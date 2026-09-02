import { NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { transitionErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { sessionEvents } from "@/lib/sessionEvents";
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

  try {
    await prisma.$transaction([
      prisma.report.create({
        data: { sessionId: session.id, text: body.text },
      }),
      prisma.session.update({
        where: { id: session.id },
        data: { state: "REPORT_SUBMITTED" },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Report already submitted for this session" },
        { status: 400 }
      );
    }
    throw error;
  }

  const pings = await prisma.locationPing.findMany({
    where: { sessionId: session.id },
  });

  let score: ScoreResponseBody;
  try {
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
      throw new Error(`Verification service responded with ${scoreResponse.status}`);
    }

    score = await scoreResponse.json();
  } catch {
    // Roll back so the session isn't left stranded in REPORT_SUBMITTED with
    // no way to retry: a fetch failure (e.g. ECONNREFUSED) throws here just
    // like a non-2xx response, so both paths need the same rollback.
    await prisma.$transaction([
      prisma.report.delete({ where: { sessionId: session.id } }),
      prisma.session.update({
        where: { id: session.id },
        data: { state: "ENDED" },
      }),
    ]);

    return NextResponse.json(
      { error: "Verification service request failed" },
      { status: 502 }
    );
  }

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

  sessionEvents.emit(updatedSession.id);

  return NextResponse.json({ session: updatedSession, result });
}
