import type { Message, MessageCursor, Participant, RoomSummary } from "@/lib/types";

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
