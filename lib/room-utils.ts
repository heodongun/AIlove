import type {
  Message,
  MessageCursor,
  Participant,
  RoomSummary,
  RoomType,
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

    return new Date(
      `${date}T${hour}:${minute}:${second}.${millisecond}+09:00`,
    );
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
    background: `linear-gradient(135deg, hsla(${hue}, 76%, 84%, 1), hsla(${(hue + 38) % 360}, 72%, 74%, 1))`,
    border: `hsla(${(hue + 22) % 360}, 65%, 52%, 0.34)`,
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
  const sameDate = formatDateKey(date) === formatDateKey(now);

  if (sameDate) {
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

export function shortenText(input: string, maxLength = 48) {
  const trimmed = input.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function roomTraitHighlights(participants: Participant[]) {
  const values = participants.flatMap((participant) => participant.traits);
  const unique = new Set<string>();

  for (const value of values) {
    unique.add(value);
    if (unique.size >= 4) {
      break;
    }
  }

  return Array.from(unique);
}

export function buildConversationHighlights(
  messages: Message[],
  fallback = "새 메시지가 들어오면 이곳에 대화 흐름이 요약됩니다.",
) {
  const recent = messages
    .filter((message) => message.messageType !== "system")
    .slice(-3);

  if (recent.length === 0) {
    return [fallback];
  }

  return recent.map((message) => {
    const speaker = message.speakerDisplayName ?? message.speakerHandle ?? "AI";
    return `${speaker}: ${shortenText(message.content, 56)}`;
  });
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function topTopicKeywords(messages: Message[], participants: Participant[]) {
  const stopwords = new Set([
    "오늘",
    "지금",
    "정말",
    "그냥",
    "조금",
    "계속",
    "이제",
    "우리",
    "내가",
    "네가",
    "나는",
    "너는",
    "있어",
    "없어",
    "그래서",
    "이렇게",
    "그렇게",
    "근데",
    "좋아",
    "맞아",
    "응",
    "방금",
    "아까",
    "이번",
    "같아",
    "그말",
    "말이",
    "흐름",
    "분위기",
    "한마디",
    "얘기",
    "대화",
  ]);

  const participantTokens = new Set(
    participants
      .flatMap((participant) => [participant.displayName, participant.handle])
      .map((token) => token.toLowerCase()),
  );

  const counts = new Map<string, number>();

  for (const message of messages) {
    const words = compactText(message.content)
      .toLowerCase()
      .match(/[가-힣a-z0-9]{2,}/g);

    if (!words) {
      continue;
    }

    for (const word of words) {
      if (stopwords.has(word) || participantTokens.has(word)) {
        continue;
      }

      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([word]) => word);
}

function detectConversationTone(messages: Message[]) {
  const source = compactText(messages.map((message) => message.content).join(" ")).toLowerCase();
  const score = {
    warm: 0,
    teasing: 0,
    candid: 0,
    calm: 0,
  };

  const apply = (keywords: string[], key: keyof typeof score, weight = 1) => {
    for (const keyword of keywords) {
      if (source.includes(keyword)) {
        score[key] += weight;
      }
    }
  };

  apply(["좋아", "다정", "설렌", "기억", "듣고 싶", "남아", "보고 싶"], "warm", 2);
  apply(["반칙", "장난", "들켰", "티", "웃", "놀리"], "teasing", 2);
  apply(["솔직", "분명", "진심", "숨기", "직접", "말할게"], "candid", 2);
  apply(["천천히", "조용", "차분", "오래", "가만", "천천"], "calm", 1);

  return Object.entries(score).sort((left, right) => right[1] - left[1])[0]?.[0] as
    | "warm"
    | "teasing"
    | "candid"
    | "calm";
}

function countNameMentions(messages: Message[], participants: Participant[]) {
  return messages.reduce((total, message) => {
    const content = message.content;
    const mentions = participants.some((participant) =>
      [participant.displayName, participant.handle].some(
        (token) => token && token !== message.speakerDisplayName && content.includes(token),
      ),
    );

    return total + (mentions ? 1 : 0);
  }, 0);
}

function consecutiveReplyCount(messages: Message[]) {
  let total = 0;

  for (let index = 1; index < messages.length; index += 1) {
    const previous = messages[index - 1];
    const current = messages[index];

    if (
      previous.speakerId &&
      current.speakerId &&
      previous.speakerId !== current.speakerId
    ) {
      total += 1;
    }
  }

  return total;
}

export function getAffectionScore(
  messages: Message[],
  participants: Participant[],
  roomType: RoomType,
) {
  const textMessages = messages.filter((message) => message.messageType === "text").slice(-12);

  if (textMessages.length === 0) {
    return roomType === "couple" ? 18 : 12;
  }

  const combined = compactText(textMessages.map((message) => message.content).join(" "));
  const keywordHits = [
    "좋아",
    "설레",
    "보고 싶",
    "다정",
    "기억",
    "솔직",
    "분명",
    "진심",
    "티",
    "들켰",
    "오래 남",
    "기울",
    "가까워",
    "애매하게 안 할게",
  ].reduce((total, keyword) => total + (combined.includes(keyword) ? 1 : 0), 0);
  const replies = consecutiveReplyCount(textMessages);
  const nameMentions = countNameMentions(textMessages, participants);
  const uniqueSpeakers = new Set(
    textMessages.map((message) => message.speakerHandle).filter(Boolean),
  ).size;

  let score = roomType === "couple" ? 28 : 22;
  score += Math.min(24, replies * 4);
  score += Math.min(26, keywordHits * 5);
  score += Math.min(14, nameMentions * 3);
  score += Math.min(10, uniqueSpeakers * 2);

  if (roomType === "group" && uniqueSpeakers >= 4) {
    score += 8;
  }

  return Math.max(0, Math.min(100, score));
}

export function getAffectionLabel(score: number, roomType: RoomType) {
  if (roomType === "group") {
    if (score >= 80) {
      return "방 안 전체 텐션이 꽤 진해진 상태";
    }

    if (score >= 60) {
      return "여러 커플이 번갈아 분위기를 올리는 중";
    }

    if (score >= 40) {
      return "서로 눈치 보면서도 끼어드는 단계";
    }

    return "아직은 조심스럽게 탐색 중";
  }

  if (score >= 80) {
    return "감정선이 꽤 짙어진 상태";
  }

  if (score >= 60) {
    return "서로 호감이 선명해지는 중";
  }

  if (score >= 40) {
    return "좋아하는 티가 조금씩 나는 단계";
  }

  return "아직은 조심스럽게 간 보는 단계";
}

export function buildConversationSummary(
  messages: Message[],
  participants: Participant[],
  roomType: RoomType,
) {
  const textMessages = messages.filter((message) => message.messageType === "text").slice(-8);

  if (textMessages.length === 0) {
    return "아직 뚜렷한 대화 흐름은 없고, 새 메시지를 기다리는 중입니다.";
  }

  const recentSpeakers = [...new Set(
    textMessages
      .map((message) => message.speakerDisplayName ?? message.speakerHandle)
      .filter(Boolean),
  )];
  const lastSpeaker =
    textMessages.at(-1)?.speakerDisplayName ?? textMessages.at(-1)?.speakerHandle ?? "누군가";
  const topicKeywords = topTopicKeywords(textMessages, participants);
  const tone = detectConversationTone(textMessages);

  const toneDescription = {
    warm: "다정하게 받아치며",
    teasing: "장난을 섞어 밀고 당기며",
    candid: "솔직한 표현을 더 자주 꺼내며",
    calm: "천천히 여운을 남기며",
  }[tone || "warm"];

  if (roomType === "couple") {
    const left = participants[0]?.displayName ?? recentSpeakers[0] ?? "두 사람";
    const right = participants[1]?.displayName ?? recentSpeakers[1] ?? "상대";
    const topicPart =
      topicKeywords.length > 0 ? `${topicKeywords.join(", ")} 같은 얘기를 이어가며 ` : "";

    return `${left}와 ${right}가 ${topicPart}${toneDescription} 대화를 이어가는 중입니다. 최근엔 ${lastSpeaker} 쪽이 한마디를 더 보태면서 감정선이 조금 더 가까워졌습니다.`;
  }

  const speakerLine =
    recentSpeakers.length >= 3
      ? `${recentSpeakers.slice(0, 3).join(", ")}가 번갈아 끼어들며`
      : `${recentSpeakers.join(", ")}가 주고받으며`;
  const topicPart =
    topicKeywords.length > 0 ? `${topicKeywords.join(", ")} 흐름으로 ` : "";

  return `${speakerLine} ${topicPart}방 분위기를 ${toneDescription} 끌어올리는 중입니다. 방금은 ${lastSpeaker}의 말 뒤로 다른 커플도 바로 반응하는 흐름이 이어졌습니다.`;
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

export function updateRoomsWithLatestMessages(
  rooms: RoomSummary[],
  roomSlug: string,
  incoming: Message[],
) {
  const latest = [...incoming]
    .reverse()
    .find((message) => message.messageType !== "system") ?? incoming.at(-1);

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
