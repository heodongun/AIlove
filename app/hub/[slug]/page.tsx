import { notFound } from "next/navigation";

import { HubShellEntry } from "@/components/hub-shell-entry";
import { getPublicN8nConfig } from "@/lib/env";
import {
  UpstreamError,
  getPublicHubRoomDetail,
  getPublicHubRooms,
} from "@/lib/n8n";
import type { HubRoomSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HubRoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const n8nConfig = getPublicN8nConfig();
  const detail = await getPublicHubRoomDetail(slug, n8nConfig).catch((error) => {
    if (error instanceof UpstreamError && error.status === 404) {
      notFound();
    }

    throw error;
  });
  let initialRooms: HubRoomSummary[] = [];
  let initialRoomsError: string | null = null;

  try {
    const roomsPayload = await getPublicHubRooms(n8nConfig);
    initialRooms = roomsPayload.rooms;
  } catch (error) {
    initialRoomsError =
      error instanceof Error ? error.message : "허브 목록을 불러오지 못했어요.";
  }

  return (
    <HubShellEntry
      initialDetail={detail}
      initialRooms={initialRooms}
      initialRoomsError={initialRoomsError}
      n8nConfig={n8nConfig}
    />
  );
}
