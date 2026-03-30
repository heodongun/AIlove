import type {
  CharacterProfile,
  EmotionEvent,
  HighlightMoment,
  Message,
  MessageCursor,
  MessageMetaUpdate,
  MessageReactions,
  Participant,
  RelationshipFilter,
  RelationshipSnapshot,
  RelationshipStage,
  RelationshipTrend,
  RoomSummary,
  RoomType,
  ScenePoll,
} from "@/lib/types";

const KOREA_TIMEZONE = "Asia/Seoul";

export function parseKoreaDate(input: string | Date) {
  if (input instanceof Date) {
    return input;
  }

  const value = String(input ?? "").trim();

  if (!value) {
    return new Date(NaN);
  }

  if (/([zZ]|[+-]\d{2}:\d{2})$/.test(value)) {
    return new Date(value);
  }

  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?$/,
  );

  if (match) {
    const [, date, hour = "00", minute = "00", second = "00", fraction = ""] = match;
    const millisecond = fraction ? fraction.slice(0, 3).padEnd(3, "0") : "000";

    return new Date(`${date}T${hour}:${minute}:${second}.${millisecond}+09:00`);
  }

  return new Date(value);
}

export function toKoreaDateTimeAttr(input: string | Date) {
  const date = parseKoreaDate(input);
  return Number.isNaN(date.getTime()) ? String(input) : date.toISOString();
}

function formatDateKey(input: string | Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: KOREA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parseKoreaDate(input));
}

function hashValue(input: string) {
  return Array.from(input).reduce((acc, char) => {
    return (acc * 31 + char.charCodeAt(0)) % 360;
  }, 18);
}

export function getAvatarPalette(seed: string | null | undefined) {
  const hue = hashValue(seed ?? "ailove");

  return {
    background: `linear-gradient(135deg, hsla(${hue}, 76%, 84%, 1), hsla(${(hue + 36) % 360}, 72%, 76%, 1))`,
    border: `hsla(${(hue + 14) % 360}, 55%, 45%, 0.36)`,
    tint: `hsla(${hue}, 78%, 58%, 0.14)`,
  };
}

export function getInitials(name: string, maxChars = 2) {
  const trimmed = name.trim();

  if (!trimmed) {
    return "AI";
  }

  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return words
      .slice(0, maxChars)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  return trimmed.slice(0, maxChars).toUpperCase();
}

export function getAvatarLabel(name: string, size: number) {
  return getInitials(name, size <= 28 ? 1 : 2);
}

export function shortenText(input: string, maxLength = 48) {
  const trimmed = input.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function formatRelativeTime(input: string | null) {
  if (!input) {
    return "방금";
  }

  const date = parseKoreaDate(input);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "방금";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIMEZONE,
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatClockTime(input: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(parseKoreaDate(input));
}

export function formatSidebarTime(input: string | null) {
  if (!input) {
    return "";
  }

  const date = parseKoreaDate(input);
  const now = new Date();

  if (formatDateKey(date) === formatDateKey(now)) {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: KOREA_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIMEZONE,
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export function formatDayLabel(input: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIMEZONE,
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parseKoreaDate(input));
}

export function sameDay(left: string, right: string) {
  return formatDateKey(left) === formatDateKey(right);
}

export function latestMessageCursor(messages: Message[]): MessageCursor {
  const lastMessage = messages.at(-1);

  if (!lastMessage) {
    return {};
  }

  return {
    after: lastMessage.postedAt,
    afterId: String(lastMessage.id),
  };
}

export function mergeMessages(existing: Message[], incoming: Message[]) {
  const deduped = new Map<number, Message>();

  for (const message of existing) {
    deduped.set(message.id, message);
  }

  for (const message of incoming) {
    deduped.set(message.id, message);
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const leftTime = parseKoreaDate(left.postedAt).getTime();
    const rightTime = parseKoreaDate(right.postedAt).getTime();

    if (leftTime === rightTime) {
      return left.id - right.id;
    }

    return leftTime - rightTime;
  });
}

export function mergeMessageMeta(messages: Message[], updates: MessageMetaUpdate[]) {
  if (updates.length === 0) {
    return messages;
  }

  const byId = new Map(updates.map((update) => [update.messageId, update.reactions]));

  return messages.map((message) => {
    const reactions = byId.get(message.id);

    if (!reactions) {
      return message;
    }

    return {
      ...message,
      reactions,
    };
  });
}

export function updateRoomsWithLatestMessages(
  rooms: RoomSummary[],
  roomSlug: string,
  incoming: Message[],
) {
  const latest =
    [...incoming].reverse().find((message) => message.messageType !== "system") ??
    incoming.at(-1);

  if (!latest) {
    return rooms;
  }

  const nextRooms = rooms.map((room) => {
    if (room.slug !== roomSlug) {
      return room;
    }

    return {
      ...room,
      lastMessagePreview: latest.content,
      lastMessageAt: latest.postedAt,
    };
  });

  return nextRooms.sort((left, right) => {
    const leftTime = left.lastMessageAt ? parseKoreaDate(left.lastMessageAt).getTime() : 0;
    const rightTime = right.lastMessageAt ? parseKoreaDate(right.lastMessageAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

export function roomTraitHighlights(participants: Participant[]) {
  const unique = new Set<string>();

  for (const participant of participants) {
    for (const trait of participant.traits) {
      unique.add(trait);

      if (unique.size >= 4) {
        return [...unique];
      }
    }
  }

  return [...unique];
}

export function matchesRoomQuery(room: RoomSummary, query: string) {
  const q = query.trim().toLowerCase();

  if (!q) {
    return true;
  }

  const text = [
    room.title,
    room.subtitle,
    room.description,
    room.currentSituation,
    room.lastMessagePreview,
    room.highlightQuote,
    room.relationshipSnapshot.heroLine,
    room.relationshipSnapshot.currentSituation,
    room.relationshipSnapshot.confessionPrediction?.actorDisplayName ?? "",
    room.relationshipSnapshot.dominantPair?.label ?? "",
    ...room.participants.map((participant) => participant.displayName),
    ...room.participants.map((participant) => participant.bio ?? ""),
    ...room.participants.flatMap((participant) => participant.traits),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes(q);
}

const STAGE_META: Record<
  RelationshipStage,
  { label: string; emoji: string; filterLabel: string; tone: string }
> = {
  awkward: {
    label: "어색함",
    emoji: "💔",
    filterLabel: "어색함",
    tone: "조심스럽고 거리감이 아직 남아 있는 상태",
  },
  interest: {
    label: "호감",
    emoji: "🙂",
    filterLabel: "호감",
    tone: "신경은 쓰이지만 아직 확인하지 않은 상태",
  },
  flirt: {
    label: "썸",
    emoji: "💞",
    filterLabel: "썸",
    tone: "밀고 당기며 감정을 드러내는 상태",
  },
  love: {
    label: "연애",
    emoji: "❤️",
    filterLabel: "연애",
    tone: "서로 감정을 거의 확인한 상태",
  },
  obsession: {
    label: "집착",
    emoji: "🔥",
    filterLabel: "집착",
    tone: "강하게 끌리지만 균형이 흔들리는 상태",
  },
  group: {
    label: "단톡",
    emoji: "🎭",
    filterLabel: "단톡",
    tone: "여러 페어가 번갈아 장면을 흔드는 상태",
  },
};

const TREND_META: Record<
  RelationshipTrend,
  { label: string; symbol: string; tone: string }
> = {
  rising: {
    label: "감정 상승 중",
    symbol: "🔺",
    tone: "감정이 붙고 있다",
  },
  falling: {
    label: "감정 하락 중",
    symbol: "🔻",
    tone: "거리를 다시 재는 중",
  },
  stable: {
    label: "유지 중",
    symbol: "➖",
    tone: "감정선이 유지되는 중",
  },
  conflict: {
    label: "갈등 발생",
    symbol: "🔴",
    tone: "오해나 부딪힘이 생긴 상태",
  },
  recovery: {
    label: "관계 회복",
    symbol: "🟢",
    tone: "감정을 다시 풀어내는 중",
  },
};

export function getStageMeta(stage: RelationshipStage) {
  return STAGE_META[stage] ?? STAGE_META.interest;
}

export function getTrendMeta(trend: RelationshipTrend) {
  return TREND_META[trend] ?? TREND_META.stable;
}

export function normalizeRelationshipSnapshot(
  snapshot: RelationshipSnapshot,
  roomType: RoomType,
): RelationshipSnapshot {
  const stage = roomType === "group" ? "group" : snapshot.stage;
  const stageMeta = getStageMeta(stage);
  const trendMeta = getTrendMeta(snapshot.trend);

  return {
    ...snapshot,
    stage,
    stageLabel: snapshot.stageLabel || stageMeta.label,
    heroLine:
      snapshot.heroLine || `지금: ${stageMeta.label} 단계 (${trendMeta.label})`,
    currentSituation:
      snapshot.currentSituation || `${stageMeta.tone}. ${trendMeta.tone}.`,
  };
}

export function matchesRelationshipFilter(
  room: RoomSummary,
  filter: RelationshipFilter,
  snapshot = room.relationshipSnapshot,
) {
  if (filter === "all") {
    return true;
  }

  return normalizeRelationshipSnapshot(snapshot, room.roomType).stage === filter;
}

export function filterLabel(filter: RelationshipFilter) {
  if (filter === "all") {
    return "전체";
  }

  return getStageMeta(filter).filterLabel;
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildCharacterProfiles(
  participants: Participant[],
  existingProfiles: CharacterProfile[],
) {
  if (existingProfiles.length > 0) {
    return existingProfiles;
  }

  return participants.map((participant) => ({
    participantId: participant.id,
    handle: participant.handle,
    displayName: participant.displayName,
    shortHook: participant.bio ?? `${participant.displayName}다운 온도를 유지하는 사람`,
    personaBullets:
      participant.traits.length > 0
        ? participant.traits.slice(0, 3)
        : [participant.roleLabel ?? "상황을 읽음", "감정 표현", "관계 탐색"],
    signatureStyle: participant.roleLabel,
  }));
}

export function buildEmotionTimelineFallback(
  messages: Message[],
  snapshot: RelationshipSnapshot,
): EmotionEvent[] {
  const recent = messages.filter((message) => message.messageType === "text").slice(-5);

  if (recent.length === 0) {
    return [];
  }

  return recent.slice(-3).map((message, index) => ({
    id: `fallback-${message.id}`,
    eventType:
      snapshot.trend === "conflict"
        ? "conflict"
        : snapshot.trend === "recovery"
          ? "recovery"
          : "rise",
    label:
      index === recent.slice(-3).length - 1
        ? getTrendMeta(snapshot.trend).label
        : shortenText(message.content, 24),
    at: message.postedAt,
    pairIds: [],
    pairHandles: [],
    impact: Math.max(1, Math.min(5, Math.round(snapshot.affectionScore / 20))),
  }));
}

export function buildHighlightFallback(messages: Message[]): string | null {
  const candidates = messages
    .filter((message) => message.messageType === "text")
    .slice(-12)
    .sort((left, right) => right.content.length - left.content.length);

  return candidates[0] ? shortenText(candidates[0].content, 56) : null;
}

export function buildRelationshipHero(snapshot: RelationshipSnapshot) {
  const stageMeta = getStageMeta(snapshot.stage);
  const trendMeta = getTrendMeta(snapshot.trend);
  return `${stageMeta.emoji} ${snapshot.heroLine || `지금: ${stageMeta.label} 단계 (${trendMeta.label})`}`;
}

export function buildConfessionLine(snapshot: RelationshipSnapshot) {
  const prediction = snapshot.confessionPrediction;

  if (!prediction?.actorDisplayName || prediction.probability <= 0) {
    return "아직 누가 먼저 움직일지 숨죽여 지켜보는 중";
  }

  return `${prediction.actorDisplayName}가 먼저 고백할 확률 ${prediction.probability}%`;
}

export function buildCurrentSituation(snapshot: RelationshipSnapshot, currentSituation?: string | null) {
  const base = currentSituation || snapshot.currentSituation;
  return base ? `🔥 현재 상황: ${base}` : "🔥 현재 상황: 감정선이 서서히 움직이는 중";
}

export function stripSituationPrefix(input: string) {
  return input.replace(/^🔥\s*현재 상황:\s*/, "").trim();
}

export function buildTurningPointLine(
  events: EmotionEvent[],
  highlight?: HighlightMoment | null,
) {
  if (highlight?.reason) {
    return `최근 변곡점: ${highlight.reason}`;
  }

  const latest = events.at(-1);
  if (!latest) {
    return "최근 변곡점: 아직 큰 전환은 열리지 않았어요.";
  }

  return `최근 변곡점: ${latest.label}`;
}

export function buildSnapshotMetaTitle(snapshot: RelationshipSnapshot) {
  return `관계 단계와 감정 변화는 최근 장면 기준 추정치입니다. 현재 단계는 ${snapshot.stageLabel}, 추세는 ${getTrendMeta(snapshot.trend).label}입니다.`;
}

export function buildSparkline(events: EmotionEvent[]) {
  if (events.length === 0) {
    return "▁▂▂";
  }

  const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  return events
    .slice(-5)
    .map((event) => {
      const bucket = Math.max(0, Math.min(chars.length - 1, event.impact + 2));
      return chars[bucket];
    })
    .join("");
}

export function buildSnapshotSparkline(snapshot: RelationshipSnapshot) {
  const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const base = Math.max(1, Math.min(chars.length - 2, Math.round(snapshot.affectionScore / 16)));
  const delta = Math.max(-2, Math.min(2, snapshot.trendDelta));
  const points =
    snapshot.trend === "rising"
      ? [base - 2, base - 1, base, base + 1, base + 1 + delta]
      : snapshot.trend === "falling"
        ? [base + 1, base, base, base - 1, base - 1 + delta]
        : snapshot.trend === "conflict"
          ? [base + 1, base, base - 2, base - 1, base - 1 + delta]
          : snapshot.trend === "recovery"
            ? [base - 2, base - 1, base, base + 1, base + 2]
            : [base - 1, base, base, base, base + delta];

  return points
    .map((value) => chars[Math.max(0, Math.min(chars.length - 1, value))] ?? chars[1])
    .join("");
}

export function buildPollSubtitle(poll: ScenePoll | null) {
  if (!poll) {
    return "다음 장면은 AI들이 알아서 이어갑니다.";
  }

  return poll.status === "open"
    ? `관전자 ${poll.totalVotes}명이 다음 장면에 개입 중`
    : `직전 장면 투표가 마감되었습니다 (${poll.totalVotes}표)`;
}

export function messageAlignment(message: Message, participants: Participant[]) {
  if (!message.speakerId) {
    return "center";
  }

  const index = participants.findIndex((participant) => participant.id === message.speakerId);

  if (index === -1) {
    return "left";
  }

  return index % 2 === 0 ? "left" : "right";
}

export function reactionOptions() {
  return ["😍", "🤭", "😭", "😮", "💘"];
}

export function mergeReactionUpdate(
  messages: Message[],
  update: { messageId: number; reactions: MessageReactions },
) {
  return messages.map((message) =>
    message.id === update.messageId
      ? {
          ...message,
          reactions: update.reactions,
        }
      : message,
  );
}

export function eventBadgeTone(event: EmotionEvent) {
  switch (event.eventType) {
    case "rise":
      return "rise";
    case "recovery":
      return "recovery";
    case "conflict":
      return "conflict";
    case "drop":
    case "distance":
      return "drop";
    case "confession_attempt":
      return "spotlight";
    default:
      return "rise";
  }
}

export function roomIntro(room: Pick<RoomSummary, "subtitle" | "description" | "participants">) {
  if (room.subtitle?.trim()) {
    return room.subtitle.trim();
  }

  if (room.description?.trim()) {
    return shortenText(room.description.trim(), 48);
  }

  return room.participants
    .map((participant) => participant.roleLabel || participant.bio || participant.displayName)
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");
}

export function participantIntro(participant: Participant) {
  return participant.bio || participant.roleLabel || participant.handle;
}

export function quoteShareText(roomTitle: string, quote: string) {
  return `${roomTitle}\n\n✨ 오늘의 명대사\n"${quote}"`;
}

export function buildMessageSearchText(message: Message) {
  return compactText(
    [message.speakerDisplayName ?? message.speakerHandle ?? "", message.content].join(" "),
  ).toLowerCase();
}
