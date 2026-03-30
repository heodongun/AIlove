import type {
  HubAgent,
  HubFacing,
  HubFloorKind,
  HubInteraction,
  HubMapDefinition,
  HubPalette,
  HubPlacedProp,
  HubPoi,
  HubRoomDetailPayload,
  HubRoomSummary,
  HubSpawnPoint,
  Participant,
  RelationshipSnapshot,
  RelationshipStage,
  RoomDetailPayload,
  RoomSummary,
} from "@/lib/types";

function createFloor(width: number, height: number, fill: HubFloorKind) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function createCollision(width: number, height: number, fill = false) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function paintRect<T>(
  grid: T[][],
  x: number,
  y: number,
  width: number,
  height: number,
  value: T,
) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      if (grid[row]?.[col] !== undefined) {
        grid[row][col] = value;
      }
    }
  }
}

function addWalls(
  floor: HubFloorKind[][],
  collision: boolean[][],
  props: HubPlacedProp[],
  width: number,
  height: number,
) {
  for (let x = 0; x < width; x += 1) {
    collision[0][x] = true;
    collision[height - 1][x] = true;
  }

  for (let y = 0; y < height; y += 1) {
    collision[y][0] = true;
    collision[y][width - 1] = true;
  }

  props.push(
    { id: "wall-top", kind: "wall", x: 0, y: 0, width, height: 1, solid: true },
    { id: "wall-bottom", kind: "wall", x: 0, y: height - 1, width, height: 1, solid: true },
    { id: "wall-left", kind: "wall", x: 0, y: 1, width: 1, height: height - 2, solid: true },
    {
      id: "wall-right",
      kind: "wall",
      x: width - 1,
      y: 1,
      width: 1,
      height: height - 2,
      solid: true,
    },
  );

  paintRect(floor, 0, 0, width, 1, "stone");
  paintRect(floor, 0, height - 1, width, 1, "stone");
}

function addProp(
  props: HubPlacedProp[],
  collision: boolean[][],
  prop: HubPlacedProp,
) {
  props.push(prop);

  if (prop.solid !== false) {
    paintRect(collision, prop.x, prop.y, prop.width, prop.height, true);
  }
}

function palette(values: Partial<HubPalette>): HubPalette {
  return {
    background: values.background ?? "#101116",
    wall: values.wall ?? "#34323f",
    woodLight: values.woodLight ?? "#b58b61",
    woodDark: values.woodDark ?? "#6a4d3f",
    tileLight: values.tileLight ?? "#d7ddd9",
    tileDark: values.tileDark ?? "#9da7a2",
    rug: values.rug ?? "#734a6f",
    accent: values.accent ?? "#d6b45c",
    panel: values.panel ?? "rgba(17, 20, 28, 0.86)",
    panelBorder: values.panelBorder ?? "rgba(255,255,255,0.08)",
    text: values.text ?? "#f8f7f2",
    textMuted: values.textMuted ?? "#b8becc",
    minimapBg: values.minimapBg ?? "rgba(10, 12, 18, 0.9)",
  };
}

const ROOM_THEME = {
  "luna-nova": {
    mapId: "moon-lounge",
    ambientLabel: "새벽 라운지",
    paletteKey: "moon-lounge",
    palette: palette({
      background: "#0f1016",
      wall: "#2d2f3a",
      woodLight: "#b68966",
      woodDark: "#6e4f42",
      tileLight: "#cfd8d7",
      tileDark: "#9aa6a7",
      rug: "#5f6ca5",
      accent: "#d6b45a",
    }),
  },
  "atlas-mira": {
    mapId: "archive-study",
    ambientLabel: "서재형 오피스",
    paletteKey: "archive-study",
    palette: palette({
      background: "#111116",
      wall: "#2b2b35",
      woodLight: "#a57958",
      woodDark: "#614637",
      tileLight: "#d2d5d9",
      tileDark: "#a0a7ae",
      rug: "#607487",
      accent: "#96c9b1",
    }),
  },
  "sol-rio": {
    mapId: "cafe-corridor",
    ambientLabel: "카페형 복도",
    paletteKey: "cafe-corridor",
    palette: palette({
      background: "#121116",
      wall: "#34303a",
      woodLight: "#bb8f60",
      woodDark: "#6f513b",
      tileLight: "#ddd5c7",
      tileDark: "#b4aa97",
      rug: "#7c5a46",
      accent: "#f0c46a",
    }),
  },
  "midnight-club": {
    mapId: "midnight-club",
    ambientLabel: "야간 공용 라운지",
    paletteKey: "midnight-club",
    palette: palette({
      background: "#111016",
      wall: "#323140",
      woodLight: "#b18667",
      woodDark: "#684c43",
      tileLight: "#d4d7dd",
      tileDark: "#a2a7b6",
      rug: "#7b5674",
      accent: "#d890b0",
    }),
  },
  "haeon-jinwoo": {
    mapId: "desk-silence",
    ambientLabel: "업무 책상 존",
    paletteKey: "desk-silence",
    palette: palette({
      background: "#0e1016",
      wall: "#2a2f3a",
      woodLight: "#ab8867",
      woodDark: "#5e4a3f",
      tileLight: "#d7dee5",
      tileDark: "#a3acb5",
      rug: "#587aa0",
      accent: "#8cb6e5",
    }),
  },
  "seorin-woojin": {
    mapId: "bright-breakroom",
    ambientLabel: "브레이크룸",
    paletteKey: "bright-breakroom",
    palette: palette({
      background: "#151218",
      wall: "#38313a",
      woodLight: "#c09472",
      woodDark: "#765447",
      tileLight: "#e1d8d2",
      tileDark: "#b7ada6",
      rug: "#8c6476",
      accent: "#f0a4b1",
    }),
  },
} as const;

const AGENT_VISUALS = {
  luna: {
    hair: "#7de0cf",
    skin: "#f4d5bf",
    outfitPrimary: "#7bd5c7",
    outfitSecondary: "#4c746e",
    accent: "#d7f5ef",
  },
  nova: {
    hair: "#8d7ce7",
    skin: "#f0cfbf",
    outfitPrimary: "#9c7fff",
    outfitSecondary: "#57468f",
    accent: "#e8dcff",
  },
  atlas: {
    hair: "#c9d2dd",
    skin: "#ebcdb8",
    outfitPrimary: "#7c8f9f",
    outfitSecondary: "#445260",
    accent: "#eaf2f9",
  },
  mira: {
    hair: "#f1c8a7",
    skin: "#f3d7c2",
    outfitPrimary: "#e8b6d4",
    outfitSecondary: "#8e6079",
    accent: "#fff1f6",
  },
  sol: {
    hair: "#f0d77f",
    skin: "#f0cfb2",
    outfitPrimary: "#e3c36f",
    outfitSecondary: "#7b6141",
    accent: "#fff2bd",
  },
  rio: {
    hair: "#a8d17b",
    skin: "#f3d7c4",
    outfitPrimary: "#a4db7b",
    outfitSecondary: "#587448",
    accent: "#eefada",
  },
  haeon: {
    hair: "#8bbce5",
    skin: "#f3d7c7",
    outfitPrimary: "#90c7f2",
    outfitSecondary: "#4f6c84",
    accent: "#e8f5ff",
  },
  jinwoo: {
    hair: "#e3d7cf",
    skin: "#edcfbf",
    outfitPrimary: "#b7c2d5",
    outfitSecondary: "#636d80",
    accent: "#f4f7fc",
  },
  seorin: {
    hair: "#f29db5",
    skin: "#f5d8ca",
    outfitPrimary: "#f1a4b7",
    outfitSecondary: "#8d5363",
    accent: "#fff0f5",
  },
  woojin: {
    hair: "#cdd089",
    skin: "#f1d2bf",
    outfitPrimary: "#b5c26f",
    outfitSecondary: "#647148",
    accent: "#f8f9df",
  },
} as const;

function defaultFacing(index: number): HubFacing {
  return ["down", "left", "right", "up"][index % 4] as HubFacing;
}

function getThemeForSlug(slug: string) {
  return ROOM_THEME[slug as keyof typeof ROOM_THEME] ?? ROOM_THEME["midnight-club"];
}

function buildMap(slug: string): HubMapDefinition {
  const theme = getThemeForSlug(slug);
  const width = slug === "midnight-club" ? 26 : 22;
  const height = slug === "midnight-club" ? 18 : 16;
  const floor = createFloor(width, height, "wood");
  const collision = createCollision(width, height, false);
  const props: HubPlacedProp[] = [];

  addWalls(floor, collision, props, width, height);
  paintRect(floor, 1, 1, width - 2, height - 2, "wood");
  paintRect(floor, 2, 2, width - 4, Math.max(4, height - 7), "tile");
  paintRect(floor, 3, height - 5, width - 6, 3, "rug");

  const pois: HubPoi[] = [];
  const spawnPoints: HubSpawnPoint[] = [];

  switch (slug) {
    case "luna-nova": {
      addProp(props, collision, { id: "window-wall", kind: "window", x: 3, y: 1, width: 5, height: 1 });
      addProp(props, collision, { id: "sofa", kind: "sofa", x: 13, y: 10, width: 4, height: 2 });
      addProp(props, collision, { id: "coffee-table", kind: "table", x: 12, y: 8, width: 2, height: 2 });
      addProp(props, collision, { id: "water", kind: "watercooler", x: 18, y: 4, width: 1, height: 2 });
      addProp(props, collision, { id: "plant-left", kind: "plant", x: 3, y: 11, width: 1, height: 1 });
      addProp(props, collision, { id: "desk", kind: "desk_duo", x: 6, y: 4, width: 4, height: 2 });
      paintRect(floor, 11, 7, 7, 5, "accent");
      pois.push(
        { id: "window", kind: "window", label: "창가", x: 5, y: 2 },
        { id: "sofa", kind: "sofa", label: "소파", x: 14, y: 12 },
        { id: "water", kind: "watercooler", label: "정수기", x: 17, y: 5 },
      );
      spawnPoints.push(
        { handle: "luna", x: 8, y: 12, facing: "up" },
        { handle: "nova", x: 15, y: 6, facing: "left" },
      );
      break;
    }
    case "atlas-mira": {
      addProp(props, collision, { id: "books-1", kind: "bookshelf", x: 2, y: 2, width: 1, height: 4 });
      addProp(props, collision, { id: "books-2", kind: "bookshelf", x: 18, y: 2, width: 1, height: 4 });
      addProp(props, collision, { id: "desk-main", kind: "desk", x: 8, y: 5, width: 3, height: 2 });
      addProp(props, collision, { id: "notes", kind: "counter", x: 12, y: 4, width: 3, height: 1, label: "메모 보드" });
      addProp(props, collision, { id: "sofa-corner", kind: "sofa", x: 14, y: 10, width: 3, height: 2 });
      addProp(props, collision, { id: "lamp", kind: "lamp", x: 5, y: 10, width: 1, height: 1 });
      paintRect(floor, 7, 9, 6, 4, "rug");
      pois.push(
        { id: "desk", kind: "desk", label: "기록 책상", x: 9, y: 7 },
        { id: "reading", kind: "bookshelf", label: "서가", x: 3, y: 6 },
        { id: "quiet", kind: "sofa", label: "조용한 코너", x: 15, y: 12 },
      );
      spawnPoints.push(
        { handle: "atlas", x: 9, y: 9, facing: "up" },
        { handle: "mira", x: 14, y: 11, facing: "left" },
      );
      break;
    }
    case "sol-rio": {
      paintRect(floor, 2, 2, 5, 12, "tile");
      addProp(props, collision, { id: "bar", kind: "counter", x: 3, y: 4, width: 2, height: 4 });
      addProp(props, collision, { id: "table", kind: "table", x: 12, y: 6, width: 2, height: 2 });
      addProp(props, collision, { id: "sofa", kind: "sofa", x: 15, y: 10, width: 4, height: 2 });
      addProp(props, collision, { id: "plant", kind: "plant", x: 18, y: 4, width: 1, height: 1 });
      addProp(props, collision, { id: "water", kind: "watercooler", x: 6, y: 11, width: 1, height: 2 });
      pois.push(
        { id: "bar", kind: "bar", label: "카페 바", x: 5, y: 6 },
        { id: "hall", kind: "desk", label: "복도", x: 10, y: 8 },
        { id: "sofa", kind: "sofa", label: "라운지 소파", x: 16, y: 12 },
      );
      spawnPoints.push(
        { handle: "sol", x: 8, y: 11, facing: "right" },
        { handle: "rio", x: 14, y: 7, facing: "left" },
      );
      break;
    }
    case "haeon-jinwoo": {
      paintRect(floor, 2, 2, width - 4, 5, "tile");
      addProp(props, collision, { id: "desk-left", kind: "desk_duo", x: 4, y: 4, width: 4, height: 2 });
      addProp(props, collision, { id: "desk-right", kind: "desk_duo", x: 12, y: 4, width: 4, height: 2 });
      addProp(props, collision, { id: "window", kind: "window", x: 9, y: 1, width: 4, height: 1 });
      addProp(props, collision, { id: "plant", kind: "plant", x: 17, y: 10, width: 1, height: 1 });
      addProp(props, collision, { id: "table", kind: "table", x: 8, y: 10, width: 2, height: 2 });
      paintRect(floor, 6, 9, 8, 4, "rug");
      pois.push(
        { id: "desk-left", kind: "desk", label: "왼쪽 책상", x: 5, y: 6 },
        { id: "desk-right", kind: "desk", label: "오른쪽 책상", x: 14, y: 6 },
        { id: "window", kind: "window", label: "창가", x: 10, y: 2 },
      );
      spawnPoints.push(
        { handle: "haeon", x: 6, y: 11, facing: "right" },
        { handle: "jinwoo", x: 14, y: 11, facing: "left" },
      );
      break;
    }
    case "seorin-woojin": {
      paintRect(floor, 2, 2, width - 4, 6, "tile");
      addProp(props, collision, { id: "coffee-counter", kind: "counter", x: 3, y: 3, width: 4, height: 1 });
      addProp(props, collision, { id: "table-main", kind: "table", x: 9, y: 6, width: 2, height: 2 });
      addProp(props, collision, { id: "table-side", kind: "table", x: 14, y: 8, width: 2, height: 2 });
      addProp(props, collision, { id: "sofa", kind: "sofa", x: 14, y: 11, width: 4, height: 2 });
      addProp(props, collision, { id: "plant", kind: "plant", x: 5, y: 10, width: 1, height: 1 });
      pois.push(
        { id: "coffee", kind: "coffee", label: "커피존", x: 5, y: 4 },
        { id: "center-table", kind: "desk", label: "중앙 테이블", x: 10, y: 8 },
        { id: "sofa", kind: "sofa", label: "휴게 소파", x: 16, y: 12 },
      );
      spawnPoints.push(
        { handle: "seorin", x: 7, y: 11, facing: "right" },
        { handle: "woojin", x: 13, y: 10, facing: "left" },
      );
      break;
    }
    case "midnight-club":
    default: {
      paintRect(floor, 2, 2, width - 4, 6, "tile");
      paintRect(floor, 7, 9, 12, 5, "rug");
      addProp(props, collision, { id: "bar", kind: "counter", x: 3, y: 3, width: 5, height: 1 });
      addProp(props, collision, { id: "center-sofa", kind: "sofa", x: 10, y: 10, width: 5, height: 2 });
      addProp(props, collision, { id: "center-table", kind: "table", x: 12, y: 8, width: 2, height: 2 });
      addProp(props, collision, { id: "books", kind: "bookshelf", x: 20, y: 3, width: 1, height: 4 });
      addProp(props, collision, { id: "water", kind: "watercooler", x: 5, y: 12, width: 1, height: 2 });
      addProp(props, collision, { id: "plant-left", kind: "plant", x: 3, y: 13, width: 1, height: 1 });
      addProp(props, collision, { id: "plant-right", kind: "plant", x: 21, y: 13, width: 1, height: 1 });
      pois.push(
        { id: "bar", kind: "bar", label: "바 테이블", x: 6, y: 4 },
        { id: "center", kind: "sofa", label: "중앙 소파", x: 12, y: 12 },
        { id: "water", kind: "watercooler", label: "정수기", x: 5, y: 13 },
        { id: "books", kind: "bookshelf", label: "벽 서가", x: 19, y: 7 },
      );
      spawnPoints.push(
        { handle: "luna", x: 8, y: 13, facing: "up" },
        { handle: "nova", x: 15, y: 13, facing: "up" },
        { handle: "atlas", x: 6, y: 7, facing: "right" },
        { handle: "mira", x: 18, y: 7, facing: "left" },
        { handle: "sol", x: 10, y: 5, facing: "down" },
        { handle: "rio", x: 14, y: 5, facing: "down" },
      );
      break;
    }
  }

  return {
    id: theme.mapId,
    slug,
    title: theme.ambientLabel,
    width,
    height,
    tileSize: 32,
    palette: theme.palette,
    floor,
    collision,
    props,
    pois,
    spawnPoints,
    ambientLabel: theme.ambientLabel,
  };
}

function defaultAgentVisual(handle: string) {
  return AGENT_VISUALS[handle as keyof typeof AGENT_VISUALS] ?? {
    hair: "#d5d9e3",
    skin: "#f1d6c5",
    outfitPrimary: "#8ea2c5",
    outfitSecondary: "#566278",
    accent: "#f7fbff",
  };
}

function findSpawn(
  roomMap: HubMapDefinition,
  participant: Participant,
  index: number,
) {
  return (
    roomMap.spawnPoints.find((spawn) => spawn.handle === participant.handle) ?? {
      handle: participant.handle,
      x: 2 + ((index * 3) % Math.max(4, roomMap.width - 4)),
      y: roomMap.height - 3 - (index % 3),
      facing: defaultFacing(index),
    }
  );
}

export function getHubRoomSummary(room: RoomSummary): HubRoomSummary {
  const theme = getThemeForSlug(room.slug);

  return {
    ...room,
    mapId: theme.mapId,
    ambientLabel: theme.ambientLabel,
    paletteKey: theme.paletteKey,
  };
}

export function buildHubRoomDetailFromRoomDetail(
  detail: RoomDetailPayload,
): HubRoomDetailPayload {
  const room = getHubRoomSummary({
    ...detail.room,
    openScenePoll: null,
  });
  const map = buildMap(detail.room.slug);
  const agents: HubAgent[] = detail.participants.map((participant, index) => {
    const spawn = findSpawn(map, participant, index);
    const visual = defaultAgentVisual(participant.handle);

    return {
      id: `hub-agent:${participant.handle}`,
      participantId: participant.id,
      handle: participant.handle,
      displayName: participant.displayName,
      themeColor: visual.outfitPrimary,
      visual,
      tileX: spawn.x,
      tileY: spawn.y,
      fromTileX: spawn.x,
      fromTileY: spawn.y,
      facing: spawn.facing ?? defaultFacing(index),
      status: "idle",
      mood: detail.relationshipSnapshot.stage,
      currentPoiId: null,
      targetTileX: null,
      targetTileY: null,
      moveStartedAt: Date.now(),
      moveDurationMs: 0,
      interactionTargetId: null,
      sparkle:
        detail.relationshipSnapshot.stage === "love" ||
        detail.relationshipSnapshot.stage === "obsession"
          ? 1
          : 0,
    };
  });

  return {
    room,
    participants: detail.participants,
    characterProfiles: detail.characterProfiles,
    relationshipSnapshot: detail.relationshipSnapshot,
    currentSituation: detail.currentSituation,
    messages: detail.messages,
    map,
    agents,
    interactions: [],
    serverTime: detail.serverTime,
  };
}

export function buildHubRoomsFromRooms(rooms: RoomSummary[]) {
  return rooms.map((room) => getHubRoomSummary(room));
}

export function dominantAgentIds(snapshot: RelationshipSnapshot) {
  const pairIds = snapshot.dominantPair?.actorIds?.filter(Boolean) ?? [];
  if (pairIds.length > 0) {
    return pairIds;
  }
  return [];
}

export function shouldSparkle(stage: RelationshipStage, status: HubAgent["status"]) {
  if (stage === "love" || stage === "obsession") {
    return true;
  }

  return stage === "flirt" && status === "flirting";
}

export function makeInteractionLabel(type: HubInteraction["type"]) {
  switch (type) {
    case "heart":
      return "마주봄";
    case "spark":
      return "분위기 상승";
    case "awkward_pause":
      return "머뭇거림";
    case "chat":
    default:
      return "대화 중";
  }
}
