import { NextResponse } from "next/server";

import { UpstreamError, getPublicRooms } from "@/lib/n8n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const payload = await getPublicRooms({
      limit: searchParams.get("limit") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      type: searchParams.get("type") ?? undefined,
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
        : "대화방 목록을 가져오는 중 오류가 발생했어요.";

    return NextResponse.json({ message }, { status });
  }
}
