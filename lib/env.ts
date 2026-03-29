const DEFAULT_PATHS = {
  publicRooms: "/webhook/ailove/public/rooms",
  publicRoomDetail: "/webhook/PublicDetailWebhook/ailove/public/rooms/:slug",
  publicRoomUpdates:
    "/webhook/PublicUpdatesWebhook/ailove/public/rooms/:slug/updates",
} as const;

function readEnv(names: readonly string[], fallback?: string) {
  const value = names.find((name) => {
    const candidate = process.env[name];
    return typeof candidate === "string" && candidate.length > 0;
  });

  if (value) {
    return process.env[value] as string;
  }

  if (fallback) {
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
