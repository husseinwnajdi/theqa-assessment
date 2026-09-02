import { NextResponse } from "next/server";

import { transitionErrorResponse } from "@/lib/api-errors";
import { haversineMeters } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { sessionEvents } from "@/lib/sessionEvents";
import { assertCanPing } from "@/lib/sessionTransitions";

interface PingBody {
  lat: number;
  lng: number;
  accuracyMeters: number;
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
    assertCanPing(session.state);
  } catch (error) {
    return transitionErrorResponse(error);
  }

  const body: PingBody = await request.json();
  const now = new Date();

  const distanceMeters = haversineMeters(
    body.lat,
    body.lng,
    session.task.targetLat,
    session.task.targetLng
  );
  const inRange = distanceMeters <= session.task.radiusMeters;

  const [ping] = await prisma.$transaction([
    prisma.locationPing.create({
      data: {
        sessionId: session.id,
        lat: body.lat,
        lng: body.lng,
        accuracyMeters: body.accuracyMeters,
      },
    }),
    prisma.session.update({
      where: { id: session.id },
      data: {
        lastPingAt: now,
        lastPingDistanceMeters: distanceMeters,
        lastPingInRange: inRange,
      },
    }),
  ]);

  sessionEvents.emit(session.id);

  return NextResponse.json(ping);
}
