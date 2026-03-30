"use client";

import { useEffect, useMemo, useRef } from "react";

import { interpolateTile } from "@/lib/hub-sim";
import type {
  HubAgent,
  HubInteraction,
  HubMapDefinition,
} from "@/lib/types";

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
) {
  const s = scale;
  const bob = agent.status === "idle" || agent.status === "observing" ? Math.sin(frame / 20) * 1.5 : 0;
  const px = x;
  const py = y + bob;
  const outfitShift = agent.status === "pathing" || agent.status === "wandering" ? (frame % 16 < 8 ? 1 : -1) : 0;

  pixel(ctx, px + 8 * s, py, 16 * s, 8 * s, agent.visual.hair);
  pixel(ctx, px + 4 * s, py + 8 * s, 24 * s, 18 * s, agent.visual.skin);
  pixel(ctx, px + 6 * s, py + 10 * s, 20 * s, 12 * s, agent.visual.hair);
  pixel(ctx, px + 10 * s, py + 14 * s, 3 * s, 3 * s, "#17181e");
  pixel(ctx, px + 19 * s, py + 14 * s, 3 * s, 3 * s, "#17181e");
  pixel(ctx, px + 8 * s, py + 27 * s, 16 * s, 13 * s, agent.visual.outfitPrimary);
  pixel(ctx, px + 6 * s, py + 31 * s, 4 * s, 8 * s, agent.visual.outfitSecondary);
  pixel(ctx, px + 22 * s, py + 31 * s, 4 * s, 8 * s, agent.visual.outfitSecondary);
  pixel(ctx, px + 11 * s + outfitShift * s, py + 40 * s, 4 * s, 8 * s, "#27313f");
  pixel(ctx, px + 17 * s - outfitShift * s, py + 40 * s, 4 * s, 8 * s, "#27313f");
  pixel(ctx, px + 13 * s, py + 30 * s, 6 * s, 4 * s, agent.visual.accent);
}

function drawInteraction(
  ctx: CanvasRenderingContext2D,
  tileSize: number,
  interaction: HubInteraction,
  frame: number,
) {
  const floatY = Math.sin(frame / 18) * 1.5;
  const speech = interaction.speechText?.trim() ?? "";
  const emote = interaction.emote?.trim() ?? "";

  if (speech || emote) {
    const tone =
      interaction.type === "heart"
        ? { fill: "#f6dde8", border: "#d37798", text: "#472231" }
        : interaction.type === "spark"
          ? { fill: "#f7efd2", border: "#d1a74a", text: "#493814" }
          : interaction.type === "awkward_pause"
            ? { fill: "#e4e7ee", border: "#8e95a5", text: "#303541" }
            : { fill: "#edf3ec", border: "#3a8c78", text: "#203129" };
    const content = speech || emote || interaction.label;
    const normalized = content.replace(/\s+/g, " ").trim();
    const lines = (() => {
      if (normalized.length <= 14) {
        return [normalized];
      }

      const result: string[] = [];
      let cursor = normalized;

      while (cursor.length > 0 && result.length < 3) {
        result.push(cursor.slice(0, 14).trim());
        cursor = cursor.slice(14);
      }

      if (cursor.length > 0) {
        const lastIndex = result.length - 1;
        result[lastIndex] = `${result[lastIndex].slice(0, 12).trim()}…`;
      }

      return result.filter(Boolean);
    })();
    const speaker = interaction.speakerHandle ? interaction.speakerHandle.toUpperCase() : "";

    ctx.save();
    ctx.font = "600 12px system-ui, -apple-system, sans-serif";
    const widestLine = lines.reduce(
      (width, line) => Math.max(width, ctx.measureText(line).width),
      0,
    );
    const speakerWidth = speaker ? ctx.measureText(speaker).width + 14 : 0;
    const badgeWidth = emote ? 18 : 0;
    const bubbleWidth = Math.min(
      Math.max(88, Math.ceil(Math.max(widestLine, speakerWidth) + 24 + badgeWidth)),
      220,
    );
    const bubbleHeight = 14 + lines.length * 16 + (speaker ? 18 : 0);
    const centerX = interaction.tileX * tileSize + tileSize / 2;
    const bubbleLeft = Math.max(
      12,
      Math.min(ctx.canvas.width - bubbleWidth - 12, centerX - bubbleWidth / 2),
    );
    const bubbleTop = Math.max(
      10,
      interaction.tileY * tileSize - bubbleHeight - 20 + floatY,
    );

    ctx.fillStyle = "rgba(8, 10, 16, 0.28)";
    ctx.fillRect(bubbleLeft + 3, bubbleTop + 3, bubbleWidth, bubbleHeight);
    ctx.fillStyle = tone.fill;
    ctx.fillRect(bubbleLeft, bubbleTop, bubbleWidth, bubbleHeight);
    ctx.fillStyle = tone.border;
    ctx.fillRect(bubbleLeft, bubbleTop, bubbleWidth, 3);
    ctx.fillRect(bubbleLeft, bubbleTop + bubbleHeight - 3, bubbleWidth, 3);
    ctx.fillRect(bubbleLeft, bubbleTop, 3, bubbleHeight);
    ctx.fillRect(bubbleLeft + bubbleWidth - 3, bubbleTop, 3, bubbleHeight);
    pixel(
      ctx,
      bubbleLeft + Math.floor(bubbleWidth / 2) - 4,
      bubbleTop + bubbleHeight,
      8,
      8,
      tone.fill,
    );
    pixel(
      ctx,
      bubbleLeft + Math.floor(bubbleWidth / 2) - 4,
      bubbleTop + bubbleHeight,
      8,
      2,
      tone.border,
    );

    let textY = bubbleTop + 18;
    if (speaker) {
      ctx.fillStyle = "rgba(23, 27, 34, 0.16)";
      ctx.fillRect(bubbleLeft + 10, bubbleTop + 8, speakerWidth, 14);
      ctx.fillStyle = tone.text;
      ctx.font = "700 10px system-ui, -apple-system, sans-serif";
      ctx.fillText(speaker, bubbleLeft + 17, bubbleTop + 18);
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

    ctx.restore();
    return;
  }

  const px = interaction.tileX * tileSize + tileSize / 2 - 10;
  const py = interaction.tileY * tileSize - 16 + floatY;
  const base = interaction.type === "heart" ? "#f09ab9" : interaction.type === "spark" ? "#ffe07a" : "#f4f6fb";

  ctx.fillStyle = "rgba(10, 12, 20, 0.5)";
  ctx.fillRect(px + 2, py + 2, 20, 12);
  ctx.fillStyle = base;
  ctx.fillRect(px, py, 20, 12);
  if (interaction.type === "heart") {
    pixel(ctx, px + 4, py + 2, 4, "#d06482");
    pixel(ctx, px + 12, py + 2, 4, "#d06482");
    pixel(ctx, px + 6, py + 6, 8, 4, "#d06482");
  } else if (interaction.type === "awkward_pause") {
    pixel(ctx, px + 4, py + 4, 3, 3, "#6e7280");
    pixel(ctx, px + 9, py + 4, 3, 3, "#6e7280");
    pixel(ctx, px + 14, py + 4, 3, 3, "#6e7280");
  } else {
    pixel(ctx, px + 4, py + 3, 12, 6, "#2a3342");
    pixel(ctx, px + 10, py + 9, 4, 3, "#2a3342");
  }
}

function drawSparkles(
  ctx: CanvasRenderingContext2D,
  tileSize: number,
  agent: HubAgent,
  frame: number,
) {
  if (!agent.sparkle) {
    return;
  }

  const px = agent.tileX * tileSize + tileSize / 2;
  const py = agent.tileY * tileSize + 8;
  const orbit = (frame % 48) / 48;
  const dx = Math.cos(orbit * Math.PI * 2) * 10;
  const dy = Math.sin(orbit * Math.PI * 2) * 7;
  pixel(ctx, px + dx, py + dy, 3, "#ffe894");
  pixel(ctx, px - dx * 0.7, py - dy * 0.7, 2, "#fff6ce");
}

export function HubCanvas({
  map,
  agents,
  interactions,
  className,
}: {
  map: HubMapDefinition;
  agents: HubAgent[];
  interactions: HubInteraction[];
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          drawTile(context, tileSize, x, y, map.floor[y][x], map.palette);
        }
      }

      for (const prop of map.props) {
        drawProp(context, tileSize, prop, map.palette);
      }

      const now = Date.now();
      for (const agent of agents) {
        const point = interpolateTile(agent, now);
        drawPortrait(
          context,
          point.x * tileSize,
          point.y * tileSize - 16,
          1,
          agent,
          frame,
        );
        drawSparkles(context, tileSize, agent, frame);
      }

      for (const interaction of interactions) {
        drawInteraction(context, tileSize, interaction, frame);
      }

      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [agents, interactions, map, tileSize, viewport.height, viewport.width]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      height={viewport.height}
      width={viewport.width}
    />
  );
}
