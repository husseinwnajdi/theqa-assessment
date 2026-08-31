import { NextResponse } from "next/server";

import { transitionErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { assertCanSubmitReport, resolveVerificationState } from "@/lib/sessionTransitions";

const VERIFICATION_SERVICE_URL =
  process.env.VERIFICATION_SERVICE_URL ?? "http://localhost:8000";

interface ReportBody {
  text: string;
}

interface ScoreResponseBody {
  confidenceScore: number;
  reasons: string[];
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: { task: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    assertCanSubmitReport(session.state);
  } catch (error) {
    return transitionErrorResponse(error);
  }

  const body: ReportBody = await request.json();

  await prisma.$transaction([
    prisma.report.create({
      data: { sessionId: session.id, text: body.text },
    }),
    prisma.session.update({
      where: { id: session.id },
      data: { state: "REPORT_SUBMITTED" },
    }),
  ]);

  const pings = await prisma.locationPing.findMany({
    where: { sessionId: session.id },
  });

  const scoreResponse = await fetch(`${VERIFICATION_SERVICE_URL}/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetLat: session.task.targetLat,
      targetLng: session.task.targetLng,
      radiusMeters: session.task.radiusMeters,
      pings: pings.map((ping) => ({
        lat: ping.lat,
        lng: ping.lng,
        accuracyMeters: ping.accuracyMeters,
        timestamp: ping.timestamp,
      })),
      reportText: body.text,
    }),
  });

  if (!scoreResponse.ok) {
    return NextResponse.json(
      { error: "Verification service request failed" },
      { status: 502 }
    );
  }

  const score: ScoreResponseBody = await scoreResponse.json();
  const finalState = resolveVerificationState(score.confidenceScore);

  const [result, updatedSession] = await prisma.$transaction([
    prisma.verificationResult.create({
      data: {
        sessionId: session.id,
        confidenceScore: score.confidenceScore,
        reasons: score.reasons,
      },
    }),
    prisma.session.update({
      where: { id: session.id },
      data: { state: finalState },
    }),
  ]);

  return NextResponse.json({ session: updatedSession, result });
}
