import { getN8nBaseUrl, getN8nPath, interpolatePath } from "@/lib/env";
import type {
  Message,
  Participant,
  PublicN8nConfig,
  RoomDetailPayload,
  RoomSummary,
  RoomUpdatesPayload,
  RoomsPayload,
} from "@/lib/types";

type RoomsQuery = {
  limit?: string | number;
  q?: string;
  type?: string;
};

type UpdatesQuery = {
  after?: string;
  afterId?: string;
};

function coerceTraits(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((trait) => String(trait));
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((trait) => String(trait)) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeParticipant(value: Record<string, unknown>): Participant {
  return {
    id: Number(value.id ?? 0),
    handle: String(value.handle ?? ""),
    displayName: String(value.displayName ?? value.display_name ?? ""),
    bio: value.bio ? String(value.bio) : null,
    traits: coerceTraits(value.traits ?? value.traits_json),
    avatarSeed: value.avatarSeed ? String(value.avatarSeed) : value.avatar_seed ? String(value.avatar_seed) : null,
    roleLabel: value.roleLabel ? String(value.roleLabel) : value.role_label ? String(value.role_label) : null,
  };
}

function normalizeMessage(value: Record<string, unknown>): Message {
  return {
    id: Number(value.id ?? 0),
    roomId: Number(value.roomId ?? value.room_id ?? 0),
    speakerId:
      value.speakerId === null || value.speakerId === undefined
        ? null
        : Number(value.speakerId),
    speakerHandle:
      value.speakerHandle === null || value.speakerHandle === undefined
        ? null
        : String(value.speakerHandle),
    speakerDisplayName:
      value.speakerDisplayName === null || value.speakerDisplayName === undefined
        ? null
        : String(value.speakerDisplayName),
    roleLabel:
      value.roleLabel === null || value.roleLabel === undefined
        ? null
        : String(value.roleLabel),
    messageType:
      value.messageType === "system" || value.message_type === "system"
        ? "system"
        : "text",
    content: String(value.content ?? ""),
    postedAt: String(value.postedAt ?? value.posted_at ?? new Date().toISOString()),
  };
}

function normalizeRoomSummary(value: Record<string, unknown>): RoomSummary {
  const participantsRaw = Array.isArray(value.participants) ? value.participants : [];

  return {
    id: Number(value.id ?? 0),
    slug: String(value.slug ?? ""),
    title: String(value.title ?? ""),
    subtitle: value.subtitle ? String(value.subtitle) : null,
    description: value.description ? String(value.description) : null,
    roomType: value.roomType === "group" ? "group" : "couple",
    coverColor: value.coverColor ? String(value.coverColor) : null,
    participants: participantsRaw.map((participant) =>
      normalizeParticipant(participant as Record<string, unknown>),
    ),
    lastMessagePreview: String(value.lastMessagePreview ?? ""),
    lastMessageAt: value.lastMessageAt ? String(value.lastMessageAt) : null,
  };
}

function withQuery(url: URL, query: Record<string, string | number | undefined>) {
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

export class UpstreamError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

function resolveConfig(config?: PublicN8nConfig) {
  if (config) {
    return config;
  }

  return {
    baseUrl: getN8nBaseUrl(),
    publicRoomsPath: getN8nPath("publicRooms"),
    publicRoomDetailPath: getN8nPath("publicRoomDetail"),
    publicRoomUpdatesPath: getN8nPath("publicRoomUpdates"),
  } satisfies PublicN8nConfig;
}

async function fetchPublicJson(
  path: string,
  query: Record<string, string | number | undefined> = {},
  config?: PublicN8nConfig,
) {
  const resolved = resolveConfig(config);
  const url = withQuery(new URL(path, resolved.baseUrl), query);
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let message = "n8n upstream 요청이 실패했습니다.";

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      message = response.statusText || message;
    }

    throw new UpstreamError(message, response.status);
  }

  return (await response.json()) as Record<string, unknown>;
}

export async function getPublicRooms(
  query: RoomsQuery = {},
  config?: PublicN8nConfig,
): Promise<RoomsPayload> {
  const payload = await fetchPublicJson(resolveConfig(config).publicRoomsPath, query, config);
  const rooms = Array.isArray(payload.rooms) ? payload.rooms : [];

  return {
    rooms: rooms.map((room) => normalizeRoomSummary(room as Record<string, unknown>)),
    serverTime: String(payload.serverTime ?? new Date().toISOString()),
  };
}

export async function getPublicRoomDetail(
  slug: string,
  config?: PublicN8nConfig,
): Promise<RoomDetailPayload> {
  const resolved = resolveConfig(config);
  const payload = await fetchPublicJson(
    interpolatePath(resolved.publicRoomDetailPath, { slug }),
    {},
    config,
  );

  const roomRaw = payload.room as Record<string, unknown> | undefined;
  if (!roomRaw) {
    throw new UpstreamError("채팅방 정보를 찾지 못했습니다.", 404);
  }

  const participants = Array.isArray(payload.participants)
    ? payload.participants.map((participant) =>
        normalizeParticipant(participant as Record<string, unknown>),
      )
    : [];

  return {
    room: {
      ...normalizeRoomSummary({
        ...roomRaw,
        participants,
        lastMessagePreview: "",
        lastMessageAt: null,
      }),
      createdAt: roomRaw.createdAt ? String(roomRaw.createdAt) : null,
    },
    participants,
    messages: Array.isArray(payload.messages)
      ? payload.messages.map((message) =>
          normalizeMessage(message as Record<string, unknown>),
        )
      : [],
    serverTime: String(payload.serverTime ?? new Date().toISOString()),
  };
}

export async function getPublicRoomUpdates(
  slug: string,
  query: UpdatesQuery = {},
  config?: PublicN8nConfig,
): Promise<RoomUpdatesPayload> {
  const resolved = resolveConfig(config);
  const payload = await fetchPublicJson(
    interpolatePath(resolved.publicRoomUpdatesPath, { slug }),
    query,
    config,
  );

  return {
    roomSlug: String(payload.roomSlug ?? slug),
    messages: Array.isArray(payload.messages)
      ? payload.messages.map((message) =>
          normalizeMessage(message as Record<string, unknown>),
        )
      : [],
    serverTime: String(payload.serverTime ?? new Date().toISOString()),
  };
}
