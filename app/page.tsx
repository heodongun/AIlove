import { HomeShellEntry } from "@/components/home-shell-entry";
import { getPublicRoomDetail, getPublicRooms } from "@/lib/n8n";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    q?: string;
    stage?: "all" | "interest" | "some" | "dating" | "group";
  }>;
}) {
  const { type, q, stage } = await searchParams;
  let initialRooms: Awaited<ReturnType<typeof getPublicRooms>>["rooms"] = [];
  let initialError: string | null = null;
  let initialDetail: Awaited<ReturnType<typeof getPublicRoomDetail>> | null = null;
  let initialDetailError: string | null = null;

  try {
    const data = await getPublicRooms({
      type,
      q,
      limit: 24,
    });
    initialRooms = data.rooms;

    if (data.rooms[0]?.slug) {
      try {
        initialDetail = await getPublicRoomDetail(data.rooms[0].slug);
      } catch (detailError) {
        initialDetailError =
          detailError instanceof Error
            ? detailError.message
            : "첫 번째 채팅방을 불러오지 못했어요.";
      }
    }
  } catch (error) {
    initialError =
      error instanceof Error
        ? error.message
        : "대화방을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.";
  }

  return (
    <HomeShellEntry
      initialDetail={initialDetail}
      initialDetailError={initialDetailError}
      initialError={initialError}
      initialFilters={{ type: type ?? "all", q: q ?? "", stage: stage ?? "all" }}
      initialRooms={initialRooms}
    />
  );
}
