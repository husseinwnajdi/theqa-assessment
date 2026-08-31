import { NextResponse } from "next/server";

import { transitionErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { assertCanStart } from "@/lib/sessionTransitions";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await prisma.session.findUnique({ where: { id: params.id } });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    assertCanStart(session.state);
  } catch (error) {
    return transitionErrorResponse(error);
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { state: "ACTIVE", startedAt: new Date() },
  });

  return NextResponse.json(updated);
}
