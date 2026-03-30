"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import { HubRoomPane } from "@/components/hub-room-pane";
import {
  ActionChipButton,
  MessengerRail,
  RefreshIcon,
  RelationshipFilterBar,
  RoomListItem,
  SidebarHeader,
} from "@/components/messenger-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  mergeMessages,
  matchesRelationshipFilter,
  matchesRoomQuery,
} from "@/lib/room-utils";
import {
  getPublicHubRoomDetail,
  getPublicHubRoomUpdates,
  getPublicHubRooms,
} from "@/lib/n8n";
import type {
  HubRoomDetailPayload,
  HubRoomSummary,
  PublicN8nConfig,
  RelationshipFilter,
} from "@/lib/types";

function applyDetailToRooms(
  rooms: HubRoomSummary[],
  detail: HubRoomDetailPayload,
) {
  return rooms.map((room) =>
    room.slug === detail.room.slug
      ? {
          ...room,
          currentSituation: detail.currentSituation,
          relationshipSnapshot: detail.relationshipSnapshot,
          ambientLabel: detail.room.ambientLabel,
          paletteKey: detail.room.paletteKey,
        }
      : room,
  );
}

export function HubShell({
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
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [relationshipFilter, setRelationshipFilter] =
    useState<RelationshipFilter>("all");
  const [detail, setDetail] = useState(initialDetail);
  const [roomsError, setRoomsError] = useState(initialRoomsError);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchRooms = async () => {
    try {
      const payload = await getPublicHubRooms(n8nConfig);
      startTransition(() => {
        setRooms(applyDetailToRooms(payload.rooms, detail));
        setRoomsError(null);
      });
    } catch (error) {
      setRoomsError(
        error instanceof Error ? error.message : "허브 목록을 불러오지 못했어요.",
      );
    }
  };

  const refreshRooms = useEffectEvent(fetchRooms);

  const fetchDetail = async (slug: string, silent = false) => {
    if (!silent) {
      setIsRefreshing(true);
    }

    try {
      const payload = await getPublicHubRoomDetail(slug, n8nConfig);
      startTransition(() => {
        setDetail(payload);
        setRooms((current) => applyDetailToRooms(current, payload));
        setDetailError(null);
      });
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "허브 상세를 다시 불러오지 못했어요.",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchUpdates = async () => {
    if (document.visibilityState === "hidden") {
      return;
    }

    setIsRefreshing(true);

    try {
      const payload = await getPublicHubRoomUpdates(
        detail.room.slug,
        {},
        n8nConfig,
      );

      startTransition(() => {
        const latestMessage = payload.messages.at(-1) ?? null;
        setDetail((current) => ({
          ...current,
          relationshipSnapshot: payload.relationshipSnapshot ?? current.relationshipSnapshot,
          currentSituation: payload.currentSituation ?? current.currentSituation,
          messages:
            payload.messages.length > 0
              ? mergeMessages(current.messages, payload.messages)
              : current.messages,
          interactions:
            payload.interactions.length > 0 ? payload.interactions : current.interactions,
          serverTime: payload.serverTime,
        }));
        setRooms((current) =>
          current.map((room) =>
            room.slug === detail.room.slug
              ? {
                  ...room,
                  relationshipSnapshot:
                    payload.relationshipSnapshot ?? room.relationshipSnapshot,
                  currentSituation: payload.currentSituation ?? room.currentSituation,
                  lastMessagePreview:
                    latestMessage?.content ?? room.lastMessagePreview,
                  lastMessageAt: latestMessage?.postedAt ?? room.lastMessageAt,
                }
              : room,
          ),
        );
        setDetailError(null);
      });
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "허브 실시간 상태를 불러오지 못했어요.",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshUpdates = useEffectEvent(fetchUpdates);

  const visibleRooms = useMemo(
    () =>
      rooms.filter(
        (room) =>
          matchesRelationshipFilter(room, relationshipFilter) &&
          matchesRoomQuery(room, deferredQuery),
      ),
    [deferredQuery, relationshipFilter, rooms],
  );

  useEffect(() => {
    void refreshRooms();
  }, [deferredQuery]);

  useEffect(() => {
    const roomsInterval = window.setInterval(() => {
      void refreshRooms();
    }, 5_000);
    const updatesInterval = window.setInterval(() => {
      void refreshUpdates();
    }, 2_500);

    return () => {
      window.clearInterval(roomsInterval);
      window.clearInterval(updatesInterval);
    };
  }, [detail.room.slug]);

  return (
    <main className="messenger-stage">
      <div className="messenger-app">
        <MessengerRail roomCount={rooms.length} />

        <section className="hidden min-h-0 flex-col overflow-hidden border-r border-[color:var(--line)] bg-[color:var(--sidebar)] lg:flex lg:max-w-[332px]">
          <SidebarHeader
            actions={
              <>
                <ActionChipButton
                  icon={<RefreshIcon className="h-4 w-4" />}
                  className="flex-1 sm:flex-none"
                  label="새로고침"
                  onClick={() => {
                    void fetchRooms();
                    void fetchDetail(detail.room.slug, false);
                  }}
                />
                <ThemeToggle compact />
              </>
            }
            filters={
              <RelationshipFilterBar
                activeFilter={relationshipFilter}
                onSelect={setRelationshipFilter}
              />
            }
            onChangeQuery={setQuery}
            query={query}
            refreshLabel="1.5초 시뮬레이션"
            roomCount={visibleRooms.length}
            searchPlaceholder="허브 방 이름, 상황 검색"
            subtitle="픽셀 허브 관전"
            title="허브"
          />

          {roomsError ? (
            <div className="border-b border-[color:var(--line)] bg-[color:var(--danger-soft)] px-5 py-3 text-[13px] text-[var(--danger)]">
              {roomsError}
            </div>
          ) : null}

          <div className="messenger-scroll flex-1 px-2.5 py-2.5 sm:px-3 sm:py-3">
            {visibleRooms.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <div>
                  <p className="text-[17px] font-semibold text-[var(--foreground)]">
                    보이는 허브가 없습니다
                  </p>
                  <p className="mt-2 text-[14px] leading-6 text-[var(--subtle-foreground)]">
                    검색어를 바꾸거나 다른 관계 단계 필터를 선택해 보세요.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {visibleRooms.map((room) => (
                  <RoomListItem
                    key={room.id}
                    active={room.slug === detail.room.slug}
                    onSelect={(slug) => {
                      if (slug !== detail.room.slug) {
                        router.push(`/hub/${slug}`);
                      }
                    }}
                    room={room}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="flex min-h-0 flex-col overflow-hidden">
          {detailError ? (
            <div className="border-b border-[color:var(--line)] bg-[color:var(--danger-soft)] px-5 py-3 text-[13px] text-[var(--danger)]">
              {detailError}
            </div>
          ) : null}

          <HubRoomPane
            key={detail.room.slug}
            detail={detail}
            isRefreshing={isRefreshing}
            onRefresh={() => {
              void fetchDetail(detail.room.slug, false);
            }}
          />
        </div>
      </div>
    </main>
  );
}
