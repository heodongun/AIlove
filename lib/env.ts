import type { PublicN8nConfig } from "@/lib/types";

const DEFAULT_PATHS = {
  publicRooms: "/webhook/ailove/public/rooms",
  publicRoomDetail: "/webhook/PublicDetailWebhook/ailove/public/rooms/:slug",
  publicRoomUpdates: "/webhook/PublicUpdatesWebhook/ailove/public/rooms/:slug/updates",
  publicVote: "/webhook/AIloveVoteWebhook/ailove/public/rooms/:slug/vote",
  publicReaction: "/webhook/AIloveReactionWebhook/ailove/public/messages/:messageId/reactions",
  publicHubRooms: "/webhook/ailove/public/hub/rooms",
  publicHubRoomDetail: "/webhook/ailove/public/hub/rooms/:slug",
  publicHubRoomUpdates: "/webhook/ailove/public/hub/rooms/:slug/updates",
} as const;

function readEnv(names: readonly string[], fallback?: string) {
  for (const name of names) {
    const candidate = process.env[name];

    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`${names[0]} 환경변수가 필요합니다.`);
}

function withLeadingSlash(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function getN8nBaseUrl() {
  return readEnv(["NEXT_PUBLIC_N8N_BASE_URL", "N8N_BASE_URL"]);
}

export function getN8nPath(name: keyof typeof DEFAULT_PATHS) {
  const envMap = {
    publicRooms: ["NEXT_PUBLIC_N8N_PUBLIC_ROOMS_PATH", "N8N_PUBLIC_ROOMS_PATH"],
    publicRoomDetail: [
      "NEXT_PUBLIC_N8N_PUBLIC_ROOM_DETAIL_PATH",
      "N8N_PUBLIC_ROOM_DETAIL_PATH",
    ],
    publicRoomUpdates: [
      "NEXT_PUBLIC_N8N_PUBLIC_UPDATES_PATH",
      "N8N_PUBLIC_UPDATES_PATH",
    ],
    publicVote: ["NEXT_PUBLIC_N8N_PUBLIC_VOTE_PATH", "N8N_PUBLIC_VOTE_PATH"],
    publicReaction: [
      "NEXT_PUBLIC_N8N_PUBLIC_REACTION_PATH",
      "N8N_PUBLIC_REACTION_PATH",
    ],
    publicHubRooms: [
      "NEXT_PUBLIC_N8N_PUBLIC_HUB_ROOMS_PATH",
      "N8N_PUBLIC_HUB_ROOMS_PATH",
    ],
    publicHubRoomDetail: [
      "NEXT_PUBLIC_N8N_PUBLIC_HUB_ROOM_DETAIL_PATH",
      "N8N_PUBLIC_HUB_ROOM_DETAIL_PATH",
    ],
    publicHubRoomUpdates: [
      "NEXT_PUBLIC_N8N_PUBLIC_HUB_UPDATES_PATH",
      "N8N_PUBLIC_HUB_UPDATES_PATH",
    ],
  } as const;

  return withLeadingSlash(readEnv(envMap[name], DEFAULT_PATHS[name]));
}

export function interpolatePath(
  template: string,
  replacements: Record<string, string | number>,
) {
  return template.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const value = replacements[key];

    if (value === undefined || value === null) {
      throw new Error(`경로 변수 ${key}가 필요합니다.`);
    }

    return encodeURIComponent(String(value));
  });
}

export function getPublicN8nConfig(): PublicN8nConfig {
  return {
    baseUrl: getN8nBaseUrl(),
    publicRoomsPath: getN8nPath("publicRooms"),
    publicRoomDetailPath: getN8nPath("publicRoomDetail"),
    publicRoomUpdatesPath: getN8nPath("publicRoomUpdates"),
    publicVotePath: getN8nPath("publicVote"),
    publicReactionPath: getN8nPath("publicReaction"),
    publicHubRoomsPath: getN8nPath("publicHubRooms"),
    publicHubRoomDetailPath: getN8nPath("publicHubRoomDetail"),
    publicHubRoomUpdatesPath: getN8nPath("publicHubRoomUpdates"),
  };
}
