"use client";

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
  latestMessageCursor,
  mergeMessages,
  updateRoomsWithLatestMessages,
} from "@/lib/room-utils";
import type { Message, RoomDetailPayload, RoomSummary } from "@/lib/types";

export function RoomShell({
  initialDetail,
  initialRooms,
  initialRoomsError,
}: {
  initialDetail: RoomDetailPayload;
  initialRooms: RoomSummary[];
  initialRoomsError: string | null;
}) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [query, setQuery] = useState("");
  const [roomsError, setRoomsError] = useState(initialRoomsError);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [messages, setMessages] = useState(initialDetail.messages);
  const [serverTime, setServerTime] = useState(initialDetail.serverTime);
  const [isDetailRefreshing, setIsDetailRefreshing] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastMessage = messages.at(-1) ?? null;
  const messageCursor = latestMessageCursor(messages);

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

  const fetchRooms = async () => {
    const params = new URLSearchParams();
    params.set("limit", "24");

    if (deferredQuery.trim()) {
      params.set("q", deferredQuery.trim());
    }

    try {
      const response = await fetch(`/api/rooms?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | { rooms: RoomSummary[] }
        | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in payload && payload.message
            ? payload.message
            : "채팅방 목록을 불러오지 못했어요.",
        );
      }

      if ("rooms" in payload) {
        setRooms(payload.rooms);
        setRoomsError(null);
      }
    } catch (error) {
      setRoomsError(
        error instanceof Error ? error.message : "채팅방 목록을 불러오지 못했어요.",
      );
    }
  };

  const refreshRooms = useEffectEvent(fetchRooms);

  const fetchUpdates = async () => {
    if (document.visibilityState === "hidden") {
      return;
    }

    setIsDetailRefreshing(true);
    const lastMessage = messages.at(-1);
    const wasPinned = isPinnedToBottom();
    const params = new URLSearchParams();

    if (lastMessage?.postedAt) {
      params.set("after", lastMessage.postedAt);
      params.set("afterId", String(lastMessage.id));
    }

    try {
      const response = await fetch(
        `/api/rooms/${initialDetail.room.slug}/updates?${params.toString()}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as
        | { messages: Message[]; serverTime: string }
        | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in payload && payload.message
            ? payload.message
            : "새 메시지를 가져오지 못했어요.",
        );
      }

      if ("messages" in payload) {
        if (payload.messages.length > 0) {
          startTransition(() => {
            setMessages((current) => mergeMessages(current, payload.messages));
            setServerTime(payload.serverTime);
            setRooms((current) =>
              updateRoomsWithLatestMessages(
                current,
                initialDetail.room.slug,
                payload.messages,
              ),
            );
          });

          if (wasPinned) {
            window.requestAnimationFrame(() => scrollToBottom("smooth"));
          }
        } else {
          setServerTime(payload.serverTime);
        }

        setDetailError(null);
      }
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "새 메시지를 가져오지 못했어요.",
      );
    } finally {
      setIsDetailRefreshing(false);
    }
  };

  const refreshUpdates = useEffectEvent(fetchUpdates);

  useEffect(() => {
    scrollToBottom("auto");
  }, []);

  useEffect(() => {
    void refreshRooms();
  }, [deferredQuery]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshRooms();
    }, 5_000);

    return () => window.clearInterval(intervalId);
  }, [deferredQuery]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshUpdates();
    }, 8_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();

    if (messageCursor.after) {
      params.set("after", messageCursor.after);
    }

    if (messageCursor.afterId) {
      params.set("afterId", messageCursor.afterId);
    }

    const stream = new EventSource(
      `/api/rooms/${initialDetail.room.slug}/stream${params.toString() ? `?${params.toString()}` : ""}`,
    );

    const handleMessages = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as {
        messages: Message[];
        serverTime: string;
      };

      if (!payload.messages.length) {
        return;
      }

      const wasPinned = isPinnedToBottom();

      startTransition(() => {
        setMessages((current) => mergeMessages(current, payload.messages));
        setServerTime(payload.serverTime);
        setRooms((current) =>
          updateRoomsWithLatestMessages(
            current,
            initialDetail.room.slug,
            payload.messages,
          ),
        );
      });

      if (wasPinned) {
        window.requestAnimationFrame(() => scrollToBottom("smooth"));
      }
    };

    const handleError = () => {
      stream.close();
    };

    stream.addEventListener("messages", handleMessages as EventListener);
    stream.addEventListener("error", handleError);

    return () => {
      stream.removeEventListener("messages", handleMessages as EventListener);
      stream.removeEventListener("error", handleError);
      stream.close();
    };
  }, [
    initialDetail.room.slug,
    lastMessage?.id,
    lastMessage?.postedAt,
    messageCursor.after,
    messageCursor.afterId,
  ]);

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

  return (
    <main className="messenger-stage">
      <div className="messenger-app">
        <MessengerRail roomCount={rooms.length} />

        <section className="flex min-h-0 flex-col overflow-hidden border-r border-[color:var(--line)] bg-[color:var(--sidebar)]">
          <SidebarHeader
            actions={
              <>
                <ActionChipButton
                  label="새로고침"
                  onClick={() => {
                    void fetchRooms();
                  }}
                />
                <ThemeToggle />
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
            {visibleRooms.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <div>
                  <p className="text-[17px] font-semibold text-[var(--foreground)]">
                    보이는 채팅방이 없습니다
                  </p>
                  <p className="mt-2 text-[14px] leading-6 text-[var(--subtle-foreground)]">
                    검색어를 바꾸거나 새 메시지를 기다려 보세요.
                  </p>
                </div>
              </div>
            ) : (
              visibleRooms.map((room) => (
                <RoomListItem
                  key={room.id}
                  active={room.slug === initialDetail.room.slug}
                  onSelect={(slug) => {
                    if (slug !== initialDetail.room.slug) {
                      router.push(`/rooms/${slug}`);
                    }
                  }}
                  room={room}
                />
              ))
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden bg-[color:var(--thread-pane)]">
          <ConversationHeader
            actions={
              <ActionChipButton
                label={isDetailRefreshing ? "확인 중" : "지금 확인"}
                onClick={() => {
                  void fetchUpdates();
                }}
              />
            }
            participants={initialDetail.participants}
            room={initialDetail.room}
            serverTime={serverTime}
          />

          {detailError ? (
            <div className="border-b border-[color:var(--line)] bg-[color:var(--danger-soft)] px-5 py-3 text-[13px] text-[var(--danger)]">
              {detailError}
            </div>
          ) : null}

          <ChatTimeline
            emptyCopy="owner 루프가 메시지를 넣으면 여기 바로 반영됩니다."
            messages={messages}
            participants={initialDetail.participants}
            scrollRef={scrollRef}
          />

          <ReadOnlyComposer
            cta={
              <ActionChipButton
                label={isDetailRefreshing ? "확인 중" : "새로고침"}
                onClick={() => {
                  void fetchUpdates();
                }}
              />
            }
            isRefreshing={isDetailRefreshing}
            secondaryAction={
              <ActionChipButton
                label="맨 아래"
                onClick={() => {
                  scrollToBottom("smooth");
                }}
              />
            }
          />
        </section>
      </div>
    </main>
  );
}
