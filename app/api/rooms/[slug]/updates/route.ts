import { NextResponse } from "next/server";

import { UpstreamError, getPublicRoomUpdates } from "@/lib/n8n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);

  try {
    const payload = await getPublicRoomUpdates(slug, {
      after: searchParams.get("after") ?? undefined,
      afterId: searchParams.get("afterId") ?? undefined,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 500;
    const message =
      error instanceof Error
        ? error.message
        : "새 메시지를 가져오는 중 오류가 발생했어요.";

    return NextResponse.json({ message }, { status });
  }
}
