import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

interface CreateTaskBody {
  title: string;
  description: string;
  targetLat: number;
  targetLng: number;
  radiusMeters: number;
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: CreateTaskBody = await request.json();

  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      targetLat: body.targetLat,
      targetLng: body.targetLng,
      radiusMeters: body.radiusMeters,
    },
  });

  return NextResponse.json(task);
}
