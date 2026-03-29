"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import {
  ActionChipButton,
  ChatTimeline,
  ConversationHeader,
  MessengerRail,
  ReadOnlyComposer,
  RoomListItem,
  SidebarHeader,
} from "@/components/messenger-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  mergeMessages,
  updateRoomsWithLatestMessages,
} from "@/lib/room-utils";
import {
  getPublicRoomDetail,
  getPublicRoomUpdates,
  getPublicRooms,
} from "@/lib/n8n";
import type { RoomDetailPayload, RoomSummary } from "@/lib/types";

function ThreadPlaceholder() {
  return (
    <div className="room-wallpaper flex flex-1 items-center justify-center px-6 py-10">
      <div className="rounded-2xl bg-[var(--bubble-other)] px-7 py-7 text-center">
        <p className="text-[24px] font-bold tracking-[-0.03em] text-[var(--foreground)]">
          채팅방을 선택하세요
        </p>
        <p className="mt-3 text-[14px] leading-6 text-[var(--subtle-foreground)]">
          왼쪽 목록에서 방을 누르면 실제 대화가 여기 바로 열립니다.
        </p>
      </div>
    </div>
  );
}

export function HomeShell({
  initialRooms,
  initialError,
  initialFilters,
  initialDetail,
  initialDetailError,
}: {
  initialRooms: RoomSummary[];
  initialError: string | null;
  initialFilters: {
    type: string;
    q: string;
  };
  initialDetail: RoomDetailPayload | null;
  initialDetailError: string | null;
}) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [query, setQuery] = useState(initialFilters.q);
  const [activeSlug, setActiveSlug] = useState(
    initialDetail?.room.slug ?? initialRooms[0]?.slug ?? null,
  );
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [detail, setDetail] = useState<RoomDetailPayload | null>(initialDetail);
  const [roomsError, setRoomsError] = useState(initialError);
  const [detailError, setDetailError] = useState(initialDetailError);
  const [isRoomsLoading, setIsRoomsLoading] = useState(
    initialRooms.length === 0 && !initialError,
  );
  const [isDetailLoading, setIsDetailLoading] = useState(
    !initialDetail && initialRooms.length > 0,
  );
  const [isDetailRefreshing, setIsDetailRefreshing] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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

    return container.scrollHeight - container.scrollTop - container.clientHeight < 96;
  };

  const fetchRooms = async ({
    silent = false,
    forceSelection = false,
  }: {
    silent?: boolean;
    forceSelection?: boolean;
  } = {}) => {
    if (!silent) {
      setIsRoomsLoading(rooms.length === 0);
    }

    const params = new URLSearchParams();
    params.set("limit", "24");

    if (deferredQuery.trim()) {
      params.set("q", deferredQuery.trim());
    }

    try {
      const payload = await getPublicRooms({
        limit: 24,
        q: deferredQuery.trim() || undefined,
      });
      const nextRooms = payload.rooms;

      startTransition(() => {
        setRooms(nextRooms);
        setRoomsError(null);

        if (
          forceSelection ||
          !activeSlug ||
          !nextRooms.some((room) => room.slug === activeSlug)
        ) {
          setActiveSlug(nextRooms[0]?.slug ?? null);
        }
      });
    } catch (error) {
      setRoomsError(
        error instanceof Error
          ? error.message
          : "채팅방 목록을 가져오지 못했어요.",
      );
    } finally {
      setIsRoomsLoading(false);
    }
  };

  const refreshRooms = useEffectEvent(fetchRooms);

  const fetchRoomDetail = async (
    slug: string,
    {
      silent = false,
    }: {
      silent?: boolean;
    } = {},
  ) => {
    if (!slug) {
      setDetail(null);
      return;
    }

    if (!silent) {
      setIsDetailLoading(true);
    }

    try {
      const payload = await getPublicRoomDetail(slug);

      startTransition(() => {
        setDetail(payload);
        setDetailError(null);
      });
      window.requestAnimationFrame(() => scrollToBottom("auto"));
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "대화방을 열지 못했어요.",
      );
    } finally {
      setIsDetailLoading(false);
    }
  };

  const loadRoomDetail = useEffectEvent(fetchRoomDetail);

  const fetchActiveUpdates = async () => {
    if (document.visibilityState === "hidden" || !activeSlug || !detail) {
      return;
    }

    if (detail.room.slug !== activeSlug) {
      return;
    }

    setIsDetailRefreshing(true);
    const lastMessage = detail.messages.at(-1);
    const wasPinned = isPinnedToBottom();
    const params = new URLSearchParams();

    if (lastMessage?.postedAt) {
      params.set("after", lastMessage.postedAt);
      params.set("afterId", String(lastMessage.id));
    }

    try {
      const payload = await getPublicRoomUpdates(activeSlug, {
        after: params.get("after") ?? undefined,
        afterId: params.get("afterId") ?? undefined,
      });

      if (payload.messages.length > 0) {
        startTransition(() => {
          setDetail((current) => {
            if (!current || current.room.slug !== activeSlug) {
              return current;
            }

            return {
              ...current,
              messages: mergeMessages(current.messages, payload.messages),
              serverTime: payload.serverTime,
            };
          });
          setRooms((current) =>
            updateRoomsWithLatestMessages(current, activeSlug, payload.messages),
          );
        });

        if (wasPinned) {
          window.requestAnimationFrame(() => scrollToBottom("smooth"));
        }
      } else {
        setDetail((current) => {
          if (!current || current.room.slug !== activeSlug) {
            return current;
          }

          return {
            ...current,
            serverTime: payload.serverTime,
          };
        });
      }

      setDetailError(null);
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "새 메시지를 가져오지 못했어요.",
      );
    } finally {
      setIsDetailRefreshing(false);
    }
  };

  const refreshActiveUpdates = useEffectEvent(fetchActiveUpdates);

  const refreshPreview = async () => {
    await fetchRooms({ silent: true });

    if (activeSlug && !isCompactLayout) {
      await fetchRoomDetail(activeSlug, { silent: true });
    }
  };

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
    void refreshRooms({ forceSelection: true });
  }, [deferredQuery]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshRooms({ silent: true });
    }, 5_000);

    return () => window.clearInterval(intervalId);
  }, [deferredQuery]);

  useEffect(() => {
    if (!activeSlug) {
      setDetail(null);
      return;
    }

    if (isCompactLayout) {
      return;
    }

    if (detail?.room.slug === activeSlug) {
      return;
    }

    void loadRoomDetail(activeSlug);
  }, [activeSlug, detail?.room.slug, isCompactLayout]);

  useEffect(() => {
    if (isCompactLayout) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshActiveUpdates();
    }, 4_000);

    return () => window.clearInterval(intervalId);
  }, [activeSlug, detail?.room.slug, isCompactLayout]);

  const visibleRooms = rooms.filter((room) => {
    const q = deferredQuery.trim().toLowerCase();

    if (!q) {
      return true;
    }

    const text = [
      room.title,
      room.subtitle,
      room.description,
      room.lastMessagePreview,
      ...room.participants.map((participant) => participant.displayName),
      ...room.participants.map((participant) => participant.bio ?? ""),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(q);
  });

  const activeRoom =
    visibleRooms.find((room) => room.slug === activeSlug) ??
    rooms.find((room) => room.slug === activeSlug) ??
    null;

  return (
    <main className="messenger-stage">
      <div className="messenger-app">
        <MessengerRail roomCount={rooms.length} />

        <section className="flex min-h-0 flex-col overflow-hidden border-r border-[color:var(--line)] bg-[color:var(--sidebar)] lg:max-w-[360px]">
          <SidebarHeader
            actions={
              <>
                <ActionChipButton
                  className="flex-1 sm:flex-none"
                  disabled={isRoomsLoading}
                  label={isRoomsLoading ? "불러오는 중" : "새로고침"}
                  onClick={() => {
                    void fetchRooms();
                  }}
                />
                <ThemeToggle compact={isCompactLayout} />
              </>
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

          <div className="messenger-scroll flex-1 py-2">
            {isRoomsLoading ? (
              <div className="space-y-2 px-4 py-4">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[86px] animate-pulse rounded-2xl bg-white/6"
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
                    검색어를 바꾸거나 새 메시지가 올라오길 기다려 보세요.
                  </p>
                </div>
              </div>
            ) : (
              visibleRooms.map((room) => (
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
              ))
            )}
          </div>
        </section>

        <section className="hidden min-h-0 flex-col overflow-hidden bg-[color:var(--thread-pane)] lg:flex">
          {detail && activeRoom ? (
            <>
              <ConversationHeader
                actions={
                  <ActionChipButton
                    className="min-w-[96px]"
                    disabled={isDetailLoading}
                    label={isDetailRefreshing ? "확인 중" : "지금 확인"}
                    onClick={() => {
                      void refreshPreview();
                    }}
                  />
                }
                messages={detail.messages}
                participants={detail.participants}
                room={detail.room}
                serverTime={detail.serverTime}
              />

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
                        className={`h-14 animate-pulse rounded-md bg-white/10 ${
                          index % 2 === 0 ? "mr-auto w-2/3" : "ml-auto w-1/2"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <ChatTimeline
                  emptyCopy="owner 루프가 메시지를 넣으면 여기 바로 반영됩니다."
                  messages={detail.messages}
                  participants={detail.participants}
                  scrollRef={scrollRef}
                />
              )}

              <ReadOnlyComposer
                cta={
                  <Link
                    className="inline-flex min-h-10 w-full items-center justify-center rounded-full bg-[var(--composer-button)] px-4 text-[13px] font-semibold text-[var(--composer-button-text)] sm:w-auto"
                    href={`/rooms/${detail.room.slug}`}
                  >
                    입장
                  </Link>
                }
                isRefreshing={isDetailRefreshing}
                secondaryAction={
                  <ActionChipButton
                    className="w-full sm:w-auto"
                    label="지금 확인"
                    onClick={() => {
                      void refreshPreview();
                    }}
                  />
                }
              />
            </>
          ) : (
            <ThreadPlaceholder />
          )}
        </section>
      </div>
    </main>
  );
}
