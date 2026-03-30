"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActionChipButton,
  MessengerRail,
  RefreshIcon,
  RelationshipFilterBar,
  RoomListItem,
  SidebarHeader,
} from "@/components/messenger-ui";
import { RoomStoryPane } from "@/components/room-story-pane";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  matchesRelationshipFilter,
  matchesRoomQuery,
  mergeMessageMeta,
  mergeMessages,
  updateRoomsWithLatestMessages,
} from "@/lib/room-utils";
import {
  getPublicRoomDetail,
  getPublicRoomUpdates,
  getPublicRooms,
  submitMessageReaction,
  submitSceneVote,
} from "@/lib/n8n";
import type {
  PublicN8nConfig,
  RelationshipFilter,
  RoomDetailPayload,
  RoomSummary,
} from "@/lib/types";
import {
  getOrCreateViewerId,
  readDramaModePreference,
  readInfoPanelPreference,
  readSavedHighlights,
  toggleSavedHighlight,
  writeDramaModePreference,
  writeInfoPanelPreference,
} from "@/lib/viewer";

function ThreadPlaceholder() {
  return (
    <div className="room-wallpaper flex flex-1 items-center justify-center px-6 py-10">
      <div className="max-w-lg rounded-[28px] border border-[color:var(--line)] bg-[var(--card-surface)] px-7 py-7 text-center shadow-[var(--shadow-soft)]">
        <p className="text-[26px] font-bold tracking-[-0.03em] text-[var(--foreground)]">
          채팅방을 선택하세요
        </p>
        <p className="mt-3 text-[14px] leading-6 text-[var(--subtle-foreground)]">
          왼쪽 목록에서 장면을 고르면 현재 관계 상태, 감정 변화, 투표와 실시간 대화가
          함께 열립니다.
        </p>
      </div>
    </div>
  );
}

function applyDetailToRooms(rooms: RoomSummary[], detail: RoomDetailPayload) {
  return rooms.map((room) =>
    room.slug === detail.room.slug
      ? {
          ...room,
          currentSituation: detail.currentSituation,
          dominantPair:
            detail.relationshipSnapshot.dominantPair ?? room.dominantPair ?? null,
          highlightQuote: detail.highlight?.quote ?? room.highlightQuote,
          openScenePoll: detail.scenePoll,
          relationshipSnapshot: detail.relationshipSnapshot,
        }
      : room,
  );
}

export function HomeShell({
  initialRooms,
  initialError,
  initialFilters,
  initialDetail,
  initialDetailError,
  n8nConfig,
}: {
  initialRooms: RoomSummary[];
  initialError: string | null;
  initialFilters: {
    type: string;
    q: string;
    stage: RelationshipFilter;
  };
  initialDetail: RoomDetailPayload | null;
  initialDetailError: string | null;
  n8nConfig: PublicN8nConfig;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [rooms, setRooms] = useState(initialRooms);
  const [query, setQuery] = useState(initialFilters.q);
  const deferredQuery = useDeferredValue(query);
  const [relationshipFilter, setRelationshipFilter] = useState<RelationshipFilter>(
    initialFilters.stage,
  );
  const [activeSlug, setActiveSlug] = useState(
    initialDetail?.room.slug ?? initialRooms[0]?.slug ?? null,
  );
  const [detail, setDetail] = useState<RoomDetailPayload | null>(initialDetail);
  const [roomsError, setRoomsError] = useState(initialError);
  const [detailError, setDetailError] = useState(initialDetailError);
  const [isRoomsLoading, setIsRoomsLoading] = useState(
    initialRooms.length === 0 && !initialError,
  );
  const [isDetailLoading, setIsDetailLoading] = useState(!initialDetail && initialRooms.length > 0);
  const [isDetailRefreshing, setIsDetailRefreshing] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [reactingMessageId, setReactingMessageId] = useState<number | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [metaExpanded, setMetaExpanded] = useState(true);
  const [dramaMode, setDramaMode] = useState(true);
  const [savedHighlightKeys, setSavedHighlightKeys] = useState<Set<string>>(new Set());
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  };

  const isPinnedToBottom = () => {
    const container = scrollRef.current;
    if (!container) {
      return true;
    }

    return container.scrollHeight - container.scrollTop - container.clientHeight < 120;
  };

  const fetchRooms = async (silent = false) => {
    if (!silent) {
      setIsRoomsLoading(rooms.length === 0);
    }

    try {
      const payload = await getPublicRooms(
        {
          limit: 24,
          q: deferredQuery.trim() || undefined,
        },
        n8nConfig,
      );

      startTransition(() => {
        setRooms(payload.rooms);
        setRoomsError(null);
      });
    } catch (error) {
      setRoomsError(
        error instanceof Error ? error.message : "채팅방 목록을 불러오지 못했어요.",
      );
    } finally {
      setIsRoomsLoading(false);
    }
  };

  const refreshRooms = useEffectEvent(fetchRooms);

  const fetchRoomDetail = async (slug: string, silent = false) => {
    if (!silent) {
      setIsDetailLoading(true);
    }

    try {
      const payload = await getPublicRoomDetail(slug, n8nConfig, {
        deviceId: viewerId ?? undefined,
      });

      startTransition(() => {
        setDetail(payload);
        setDetailError(null);
        setRooms((current) => applyDetailToRooms(current, payload));
      });

      window.requestAnimationFrame(() => scrollToBottom("auto"));
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "대화방을 불러오지 못했어요.",
      );
    } finally {
      setIsDetailLoading(false);
    }
  };

  const loadRoomDetail = useEffectEvent(fetchRoomDetail);

  const fetchUpdates = async () => {
    if (
      document.visibilityState === "hidden" ||
      !activeSlug ||
      !detail ||
      detail.room.slug !== activeSlug
    ) {
      return;
    }

    const cursor = detail.messages.at(-1);
    const pinned = isPinnedToBottom();
    setIsDetailRefreshing(true);

    try {
      const payload = await getPublicRoomUpdates(
        activeSlug,
        {
          after: cursor?.postedAt,
          afterId: cursor ? String(cursor.id) : undefined,
          deviceId: viewerId ?? undefined,
        },
        n8nConfig,
      );

      const mergedMessages = mergeMessageMeta(
        mergeMessages(detail.messages, payload.messages),
        payload.messageMeta,
      );
      const nextDetail: RoomDetailPayload = {
        ...detail,
        messages: mergedMessages,
        relationshipSnapshot: payload.relationshipSnapshot ?? detail.relationshipSnapshot,
        emotionTimeline:
          payload.emotionTimeline.length > 0
            ? payload.emotionTimeline
            : detail.emotionTimeline,
        highlight: payload.highlight ?? detail.highlight,
        scenePoll: payload.scenePoll ?? detail.scenePoll,
        viewerState: payload.viewerState ?? detail.viewerState,
        currentSituation: payload.currentSituation ?? detail.currentSituation,
        serverTime: payload.serverTime,
      };

      startTransition(() => {
        setDetail(nextDetail);
        setRooms((roomList) =>
          applyDetailToRooms(
            updateRoomsWithLatestMessages(roomList, activeSlug, payload.messages),
            nextDetail,
          ),
        );
        setDetailError(null);
      });

      if (payload.messages.length > 0 && pinned) {
        window.requestAnimationFrame(() => scrollToBottom(dramaMode ? "smooth" : "auto"));
      }
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "실시간 업데이트를 가져오지 못했어요.",
      );
    } finally {
      setIsDetailRefreshing(false);
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
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncLayout = () => {
      setIsCompactLayout(mediaQuery.matches);
    };

    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);

    return () => {
      mediaQuery.removeEventListener("change", syncLayout);
    };
  }, []);

  useEffect(() => {
    setViewerId(getOrCreateViewerId());
    setDramaMode(readDramaModePreference(true));
    setMetaExpanded(readInfoPanelPreference(true));
    setSavedHighlightKeys(readSavedHighlights());
  }, []);

  useEffect(() => {
    void refreshRooms(true);
  }, [deferredQuery]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshRooms(true);
    }, 5_000);

    return () => window.clearInterval(intervalId);
  }, [deferredQuery]);

  useEffect(() => {
    if (!visibleRooms.length) {
      return;
    }

    if (!activeSlug || !visibleRooms.some((room) => room.slug === activeSlug)) {
      setActiveSlug(visibleRooms[0]?.slug ?? null);
    }
  }, [activeSlug, visibleRooms]);

  useEffect(() => {
    if (!activeSlug || isCompactLayout) {
      return;
    }

    if (detail?.room.slug === activeSlug && detail.viewerState?.deviceId === viewerId) {
      return;
    }

    void loadRoomDetail(activeSlug, false);
  }, [activeSlug, detail?.room.slug, detail?.viewerState?.deviceId, viewerId, isCompactLayout]);

  useEffect(() => {
    if (isCompactLayout || !activeSlug) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshUpdates();
    }, 2_500);

    return () => window.clearInterval(intervalId);
  }, [activeSlug, isCompactLayout]);

  const activeRoom =
    visibleRooms.find((room) => room.slug === activeSlug) ??
    rooms.find((room) => room.slug === activeSlug) ??
    null;

  const highlightKey =
    detail?.highlight && activeRoom
      ? `${activeRoom.slug}:${detail.highlight.messageId ?? detail.highlight.createdAt}`
      : null;

  return (
    <main className="messenger-stage">
      <div className="messenger-app">
        <MessengerRail roomCount={rooms.length} />

        <section className="flex min-h-0 flex-col overflow-hidden border-r border-[color:var(--line)] bg-[color:var(--sidebar)] lg:max-w-[332px]">
          <SidebarHeader
            actions={
              <>
                <ActionChipButton
                  icon={<RefreshIcon className="h-4 w-4" />}
                  className="flex-1 sm:flex-none"
                  disabled={isRoomsLoading}
                  label={isRoomsLoading ? "불러오는 중" : "새로고침"}
                  onClick={() => {
                    void fetchRooms(false);
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
            roomCount={visibleRooms.length}
          />

          {roomsError ? (
            <div className="border-b border-[color:var(--line)] bg-[color:var(--danger-soft)] px-5 py-3 text-[13px] text-[var(--danger)]">
              {roomsError}
            </div>
          ) : null}

          <div className="messenger-scroll flex-1 px-2.5 py-2.5 sm:px-3 sm:py-3">
            {isRoomsLoading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[124px] animate-pulse rounded-[20px] bg-[var(--sidebar-selected)]"
                  />
                ))}
              </div>
            ) : visibleRooms.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <div>
                  <p className="text-[17px] font-semibold text-[var(--foreground)]">
                    보이는 채팅방이 없습니다
                  </p>
                  <p className="mt-2 text-[14px] leading-6 text-[var(--subtle-foreground)]">
                    검색어나 필터를 바꾸거나 새 장면이 열리길 기다려 보세요.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {visibleRooms.map((room) => (
                  <RoomListItem
                    key={room.id}
                    active={room.slug === activeRoom?.slug}
                    onSelect={(slug) => {
                      if (isCompactLayout) {
                        router.push(`/rooms/${slug}`);
                        return;
                      }

                      setActiveSlug(slug);
                    }}
                    room={room}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="hidden min-h-0 flex-col overflow-hidden lg:flex">
          {detail && activeRoom ? (
            <>
              {detailError ? (
                <div className="border-b border-[color:var(--line)] bg-[color:var(--danger-soft)] px-5 py-3 text-[13px] text-[var(--danger)]">
                  {detailError}
                </div>
              ) : null}

              {isDetailLoading ? (
                <div className="room-wallpaper flex flex-1 items-center justify-center px-6">
                  <div className="w-full max-w-3xl space-y-4">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        className={`h-16 animate-pulse rounded-[20px] bg-[var(--card-surface)] ${
                          index % 2 === 0 ? "mr-auto w-2/3" : "ml-auto w-1/2"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <RoomStoryPane
                  detail={detail}
                  dramaMode={dramaMode}
                  emptyCopy="owner 루프가 메시지를 넣으면 여기 바로 반영됩니다."
                  isRefreshing={isDetailRefreshing}
                  isVoting={isVoting}
                  metaExpanded={metaExpanded}
                  onReact={async (messageId, emoji) => {
                    if (!viewerId) {
                      return;
                    }

                    try {
                      setReactingMessageId(messageId);
                      const response = await submitMessageReaction(
                        messageId,
                        {
                          emoji,
                          deviceId: viewerId,
                        },
                        n8nConfig,
                      );

                      startTransition(() => {
                        setDetail((current) =>
                          current
                            ? {
                                ...current,
                                messages: current.messages.map((message) =>
                                  message.id === response.messageId
                                    ? { ...message, reactions: response.reactions }
                                    : message,
                                ),
                              }
                            : current,
                        );
                      });
                    } catch (error) {
                      setDetailError(
                        error instanceof Error
                          ? error.message
                          : "반응을 남기지 못했어요.",
                      );
                    } finally {
                      setReactingMessageId(null);
                    }
                  }}
                  onRefresh={() => {
                    if (activeSlug) {
                      void fetchRoomDetail(activeSlug, false);
                    }
                  }}
                  onShareHighlight={async (text) => {
                    try {
                      await navigator.clipboard.writeText(text);
                    } catch {
                      setDetailError("명대사 복사에 실패했어요.");
                    }
                  }}
                  onToggleDrama={() => {
                    setDramaMode((current) => {
                      const next = !current;
                      writeDramaModePreference(next);
                      return next;
                    });
                  }}
                  onToggleMeta={() => {
                    setMetaExpanded((current) => {
                      const next = !current;
                      writeInfoPanelPreference(next);
                      return next;
                    });
                  }}
                  onToggleSaveHighlight={() => {
                    if (!highlightKey) {
                      return;
                    }

                    setSavedHighlightKeys(toggleSavedHighlight(highlightKey));
                  }}
                  onVote={async (sceneId, optionId) => {
                    if (!viewerId || !activeSlug) {
                      return;
                    }

                    try {
                      setIsVoting(true);
                      const response = await submitSceneVote(
                        activeSlug,
                        {
                          sceneId,
                          optionId,
                          deviceId: viewerId,
                        },
                        n8nConfig,
                      );

                      startTransition(() => {
                        setDetail((current) =>
                          current
                            ? {
                                ...current,
                                scenePoll: response.scenePoll,
                                viewerState: response.viewerState,
                              }
                            : current,
                        );
                      });
                    } catch (error) {
                      setDetailError(
                        error instanceof Error
                          ? error.message
                          : "투표를 반영하지 못했어요.",
                      );
                    } finally {
                      setIsVoting(false);
                    }
                  }}
                  reactingMessageId={reactingMessageId}
                  savedHighlight={highlightKey ? savedHighlightKeys.has(highlightKey) : false}
                  scrollRef={scrollRef}
                  serverTime={detail.serverTime}
                />
              )}
            </>
          ) : (
            <ThreadPlaceholder />
          )}
        </section>
      </div>
    </main>
  );
}
