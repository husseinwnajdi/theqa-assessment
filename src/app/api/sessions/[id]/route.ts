import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isStale } from "@/lib/sessionTransitions";

const include = { task: true, pings: true, report: true, result: true } as const;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include,
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (isStale(session.state, session.lastPingAt, new Date())) {
    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { state: "ENDED", endedAt: new Date() },
      include,
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json(session);
}
