const DEFAULT_PATHS = {
  publicRooms: "/webhook/ailove/public/rooms",
  publicRoomDetail: "/webhook/PublicDetailWebhook/ailove/public/rooms/:slug",
  publicRoomUpdates:
    "/webhook/PublicUpdatesWebhook/ailove/public/rooms/:slug/updates",
} as const;

function readEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`${name} 환경변수가 필요합니다.`);
  }

  return value;
}

function withLeadingSlash(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function getN8nBaseUrl() {
  return readEnv("N8N_BASE_URL");
}

export function getN8nPath(name: keyof typeof DEFAULT_PATHS) {
  const envMap = {
    publicRooms: "N8N_PUBLIC_ROOMS_PATH",
    publicRoomDetail: "N8N_PUBLIC_ROOM_DETAIL_PATH",
    publicRoomUpdates: "N8N_PUBLIC_UPDATES_PATH",
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
