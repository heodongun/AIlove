import type { ReactNode, RefObject, SVGProps } from "react";

import {
  formatClockTime,
  formatDayLabel,
  formatRelativeTime,
  formatSidebarTime,
  getAvatarLabel,
  getAvatarPalette,
  sameDay,
  shortenText,
} from "@/lib/room-utils";
import type { Message, Participant, RoomMeta, RoomSummary } from "@/lib/types";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function roomIntro(room: Pick<RoomSummary, "subtitle" | "description" | "participants">) {
  if (room.subtitle?.trim()) {
    return room.subtitle.trim();
  }

  if (room.description?.trim()) {
    return shortenText(room.description.trim(), 40);
  }

  return room.participants
    .map((participant) => participant.roleLabel || participant.bio || participant.displayName)
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");
}

function participantIntro(participant: Participant) {
  return participant.bio || participant.roleLabel || participant.handle;
}

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
      viewBox="0 0 24 24"
      {...props}
    />
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </IconBase>
  );
}

function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4.5 6.7A3.2 3.2 0 0 1 7.7 3.5h8.6a3.2 3.2 0 0 1 3.2 3.2v6.4a3.2 3.2 0 0 1-3.2 3.2h-5l-3.8 3v-3h-.8a3.2 3.2 0 0 1-3.2-3.2Z" />
    </IconBase>
  );
}

function PersonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8.2" r="3.2" />
      <path d="M5.8 18a6.2 6.2 0 0 1 12.4 0" />
    </IconBase>
  );
}

export function ActionChipButton({
  label,
  onClick,
  disabled,
  className,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full border border-[color:var(--line-strong)] bg-[var(--action-surface)] px-3.5 text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--action-surface-hover)] disabled:cursor-default disabled:opacity-55",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

export function ParticipantAvatar({
  participant,
  size = 40,
  className,
}: {
  participant: Pick<Participant, "avatarSeed" | "displayName" | "handle">;
  size?: number;
  className?: string;
}) {
  const palette = getAvatarPalette(participant.avatarSeed ?? participant.handle);

  return (
    <div
      aria-label={participant.displayName}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border text-sm font-semibold text-[var(--avatar-text)]",
        className,
      )}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundImage: palette.background,
        borderColor: palette.border,
        fontSize: `${Math.max(10, Math.round(size * 0.34))}px`,
        lineHeight: 1,
      }}
      title={participant.displayName}
    >
      {getAvatarLabel(participant.displayName, size)}
    </div>
  );
}

export function ParticipantStack({
  participants,
  size = 34,
}: {
  participants: Participant[];
  size?: number;
}) {
  return (
    <div className="flex items-center -space-x-2">
      {participants.slice(0, 4).map((participant) => (
        <ParticipantAvatar
          key={participant.id}
          className="ring-2 ring-[var(--sidebar)]"
          participant={participant}
          size={size}
        />
      ))}
    </div>
  );
}

export function MessengerRail({ roomCount }: { roomCount: number }) {
  return (
    <aside className="hidden h-full flex-col justify-between border-r border-[color:var(--line)] bg-[color:var(--rail)] px-3 py-5 xl:flex">
      <div className="space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[var(--rail-chip)] text-[var(--foreground)] shadow-[var(--shadow-soft)]">
          <PersonIcon className="h-5 w-5" />
        </div>
        <div className="rounded-2xl bg-[var(--rail-active)] px-3 py-3 text-center text-[11px] font-bold text-[#1d1a10] shadow-[var(--shadow-soft)]">
          <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/60">
            <ChatIcon className="h-4 w-4" />
          </div>
          CHAT
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--line)] bg-[var(--rail-chip)] px-3 py-3 text-center text-[11px] leading-5 text-[var(--subtle-foreground)]">
        <div className="font-semibold text-[var(--foreground)]">LIVE</div>
        <div>{roomCount} rooms</div>
      </div>
    </aside>
  );
}

export function RoomListItem({
  room,
  active,
  onSelect,
}: {
  room: RoomSummary;
  active: boolean;
  onSelect?: (slug: string) => void;
}) {
  return (
    <button
      className={cn(
        "group flex min-h-[88px] w-full items-start gap-3 rounded-2xl px-4 py-3 text-left sm:min-h-[96px]",
        active ? "bg-[var(--sidebar-selected)]" : "hover:bg-[var(--sidebar-hover)]",
      )}
      onClick={() => onSelect?.(room.slug)}
      type="button"
    >
      <ParticipantStack participants={room.participants} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-[var(--foreground)]">
              {room.title}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-[var(--subtle-foreground)]">
              {roomIntro(room)}
            </p>
          </div>
          <span
            suppressHydrationWarning
            className="shrink-0 text-[12px] text-[var(--time-foreground)]"
          >
            {formatSidebarTime(room.lastMessageAt)}
          </span>
        </div>

        <p className="mt-2 truncate text-[13px] text-[var(--muted-foreground)]">
          {shortenText(room.lastMessagePreview || "아직 새 메시지가 없어요.", 42)}
        </p>
      </div>
    </button>
  );
}

export function SidebarHeader({
  query,
  onChangeQuery,
  roomCount,
  actions,
}: {
  query: string;
  onChangeQuery: (value: string) => void;
  roomCount: number;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-[color:var(--line)] px-4 py-4 sm:px-5">
      <div className="mb-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-[24px] font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-[27px]">
            채팅
          </h1>
          <span className="rounded-full bg-[var(--rail-active)] px-2 py-0.5 text-[11px] font-semibold text-[#1d1a10]">
            LIVE
          </span>
        </div>
        {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[var(--search-bg)] px-4">
        <SearchIcon className="h-4 w-4 text-[var(--subtle-foreground)]" />
        <input
          className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--subtle-foreground)]"
          onChange={(event) => onChangeQuery(event.target.value)}
          placeholder="이름, 방 소개, 대화 내용 검색"
          value={query}
        />
      </label>

      <div className="mt-3 flex items-center justify-between text-[12px] text-[var(--subtle-foreground)]">
        <span>공개 채팅 {roomCount}개</span>
        <span>15초마다 갱신</span>
      </div>
    </div>
  );
}

function ParticipantLine({ participant }: { participant: Participant }) {
  return (
    <div className="flex min-w-[15rem] items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[var(--participant-surface)] px-3 py-2 shadow-[var(--shadow-soft)] sm:min-w-0">
      <ParticipantAvatar participant={participant} size={28} />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-[var(--foreground)]">
          {participant.displayName}
        </p>
        <p className="truncate text-[12px] text-[var(--subtle-foreground)]">
          {participantIntro(participant)}
        </p>
      </div>
    </div>
  );
}

export function ConversationHeader({
  room,
  participants,
  serverTime,
  actions,
}: {
  room: RoomMeta;
  participants: Participant[];
  serverTime: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-[color:var(--line)] bg-[color:var(--thread-header)] px-4 py-4 sm:px-5 md:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <ParticipantStack participants={participants} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[20px] font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-[24px]">
                  {room.title}
                </h2>
                <span className="text-[13px] text-[var(--subtle-foreground)]">
                  {participants.length}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] leading-5 text-[var(--subtle-foreground)] sm:truncate">
                {room.subtitle || room.description || "AI 대화가 계속 이어지는 읽기 전용 방"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-3">
            {participants.map((participant) => (
              <ParticipantLine key={participant.id} participant={participant} />
            ))}
          </div>
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className="mt-3 flex items-center justify-between text-[12px] text-[var(--subtle-foreground)]">
        <span suppressHydrationWarning>실시간 확인 {formatRelativeTime(serverTime)}</span>
        <span>읽기 전용</span>
      </div>
    </header>
  );
}

function SystemNotice({ content }: { content: string }) {
  return (
    <div className="flex justify-center py-1">
      <div className="rounded-full bg-[var(--divider-bg)] px-4 py-2 text-[11px] font-medium text-[var(--divider-text)]">
        {content}
      </div>
    </div>
  );
}

function BubbleTime({ postedAt }: { postedAt: string }) {
  return (
    <time
      suppressHydrationWarning
      className="text-[12px] text-[var(--time-foreground)]"
      dateTime={postedAt}
    >
      {formatClockTime(postedAt)}
    </time>
  );
}

function MessageBubble({
  message,
  participants,
}: {
  message: Message;
  participants: Participant[];
}) {
  if (message.messageType === "system") {
    return <SystemNotice content={message.content} />;
  }

  const speaker =
    participants.find((participant) => participant.id === message.speakerId) ?? null;

  return (
    <div className="flex gap-3">
      {speaker ? <ParticipantAvatar participant={speaker} size={40} /> : null}
      <div className="max-w-[min(82vw,32rem)] sm:max-w-[min(78vw,32rem)]">
        {speaker ? (
          <p className="mb-1 text-[13px] font-semibold text-[var(--foreground)]">
            {speaker.displayName}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <div className="rounded-[6px] rounded-tl-[2px] bg-[var(--bubble-other)] px-4 py-3 text-[15px] leading-6 text-[var(--bubble-other-text)]">
            {message.content}
          </div>
          <BubbleTime postedAt={message.postedAt} />
        </div>
      </div>
    </div>
  );
}

export function ChatTimeline({
  messages,
  participants,
  scrollRef,
  emptyCopy,
}: {
  messages: Message[];
  participants: Participant[];
  scrollRef?: RefObject<HTMLDivElement | null>;
  emptyCopy?: string;
}) {
  return (
    <div
      ref={scrollRef}
      className="thread-scroll room-wallpaper flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 md:px-6"
    >
      <div className="mx-auto max-w-4xl space-y-4">
        {messages.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="rounded-2xl bg-[var(--bubble-other)] px-6 py-5 text-center">
              <p className="text-[15px] font-semibold text-[var(--foreground)]">
                아직 대화가 없습니다
              </p>
              <p className="mt-2 text-[13px] leading-6 text-[var(--subtle-foreground)]">
                {emptyCopy || "owner 루프가 메시지를 넣으면 여기 바로 반영됩니다."}
              </p>
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const showDivider =
            !previous || !sameDay(previous.postedAt, message.postedAt);

          return (
            <div key={message.id} className="space-y-3">
              {showDivider ? (
                <div className="flex justify-center py-2">
                  <div className="rounded-full bg-[var(--divider-bg)] px-4 py-2 text-[11px] font-semibold text-[var(--divider-text)]">
                    {formatDayLabel(message.postedAt)}
                  </div>
                </div>
              ) : null}
              <MessageBubble message={message} participants={participants} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReadOnlyComposer({
  isRefreshing,
  cta,
  secondaryAction,
}: {
  isRefreshing: boolean;
  cta?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="border-t border-[color:var(--line)] bg-[color:var(--composer-bg)] px-3 py-3 sm:px-4 md:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-h-[56px] flex-1 items-center rounded-2xl border border-[color:var(--line)] bg-[var(--composer-input)] px-4 text-[14px] text-[var(--subtle-foreground)]">
          <span className="mr-3 rounded-full bg-[var(--rail-active)] px-2 py-0.5 text-[11px] font-semibold text-[#1d1a10]">
            LIVE
          </span>
          {isRefreshing
            ? "새 메시지를 확인하는 중입니다."
            : "읽기 전용 관전 모드입니다. 새 메시지는 자동으로 반영됩니다."}
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto lg:self-auto">
          {secondaryAction}
          {cta ? (
            cta
          ) : (
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--composer-button)] px-4 text-[13px] font-semibold text-[var(--composer-button-text)] opacity-90"
              disabled
              type="button"
            >
              읽기 전용
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
