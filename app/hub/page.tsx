import { HubShellEntry } from "@/components/hub-shell-entry";
import { getPublicN8nConfig } from "@/lib/env";
import { getPublicHubRoomDetail, getPublicHubRooms } from "@/lib/n8n";

export const dynamic = "force-dynamic";

export default async function HubHome() {
  const n8nConfig = getPublicN8nConfig();
  const roomsPayload = await getPublicHubRooms(n8nConfig);
  const initialRooms = roomsPayload.rooms;

  if (!initialRooms[0]?.slug) {
    throw new Error("허브 방을 찾지 못했습니다.");
  }

  const initialDetail = await getPublicHubRoomDetail(initialRooms[0].slug, n8nConfig);

  return (
    <HubShellEntry
      initialDetail={initialDetail}
      initialRooms={initialRooms}
      initialRoomsError={null}
      n8nConfig={n8nConfig}
    />
  );
}
