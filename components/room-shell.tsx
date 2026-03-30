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

export function RoomShell({
  initialDetail,
  initialRooms,
  initialRoomsError,
  n8nConfig,
}: {
  initialDetail: RoomDetailPayload;
  initialRooms: RoomSummary[];
  initialRoomsError: string | null;
  n8nConfig: PublicN8nConfig;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [rooms, setRooms] = useState(initialRooms);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [relationshipFilter, setRelationshipFilter] = useState<RelationshipFilter>("all");
  const [detail, setDetail] = useState(initialDetail);
  const [roomsError, setRoomsError] = useState(initialRoomsError);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [reactingMessageId, setReactingMessageId] = useState<number | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [metaExpanded, setMetaExpanded] = useState(true);
  const [dramaMode, setDramaMode] = useState(true);
  const [savedHighlightKeys, setSavedHighlightKeys] = useState<Set<string>>(new Set());

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

  const fetchRooms = async () => {
    try {
      const payload = await getPublicRooms(
        {
          limit: 24,
          q: deferredQuery.trim() || undefined,
        },
        n8nConfig,
      );
      startTransition(() => {
        setRooms(applyDetailToRooms(payload.rooms, detail));
        setRoomsError(null);
      });
    } catch (error) {
      setRoomsError(
        error instanceof Error ? error.message : "채팅방 목록을 불러오지 못했어요.",
      );
    }
  };

  const refreshRooms = useEffectEvent(fetchRooms);

  const fetchDetail = async (slug: string, silent = false) => {
    if (!silent) {
      setIsRefreshing(true);
    }

    try {
      const payload = await getPublicRoomDetail(slug, n8nConfig, {
        deviceId: viewerId ?? undefined,
      });
      startTransition(() => {
        setDetail(payload);
        setRooms((current) => applyDetailToRooms(current, payload));
        setDetailError(null);
      });
      window.requestAnimationFrame(() => scrollToBottom("auto"));
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "채팅방을 다시 불러오지 못했어요.",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const reloadDetail = useEffectEvent(fetchDetail);

  const fetchUpdates = async () => {
    if (document.visibilityState === "hidden") {
      return;
    }

    const lastMessage = detail.messages.at(-1);
    const pinned = isPinnedToBottom();
    setIsRefreshing(true);

    try {
      const payload = await getPublicRoomUpdates(
        detail.room.slug,
        {
          after: lastMessage?.postedAt,
          afterId: lastMessage ? String(lastMessage.id) : undefined,
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
        setRooms((currentRooms) =>
          applyDetailToRooms(
            updateRoomsWithLatestMessages(currentRooms, detail.room.slug, payload.messages),
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
    setViewerId(getOrCreateViewerId());
    setDramaMode(readDramaModePreference(true));
    setMetaExpanded(readInfoPanelPreference(true));
    setSavedHighlightKeys(readSavedHighlights());
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => scrollToBottom("auto"));
  }, []);

  useEffect(() => {
    void refreshRooms();
  }, [deferredQuery]);

  useEffect(() => {
    if (!viewerId) {
      return;
    }

    void reloadDetail(detail.room.slug, true);
  }, [viewerId, detail.room.slug]);

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
  }, []);

  const highlightKey = detail.highlight
    ? `${detail.room.slug}:${detail.highlight.messageId ?? detail.highlight.createdAt}`
    : null;

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
            roomCount={visibleRooms.length}
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
                    보이는 채팅방이 없습니다
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
                        router.push(`/rooms/${slug}`);
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

          <RoomStoryPane
            detail={detail}
            dramaMode={dramaMode}
            emptyCopy="owner 루프가 메시지를 넣으면 여기 바로 반영됩니다."
            isRefreshing={isRefreshing}
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
                  setDetail((current) => ({
                    ...current,
                    messages: current.messages.map((message) =>
                      message.id === response.messageId
                        ? { ...message, reactions: response.reactions }
                        : message,
                    ),
                  }));
                });
              } catch (error) {
                setDetailError(
                  error instanceof Error ? error.message : "반응을 남기지 못했어요.",
                );
              } finally {
                setReactingMessageId(null);
              }
            }}
            onRefresh={() => {
              void fetchDetail(detail.room.slug, false);
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
              if (!viewerId) {
                return;
              }

              try {
                setIsVoting(true);
                const response = await submitSceneVote(
                  detail.room.slug,
                  {
                    sceneId,
                    optionId,
                    deviceId: viewerId,
                  },
                  n8nConfig,
                );

                startTransition(() => {
                  setDetail((current) => ({
                    ...current,
                    scenePoll: response.scenePoll,
                    viewerState: response.viewerState,
                  }));
                });
              } catch (error) {
                setDetailError(
                  error instanceof Error ? error.message : "투표를 반영하지 못했어요.",
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
        </div>
      </div>
    </main>
  );
}
