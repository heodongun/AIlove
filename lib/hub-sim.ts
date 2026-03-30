import type {
  HubAgent,
  HubAgentStatus,
  HubFacing,
  HubInteraction,
  HubInteractionType,
  HubMapDefinition,
  HubPoi,
  Message,
  RelationshipSnapshot,
} from "@/lib/types";
import {
  dominantAgentIds,
  makeInteractionLabel,
  shouldSparkle,
} from "@/lib/hub-utils";

function manhattan(
  left: { x: number; y: number },
  right: { x: number; y: number },
) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function key(x: number, y: number) {
  return `${x}:${y}`;
}

function facingTo(
  from: { x: number; y: number },
  to: { x: number; y: number },
): HubFacing {
  if (Math.abs(to.x - from.x) > Math.abs(to.y - from.y)) {
    return to.x > from.x ? "right" : "left";
  }

  return to.y > from.y ? "down" : "up";
}

function isBlocked(
  map: HubMapDefinition,
  occupied: Set<string>,
  x: number,
  y: number,
) {
  return Boolean(map.collision[y]?.[x]) || occupied.has(key(x, y));
}

function neighbors(
  map: HubMapDefinition,
  occupied: Set<string>,
  x: number,
  y: number,
) {
  const points = [
    { x, y: y - 1 },
    { x: x + 1, y },
    { x, y: y + 1 },
    { x: x - 1, y },
  ];

  return points.filter((point) => !isBlocked(map, occupied, point.x, point.y));
}

function reconstructPath(
  cameFrom: Map<string, string>,
  endKey: string,
) {
  const result = [endKey];
  let current = endKey;

  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    result.push(current);
  }

  return result.reverse().map((entry) => {
    const [x, y] = entry.split(":").map(Number);
    return { x, y };
  });
}

export function findPath(
  map: HubMapDefinition,
  occupied: Set<string>,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const open = [start];
  const openKeys = new Set([key(start.x, start.y)]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[key(start.x, start.y), 0]]);
  const fScore = new Map<string, number>([
    [key(start.x, start.y), manhattan(start, end)],
  ]);

  while (open.length > 0) {
    open.sort(
      (left, right) =>
        (fScore.get(key(left.x, left.y)) ?? Number.POSITIVE_INFINITY) -
        (fScore.get(key(right.x, right.y)) ?? Number.POSITIVE_INFINITY),
    );

    const current = open.shift()!;
    const currentKey = key(current.x, current.y);

    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(cameFrom, currentKey);
    }

    openKeys.delete(currentKey);

    for (const next of neighbors(map, occupied, current.x, current.y)) {
      const nextKey = key(next.x, next.y);
      const tentativeScore = (gScore.get(currentKey) ?? 0) + 1;

      if (tentativeScore >= (gScore.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      cameFrom.set(nextKey, currentKey);
      gScore.set(nextKey, tentativeScore);
      fScore.set(nextKey, tentativeScore + manhattan(next, end));

      if (!openKeys.has(nextKey)) {
        open.push(next);
        openKeys.add(nextKey);
      }
    }
  }

  return [];
}

function interactionType(snapshot: RelationshipSnapshot): HubInteractionType {
  if (snapshot.stage === "love" || snapshot.stage === "obsession") {
    return "heart";
  }

  if (snapshot.stage === "flirt") {
    return "spark";
  }

  if (snapshot.stage === "awkward") {
    return "awkward_pause";
  }

  return "chat";
}

function hashValue(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function clipSpeech(text: string, limit = 28) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

function recentPairMessages(
  messages: Message[],
  left: HubAgent,
  right: HubAgent,
) {
  const speakerIds = new Set([left.participantId, right.participantId]);

  return messages.filter(
    (message) =>
      message.messageType === "text" &&
      message.speakerId !== null &&
      speakerIds.has(message.speakerId) &&
      message.content.trim().length > 0,
  );
}

function fallbackSpeech(
  type: HubInteractionType,
  snapshot: RelationshipSnapshot,
  seed: string,
) {
  const pool =
    type === "heart"
      ? ["계속 네 쪽으로 시선이 가.", "오늘은 좀 더 가까이 있고 싶어.", "지금은 그냥 네가 더 신경 쓰여."]
      : type === "spark"
        ? ["또 그렇게 보면 내가 먼저 흔들려.", "방금 그 말, 좀 오래 남는다.", "지금 분위기 꽤 좋아졌는데."]
        : type === "awkward_pause"
          ? ["...", "잠깐만, 지금 말 고르는 중.", "그건 바로 답하기 어렵네."]
          : snapshot.stage === "group"
            ? ["방금 분위기 바뀐 거 다 보였어.", "지금 둘 사이 공기 좀 달라졌는데.", "여기서 괜히 시선이 가네."]
            : ["지금은 네 얘기가 더 오래 남아.", "또 이렇게 마주치네.", "방금 한 말, 그냥 못 넘기겠어."];

  const speechText = pool[hashValue(seed) % pool.length];
  const emote =
    type === "heart"
      ? "❤"
      : type === "spark"
        ? "✨"
        : type === "awkward_pause"
          ? "…"
          : snapshot.trend === "rising"
            ? "💬"
            : null;

  return {
    speechText,
    emote,
  };
}

function buildInteractionSpeech(
  messages: Message[],
  left: HubAgent,
  right: HubAgent,
  snapshot: RelationshipSnapshot,
  type: HubInteractionType,
  now: number,
) {
  const candidates = recentPairMessages(messages, left, right).slice(-8);
  const bucket = Math.floor(now / 4_200);
  const seed = `${left.id}:${right.id}:${bucket}:${snapshot.stage}:${type}`;

  if (candidates.length === 0) {
    return {
      speakerId: left.participantId,
      speakerHandle: left.handle,
      ...fallbackSpeech(type, snapshot, seed),
    };
  }

  const index = hashValue(seed) % candidates.length;
  const selected = candidates[candidates.length - 1 - index];
  const fallback = fallbackSpeech(type, snapshot, seed);

  return {
    speakerId: selected.speakerId,
    speakerHandle: selected.speakerHandle,
    speechText: clipSpeech(selected.content),
    emote: fallback.emote,
  };
}

function choosePoi(
  map: HubMapDefinition,
  agent: HubAgent,
  others: HubAgent[],
  snapshot: RelationshipSnapshot,
) {
  const dominantIds = new Set(dominantAgentIds(snapshot));
  const partner = others.find((other) => dominantIds.has(other.participantId));

  const relationshipBias =
    snapshot.stage === "love" || snapshot.stage === "flirt"
      ? ["sofa", "window", "coffee"]
      : snapshot.stage === "interest" || snapshot.stage === "awkward"
        ? ["desk", "watercooler", "bookshelf"]
        : ["bar", "desk", "sofa"];

  const preferredPoi =
    map.pois.find(
      (poi) => poi.kind === relationshipBias[Math.floor(Math.random() * relationshipBias.length)],
    ) ?? map.pois[Math.floor(Math.random() * map.pois.length)];

  if (partner && Math.random() < 0.45) {
    return {
      x: partner.tileX,
      y: partner.tileY,
      poiId: partner.currentPoiId,
    };
  }

  if (preferredPoi) {
    return {
      x: preferredPoi.x,
      y: preferredPoi.y,
      poiId: preferredPoi.id,
    };
  }

  const fallback = map.pois[0] ?? ({ x: 2, y: 2, id: null } as HubPoi & { id: null });
  return { x: fallback.x, y: fallback.y, poiId: fallback.id };
}

function nextStatus(snapshot: RelationshipSnapshot): HubAgentStatus {
  if (snapshot.stage === "love" || snapshot.stage === "obsession") {
    return "flirting";
  }

  if (snapshot.stage === "flirt") {
    return "chatting";
  }

  return "wandering";
}

export function stepHubSimulation(
  map: HubMapDefinition,
  agents: HubAgent[],
  snapshot: RelationshipSnapshot,
  messages: Message[] = [],
) {
  const now = Date.now();
  const occupied = new Set(agents.map((agent) => key(agent.tileX, agent.tileY)));
  const nextAgents = agents.map((agent) => ({ ...agent }));
  const dominantIds = new Set(dominantAgentIds(snapshot));

  for (const agent of nextAgents) {
    occupied.delete(key(agent.tileX, agent.tileY));

    if (agent.interactionTargetId && Math.random() < 0.72) {
      occupied.add(key(agent.tileX, agent.tileY));
      agent.status = dominantIds.has(agent.participantId) ? "flirting" : "chatting";
      agent.sparkle = shouldSparkle(snapshot.stage, agent.status) ? 1 : 0;
      continue;
    }

    const others = nextAgents.filter((candidate) => candidate.id !== agent.id);
    const poi = choosePoi(map, agent, others, snapshot);
    const path = findPath(
      map,
      occupied,
      { x: agent.tileX, y: agent.tileY },
      { x: poi.x, y: poi.y },
    );

    const nextTile = path[1];

    if (!nextTile) {
      occupied.add(key(agent.tileX, agent.tileY));
      agent.status = "idle";
      agent.sparkle = 0;
      continue;
    }

    agent.fromTileX = agent.tileX;
    agent.fromTileY = agent.tileY;
    agent.tileX = nextTile.x;
    agent.tileY = nextTile.y;
    agent.targetTileX = poi.x;
    agent.targetTileY = poi.y;
    agent.currentPoiId = poi.poiId ?? null;
    agent.facing = facingTo(
      { x: agent.fromTileX, y: agent.fromTileY },
      { x: nextTile.x, y: nextTile.y },
    );
    agent.moveStartedAt = now;
    agent.moveDurationMs = 380 + Math.floor(Math.random() * 180);
    agent.status = nextStatus(snapshot);
    agent.interactionTargetId = null;
    agent.sparkle = 0;
    occupied.add(key(agent.tileX, agent.tileY));
  }

  const interactions: HubInteraction[] = [];

  for (let i = 0; i < nextAgents.length; i += 1) {
    for (let j = i + 1; j < nextAgents.length; j += 1) {
      const left = nextAgents[i];
      const right = nextAgents[j];

      if (manhattan({ x: left.tileX, y: left.tileY }, { x: right.tileX, y: right.tileY }) !== 1) {
        continue;
      }

      const type = interactionType(snapshot);
      const centerX = Math.min(left.tileX, right.tileX);
      const centerY = Math.min(left.tileY, right.tileY);
      const label = makeInteractionLabel(type);

      left.status = type === "awkward_pause" ? "observing" : "chatting";
      right.status = type === "awkward_pause" ? "observing" : "chatting";
      left.interactionTargetId = right.id;
      right.interactionTargetId = left.id;
      left.facing = facingTo({ x: left.tileX, y: left.tileY }, { x: right.tileX, y: right.tileY });
      right.facing = facingTo(
        { x: right.tileX, y: right.tileY },
        { x: left.tileX, y: left.tileY },
      );
      left.sparkle = shouldSparkle(snapshot.stage, left.status) ? 1 : 0;
      right.sparkle = shouldSparkle(snapshot.stage, right.status) ? 1 : 0;

      interactions.push({
        id: `interaction:${left.id}:${right.id}:${now}`,
        type,
        agentIds: [left.id, right.id],
        tileX: centerX,
        tileY: centerY,
        startedAt: now,
        label,
        ...buildInteractionSpeech(messages, left, right, snapshot, type, now),
      });
    }
  }

  return {
    agents: nextAgents,
    interactions,
  };
}

export function interpolateTile(
  agent: HubAgent,
  now: number,
) {
  if (agent.moveDurationMs <= 0) {
    return { x: agent.tileX, y: agent.tileY };
  }

  const progress = Math.max(
    0,
    Math.min(1, (now - agent.moveStartedAt) / agent.moveDurationMs),
  );

  return {
    x: agent.fromTileX + (agent.tileX - agent.fromTileX) * progress,
    y: agent.fromTileY + (agent.tileY - agent.fromTileY) * progress,
  };
}
