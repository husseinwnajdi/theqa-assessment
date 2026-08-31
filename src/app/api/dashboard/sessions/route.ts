import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  const sessions = await prisma.session.findMany({
    include: { task: true, result: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sessions);
}
