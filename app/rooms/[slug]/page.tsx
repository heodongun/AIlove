import { notFound } from "next/navigation";

import { RoomShellEntry } from "@/components/room-shell-entry";
import { UpstreamError, getPublicRoomDetail, getPublicRooms } from "@/lib/n8n";

export const dynamic = "force-dynamic";

async function loadRoomDetail(slug: string) {
  try {
    return await getPublicRoomDetail(slug);
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await loadRoomDetail(slug);
  let initialRooms: Awaited<ReturnType<typeof getPublicRooms>>["rooms"] = [];
  let initialRoomsError: string | null = null;

  try {
    const rooms = await getPublicRooms({ limit: 24 });
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
    />
  );
}
