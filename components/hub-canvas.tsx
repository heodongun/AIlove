"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { interpolateTile } from "@/lib/hub-sim";
import type { HubSceneState } from "@/lib/hub-sim";
import type {
  HubAgent,
  HubCameraState,
  HubEmotionalState,
  HubIntention,
  HubInteraction,
  HubMapDefinition,
  HubSimulationEvent,
} from "@/lib/types";

type FaceState =
  | "neutral"
  | "talking"
  | "warm"
  | "flustered"
  | "awkward"
  | "jealous"
  | "curious";

type RenderAgent = {
  agent: HubAgent;
  x: number;
  y: number;
  centerX: number;
  headY: number;
};

function intentionGlyph(intention: HubIntention) {
  switch (intention) {
    case "approach":
      return "→";
    case "escape":
      return "↘";
    case "wait":
      return "…";
    case "observe":
      return "👁";
    case "confess":
      return "❤";
    case "interrupt":
      return "⚡";
    case "wander":
    default:
      return "◌";
  }
}

function glowForEmotion(emotion: HubEmotionalState) {
  switch (emotion) {
    case "nervous":
      return "rgba(255, 209, 102, 0.22)";
    case "interested":
      return "rgba(226, 120, 172, 0.24)";
    case "avoiding":
      return "rgba(125, 174, 255, 0.2)";
    case "confessing":
      return "rgba(255, 156, 184, 0.28)";
    case "neutral":
    default:
      return "rgba(255,255,255,0.08)";
  }
}

function hashInt(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  heightOrColor: number | string,
  colorMaybe?: string,
) {
  const height = typeof heightOrColor === "number" ? heightOrColor : width;
  const color = typeof heightOrColor === "string" ? heightOrColor : colorMaybe ?? "#fff";
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tileSize: number,
  x: number,
  y: number,
  kind: string,
  palette: HubMapDefinition["palette"],
) {
  const px = x * tileSize;
  const py = y * tileSize;
  const light = kind === "tile" ? palette.tileLight : palette.woodLight;
  const dark = kind === "tile" ? palette.tileDark : palette.woodDark;
  const base =
    kind === "rug"
      ? palette.rug
      : kind === "accent"
        ? palette.accent
        : kind === "stone"
          ? palette.wall
          : light;

  ctx.fillStyle = base;
  ctx.fillRect(px, py, tileSize, tileSize);
  pixel(ctx, px, py, tileSize, kind === "stone" ? palette.wall : light);
  pixel(ctx, px + tileSize - 4, py + tileSize - 4, 4, dark);
  pixel(ctx, px + 4, py + tileSize - 8, 4, dark);
  pixel(ctx, px + tileSize - 8, py + 4, 4, "rgba(255,255,255,0.12)");
}

function drawProp(
  ctx: CanvasRenderingContext2D,
  tileSize: number,
  prop: HubMapDefinition["props"][number],
  palette: HubMapDefinition["palette"],
) {
  const px = prop.x * tileSize;
  const py = prop.y * tileSize;
  const width = prop.width * tileSize;
  const height = prop.height * tileSize;

  const paint = (fill: string, stroke: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(px, py, width, height);
    ctx.fillStyle = stroke;
    ctx.fillRect(px, py, width, 4);
    ctx.fillRect(px, py, 4, height);
  };

  switch (prop.kind) {
    case "wall":
      paint(palette.wall, "rgba(255,255,255,0.08)");
      break;
    case "desk":
    case "desk_duo":
      paint("#7a5a44", "#d2a77e");
      pixel(ctx, px + 8, py + 8, 10, "#171c27");
      pixel(ctx, px + width - 18, py + 10, 6, "#ece4d7");
      break;
    case "sofa":
      paint("#586c88", "#93b1d8");
      pixel(ctx, px + 6, py + height - 10, width - 12, 6, "#2d394a");
      break;
    case "table":
      paint("#8d6a4d", "#d7b28d");
      pixel(ctx, px + 8, py + 8, width - 16, height - 16, "#b68f66");
      break;
    case "watercooler":
      paint("#8cb6d3", "#d9f1ff");
      pixel(ctx, px + 6, py + height - 8, width - 12, 4, "#314a5c");
      break;
    case "plant":
      paint("#5e7a46", "#a8cf77");
      pixel(ctx, px + 8, py + height - 8, width - 16, 4, "#7a5a44");
      break;
    case "bookshelf":
      paint("#6d4c3c", "#cfad78");
      pixel(ctx, px + 6, py + 8, width - 12, 4, "#8cb6d3");
      pixel(ctx, px + 6, py + 16, width - 12, 4, "#e2a6c0");
      pixel(ctx, px + 6, py + 24, width - 12, 4, "#a7d693");
      break;
    case "counter":
      paint("#7e6251", "#caa48a");
      pixel(ctx, px + 8, py + 6, width - 16, 6, "#232a34");
      break;
    case "lamp":
      paint("#d7b85f", "#fff4c4");
      pixel(ctx, px + 10, py + 10, width - 20, height - 20, "#f6de92");
      break;
    case "window":
      paint("#8fc0e9", "#f2f8ff");
      pixel(ctx, px + 4, py + 4, width - 8, height - 8, "#bfdcf7");
      break;
    default:
      paint("#7a5a44", "#d2a77e");
  }
}

function drawPortrait(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  agent: HubAgent,
  frame: number,
  faceState: FaceState,
) {
  const s = scale;
  const bob = agent.status === "idle" || agent.status === "observing" ? Math.sin(frame / 20) * 1.5 : 0;
  const px = x;
  const py = y + bob;
  const outfitShift = agent.status === "pathing" || agent.status === "wandering" ? (frame % 16 < 8 ? 1 : -1) : 0;
  const eyeColor = faceState === "warm" ? "#28463d" : "#17181e";

  pixel(ctx, px + 8 * s, py, 16 * s, 8 * s, agent.visual.hair);
  pixel(ctx, px + 4 * s, py + 8 * s, 24 * s, 18 * s, agent.visual.skin);
  pixel(ctx, px + 6 * s, py + 10 * s, 20 * s, 12 * s, agent.visual.hair);

  if (faceState === "warm" || faceState === "flustered") {
    pixel(ctx, px + 6 * s, py + 18 * s, 4 * s, 3 * s, "#ef9baa");
    pixel(ctx, px + 22 * s, py + 18 * s, 4 * s, 3 * s, "#ef9baa");
  }

  if (faceState === "awkward") {
    pixel(ctx, px + 10 * s, py + 14 * s, 3 * s, 1 * s, eyeColor);
    pixel(ctx, px + 19 * s, py + 14 * s, 3 * s, 1 * s, eyeColor);
    pixel(ctx, px + 14 * s, py + 21 * s, 5 * s, 1 * s, "#5c4a55");
    pixel(ctx, px + 24 * s, py + 10 * s, 2 * s, 4 * s, "#d6f0ff");
  } else if (faceState === "jealous") {
    pixel(ctx, px + 9 * s, py + 13 * s, 4 * s, 1 * s, eyeColor);
    pixel(ctx, px + 19 * s, py + 13 * s, 4 * s, 1 * s, eyeColor);
    pixel(ctx, px + 9 * s, py + 12 * s, 3 * s, 1 * s, "#3f2f36");
    pixel(ctx, px + 20 * s, py + 12 * s, 3 * s, 1 * s, "#3f2f36");
    pixel(ctx, px + 13 * s, py + 21 * s, 7 * s, 1 * s, "#55343e");
  } else if (faceState === "curious") {
    pixel(ctx, px + 10 * s, py + 13 * s, 3 * s, 4 * s, eyeColor);
    pixel(ctx, px + 19 * s, py + 13 * s, 3 * s, 4 * s, eyeColor);
    pixel(ctx, px + 14 * s, py + 21 * s, 4 * s, 2 * s, "#5c4a55");
  } else {
    pixel(ctx, px + 10 * s, py + 14 * s, 3 * s, 3 * s, eyeColor);
    pixel(ctx, px + 19 * s, py + 14 * s, 3 * s, 3 * s, eyeColor);
    pixel(
      ctx,
      px + 14 * s,
      py + 21 * s,
      faceState === "talking" ? 5 * s : 4 * s,
      faceState === "talking" ? 2 * s : 1 * s,
      faceState === "warm" ? "#3a6052" : "#5c4a55",
    );
  }

  pixel(ctx, px + 8 * s, py + 27 * s, 16 * s, 13 * s, agent.visual.outfitPrimary);
  pixel(ctx, px + 6 * s, py + 31 * s, 4 * s, 8 * s, agent.visual.outfitSecondary);
  pixel(ctx, px + 22 * s, py + 31 * s, 4 * s, 8 * s, agent.visual.outfitSecondary);
  pixel(ctx, px + 11 * s + outfitShift * s, py + 40 * s, 4 * s, 8 * s, "#27313f");
  pixel(ctx, px + 17 * s - outfitShift * s, py + 40 * s, 4 * s, 8 * s, "#27313f");
  pixel(ctx, px + 13 * s, py + 30 * s, 6 * s, 4 * s, agent.visual.accent);
}

function drawEmotionAura(
  ctx: CanvasRenderingContext2D,
  entry: RenderAgent,
  frame: number,
  selected: boolean,
) {
  const pulse = 1 + Math.sin(frame / 12) * 0.08;
  const width = 26 * pulse;
  const height = 14 * pulse;
  const left = entry.centerX - width / 2;
  const top = entry.y + 30;
  ctx.fillStyle = glowForEmotion(entry.agent.emotionalState);
  ctx.fillRect(left, top, width, height);

  if (selected) {
    ctx.fillStyle = "rgba(248, 247, 242, 0.18)";
    ctx.fillRect(entry.centerX - 18, entry.y - 4, 36, 54);
    ctx.fillStyle = "#f8f7f2";
    ctx.fillRect(entry.centerX - 18, entry.y - 4, 36, 2);
    ctx.fillRect(entry.centerX - 18, entry.y + 48, 36, 2);
    ctx.fillRect(entry.centerX - 18, entry.y - 4, 2, 54);
    ctx.fillRect(entry.centerX + 16, entry.y - 4, 2, 54);
  }
}

function drawIntentIndicator(
  ctx: CanvasRenderingContext2D,
  entry: RenderAgent,
  frame: number,
) {
  const glyph = intentionGlyph(entry.agent.intention);
  const floatY = Math.sin((frame + hashInt(entry.agent.id)) / 16) * 1.5;
  const left = entry.centerX - 11;
  const top = entry.headY - 18 + floatY;

  ctx.fillStyle = "rgba(7, 9, 14, 0.34)";
  ctx.fillRect(left + 2, top + 2, 22, 18);
  ctx.fillStyle = "#f8f7f2";
  ctx.fillRect(left, top, 22, 18);
  ctx.fillStyle = "#d4d3ce";
  ctx.fillRect(left, top, 22, 2);
  ctx.fillRect(left, top + 16, 22, 2);
  ctx.fillRect(left, top, 2, 18);
  ctx.fillRect(left + 20, top, 2, 18);
  ctx.fillStyle = "#23262d";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.fillText(glyph, left + 5, top + 13);
}

function drawEventBadge(
  ctx: CanvasRenderingContext2D,
  event: HubSimulationEvent,
  tileSize: number,
  frame: number,
) {
  const pulse = Math.sin(frame / 14) * 2;
  const left = event.tileX * tileSize + 8;
  const top = event.tileY * tileSize - 20 + pulse;
  const label = event.type === "confession" ? "!" : event.type === "bond_decrease" ? "↓" : "●";

  ctx.fillStyle = "rgba(8, 10, 16, 0.3)";
  ctx.fillRect(left + 2, top + 2, 16, 16);
  ctx.fillStyle = event.type === "bond_decrease" ? "#f0d7dd" : "#f8f2db";
  ctx.fillRect(left, top, 16, 16);
  ctx.fillStyle = event.type === "bond_decrease" ? "#b76b78" : "#c9a750";
  ctx.fillRect(left, top, 16, 2);
  ctx.fillRect(left, top + 14, 16, 2);
  ctx.fillRect(left, top, 2, 16);
  ctx.fillRect(left + 14, top, 2, 16);
  ctx.fillStyle = "#24262c";
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.fillText(label, left + 5, top + 12);
}

function clampCanvas(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function wrapBubbleText(text: string, limit = 12) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const lines: string[] = [];
  let cursor = normalized;

  while (cursor.length > 0 && lines.length < 4) {
    lines.push(cursor.slice(0, limit).trim());
    cursor = cursor.slice(limit);
  }

  if (cursor.length > 0) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = `${lines[lastIndex].slice(0, Math.max(1, limit - 2)).trim()}…`;
  }

  return lines;
}

function reactionGlyph(interaction: HubInteraction, listenerIndex = 0) {
  if (interaction.type === "confession" || interaction.type === "heart") {
    return listenerIndex % 2 === 0 ? "❤" : "💗";
  }

  if (interaction.type === "spark") {
    return listenerIndex % 2 === 0 ? "✨" : "☺";
  }

  if (interaction.type === "awkward_pause") {
    return listenerIndex % 2 === 0 ? "…" : "!?";
  }

  return listenerIndex % 2 === 0 ? "💬" : "♪";
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  interaction: HubInteraction,
  speaker: RenderAgent,
  listeners: RenderAgent[],
  frame: number,
) {
  const floatY = Math.sin(frame / 18) * 1.5;
  const speech = interaction.speechText?.trim() ?? "";
  const emote = interaction.emote?.trim() ?? "";

  const tone =
    interaction.type === "confession"
      ? { fill: "#f6dbe7", border: "#d46d96", text: "#4c2333" }
      : interaction.type === "heart"
      ? { fill: "#f6dde8", border: "#d37798", text: "#472231" }
      : interaction.type === "spark"
        ? { fill: "#f7efd2", border: "#d1a74a", text: "#493814" }
        : interaction.type === "awkward_pause"
          ? { fill: "#e4e7ee", border: "#8e95a5", text: "#303541" }
          : { fill: "#edf3ec", border: "#3a8c78", text: "#203129" };
  const lines = wrapBubbleText(speech || emote || interaction.label, 12);
  const speakerLabel = interaction.speakerHandle
    ? interaction.speakerHandle.toUpperCase()
    : "";
  const scale = ctx.getTransform().a || 1;
  const worldWidth = ctx.canvas.width / scale;
  const worldHeight = ctx.canvas.height / scale;

  ctx.save();
  ctx.font = "600 12px system-ui, -apple-system, sans-serif";
  const widestLine = lines.reduce(
    (width, line) => Math.max(width, ctx.measureText(line).width),
    0,
  );
  const speakerWidth = speakerLabel
    ? ctx.measureText(speakerLabel).width + 14
    : 0;
  const badgeWidth = emote ? 18 : 0;
  const bubbleWidth = Math.min(
    Math.max(96, Math.ceil(Math.max(widestLine, speakerWidth) + 24 + badgeWidth)),
    228,
  );
  const bubbleHeight = 16 + lines.length * 16 + (speakerLabel ? 18 : 0);
  const preferLeft = listeners[0] ? listeners[0].centerX > speaker.centerX : false;
  const bubbleLeft = clampCanvas(
    speaker.centerX + (preferLeft ? -bubbleWidth - 12 : 12),
    8,
    worldWidth - bubbleWidth - 8,
  );
  const bubbleTop = clampCanvas(
    speaker.y - bubbleHeight - 18 + floatY,
    8,
    worldHeight - bubbleHeight - 8,
  );
  const tailX = clampCanvas(
    speaker.centerX,
    bubbleLeft + 10,
    bubbleLeft + bubbleWidth - 10,
  );

  ctx.fillStyle = "rgba(8, 10, 16, 0.32)";
  ctx.fillRect(bubbleLeft + 3, bubbleTop + 3, bubbleWidth, bubbleHeight);
  ctx.fillStyle = tone.fill;
  ctx.fillRect(bubbleLeft, bubbleTop, bubbleWidth, bubbleHeight);
  ctx.fillStyle = tone.border;
  ctx.fillRect(bubbleLeft, bubbleTop, bubbleWidth, 3);
  ctx.fillRect(bubbleLeft, bubbleTop + bubbleHeight - 3, bubbleWidth, 3);
  ctx.fillRect(bubbleLeft, bubbleTop, 3, bubbleHeight);
  ctx.fillRect(bubbleLeft + bubbleWidth - 3, bubbleTop, 3, bubbleHeight);
  pixel(ctx, tailX - 4, bubbleTop + bubbleHeight, 8, 8, tone.fill);
  pixel(ctx, tailX - 4, bubbleTop + bubbleHeight, 8, 2, tone.border);

  let textY = bubbleTop + 18;
  if (speakerLabel) {
    ctx.fillStyle = "rgba(23, 27, 34, 0.14)";
    ctx.fillRect(bubbleLeft + 10, bubbleTop + 8, speakerWidth, 14);
    ctx.fillStyle = tone.text;
    ctx.font = "700 10px system-ui, -apple-system, sans-serif";
    ctx.fillText(speakerLabel, bubbleLeft + 17, bubbleTop + 18);
    textY += 14;
  }

  ctx.fillStyle = tone.text;
  ctx.font = "600 12px system-ui, -apple-system, sans-serif";
  for (const line of lines) {
    ctx.fillText(line, bubbleLeft + 12, textY);
    textY += 16;
  }

  if (emote) {
    ctx.fillStyle = "rgba(23, 27, 34, 0.1)";
    ctx.fillRect(bubbleLeft + bubbleWidth - 24, bubbleTop + 8, 14, 14);
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText(emote, bubbleLeft + bubbleWidth - 21, bubbleTop + 19);
  }

  listeners.slice(0, 2).forEach((listener, index) => {
    const glyph = reactionGlyph(interaction, index);
    const miniWidth = glyph.length > 1 ? 26 : 20;
    const miniLeft = clampCanvas(
      listener.centerX - miniWidth / 2,
      8,
      worldWidth - miniWidth - 8,
    );
    const miniTop = clampCanvas(
      listener.y - 22 - index * 18 + Math.cos((frame + index * 6) / 14) * 1.5,
      8,
      worldHeight - 24,
    );

    ctx.fillStyle = "rgba(8, 10, 16, 0.28)";
    ctx.fillRect(miniLeft + 2, miniTop + 2, miniWidth, 18);
    ctx.fillStyle = "#f8f7f2";
    ctx.fillRect(miniLeft, miniTop, miniWidth, 18);
    ctx.fillStyle = "#d5d1cb";
    ctx.fillRect(miniLeft, miniTop, miniWidth, 2);
    ctx.fillRect(miniLeft, miniTop + 16, miniWidth, 2);
    ctx.fillRect(miniLeft, miniTop, 2, 18);
    ctx.fillRect(miniLeft + miniWidth - 2, miniTop, 2, 18);
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#2a2d33";
    ctx.fillText(glyph, miniLeft + 5, miniTop + 13);
  });

  ctx.restore();
}

function drawSparkles(
  ctx: CanvasRenderingContext2D,
  point: RenderAgent,
  agent: HubAgent,
  frame: number,
) {
  if (!agent.sparkle) {
    return;
  }

  const px = point.centerX;
  const py = point.headY;
  const orbit = (frame % 48) / 48;
  const dx = Math.cos(orbit * Math.PI * 2) * 10;
  const dy = Math.sin(orbit * Math.PI * 2) * 7;
  pixel(ctx, px + dx, py + dy, 3, "#ffe894");
  pixel(ctx, px - dx * 0.7, py - dy * 0.7, 2, "#fff6ce");
}

function drawSceneMarker(
  ctx: CanvasRenderingContext2D,
  tileSize: number,
  map: HubMapDefinition,
  scene: HubSceneState | null,
  frame: number,
) {
  if (!scene?.anchorPoiId) {
    return;
  }

  const poi = map.pois.find((entry) => entry.id === scene.anchorPoiId);
  if (!poi) {
    return;
  }

  const pulse = frame % 24 < 12 ? 1 : 0;
  const px = poi.x * tileSize;
  const py = poi.y * tileSize;
  const color = "rgba(255, 216, 77, 0.42)";
  const edge = pulse ? "#f6d670" : "#d2b25b";

  ctx.fillStyle = color;
  ctx.fillRect(px + 4, py + 4, tileSize - 8, tileSize - 8);
  ctx.fillStyle = edge;
  ctx.fillRect(px + 2, py + 2, tileSize - 4, 2);
  ctx.fillRect(px + 2, py + tileSize - 4, tileSize - 4, 2);
  ctx.fillRect(px + 2, py + 2, 2, tileSize - 4);
  ctx.fillRect(px + tileSize - 4, py + 2, 2, tileSize - 4);
}

function faceStateForAgent(
  agent: HubAgent,
  interactions: HubInteraction[],
  scene: HubSceneState | null,
) {
  const interaction = interactions.find((entry) => entry.agentIds.includes(agent.id));
  if (interaction) {
    const isSpeaker =
      interaction.speakerId === agent.participantId ||
      interaction.speakerHandle === agent.handle;

    if (interaction.type === "heart") {
      return isSpeaker ? "warm" : "flustered";
    }

    if (interaction.type === "spark") {
      return isSpeaker ? "talking" : "warm";
    }

    if (interaction.type === "awkward_pause") {
      return isSpeaker ? "awkward" : "curious";
    }

    return isSpeaker ? "talking" : "curious";
  }

  if (scene?.observerAgentId === agent.id) {
    return scene.mode === "jealous_pass" ? "jealous" : "curious";
  }

  if (agent.status === "avoiding") {
    return "awkward";
  }

  if (agent.emotionalState === "confessing") {
    return "flustered";
  }

  if (agent.emotionalState === "nervous") {
    return "awkward";
  }

  if (agent.emotionalState === "interested") {
    return "warm";
  }

  if (agent.status === "intercepting") {
    return "talking";
  }

  if (agent.status === "flirting") {
    return "warm";
  }

  return "neutral";
}

export function HubCanvas({
  map,
  agents,
  interactions,
  activeEvent,
  camera,
  selectedAgentId,
  onSelectAgent,
  scene,
  className,
}: {
  map: HubMapDefinition;
  agents: HubAgent[];
  interactions: HubInteraction[];
  activeEvent?: HubSimulationEvent | null;
  camera?: HubCameraState | null;
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;
  scene?: HubSceneState | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitboxesRef = useRef<Array<{ id: string; x: number; y: number; width: number; height: number }>>([]);
  const transformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const tileSize = map.tileSize;
  const viewport = useMemo(
    () => ({
      width: map.width * tileSize,
      height: map.height * tileSize,
    }),
    [map.height, map.width, tileSize],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let frame = 0;
    let rafId = 0;
    let cancelled = false;
    context.imageSmoothingEnabled = false;

    const draw = () => {
      if (cancelled) {
        return;
      }

      frame += 1;
      context.clearRect(0, 0, viewport.width, viewport.height);
      context.fillStyle = map.palette.background;
      context.fillRect(0, 0, viewport.width, viewport.height);

      const focusTileX = camera?.focusTileX ?? scene?.anchorPoi?.x ?? map.width / 2;
      const focusTileY = camera?.focusTileY ?? scene?.anchorPoi?.y ?? map.height / 2;
      const zoom = Math.max(1, Math.min(1.55, camera?.zoom ?? 1));
      const focusX = focusTileX * tileSize + tileSize / 2;
      const focusY = focusTileY * tileSize + tileSize / 2;
      const minOffsetX = Math.min(0, viewport.width - viewport.width * zoom);
      const minOffsetY = Math.min(0, viewport.height - viewport.height * zoom);
      const offsetX = clampCanvas(
        viewport.width / 2 - focusX * zoom,
        minOffsetX,
        0,
      );
      const offsetY = clampCanvas(
        viewport.height / 2 - focusY * zoom,
        minOffsetY,
        0,
      );
      transformRef.current = { scale: zoom, offsetX, offsetY };

      context.save();
      context.translate(offsetX, offsetY);
      context.scale(zoom, zoom);

      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          drawTile(context, tileSize, x, y, map.floor[y][x], map.palette);
        }
      }

      for (const prop of map.props) {
        drawProp(context, tileSize, prop, map.palette);
      }

      drawSceneMarker(context, tileSize, map, scene ?? null, frame);
      if (activeEvent) {
        drawEventBadge(context, activeEvent, tileSize, frame);
      }

      const now = Date.now();
      const renderedAgents = agents.map((agent) => {
        const point = interpolateTile(agent, now);
        return {
          agent,
          x: point.x * tileSize,
          y: point.y * tileSize - 16,
          centerX: point.x * tileSize + tileSize / 2,
          headY: point.y * tileSize - 4,
        } satisfies RenderAgent;
      });
      const renderedAgentMap = new Map(
        renderedAgents.map((entry) => [entry.agent.id, entry]),
      );
      hitboxesRef.current = renderedAgents.map((entry) => ({
        id: entry.agent.id,
        x: entry.x,
        y: entry.y,
        width: tileSize,
        height: 48,
      }));

      for (const entry of renderedAgents) {
        const faceState = faceStateForAgent(entry.agent, interactions, scene ?? null);
        drawEmotionAura(
          context,
          entry,
          frame,
          selectedAgentId === entry.agent.id,
        );
        drawPortrait(
          context,
          entry.x,
          entry.y,
          1,
          entry.agent,
          frame,
          faceState,
        );
        drawSparkles(context, entry, entry.agent, frame);
        if (
          selectedAgentId === entry.agent.id ||
          entry.agent.intention !== "wander" ||
          entry.agent.emotionalState !== "neutral"
        ) {
          drawIntentIndicator(context, entry, frame);
        }
      }

      for (const interaction of interactions) {
        const speaker =
          interaction.agentIds
            .map((agentId) => renderedAgentMap.get(agentId))
            .find(
              (entry) =>
                entry &&
                (interaction.speakerId === entry.agent.participantId ||
                  interaction.speakerHandle === entry.agent.handle),
            ) ??
          renderedAgentMap.get(interaction.agentIds[0] ?? "");
        if (!speaker) {
          continue;
        }

        drawSpeechBubble(
          context,
          interaction,
          speaker,
          interaction.agentIds
            .map((agentId) => renderedAgentMap.get(agentId))
            .filter((entry): entry is RenderAgent => Boolean(entry && entry.agent.id !== speaker.agent.id)),
          frame,
        );
      }

      context.restore();
      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [
    activeEvent,
    agents,
    camera,
    interactions,
    map,
    scene,
    selectedAgentId,
    tileSize,
    viewport.height,
    viewport.width,
  ]);

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!onSelectAgent || !canvasRef.current) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = ((event.clientX - rect.left) / rect.width) * canvasRef.current.width;
    const screenY = ((event.clientY - rect.top) / rect.height) * canvasRef.current.height;
    const { scale, offsetX, offsetY } = transformRef.current;
    const worldX = (screenX - offsetX) / scale;
    const worldY = (screenY - offsetY) / scale;

    const target = [...hitboxesRef.current]
      .reverse()
      .find(
        (entry) =>
          worldX >= entry.x &&
          worldX <= entry.x + entry.width &&
          worldY >= entry.y &&
          worldY <= entry.y + entry.height,
      );

    if (target) {
      onSelectAgent(target.id);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      height={viewport.height}
      onPointerUp={handlePointerUp}
      width={viewport.width}
    />
  );
}
