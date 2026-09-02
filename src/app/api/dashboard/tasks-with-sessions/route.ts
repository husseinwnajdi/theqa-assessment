import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  const tasks = await prisma.task.findMany({
    orderBy: { id: "desc" },
    include: {
      sessions: {
        orderBy: { createdAt: "desc" },
        include: {
          participant: true,
          result: true,
        },
      },
    },
  });

  return NextResponse.json(tasks);
}
