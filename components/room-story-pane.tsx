"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

import {
  ActionChipButton,
  ChevronIcon,
  ParticipantAvatar,
  ParticipantStack,
  RefreshIcon,
  SparkIcon,
  cn,
} from "@/components/messenger-ui";
import {
  buildConfessionLine,
  buildCurrentSituation,
  buildEmotionTimelineFallback,
  buildPollSubtitle,
  buildRelationshipHero,
  buildSnapshotMetaTitle,
  buildSparkline,
  buildTurningPointLine,
  eventBadgeTone,
  formatClockTime,
  formatDayLabel,
  formatRelativeTime,
  getAvatarPalette,
  getStageMeta,
  getTrendMeta,
  messageAlignment,
  quoteShareText,
  reactionOptions,
  sameDay,
  stripSituationPrefix,
  toKoreaDateTimeAttr,
} from "@/lib/room-utils";
import type {
  CharacterProfile,
  EmotionEvent,
  HighlightMoment,
  Message,
  MessageReactions,
  Participant,
  RelationshipSnapshot,
  RoomDetailPayload,
  ScenePoll,
} from "@/lib/types";

function TrendPill({
  snapshot,
  title,
}: {
  snapshot: RelationshipSnapshot;
  title?: string;
}) {
  const trendMeta = getTrendMeta(snapshot.trend);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-[var(--chip-surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--foreground)]"
      title={title}
    >
      <span>{trendMeta.symbol}</span>
      <span>{trendMeta.label}</span>
      {snapshot.trendDelta !== 0 ? (
        <span className="text-[var(--subtle-foreground)]">
          {snapshot.trendDelta > 0 ? `+${snapshot.trendDelta}` : snapshot.trendDelta}
        </span>
      ) : null}
    </span>
  );
}

function MetaPill({
  label,
  tone = "default",
  title,
}: {
  label: string;
  tone?: "default" | "accent" | "muted";
  title?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-[12px] font-semibold",
        tone === "default" &&
          "border-[color:var(--line-strong)] bg-[var(--chip-surface)] text-[var(--foreground)]",
        tone === "accent" &&
          "border-[var(--accent-soft-border)] bg-[var(--accent-soft)] text-[var(--foreground)]",
        tone === "muted" &&
          "border-[color:var(--line)] bg-[var(--card-quiet)] text-[var(--subtle-foreground)]",
      )}
      title={title}
    >
      {label}
    </span>
  );
}

function StoryHero({
  room,
  snapshot,
  serverTime,
  emotionTimeline,
  highlight,
  scenePoll,
  metaExpanded,
  onToggleMeta,
  dramaMode,
  onToggleDrama,
  onRefresh,
  isRefreshing,
}: {
  room: RoomDetailPayload["room"];
  snapshot: RelationshipSnapshot;
  serverTime: string;
  emotionTimeline: EmotionEvent[];
  highlight: HighlightMoment | null;
  scenePoll: ScenePoll | null;
  metaExpanded: boolean;
  onToggleMeta: () => void;
  dramaMode: boolean;
  onToggleDrama: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const stageMeta = getStageMeta(snapshot.stage);
  const sparkline = buildSparkline(emotionTimeline);
  const turningPointLine = buildTurningPointLine(emotionTimeline, highlight);
  const liveSignalLabel =
    scenePoll?.status === "open"
      ? "🗳 투표 진행 중"
      : highlight
        ? "✨ 명장면 포착"
        : "🎬 장면 진행 중";
  const sceneSummary = stripSituationPrefix(buildCurrentSituation(snapshot, room.currentSituation));

  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b border-[color:var(--line)] bg-[var(--thread-header)] backdrop-blur",
        metaExpanded ? "px-4 py-4 sm:px-5" : "px-4 py-3 sm:px-5",
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-3">
              <ParticipantStack participants={room.participants} size={metaExpanded ? 36 : 30} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="truncate break-keep text-[22px] font-bold tracking-[-0.04em] text-[var(--foreground)] sm:text-[24px]">
                    {room.title}
                  </h2>
                  <span
                    className="shrink-0 rounded-full border border-[color:var(--line-strong)] bg-[var(--chip-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--foreground)]"
                    title={buildSnapshotMetaTitle(snapshot)}
                  >
                    {stageMeta.emoji} {snapshot.stageLabel}
                  </span>
                  {!metaExpanded ? (
                    <TrendPill
                      snapshot={snapshot}
                      title="최근 10개 메시지 기준 감정 변화량을 요약한 추세입니다."
                    />
                  ) : null}
                </div>

                {metaExpanded ? (
                  <p className="mt-1 text-[13px] text-[var(--subtle-foreground)]">
                    {room.subtitle || room.description || stageMeta.tone}
                  </p>
                ) : (
                  <p className="mt-1 truncate text-[12px] text-[var(--subtle-foreground)]">
                    {buildCurrentSituation(snapshot, room.currentSituation)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <ActionChipButton
              icon={<RefreshIcon className="h-4 w-4" />}
              label={isRefreshing ? "확인 중" : "새로고침"}
              onClick={onRefresh}
            />
            <ActionChipButton
              active={dramaMode}
              icon={<SparkIcon className="h-4 w-4" />}
              label={dramaMode ? "드라마 모드" : "드라마 OFF"}
              onClick={onToggleDrama}
            />
            <ActionChipButton
              icon={
                <ChevronIcon
                  className={cn("h-4 w-4 transition-transform", metaExpanded ? "rotate-180" : "")}
                />
              }
              label={metaExpanded ? "정보 접기" : "정보 보기"}
              onClick={onToggleMeta}
            />
          </div>
        </div>

        <div className="rounded-[24px] border border-[color:var(--line)] bg-[var(--hero-surface)] px-4 py-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[18px] font-bold text-[var(--foreground)]">
              {buildRelationshipHero(snapshot)}
            </p>
            <TrendPill
              snapshot={snapshot}
              title="최근 10개 메시지 기준 감정 변화량을 요약한 추세입니다."
            />
            <MetaPill
              label={liveSignalLabel}
              title={
                scenePoll?.status === "open"
                  ? "다음 장면에 관전자가 바로 개입할 수 있습니다."
                  : highlight
                    ? "최근 대화에서 가장 반응이 큰 장면이 잡혔습니다."
                    : "현재 장면이 실시간으로 이어지는 중입니다."
              }
              tone="accent"
            />
          </div>
          <p className="mt-3 text-[15px] font-semibold leading-7 text-[var(--foreground)] sm:text-[16px]">
            {buildCurrentSituation(snapshot, room.currentSituation)}
          </p>
          <p className="mt-1 text-[13px] leading-6 text-[var(--subtle-foreground)]">
            {turningPointLine}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span
                className="rounded-full bg-[var(--chip-surface)] px-3 py-1.5 font-medium text-[var(--foreground)]"
                title={buildSnapshotMetaTitle(snapshot)}
              >
                {buildConfessionLine(snapshot)}
              </span>
              <span suppressHydrationWarning className="text-[var(--subtle-foreground)]">
                실시간 확인 {formatRelativeTime(serverTime)}
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-[color:var(--line)] bg-[var(--card-surface)] px-3 py-2 text-[12px] text-[var(--subtle-foreground)]">
              <span>감정 흐름</span>
              <span
                className="font-semibold tracking-[0.18em] text-[var(--foreground)]"
                title={turningPointLine}
              >
                {sparkline}
              </span>
            </div>
          </div>

          {metaExpanded ? (
            <div className="mt-4 grid gap-3 rounded-[20px] border border-[color:var(--line)] bg-[var(--card-surface)] px-4 py-4 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--subtle-foreground)]">
                  관계 단계
                </p>
                <p className="mt-2 text-[14px] font-semibold text-[var(--foreground)]">
                  {stageMeta.emoji} {snapshot.stageLabel}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--subtle-foreground)]">
                  {stageMeta.tone}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--subtle-foreground)]">
                  감정 변화 해석
                </p>
                <p className="mt-2 text-[14px] font-semibold text-[var(--foreground)]">
                  최근 10턴 기준 {snapshot.trendDelta > 0 ? `+${snapshot.trendDelta}` : snapshot.trendDelta}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--subtle-foreground)]">
                  단계와 변화량은 최근 장면 기준 추정치입니다.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--subtle-foreground)]">
                  지금 주목할 장면
                </p>
                <p className="mt-2 text-[14px] font-semibold text-[var(--foreground)]">
                  {highlight?.quote ? `“${highlight.quote}”` : sceneSummary}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--subtle-foreground)]">
                  {turningPointLine}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function CharacterCard({
  profile,
  participant,
}: {
  profile: CharacterProfile;
  participant: Participant | undefined;
}) {
  return (
    <article className="rounded-[22px] border border-[color:var(--line)] bg-[var(--card-surface)] px-4 py-4">
      <div className="flex items-center gap-3">
        {participant ? <ParticipantAvatar participant={participant} size={38} /> : null}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
            {profile.displayName}
          </p>
          <p className="truncate text-[12px] text-[var(--subtle-foreground)]">
            {profile.shortHook}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {profile.personaBullets.map((bullet) => (
          <span
            key={bullet}
            className="rounded-full border border-[color:var(--line)] bg-[var(--chip-surface)] px-2.5 py-1 text-[11px] text-[var(--foreground)]"
          >
            {bullet}
          </span>
        ))}
      </div>
      {profile.signatureStyle ? (
        <p className="mt-3 text-[12px] leading-5 text-[var(--muted-foreground)]">
          {profile.signatureStyle}
        </p>
      ) : null}
    </article>
  );
}

function TimelineEvent({ event }: { event: EmotionEvent }) {
  const tone = eventBadgeTone(event);

  return (
    <div className="flex gap-3">
      <div
        className={cn(
          "mt-1 h-2.5 w-2.5 rounded-full",
          tone === "rise" && "bg-[#f7cd58]",
          tone === "drop" && "bg-[#7f8aa0]",
          tone === "conflict" && "bg-[#ff7171]",
          tone === "recovery" && "bg-[#58c28d]",
          tone === "spotlight" && "bg-[#ff9c54]",
        )}
      />
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--foreground)]">{event.label}</p>
        <p className="mt-0.5 text-[11px] text-[var(--subtle-foreground)]">
          {formatClockTime(event.at)}
        </p>
      </div>
    </div>
  );
}

function ScenePollCard({
  poll,
  isVoting,
  onOpenVoteModal,
}: {
  poll: ScenePoll | null;
  isVoting: boolean;
  onOpenVoteModal: () => void;
}) {
  if (!poll) {
    return (
      <section className="rounded-[22px] border border-[color:var(--line)] bg-[var(--card-surface)] px-4 py-4">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--subtle-foreground)]">
          관전자 개입
        </p>
        <p className="mt-2 text-[14px] text-[var(--foreground)]">
          현재 열린 투표가 없습니다. 다음 장면이 시작되면 선택지가 열립니다.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[22px] border border-[color:var(--line)] bg-[var(--card-surface)] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--subtle-foreground)]">
            관전자 개입
          </p>
          <p className="mt-2 break-keep text-[15px] font-semibold text-[var(--foreground)]">
            {poll.title}
          </p>
          <p className="mt-1 break-keep text-[13px] leading-5 text-[var(--subtle-foreground)]">
            {poll.prompt}
          </p>
        </div>
        <span className="inline-flex min-h-9 min-w-[52px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[var(--chip-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground)]">
          {poll.totalVotes}표
        </span>
      </div>

      {poll.status === "open" ? (
        <div className="mt-4 rounded-[18px] border border-[color:var(--line)] bg-[var(--chip-surface)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--foreground)]">
                {poll.viewerVoteOptionId ? "투표를 남겼어요" : "지금 투표를 열 수 있어요"}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--subtle-foreground)]">
                {poll.viewerVoteOptionId
                  ? "상단 배너나 아래 버튼을 눌러 현재 선택과 득표 현황을 확인하세요."
                  : "상단 배너나 아래 버튼을 눌러 장면에 개입하세요."}
              </p>
            </div>
            <ActionChipButton
              active={Boolean(poll.viewerVoteOptionId)}
              disabled={isVoting}
              label={poll.viewerVoteOptionId ? "투표 보기" : "투표하기"}
              onClick={onOpenVoteModal}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {poll.options.map((option) => {
            const selected = poll.viewerVoteOptionId === option.optionId;

            return (
              <div
                key={option.optionId}
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-[18px] border px-3 py-3 text-left",
                  selected
                    ? "border-[var(--accent-soft-border)] bg-[var(--accent-soft)]"
                    : "border-[color:var(--line)] bg-[var(--chip-surface)]",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="break-keep text-[13px] font-semibold text-[var(--foreground)]">
                    {option.label}
                  </p>
                  <p className="mt-1 break-keep text-[12px] leading-5 text-[var(--subtle-foreground)]">
                    {option.description}
                  </p>
                </div>
                <span className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-black/5 px-2 py-1 text-[11px] font-semibold text-[var(--foreground)] dark:bg-white/8">
                  {option.voteCount}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 break-keep text-[12px] text-[var(--subtle-foreground)]">
        {buildPollSubtitle(poll)}
      </p>
    </section>
  );
}

function ScenePollBanner({
  poll,
  onOpen,
}: {
  poll: ScenePoll | null;
  onOpen: () => void;
}) {
  if (!poll || poll.status !== "open") {
    return null;
  }

  return (
    <div className="border-b border-[color:var(--line)] bg-[var(--thread-header)]/95 px-4 py-3 backdrop-blur sm:px-5">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 rounded-[22px] border border-[var(--accent-soft-border)] bg-[var(--accent-soft)] px-4 py-3 shadow-[var(--shadow-soft)] md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-[var(--accent-strong)]">
            투표하세요!
          </p>
          <p className="mt-1 break-keep text-[15px] font-semibold text-[var(--foreground)]">
            {poll.title}
          </p>
          <p className="mt-1 break-keep text-[13px] leading-5 text-[var(--subtle-foreground)]">
            {poll.prompt}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex min-h-10 min-w-[56px] items-center justify-center rounded-full bg-[var(--chip-surface)] px-3 text-[12px] font-semibold text-[var(--foreground)]">
            {poll.totalVotes}표
          </span>
          <ActionChipButton
            active={Boolean(poll.viewerVoteOptionId)}
            label={poll.viewerVoteOptionId ? "내 투표 보기" : "투표 열기"}
            onClick={onOpen}
          />
        </div>
      </div>
    </div>
  );
}

function ScenePollModal({
  poll,
  isVoting,
  onClose,
  onVote,
}: {
  poll: ScenePoll | null;
  isVoting: boolean;
  onClose: () => void;
  onVote: (sceneId: string, optionId: string) => void;
}) {
  if (!poll || poll.status !== "open") {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        aria-labelledby="scene-poll-modal-title"
        aria-modal="true"
        className="max-h-[min(88vh,760px)] w-full max-w-xl overflow-y-auto rounded-[28px] border border-[color:var(--line)] bg-[var(--sidebar)] p-5 shadow-[var(--shadow-strong)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold tracking-[0.08em] text-[var(--accent-strong)]">
              관전자 개입
            </p>
            <h3
              id="scene-poll-modal-title"
              className="mt-2 break-keep text-[22px] font-bold text-[var(--foreground)]"
            >
              {poll.title}
            </h3>
            <p className="mt-2 break-keep text-[14px] leading-6 text-[var(--subtle-foreground)]">
              {poll.prompt}
            </p>
          </div>
          <ActionChipButton label="닫기" onClick={onClose} />
        </div>

        <div className="mt-5 space-y-3">
          {poll.options.map((option) => {
            const selected = poll.viewerVoteOptionId === option.optionId;

            return (
              <button
                key={option.optionId}
                className={cn(
                  "flex min-h-24 w-full items-start justify-between gap-3 rounded-[20px] border px-4 py-4 text-left transition-colors",
                  selected
                    ? "border-[var(--accent-soft-border)] bg-[var(--accent-soft)]"
                    : "border-[color:var(--line)] bg-[var(--card-surface)] hover:bg-[var(--card-quiet)]",
                )}
                disabled={isVoting}
                onClick={() => onVote(poll.sceneId, option.optionId)}
                type="button"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-keep text-[15px] font-semibold text-[var(--foreground)]">
                    {option.label}
                  </p>
                  <p className="mt-1 break-keep text-[13px] leading-6 text-[var(--subtle-foreground)]">
                    {option.description}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="inline-flex min-h-9 min-w-[48px] items-center justify-center rounded-full bg-[var(--chip-surface)] px-3 text-[12px] font-semibold text-[var(--foreground)]">
                    {option.voteCount}표
                  </span>
                  {selected ? (
                    <span className="rounded-full bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-strong-text)]">
                      내 선택
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--subtle-foreground)]">
          <span>{buildPollSubtitle(poll)}</span>
          {poll.closesAt ? <span>마감 {formatRelativeTime(poll.closesAt)}</span> : null}
        </div>
      </div>
    </div>
  );
}

function HighlightCard({
  roomTitle,
  highlight,
  saved,
  onToggleSave,
  onShare,
}: {
  roomTitle: string;
  highlight: HighlightMoment | null;
  saved: boolean;
  onToggleSave: () => void;
  onShare: (text: string) => void;
}) {
  return (
    <section className="rounded-[22px] border border-[color:var(--line)] bg-[var(--card-surface)] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--subtle-foreground)]">
            오늘의 명장면
          </p>
          {highlight ? (
            <>
              <p className="mt-2 text-[17px] font-semibold leading-7 text-[var(--foreground)]">
                “{highlight.quote}”
              </p>
              <p className="mt-2 text-[12px] text-[var(--subtle-foreground)]">
                {highlight.speakerDisplayName
                  ? `${highlight.speakerDisplayName} · ${highlight.reason}`
                  : highlight.reason}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[14px] leading-6 text-[var(--subtle-foreground)]">
              대화가 더 쌓이면 지금 장면의 명대사를 자동으로 골라줍니다.
            </p>
          )}
        </div>
      </div>

      {highlight ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionChipButton
            active={saved}
            label={saved ? "저장됨" : "저장"}
            onClick={onToggleSave}
          />
          <ActionChipButton
            label="공유"
            onClick={() => onShare(quoteShareText(roomTitle, highlight.quote))}
          />
        </div>
      ) : null}
    </section>
  );
}

function InlineHighlightBanner({
  roomTitle,
  highlight,
  saved,
  onToggleSave,
  onShare,
}: {
  roomTitle: string;
  highlight: HighlightMoment;
  saved: boolean;
  onToggleSave: () => void;
  onShare: (text: string) => void;
}) {
  return (
    <div className="mb-3 rounded-[20px] border border-[var(--accent-soft-border)] bg-[var(--accent-soft)] px-4 py-3 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--accent-strong)]">
            ✨ 지금 뜨는 장면
          </p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--foreground)]">
            {highlight.reason}
          </p>
          <p className="mt-1 text-[13px] leading-6 text-[var(--subtle-foreground)]">
            “{highlight.quote}”
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ActionChipButton
            active={saved}
            label={saved ? "저장됨" : "저장"}
            onClick={onToggleSave}
          />
          <ActionChipButton
            label="공유"
            onClick={() => onShare(quoteShareText(roomTitle, highlight.quote))}
          />
        </div>
      </div>
    </div>
  );
}

function BubbleTime({
  postedAt,
  className,
}: {
  postedAt: string;
  className?: string;
}) {
  return (
    <time
      suppressHydrationWarning
      className={cn("text-[11px] text-[var(--time-foreground)]", className)}
      dateTime={toKoreaDateTimeAttr(postedAt)}
    >
      {formatClockTime(postedAt)}
    </time>
  );
}

function UserReactionBar({
  reactions,
  onReact,
  messageId,
  isReacting,
}: {
  reactions: MessageReactions;
  onReact: (messageId: number, emoji: string) => void;
  messageId: number;
  isReacting: boolean;
}) {
  const visibleCounts = reactions.user.filter((reaction) => reaction.count > 0);

  if (visibleCounts.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {visibleCounts.map((reaction) => (
        <button
          key={reaction.emoji}
          className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-full border border-[color:var(--line)] bg-[var(--reaction-surface)] px-2.5 text-[13px] text-[var(--foreground)] hover:bg-[var(--card-quiet)] disabled:opacity-60"
          disabled={isReacting}
          onClick={() => onReact(messageId, reaction.emoji)}
          type="button"
        >
          <span>{reaction.emoji}</span>
          <span className="text-[11px] font-semibold">{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}

function AiReactionStrip({ reactions }: { reactions: MessageReactions["ai"] }) {
  if (reactions.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {reactions.map((reaction, index) => (
        <span
          key={`${reaction.actorHandle}-${reaction.emoji}-${index}`}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--ai-reaction-surface)] px-2.5 py-1 text-[11px] text-[var(--foreground)]"
        >
          <span>{reaction.emoji}</span>
          <span>{reaction.actorDisplayName}</span>
        </span>
      ))}
    </div>
  );
}

function ReactionPickerMenu({
  anchor,
  isReacting,
  onClose,
  onReact,
}: {
  anchor:
    | {
        messageId: number;
        x: number;
        y: number;
      }
    | null;
  isReacting: boolean;
  onClose: () => void;
  onReact: (messageId: number, emoji: string) => void;
}) {
  if (!anchor) {
    return null;
  }

  const left = Math.min(anchor.x, window.innerWidth - 248);
  const top = Math.min(anchor.y, window.innerHeight - 72);

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="absolute flex items-center gap-1 rounded-full border border-[color:var(--line-strong)] bg-[var(--sidebar)] p-1.5 shadow-[var(--shadow-strong)]"
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
        style={{
          left: `${Math.max(12, left)}px`,
          top: `${Math.max(12, top)}px`,
        }}
      >
        {reactionOptions().map((emoji) => (
          <button
            key={emoji}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[18px] transition-colors hover:bg-[var(--card-quiet)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] disabled:opacity-60"
            disabled={isReacting}
            onClick={() => {
              onReact(anchor.messageId, emoji);
              onClose();
            }}
            type="button"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function TypingPreview({
  speaker,
  align,
}: {
  speaker: Participant | null;
  align: "left" | "right";
}) {
  if (!speaker) {
    return null;
  }

  return (
    <div className={cn("flex gap-3", align === "right" ? "justify-end" : "justify-start")}>
      {align === "left" ? <ParticipantAvatar participant={speaker} size={38} /> : null}
      <div
        className={cn(
          "w-fit max-w-[72vw] sm:max-w-[24rem] lg:max-w-[26rem]",
          align === "right" ? "items-end" : "",
        )}
      >
        <p className={cn("mb-1 text-[13px] font-semibold text-[var(--foreground)]", align === "right" ? "text-right" : "")}>
          {speaker.displayName} typing...
        </p>
        <div className="inline-flex items-center gap-1 rounded-[20px] bg-[var(--bubble-typing)] px-4 py-3 text-[var(--subtle-foreground)]">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
      {align === "right" ? <ParticipantAvatar participant={speaker} size={38} /> : null}
    </div>
  );
}

function MessageBubble({
  message,
  participants,
  dramaMode,
  isLatest,
  onReact,
  onOpenReactionPicker,
  reactingMessageId,
}: {
  message: Message;
  participants: Participant[];
  dramaMode: boolean;
  isLatest: boolean;
  onReact: (messageId: number, emoji: string) => void;
  onOpenReactionPicker: (messageId: number, x: number, y: number) => void;
  reactingMessageId: number | null;
}) {
  if (message.messageType === "system") {
    return (
      <div className="flex justify-center py-2">
        <div className="rounded-full bg-[var(--divider-bg)] px-4 py-2 text-[11px] font-medium text-[var(--divider-text)]">
          {message.content}
        </div>
      </div>
    );
  }

  const speaker =
    participants.find((participant) => participant.id === message.speakerId) ?? undefined;
  const align = speaker ? messageAlignment(message, participants) : "left";
  const palette = getAvatarPalette(speaker?.avatarSeed ?? speaker?.handle ?? "room");
  const bubbleStyle =
    align === "right"
      ? {
          backgroundColor: "var(--bubble-self)",
          color: "var(--bubble-self-text)",
        }
      : {
          backgroundColor: palette.tint,
          color: "var(--foreground)",
          borderColor: palette.border,
        };

  return (
    <div
      className={cn(
        "flex gap-3",
        align === "right" ? "justify-end" : "justify-start",
        dramaMode && isLatest ? "message-entrance" : "",
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenReactionPicker(message.id, event.clientX, event.clientY);
      }}
    >
      {align === "left" && speaker ? <ParticipantAvatar participant={speaker} size={40} /> : null}

      <div
        className={cn(
          "w-fit max-w-[74vw] sm:max-w-[28rem] lg:max-w-[30rem]",
          align === "right" ? "items-end" : "",
        )}
      >
        {speaker ? (
          <p
            className={cn(
              "mb-1 text-[13px] font-semibold text-[var(--foreground)]",
              align === "right" ? "text-right" : "",
            )}
          >
            {speaker.displayName}
          </p>
        ) : null}

        <div className={cn("flex", align === "right" ? "justify-end" : "")}>
          <div
            className={cn(
              "flex max-w-full flex-col gap-1 rounded-[18px] px-4 py-3 text-[15px] leading-6 shadow-[var(--shadow-soft)]",
              align === "right"
                ? "rounded-br-[6px]"
                : "rounded-bl-[6px] border border-[color:var(--line)]",
            )}
            style={bubbleStyle}
          >
            <p className="whitespace-pre-wrap break-keep">{message.content}</p>
            <BubbleTime
              className={cn(
                "self-end text-[10px]",
                align === "right"
                  ? "text-[var(--bubble-self-text)]/65"
                  : "text-[var(--time-foreground)]",
              )}
              postedAt={message.postedAt}
            />
          </div>
        </div>

        <AiReactionStrip reactions={message.reactions.ai} />
        <UserReactionBar
          isReacting={reactingMessageId === message.id}
          messageId={message.id}
          onReact={onReact}
          reactions={message.reactions}
        />
      </div>

      {align === "right" && speaker ? <ParticipantAvatar participant={speaker} size={40} /> : null}
    </div>
  );
}

function resolveTypingSpeaker(detail: RoomDetailPayload) {
  const prediction = detail.relationshipSnapshot.confessionPrediction;
  if (prediction?.actorId) {
    return (
      detail.participants.find((participant) => participant.id === prediction.actorId) ?? null
    );
  }

  const lastMessage = [...detail.messages].reverse().find((message) => message.messageType === "text");
  if (!lastMessage?.speakerId) {
    return detail.participants[0] ?? null;
  }

  return (
    detail.participants.find((participant) => participant.id !== lastMessage.speakerId) ??
    detail.participants[0] ??
    null
  );
}

export function RoomStoryPane({
  detail,
  serverTime,
  scrollRef,
  emptyCopy,
  metaExpanded,
  onToggleMeta,
  dramaMode,
  onToggleDrama,
  onRefresh,
  isRefreshing,
  isVoting,
  onVote,
  reactingMessageId,
  onReact,
  savedHighlight,
  onToggleSaveHighlight,
  onShareHighlight,
}: {
  detail: RoomDetailPayload;
  serverTime: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  emptyCopy?: string;
  metaExpanded: boolean;
  onToggleMeta: () => void;
  dramaMode: boolean;
  onToggleDrama: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  isVoting: boolean;
  onVote: (sceneId: string, optionId: string) => void;
  reactingMessageId: number | null;
  onReact: (messageId: number, emoji: string) => void;
  savedHighlight: boolean;
  onToggleSaveHighlight: () => void;
  onShareHighlight: (text: string) => void;
}) {
  const emotionTimeline =
    detail.emotionTimeline.length > 0
      ? detail.emotionTimeline
      : buildEmotionTimelineFallback(detail.messages, detail.relationshipSnapshot);
  const latestMessageId =
    detail.messages.length > 0 ? detail.messages[detail.messages.length - 1]?.id ?? null : null;
  const [showTypingPreview, setShowTypingPreview] = useState(false);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [reactionPicker, setReactionPicker] = useState<{
    messageId: number;
    x: number;
    y: number;
  } | null>(null);
  const idleRefreshCyclesRef = useRef(0);
  const previousRefreshingRef = useRef(isRefreshing);
  const previousMessageIdRef = useRef<number | null>(latestMessageId);
  const hasOpenScene = detail.scenePoll?.status === "open";
  const openPoll = detail.scenePoll?.status === "open" ? detail.scenePoll : null;
  const isPollModalVisible = pollModalOpen && Boolean(openPoll);

  useEffect(() => {
    if (latestMessageId !== previousMessageIdRef.current) {
      idleRefreshCyclesRef.current = 0;
      previousMessageIdRef.current = latestMessageId;
    }
  }, [latestMessageId]);

  useEffect(() => {
    const wasRefreshing = previousRefreshingRef.current;
    const previousMessageId = previousMessageIdRef.current;

    if (wasRefreshing && !isRefreshing) {
      if (hasOpenScene && previousMessageId === latestMessageId) {
        idleRefreshCyclesRef.current = Math.min(idleRefreshCyclesRef.current + 1, 3);
      } else {
        idleRefreshCyclesRef.current = 0;
      }
    }

    previousRefreshingRef.current = isRefreshing;
    previousMessageIdRef.current = latestMessageId;
  }, [hasOpenScene, isRefreshing, latestMessageId]);

  useEffect(() => {
    if (!dramaMode || !hasOpenScene || !isRefreshing || idleRefreshCyclesRef.current < 1) {
      const resetFrame = window.requestAnimationFrame(() => {
        setShowTypingPreview(false);
      });

      return () => window.cancelAnimationFrame(resetFrame);
    }

    const lastPostedAt = detail.messages.at(-1)?.postedAt;
    const lastGapMs = lastPostedAt ? Date.now() - new Date(lastPostedAt).getTime() : Infinity;

    if (Number.isFinite(lastGapMs) && lastGapMs < 4_000) {
      const resetFrame = window.requestAnimationFrame(() => {
        setShowTypingPreview(false);
      });

      return () => window.cancelAnimationFrame(resetFrame);
    }

    const timer = window.setTimeout(() => {
      setShowTypingPreview(true);
    }, 650);

    return () => {
      window.clearTimeout(timer);
      window.requestAnimationFrame(() => {
        setShowTypingPreview(false);
      });
    };
  }, [detail.messages, dramaMode, hasOpenScene, isRefreshing]);

  useEffect(() => {
    if (hasOpenScene) {
      return;
    }

    idleRefreshCyclesRef.current = 0;
    const resetFrame = window.requestAnimationFrame(() => {
      setShowTypingPreview(false);
    });

    return () => window.cancelAnimationFrame(resetFrame);
  }, [hasOpenScene]);

  useEffect(() => {
    if (!isPollModalVisible) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPollModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPollModalVisible]);

  useEffect(() => {
    if (!reactionPicker) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReactionPicker(null);
      }
    };

    const handleScroll = () => {
      setReactionPicker(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [reactionPicker]);

  const typingSpeaker = dramaMode && showTypingPreview ? resolveTypingSpeaker(detail) : null;
  const typingAlign =
    typingSpeaker && detail.participants.findIndex((participant) => participant.id === typingSpeaker.id) % 2 === 1
      ? "right"
      : "left";

  return (
    <section className="flex min-h-0 flex-col overflow-hidden bg-[var(--thread-pane)]">
      <StoryHero
        dramaMode={dramaMode}
        emotionTimeline={emotionTimeline}
        highlight={detail.highlight}
        isRefreshing={isRefreshing}
        metaExpanded={metaExpanded}
        onRefresh={onRefresh}
        onToggleDrama={onToggleDrama}
        onToggleMeta={onToggleMeta}
        room={detail.room}
        scenePoll={detail.scenePoll}
        serverTime={serverTime}
        snapshot={detail.relationshipSnapshot}
      />

      <ScenePollBanner
        onOpen={() => setPollModalOpen(true)}
        poll={openPoll}
      />

      {metaExpanded ? (
        <div className="border-b border-[color:var(--line)] bg-[var(--meta-surface)] px-4 py-4 sm:px-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <section className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {detail.characterProfiles.map((profile) => (
                  <CharacterCard
                    key={profile.handle}
                    participant={detail.participants.find((item) => item.id === profile.participantId)}
                    profile={profile}
                  />
                ))}
              </div>

              <HighlightCard
                highlight={detail.highlight}
                onShare={onShareHighlight}
                onToggleSave={onToggleSaveHighlight}
                roomTitle={detail.room.title}
                saved={savedHighlight}
              />
            </section>

            <section className="grid gap-4">
              <section className="rounded-[22px] border border-[color:var(--line)] bg-[var(--card-surface)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--subtle-foreground)]">
                      감정 변화
                    </p>
                    <p className="mt-1 text-[15px] font-semibold text-[var(--foreground)]">
                      {detail.relationshipSnapshot.dominantPair?.label || detail.room.title}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--chip-surface)] px-3 py-1 text-[13px] font-semibold text-[var(--foreground)]">
                    {buildSparkline(emotionTimeline)}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {emotionTimeline.slice(0, 5).map((event) => (
                    <TimelineEvent key={event.id} event={event} />
                  ))}
                </div>
              </section>

              <ScenePollCard
                isVoting={isVoting}
                onOpenVoteModal={() => setPollModalOpen(true)}
                poll={detail.scenePoll}
              />
            </section>
          </div>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="thread-scroll room-wallpaper flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 md:px-6"
      >
        <div className="mx-auto max-w-4xl space-y-4">
          {detail.messages.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="rounded-2xl bg-[var(--card-surface)] px-6 py-5 text-center shadow-[var(--shadow-soft)]">
                <p className="text-[15px] font-semibold text-[var(--foreground)]">
                  아직 대화가 없습니다
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[var(--subtle-foreground)]">
                  {emptyCopy || "owner 루프가 메시지를 넣으면 여기 바로 반영됩니다."}
                </p>
              </div>
            </div>
          ) : null}

          {detail.messages.map((message, index) => {
            const previous = detail.messages[index - 1];
            const showDivider = !previous || !sameDay(previous.postedAt, message.postedAt);

            return (
              <div key={message.id} className="space-y-3">
                {showDivider ? (
                  <div className="flex justify-center py-2">
                    <div className="rounded-full bg-[var(--divider-bg)] px-4 py-2 text-[11px] font-semibold text-[var(--divider-text)]">
                      {formatDayLabel(message.postedAt)}
                    </div>
                  </div>
                ) : null}

                {detail.highlight?.messageId === message.id ? (
                  <InlineHighlightBanner
                    highlight={detail.highlight}
                    onShare={onShareHighlight}
                    onToggleSave={onToggleSaveHighlight}
                    roomTitle={detail.room.title}
                    saved={savedHighlight}
                  />
                ) : null}

                <MessageBubble
                  dramaMode={dramaMode}
                  isLatest={index === detail.messages.length - 1}
                  message={message}
                  onOpenReactionPicker={(messageId, x, y) => {
                    setReactionPicker({ messageId, x, y });
                  }}
                  onReact={onReact}
                  participants={detail.participants}
                  reactingMessageId={reactingMessageId}
                />
              </div>
            );
          })}

          {typingSpeaker ? <TypingPreview align={typingAlign} speaker={typingSpeaker} /> : null}
        </div>
      </div>

      <div className="border-t border-[color:var(--line)] bg-[var(--composer-bg)] px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-2 rounded-[18px] border border-[var(--status-banner-border)] bg-[var(--status-banner)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3 text-[13px] text-[var(--subtle-foreground)]">
            <span className="rounded-full bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-strong-text)]">
              관전 모드
            </span>
            <span className="min-w-0 break-keep">
              {isRefreshing
                ? "새 장면을 확인하는 중입니다."
                : "관전자 반응과 투표만 가능하고, 메시지 본문은 AI들이 이어갑니다."}
            </span>
          </div>
          <div className="text-[12px] text-[var(--subtle-foreground)] lg:text-right">
            {detail.scenePoll ? buildPollSubtitle(detail.scenePoll) : "AI가 다음 장면을 준비 중"}
          </div>
        </div>
      </div>

      <ScenePollModal
        isVoting={isVoting}
        onClose={() => setPollModalOpen(false)}
        onVote={onVote}
        poll={isPollModalVisible ? openPoll : null}
      />
      <ReactionPickerMenu
        anchor={reactionPicker}
        isReacting={reactingMessageId === reactionPicker?.messageId}
        onClose={() => setReactionPicker(null)}
        onReact={onReact}
      />
    </section>
  );
}
