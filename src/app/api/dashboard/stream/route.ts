import { prisma } from "@/lib/prisma";
import { sessionEvents } from "@/lib/sessionEvents";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendSession = async (sessionId: string): Promise<void> => {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          include: { task: true, result: true, participant: true },
        });
        if (!session) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(session)}\n\n`));
      };

      unsubscribe = sessionEvents.subscribe((sessionId) => {
        void sendSession(sessionId);
      });

      request.signal.addEventListener("abort", () => {
        unsubscribe?.();
        controller.close();
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
