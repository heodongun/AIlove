import { NextResponse } from "next/server";

import { UpstreamError, getPublicRoomDetail } from "@/lib/n8n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const payload = await getPublicRoomDetail(slug);

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
        : "채팅방을 가져오는 중 오류가 발생했어요.";

    return NextResponse.json({ message }, { status });
  }
}
