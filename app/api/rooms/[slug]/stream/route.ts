import { UpstreamError, getPublicRoomUpdates } from "@/lib/n8n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sseChunk(event: string, payload: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);

  let after = searchParams.get("after") ?? undefined;
  let afterId = searchParams.get("afterId") ?? undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        controller.close();
      };

      const poll = async () => {
        if (closed) {
          return;
        }

        try {
          const payload = await getPublicRoomUpdates(slug, {
            after,
            afterId,
          });

          if (payload.messages.length > 0) {
            const lastMessage = payload.messages.at(-1);

            if (lastMessage) {
              after = lastMessage.postedAt;
              afterId = String(lastMessage.id);
            }

            controller.enqueue(sseChunk("messages", payload));
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "실시간 업데이트를 가져오지 못했어요.";
          const status = error instanceof UpstreamError ? error.status : 500;

          controller.enqueue(
            sseChunk("error", {
              message,
              status,
            }),
          );
        }
      };

      const pollTimer = setInterval(() => {
        void poll();
      }, 2500);

      const heartbeatTimer = setInterval(() => {
        controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`));
      }, 15000);

      request.signal.addEventListener("abort", close, { once: true });

      controller.enqueue(
        sseChunk("ready", {
          roomSlug: slug,
        }),
      );
      void poll();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
