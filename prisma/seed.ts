import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const participant = await prisma.participant.upsert({
    where: { email: "jane.doe@example.com" },
    update: {},
    create: {
      name: "Jane Doe",
      email: "jane.doe@example.com",
    },
  });

  // Eiffel Tower, Paris
  const task = await prisma.task.create({
    data: {
      title: "Verify visit to the Eiffel Tower",
      description: "Confirm the participant physically visited the Eiffel Tower.",
      targetLat: 48.8584,
      targetLng: 2.2945,
      radiusMeters: 100,
    },
  });

  const session = await prisma.session.create({
    data: {
      taskId: task.id,
      participantId: participant.id,
      state: "ASSIGNED",
    },
  });

  console.log(session.id);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
