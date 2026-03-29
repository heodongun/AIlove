import { notFound } from "next/navigation";

import { RoomShellEntry } from "@/components/room-shell-entry";
import { getPublicN8nConfig } from "@/lib/env";
import { UpstreamError, getPublicRoomDetail, getPublicRooms } from "@/lib/n8n";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const n8nConfig = getPublicN8nConfig();
  const detail = await getPublicRoomDetail(slug, n8nConfig).catch((error) => {
    if (error instanceof UpstreamError && error.status === 404) {
      notFound();
    }

    throw error;
  });
  let initialRooms: Awaited<ReturnType<typeof getPublicRooms>>["rooms"] = [];
  let initialRoomsError: string | null = null;

  try {
    const rooms = await getPublicRooms({ limit: 24 }, n8nConfig);
    initialRooms = rooms.rooms;
  } catch (error) {
    initialRoomsError =
      error instanceof Error ? error.message : "채팅방 목록을 불러오지 못했어요.";
  }

  return (
    <RoomShellEntry
      initialDetail={detail}
      initialRooms={initialRooms}
      initialRoomsError={initialRoomsError}
      n8nConfig={n8nConfig}
    />
  );
}
