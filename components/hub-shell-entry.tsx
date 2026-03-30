"use client";

import dynamic from "next/dynamic";

import { ShellFallback } from "@/components/shell-fallback";
import type {
  HubRoomDetailPayload,
  HubRoomSummary,
  PublicN8nConfig,
} from "@/lib/types";

const HubShell = dynamic(
  () => import("@/components/hub-shell").then((module) => module.HubShell),
  {
    ssr: false,
    loading: () => (
      <ShellFallback
        description="허브 공간과 에이전트 움직임을 연결하고 있습니다."
        title="허브를 여는 중입니다"
      />
    ),
  },
);

export function HubShellEntry({
  initialDetail,
  initialRooms,
  initialRoomsError,
  n8nConfig,
}: {
  initialDetail: HubRoomDetailPayload;
  initialRooms: HubRoomSummary[];
  initialRoomsError: string | null;
  n8nConfig: PublicN8nConfig;
}) {
  return (
    <HubShell
      initialDetail={initialDetail}
      initialRooms={initialRooms}
      initialRoomsError={initialRoomsError}
      n8nConfig={n8nConfig}
    />
  );
}
