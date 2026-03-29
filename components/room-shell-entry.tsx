"use client";

import dynamic from "next/dynamic";

import { ShellFallback } from "@/components/shell-fallback";
import type { RoomDetailPayload, RoomSummary } from "@/lib/types";

const RoomShell = dynamic(
  () => import("@/components/room-shell").then((module) => module.RoomShell),
  {
    ssr: false,
    loading: () => (
      <ShellFallback
        description="선택한 채팅방과 실시간 메시지를 연결하고 있습니다."
        title="채팅방을 여는 중입니다"
      />
    ),
  },
);

export function RoomShellEntry({
  initialDetail,
  initialRooms,
  initialRoomsError,
}: {
  initialDetail: RoomDetailPayload;
  initialRooms: RoomSummary[];
  initialRoomsError: string | null;
}) {
  return (
    <RoomShell
      initialDetail={initialDetail}
      initialRooms={initialRooms}
      initialRoomsError={initialRoomsError}
    />
  );
}
