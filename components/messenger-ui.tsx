import type { ReactNode, SVGProps } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  buildConfessionLine,
  buildCurrentSituation,
  buildSnapshotMetaTitle,
  buildSnapshotSparkline,
  filterLabel,
  formatRelativeTime,
  formatSidebarTime,
  getAvatarLabel,
  getAvatarPalette,
  getStageMeta,
  getTrendMeta,
  stripSituationPrefix,
  shortenText,
} from "@/lib/room-utils";
import type {
  Participant,
  RelationshipFilter,
  RelationshipSnapshot,
  RoomSummary,
} from "@/lib/types";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.85"
      viewBox="0 0 24 24"
      {...props}
    />
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </IconBase>
  );
}

export function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4.5 6.7A3.2 3.2 0 0 1 7.7 3.5h8.6a3.2 3.2 0 0 1 3.2 3.2v6.4a3.2 3.2 0 0 1-3.2 3.2h-5l-3.8 3v-3h-.8a3.2 3.2 0 0 1-3.2-3.2Z" />
    </IconBase>
  );
}

export function PersonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8.2" r="3.2" />
      <path d="M5.8 18a6.2 6.2 0 0 1 12.4 0" />
    </IconBase>
  );
}

export function AIloveLogoMark({
  className,
}: {
  className?: string;
}) {
  return (
    <Image
      alt="AIlove"
      className={cn("h-8 w-8 object-contain", className)}
      height={32}
      src="/ailove-logo.svg"
      width={32}
    />
  );
}

export function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v6h-6" />
    </IconBase>
  );
}

export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="m8 10 4 4 4-4" />
    </IconBase>
  );
}

export function SparkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="m12 3 1.6 4.8L18 9.4l-4.4 1.4L12 16l-1.6-5.2L6 9.4l4.4-1.6Z" />
    </IconBase>
  );
}

export function HubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3.8 4.8 7.2V17l7.2 3.2 7.2-3.2V7.2Z" />
      <path d="M12 3.8v16.4" />
      <path d="M4.8 7.2 12 10.5l7.2-3.3" />
    </IconBase>
  );
}

export function ActionChipButton({
  label,
  onClick,
  disabled,
  className,
  active = false,
  icon,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  active?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors disabled:cursor-default disabled:opacity-50",
        active
          ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-[var(--accent-strong-text)]"
          : "border-[color:var(--line-strong)] bg-[var(--action-surface)] text-[var(--foreground)] hover:bg-[var(--action-surface-hover)]",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
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

function StateBadge({
  snapshot,
  compact = false,
  title,
}: {
  snapshot: RelationshipSnapshot;
  compact?: boolean;
  title?: string;
}) {
  const meta = getStageMeta(snapshot.stage);

  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[color:var(--line-strong)] bg-[var(--chip-surface)] font-semibold text-[var(--foreground)]",
        compact ? "px-2.5 py-1 text-[11px] leading-none" : "px-3 py-1.5 text-[12px]",
      )}
    >
      <span>{meta.emoji}</span>
      <span>{snapshot.stageLabel || meta.label}</span>
    </span>
  );
}

function SignalBadge({
  label,
  title,
  tone = "default",
}: {
  label: string;
  title?: string;
  tone?: "default" | "accent" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
        tone === "accent" &&
          "border-[var(--accent-soft-border)] bg-[var(--accent-soft)] text-[var(--foreground)]",
        tone === "muted" &&
          "border-[color:var(--line)] bg-[var(--card-quiet)] text-[var(--subtle-foreground)]",
        tone === "default" &&
          "border-[color:var(--line-strong)] bg-[var(--chip-surface)] text-[var(--foreground)]",
      )}
      title={title}
    >
      {label}
    </span>
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
  const trendMeta = getTrendMeta(room.relationshipSnapshot.trend);
  const snapshotTitle = buildSnapshotMetaTitle(room.relationshipSnapshot);
  const statusLine = stripSituationPrefix(
    buildCurrentSituation(room.relationshipSnapshot, room.currentSituation),
  );
  const showPollHint = Boolean(room.openScenePoll?.sceneId);
  const sceneLine =
    room.highlightQuote ||
    room.lastMessagePreview ||
    "새 장면이 열리면 여기서 바로 확인할 수 있습니다.";

  return (
    <button
      className={cn(
        "group flex w-full flex-col gap-2.5 rounded-[20px] border px-3.5 py-3 text-left transition-colors",
        active
          ? "border-[var(--accent-soft-border)] bg-[var(--sidebar-selected)] shadow-[var(--shadow-soft)]"
          : "border-transparent hover:bg-[var(--sidebar-hover)]",
      )}
      onClick={() => onSelect?.(room.slug)}
      type="button"
    >
      <div className="flex items-start gap-3">
        <ParticipantStack participants={room.participants} size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                {room.title}
              </p>
            </div>
            <span
              suppressHydrationWarning
              className="shrink-0 text-[11px] text-[var(--time-foreground)]"
            >
              {formatSidebarTime(room.lastMessageAt)}
            </span>
          </div>

          <div className="mt-1.5 flex min-w-0 items-center gap-2">
            <StateBadge compact snapshot={room.relationshipSnapshot} title={snapshotTitle} />
            <span className="min-w-0 flex-1 truncate break-keep text-[11px] font-medium text-[var(--subtle-foreground)]">
              {buildConfessionLine(room.relationshipSnapshot)}
            </span>
            <span
              className="shrink-0 font-mono text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]"
              title="최근 관계 추세를 간단히 압축한 스파크라인입니다."
            >
              {buildSnapshotSparkline(room.relationshipSnapshot)}
            </span>
          </div>
        </div>
      </div>

      <p className="line-clamp-2 break-keep text-[11px] leading-5 text-[var(--muted-foreground)]">
        {shortenText(statusLine, 90)}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <SignalBadge
          label={`${trendMeta.symbol} ${trendMeta.label}`}
          title={snapshotTitle}
          tone="muted"
        />
        {showPollHint ? (
          <SignalBadge label="🗳 투표 중" title="지금 다음 장면 선택지가 열려 있습니다." tone="accent" />
        ) : room.highlightQuote ? (
          <SignalBadge label="✨ 명장면" title="최근 장면에서 반응이 큰 대사가 잡혔습니다." />
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-3 text-[11px]">
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[var(--subtle-foreground)]"
            title={sceneLine}
          >
            {showPollHint ? room.openScenePoll?.title : shortenText(sceneLine, 42)}
          </p>
          <p
            className="mt-1 truncate font-medium text-[var(--muted-foreground)]"
            title={buildConfessionLine(room.relationshipSnapshot)}
          >
            {buildConfessionLine(room.relationshipSnapshot)}
          </p>
        </div>
        <span suppressHydrationWarning className="shrink-0 text-[var(--subtle-foreground)]">
          {formatRelativeTime(room.lastMessageAt)}
        </span>
      </div>
    </button>
  );
}

export function SidebarHeader({
  query,
  onChangeQuery,
  roomCount,
  actions,
  filters,
  title = "채팅",
  subtitle = "실시간 장면 관전",
  searchPlaceholder = "방 이름, 상황 검색",
  refreshLabel = "2.5초 갱신",
}: {
  query: string;
  onChangeQuery: (value: string) => void;
  roomCount: number;
  actions?: ReactNode;
  filters?: ReactNode;
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
  refreshLabel?: string;
}) {
  return (
    <div className="border-b border-[color:var(--line)] px-4 py-3 sm:px-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="whitespace-nowrap break-keep text-[22px] font-bold leading-none tracking-[-0.03em] text-[var(--foreground)] sm:text-[24px]">
              {title}
            </h1>
            <span className="shrink-0 rounded-full bg-[var(--chip-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--subtle-foreground)]">
              {roomCount}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-[var(--subtle-foreground)]">
            {subtitle}
          </p>
        </div>
        {actions ? (
          <div className="flex max-w-[58%] shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[var(--search-bg)] px-3.5">
          <SearchIcon className="h-4 w-4 text-[var(--subtle-foreground)]" />
          <input
            className="w-full bg-transparent text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--subtle-foreground)]"
            onChange={(event) => onChangeQuery(event.target.value)}
            placeholder={searchPlaceholder}
            value={query}
          />
        </label>
      </div>

      {filters ? <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">{filters}</div> : null}

      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--subtle-foreground)]">
        <span>공개 {roomCount}개</span>
        <span>{refreshLabel}</span>
      </div>
    </div>
  );
}

export function RelationshipFilterBar({
  activeFilter,
  onSelect,
}: {
  activeFilter: RelationshipFilter;
  onSelect: (value: RelationshipFilter) => void;
}) {
  const filters: RelationshipFilter[] = [
    "all",
    "awkward",
    "interest",
    "flirt",
    "love",
    "obsession",
    "group",
  ];

  return (
    <>
      {filters.map((filter) => (
        <ActionChipButton
          key={filter}
          active={activeFilter === filter}
          className="min-h-8 px-2.5 text-[11px]"
          label={filterLabel(filter)}
          onClick={() => onSelect(filter)}
        />
      ))}
    </>
  );
}

function RailButton({
  href,
  active,
  label,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[78px] w-full flex-col items-center justify-center rounded-[24px] border px-2 py-3.5 text-center transition-all",
        active
          ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-[var(--accent-strong-text)] shadow-[var(--shadow-soft)]"
          : "border-[color:var(--line)] bg-[var(--rail-chip)] text-[var(--foreground)] hover:bg-[var(--sidebar-hover)]",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full",
          active ? "bg-white/45" : "bg-black/5 dark:bg-white/8",
        )}
      >
        {icon}
      </div>
      <span className="mt-1.5 block whitespace-nowrap text-[9px] font-semibold tracking-[0.08em]">
        {label}
      </span>
    </Link>
  );
}

export function MessengerRail({ roomCount }: { roomCount: number }) {
  const pathname = usePathname();
  const chatActive = !pathname.startsWith("/hub");
  const hubActive = pathname.startsWith("/hub");

  return (
    <aside className="relative z-10 hidden h-full w-[96px] min-w-[96px] flex-col border-r border-[color:var(--line)] bg-[color:var(--rail)] px-3 py-4 xl:flex">
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[var(--rail-chip)] text-[var(--foreground)] shadow-[var(--shadow-soft)]">
          <AIloveLogoMark className="h-8 w-8" />
        </div>
        <nav className="w-full space-y-2">
          <RailButton active={chatActive} href="/" icon={<ChatIcon className="h-4 w-4" />} label="CHAT" />
          <RailButton active={hubActive} href="/hub" icon={<HubIcon className="h-4 w-4" />} label="HUB" />
        </nav>

        <div className="mt-auto w-full rounded-[22px] border border-[color:var(--line)] bg-[var(--rail-chip)] px-2.5 py-3 text-center">
          <div className="text-[9px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
            {hubActive ? "LIVE HUB" : "LIVE CHAT"}
          </div>
          <div className="mt-1 text-[18px] font-bold leading-none text-[var(--foreground)]">
            {roomCount}
          </div>
          <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--subtle-foreground)]">
            rooms
          </div>
        </div>
      </div>
    </aside>
  );
}
