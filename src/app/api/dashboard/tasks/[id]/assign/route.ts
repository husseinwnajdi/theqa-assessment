import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

interface AssignBody {
  participantEmail: string;
  participantName: string;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const task = await prisma.task.findUnique({ where: { id: params.id } });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body: AssignBody = await request.json();

  const participant = await prisma.participant.upsert({
    where: { email: body.participantEmail },
    update: { name: body.participantName },
    create: { email: body.participantEmail, name: body.participantName },
  });

  const session = await prisma.session.create({
    data: {
      taskId: task.id,
      participantId: participant.id,
      state: "ASSIGNED",
    },
  });

  return NextResponse.json({ sessionId: session.id });
}
