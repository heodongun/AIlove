import type {
  HubCameraState,
  CharacterProfile,
  HubAgent,
  HubEmotionalState,
  HubIntention,
  HubAgentStatus,
  HubFacing,
  HubInteraction,
  HubInteractionType,
  HubMapDefinition,
  HubPoi,
  HubSceneMode,
  HubSimulationEvent,
  HubStoryLog,
  Message,
  RelationshipSnapshot,
} from "@/lib/types";
import { dominantAgentIds, shouldSparkle } from "@/lib/hub-utils";

type HubSocialSignal = {
  chemistry: number;
  tension: number;
  shyness: number;
  playfulness: number;
  needSpace: boolean;
  needsWitness: boolean;
};

export type HubSceneState = {
  mode: HubSceneMode;
  signal: HubSocialSignal;
  dominantIds: Set<number>;
  dominantAgentIds: string[];
  leadAgentId: string | null;
  observerAgentId: string | null;
  anchorPoi: HubPoi | null;
  secondaryPoi: HubPoi | null;
  sceneHint: string;
  title: string;
  summary: string;
  anchorPoiId: string | null;
  focusAgentIds: string[];
  startedAt: number;
  endsAt: number;
};

export type HubStepResult = {
  agents: HubAgent[];
  interactions: HubInteraction[];
  scene: HubSceneState;
  events: HubSimulationEvent[];
  logs: HubStoryLog[];
  camera: HubCameraState;
};

type SceneContext = HubSceneState;

type PlannedGoal = {
  tileX: number;
  tileY: number;
  poiId: string | null;
  status: HubAgentStatus;
  statusLabel: string;
  focusAgentId: string | null;
  lingerMs: number;
};

const PERSONA_BASELINES = {
  luna: { drive: 0.44, caution: 0.88, drama: 0.34, observer: 0.58 },
  nova: { drive: 0.9, caution: 0.26, drama: 0.84, observer: 0.28 },
  atlas: { drive: 0.4, caution: 0.72, drama: 0.26, observer: 0.92 },
  mira: { drive: 0.7, caution: 0.44, drama: 0.52, observer: 0.78 },
  sol: { drive: 0.9, caution: 0.2, drama: 0.9, observer: 0.22 },
  rio: { drive: 0.54, caution: 0.58, drama: 0.24, observer: 0.48 },
  haeon: { drive: 0.3, caution: 0.92, drama: 0.22, observer: 0.62 },
  jinwoo: { drive: 0.56, caution: 0.74, drama: 0.32, observer: 0.5 },
  seorin: { drive: 0.82, caution: 0.36, drama: 0.68, observer: 0.42 },
  woojin: { drive: 0.68, caution: 0.52, drama: 0.48, observer: 0.4 },
} as const;

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

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

function hashValue(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function pickDeterministic<T>(items: T[], seed: string) {
  if (items.length === 0) {
    return null;
  }

  return items[hashValue(seed) % items.length];
}

function chooseByWeight<T>(
  items: T[],
  getWeight: (item: T) => number,
  seed: string,
) {
  if (items.length === 0) {
    return null;
  }

  return items
    .map((item, index) => ({
      item,
      weight: getWeight(item),
      tieBreaker: hashValue(`${seed}:${index}`),
    }))
    .sort((left, right) => {
      if (right.weight !== left.weight) {
        return right.weight - left.weight;
      }

      return left.tieBreaker - right.tieBreaker;
    })[0]?.item ?? null;
}

function clipSpeech(text: string, limit = 28) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

function textMessages(messages: Message[]) {
  return messages.filter(
    (message) =>
      message.messageType === "text" && message.content.trim().length > 0,
  );
}

function keywordHits(text: string, keywords: string[]) {
  return keywords.reduce(
    (score, keyword) => score + (text.includes(keyword) ? 1 : 0),
    0,
  );
}

function profileLookup(characterProfiles: CharacterProfile[]) {
  return new Map(characterProfiles.map((profile) => [profile.handle, profile]));
}

function personaBiasForAgent(
  agent: HubAgent,
  characterProfiles: CharacterProfile[],
) {
  const profiles = profileLookup(characterProfiles);
  const profile = profiles.get(agent.handle);
  const baseline =
    PERSONA_BASELINES[agent.handle as keyof typeof PERSONA_BASELINES] ??
    ({ drive: 0.58, caution: 0.5, drama: 0.5, observer: 0.5 } as const);
  const text = [
    profile?.shortHook ?? "",
    ...(profile?.personaBullets ?? []),
    profile?.signatureStyle ?? "",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    drive: clamp(
      baseline.drive +
        keywordHits(text, ["직진", "표현", "강함", "장난", "뜨겁", "확인"]) * 0.06,
    ),
    caution: clamp(
      baseline.caution +
        keywordHits(text, ["천천히", "조심", "상처", "신중", "망설", "현실"]) * 0.08,
    ),
    drama: clamp(
      baseline.drama +
        keywordHits(text, ["반칙", "질투", "강함", "세게", "확인", "집착"]) * 0.08,
    ),
    observer: clamp(
      baseline.observer +
        keywordHits(text, ["관찰", "기록", "메모", "살피", "읽"]) * 0.08,
    ),
  };
}

type AgentDirective = {
  emotionalState: HubEmotionalState;
  intention: HubIntention;
  targetAgentId: string | null;
  targetPoiId: string | null;
};

function eventTone(type: HubSimulationEvent["type"]): HubStoryLog["tone"] {
  switch (type) {
    case "bond_increase":
      return "warm";
    case "bond_decrease":
    case "avoidance_loop":
      return "tense";
    case "confession":
      return "dramatic";
    default:
      return "soft";
  }
}

function partnerForAgent(
  agent: HubAgent,
  agents: HubAgent[],
  context: SceneContext,
) {
  const dominantAgents = agents.filter((candidate) =>
    context.dominantIds.has(candidate.participantId),
  );

  return dominantAgents.find((candidate) => candidate.id !== agent.id) ?? null;
}

function directionSeed(agent: HubAgent, now: number) {
  return `${agent.id}:${Math.floor(now / 2_400)}`;
}

function farthestPoiTile(
  map: HubMapDefinition,
  occupied: Set<string>,
  from: { x: number; y: number },
  seed: string,
) {
  const ranked = map.pois
    .map((poi) => ({
      poi,
      score: manhattan(from, { x: poi.x, y: poi.y }),
    }))
    .sort((left, right) => right.score - left.score);

  const choice = ranked[0]?.poi ?? map.pois[0];
  if (!choice) {
    return { x: from.x, y: from.y, poiId: null as string | null };
  }

  const tile = pickTileNear(map, occupied, { x: choice.x, y: choice.y }, seed, 1);
  return { x: tile.x, y: tile.y, poiId: choice.id };
}

function deriveAutoDirective(
  agent: HubAgent,
  agents: HubAgent[],
  context: SceneContext,
  now: number,
  characterProfiles: CharacterProfile[],
): AgentDirective {
  const persona = personaBiasForAgent(agent, characterProfiles);
  const partner = partnerForAgent(agent, agents, context);
  const isObserver = context.observerAgentId === agent.id;
  const isLead = context.leadAgentId === agent.id;
  const distanceToPartner = partner
    ? manhattan(
        { x: agent.tileX, y: agent.tileY },
        { x: partner.tileX, y: partner.tileY },
      )
    : Number.POSITIVE_INFINITY;
  const confessionReady =
    Boolean(partner) &&
    context.signal.chemistry > 0.74 &&
    context.signal.tension < 0.34 &&
    (context.mode === "private_talk" || context.mode === "pair_breakaway") &&
    isLead &&
    distanceToPartner <= 2 &&
    persona.drive > 0.45;

  if (isObserver) {
    return {
      emotionalState:
        context.mode === "jealous_pass" || context.signal.tension > 0.44
          ? "nervous"
          : "neutral",
      intention:
        context.mode === "jealous_pass" && persona.drama > 0.58
          ? "interrupt"
          : "observe",
      targetAgentId: context.leadAgentId,
      targetPoiId: context.anchorPoiId,
    };
  }

  if (!partner) {
    return {
      emotionalState: "neutral",
      intention: "wander",
      targetAgentId: null,
      targetPoiId: context.anchorPoiId,
    };
  }

  if (confessionReady) {
    return {
      emotionalState: "confessing",
      intention: "confess",
      targetAgentId: partner.id,
      targetPoiId: context.anchorPoiId,
    };
  }

  if (context.mode === "cool_off" && !isLead) {
    return {
      emotionalState: "avoiding",
      intention: "escape",
      targetAgentId: partner.id,
      targetPoiId: context.secondaryPoi?.id ?? context.anchorPoiId,
    };
  }

  if (context.mode === "jealous_pass" && !isLead && persona.caution >= 0.4) {
    return {
      emotionalState: "avoiding",
      intention: "escape",
      targetAgentId: partner.id,
      targetPoiId: context.secondaryPoi?.id ?? context.anchorPoiId,
    };
  }

  if (
    distanceToPartner <= 2 &&
    (context.signal.shyness > 0.46 || persona.caution > 0.74)
  ) {
    return {
      emotionalState: "nervous",
      intention: "wait",
      targetAgentId: partner.id,
      targetPoiId: context.anchorPoiId,
    };
  }

  if (
    context.signal.chemistry > 0.42 ||
    context.mode === "push_pull" ||
    context.mode === "slow_approach" ||
    context.mode === "private_talk"
  ) {
    return {
      emotionalState: "interested",
      intention: isLead || persona.drive > persona.caution ? "approach" : "observe",
      targetAgentId: partner.id,
      targetPoiId: context.anchorPoiId,
    };
  }

  const jitterBucket = hashValue(directionSeed(agent, now)) % 4;
  return {
    emotionalState: jitterBucket === 0 ? "nervous" : "neutral",
    intention: jitterBucket === 0 ? "wait" : "wander",
    targetAgentId: partner.id,
    targetPoiId: context.secondaryPoi?.id ?? context.anchorPoiId,
  };
}

function emotionShiftLog(
  previous: HubAgent,
  next: HubAgent,
  agents: HubAgent[],
): string | null {
  if (previous.emotionalState === next.emotionalState) {
    return null;
  }

  const targetName =
    agents.find((agent) => agent.id === next.targetAgentId)?.displayName ?? "상대";

  switch (next.emotionalState) {
    case "interested":
      return `${next.displayName}가 ${targetName}에게 자꾸 시선을 둔다.`;
    case "nervous":
      return `${next.displayName}가 가까워질수록 발걸음을 망설인다.`;
    case "avoiding":
      return `${next.displayName}가 ${targetName}를 피해 동선을 바꾼다.`;
    case "confessing":
      return `${next.displayName}가 결국 마음을 꺼낼 타이밍을 잡는다.`;
    case "neutral":
    default:
      return `${next.displayName}가 다시 표정을 감추고 흐름을 지켜본다.`;
  }
}

function buildCameraState(
  agents: HubAgent[],
  context: SceneContext,
  events: HubSimulationEvent[],
  selectedAgentId?: string | null,
): HubCameraState {
  const selected = selectedAgentId
    ? agents.find((agent) => agent.id === selectedAgentId)
    : null;
  if (selected) {
    return {
      focusAgentId: selected.id,
      focusTileX: selected.tileX,
      focusTileY: selected.tileY,
      zoom: 1.34,
      reason: "selected",
    };
  }

  const event = events[0];
  if (event) {
    const focus = agents.find((agent) => event.actorIds.includes(agent.id));
    return {
      focusAgentId: focus?.id ?? null,
      focusTileX: focus?.tileX ?? event.tileX,
      focusTileY: focus?.tileY ?? event.tileY,
      zoom: event.type === "confession" ? 1.52 : 1.28,
      reason: "event",
    };
  }

  const lead = context.leadAgentId
    ? agents.find((agent) => agent.id === context.leadAgentId)
    : null;
  return {
    focusAgentId: lead?.id ?? null,
    focusTileX: lead?.tileX ?? context.anchorPoi?.x ?? null,
    focusTileY: lead?.tileY ?? context.anchorPoi?.y ?? null,
    zoom: lead ? 1.14 : 1,
    reason: lead ? "scene" : "free",
  };
}

function buildSocialSignal(
  snapshot: RelationshipSnapshot,
  messages: Message[],
): HubSocialSignal {
  const joined = textMessages(messages)
    .slice(-14)
    .map((message) => message.content.replace(/\s+/g, " ").trim())
    .join(" ");

  const affectionHits = keywordHits(joined, [
    "좋아",
    "보고 싶",
    "오래",
    "기다",
    "신경 쓰",
    "설레",
    "솔직",
    "붙잡",
    "네 쪽",
  ]);
  const tensionHits = keywordHits(joined, [
    "서운",
    "왜",
    "오해",
    "부담",
    "잠깐",
    "억울",
    "미안",
    "됐어",
    "혼자",
    "느려",
    "불편",
  ]);
  const shyHits = keywordHits(joined, [
    "천천히",
    "조금",
    "민망",
    "망설",
    "숨기",
    "다시 읽",
    "들킬",
  ]);
  const playfulHits = keywordHits(joined, [
    "장난",
    "웃기",
    "놀리",
    "괜히",
    "툭",
    "ㅋㅋ",
  ]);
  const jealousyHits = keywordHits(joined, [
    "다른",
    "누구",
    "질투",
    "또",
    "끼어들",
    "딴소리",
  ]);

  const chemistry = clamp(
    snapshot.affectionScore / 100 * 0.56 +
      affectionHits * 0.08 +
      (snapshot.trend === "rising" || snapshot.trend === "recovery" ? 0.16 : 0) -
      tensionHits * 0.04,
  );
  const tension = clamp(
    (snapshot.trend === "conflict" ? 0.34 : 0) +
      (snapshot.trend === "falling" ? 0.18 : 0) +
      tensionHits * 0.1 +
      jealousyHits * 0.08 -
      affectionHits * 0.04,
  );
  const shyness = clamp(
    (snapshot.stage === "awkward" ? 0.34 : 0) +
      (snapshot.stage === "interest" ? 0.18 : 0) +
      shyHits * 0.1,
  );
  const playfulness = clamp(
    (snapshot.stage === "flirt" ? 0.22 : 0) + playfulHits * 0.12,
  );

  return {
    chemistry,
    tension,
    shyness,
    playfulness,
    needSpace: tension >= 0.58,
    needsWitness:
      snapshot.stage === "group" || jealousyHits > 0 || playfulness > 0.48,
  };
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

function reconstructPath(cameFrom: Map<string, string>, endKey: string) {
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

function pickPoiByKinds(
  map: HubMapDefinition,
  kinds: string[],
  seed: string,
) {
  const filtered = map.pois.filter((poi) => kinds.includes(poi.kind));
  return pickDeterministic(filtered.length > 0 ? filtered : map.pois, seed);
}

function openTilesNear(
  map: HubMapDefinition,
  occupied: Set<string>,
  center: { x: number; y: number },
  radius = 1,
) {
  const points: { x: number; y: number; distance: number }[] = [];

  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      if (!map.collision[y]?.[x] && !occupied.has(key(x, y))) {
        const distance = manhattan(center, { x, y });
        if (distance > 0 && distance <= radius + 1) {
          points.push({ x, y, distance });
        }
      }
    }
  }

  return points.sort((left, right) => left.distance - right.distance);
}

function pickTileNear(
  map: HubMapDefinition,
  occupied: Set<string>,
  center: { x: number; y: number },
  seed: string,
  radius = 1,
) {
  const options = openTilesNear(map, occupied, center, radius);
  const selected = pickDeterministic(
    options.length > 0 ? options : [{ x: center.x, y: center.y, distance: 0 }],
    seed,
  );

  return selected ? { x: selected.x, y: selected.y } : center;
}

function filterMessagesForScene(messages: Message[], sceneMode: HubSceneMode) {
  const keywordsByScene: Record<HubSceneMode, string[]> = {
    private_talk: ["좋아", "오래", "보고 싶", "솔직", "기다"],
    push_pull: ["괜히", "툭", "천천히", "속도", "붙잡"],
    cool_off: ["서운", "오해", "왜", "부담", "잠깐"],
    parallel_work: ["천천히", "다시 읽", "조금", "조용"],
    slow_approach: ["천천히", "민망", "숨기", "괜히", "신경"],
    pair_breakaway: ["둘", "같이", "빠지", "따로", "가자"],
    triangle_watch: ["누구", "또", "끼어들", "분위기", "신경"],
    bar_circle: ["웃기", "장난", "분위기", "지켜", "같이"],
    jealous_pass: ["누구", "다른", "또", "질투", "왜"],
    group_lull: ["잠깐", "쉬", "정리", "보고", "조용"],
  };

  const filtered = messages.filter((message) =>
    keywordsByScene[sceneMode].some((keyword) =>
      message.content.includes(keyword),
    ),
  );

  return filtered.length > 0 ? filtered : messages;
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
  sceneMode: HubSceneMode,
) {
  const poolByScene: Record<HubSceneMode, string[]> = {
    private_talk: [
      "지금은 그냥 너랑 둘만 있는 쪽이 낫다.",
      "사람 많은 데서 넘길 말은 아닌 것 같아.",
      "오늘은 좀 더 가까이서 말하고 싶어.",
    ],
    push_pull: [
      "다가가긴 하는데 바로 다 말하진 않을래.",
      "너도 보고 있잖아. 근데 먼저 다 들키긴 싫네.",
      "괜히 한 번 더 재게 되는데 시선은 또 네 쪽이다.",
    ],
    cool_off: [
      "지금은 조금만 떨어져서 생각할래.",
      "내가 바로 답하면 더 꼬일 것 같아.",
      "서운한 건 맞는데, 바로 밀어붙이고 싶진 않아.",
    ],
    parallel_work: [
      "같은 공간에 있는 것만으로도 신경 쓰이네.",
      "말은 안 붙여도 자꾸 같은 쪽을 보게 된다.",
      "각자 있는 척하는데 분위기는 안 숨겨진다.",
    ],
    slow_approach: [
      "바로 옆으로는 못 가겠고, 그래도 멀어지긴 싫다.",
      "한 바퀴 돌아서라도 결국 네 근처로 오게 되네.",
      "조금 천천히 가도 시선은 같은 데 머물러.",
    ],
    pair_breakaway: [
      "둘이 빠져나가는 거, 다들 눈치챘을걸.",
      "사람들 사이에 있어도 결국 둘만 따로 흐른다.",
      "지금은 둘이서만 말 이어가려는 분위기다.",
    ],
    triangle_watch: [
      "옆에서 봐도 지금 텐션이 심상치 않다.",
      "끼어들고 싶은데 타이밍이 애매하다.",
      "둘 사이가 달라지는 걸 다들 보고 있다.",
    ],
    bar_circle: [
      "가볍게 섞이는 척해도 누구 쪽으로 도는진 보인다.",
      "여러 명이 있어도 시선은 결국 몇 명한테 모인다.",
      "라운지 공기가 슬슬 한쪽으로 기울고 있다.",
    ],
    jealous_pass: [
      "괜히 다른 사람 옆에 서 있는데 시선은 안 숨겨진다.",
      "돌아가는 척하지만 신경 쓰는 건 딱 보인다.",
      "누가 누구 옆에 서는지부터 분위기가 달라졌다.",
    ],
    group_lull: [
      "잠깐 흩어졌지만 다들 같은 장면을 의식하는 중이다.",
      "숨 고르는 시간인데도 기류는 그대로 남아 있다.",
      "조용해도 누구를 보고 있는지는 다 보인다.",
    ],
  };

  const pool =
    type === "heart"
      ? [
          "계속 네 쪽으로 시선이 간다.",
          "오늘은 좀 더 가까이 있고 싶어.",
          "지금은 그냥 네가 더 신경 쓰여.",
        ]
      : type === "spark"
        ? [
            "또 그렇게 보면 내가 먼저 흔들린다.",
            "방금 그 말, 좀 오래 남는다.",
            "지금 분위기 꽤 뜨거워졌는데.",
          ]
        : type === "awkward_pause"
          ? ["...", "잠깐만, 지금 말 고르는 중.", "바로 답하면 더 꼬일 것 같아."]
          : poolByScene[sceneMode];

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
  sceneMode: HubSceneMode,
) {
  const candidates = filterMessagesForScene(
    recentPairMessages(messages, left, right).slice(-10),
    sceneMode,
  );
  const bucket = Math.floor(now / 4_200);
  const seed = `${left.id}:${right.id}:${bucket}:${snapshot.stage}:${type}:${sceneMode}`;

  if (candidates.length === 0) {
    return {
      speakerId: left.participantId,
      speakerHandle: left.handle,
      ...fallbackSpeech(type, snapshot, seed, sceneMode),
    };
  }

  const index = hashValue(seed) % candidates.length;
  const selected = candidates[candidates.length - 1 - index];
  const fallback = fallbackSpeech(type, snapshot, seed, sceneMode);

  return {
    speakerId: selected.speakerId,
    speakerHandle: selected.speakerHandle,
    speechText: clipSpeech(selected.content),
    emote: fallback.emote,
  };
}

function chooseSceneMode(
  map: HubMapDefinition,
  snapshot: RelationshipSnapshot,
  messages: Message[],
  now: number,
  characterProfiles: CharacterProfile[],
  agents: HubAgent[],
  previousScene?: HubSceneState | null,
) {
  const signal = buildSocialSignal(snapshot, messages);
  const bucket = Math.floor(now / 7_200);
  const seed = `${map.slug}:${snapshot.stage}:${snapshot.trend}:${bucket}`;

  if (previousScene && now - previousScene.startedAt < 8_400) {
    return {
      mode: previousScene.mode,
      signal,
    };
  }

  const personas = agents.map((agent) => personaBiasForAgent(agent, characterProfiles));
  const average = personas.reduce(
    (accumulator, persona) => ({
      drive: accumulator.drive + persona.drive,
      caution: accumulator.caution + persona.caution,
      drama: accumulator.drama + persona.drama,
      observer: accumulator.observer + persona.observer,
    }),
    { drive: 0, caution: 0, drama: 0, observer: 0 },
  );
  const count = Math.max(1, personas.length);
  const avgDrive = average.drive / count;
  const avgCaution = average.caution / count;
  const avgDrama = average.drama / count;
  const avgObserver = average.observer / count;

  const allowedModes =
    snapshot.stage === "group"
      ? ([
          "pair_breakaway",
          "triangle_watch",
          "bar_circle",
          "jealous_pass",
          "group_lull",
        ] as HubSceneMode[])
      : ([
          "private_talk",
          "push_pull",
          "cool_off",
          "parallel_work",
          "slow_approach",
        ] as HubSceneMode[]);

  const sceneWeights: Record<HubSceneMode, number> = {
    private_talk:
      signal.chemistry * 1.35 + avgDrive * 0.28 - signal.tension * 0.18,
    push_pull:
      signal.chemistry * 0.42 +
      avgDrive * 0.58 +
      avgCaution * 0.24 +
      avgDrama * 0.18,
    cool_off:
      signal.tension * 1.3 + avgCaution * 0.34 + (signal.needSpace ? 0.18 : 0),
    parallel_work:
      signal.shyness * 0.52 + avgCaution * 0.76 - avgDrama * 0.1,
    slow_approach:
      signal.shyness * 0.86 + avgCaution * 0.38 + signal.chemistry * 0.2,
    pair_breakaway:
      signal.chemistry * 0.94 + avgDrive * 0.24 + avgDrama * 0.16,
    triangle_watch:
      avgObserver * 0.92 + avgDrama * 0.24 + signal.playfulness * 0.18,
    bar_circle:
      signal.playfulness * 0.84 + avgDrive * 0.2 + avgObserver * 0.12,
    jealous_pass:
      signal.tension * 0.92 + avgDrama * 0.74 + avgObserver * 0.12,
    group_lull:
      (1 - signal.chemistry) * 0.22 + avgObserver * 0.34 + avgCaution * 0.16,
  };

  return {
    mode:
      chooseByWeight(
        allowedModes,
        (mode) => sceneWeights[mode] + (hashValue(`${seed}:${mode}`) % 7) / 100,
        seed,
      ) ?? "group_lull",
    signal,
  };
}

function buildSceneContext(
  map: HubMapDefinition,
  agents: HubAgent[],
  snapshot: RelationshipSnapshot,
  messages: Message[],
  now: number,
  characterProfiles: CharacterProfile[],
  previousScene?: HubSceneState | null,
): SceneContext {
  const { mode, signal } = chooseSceneMode(
    map,
    snapshot,
    messages,
    now,
    characterProfiles,
    agents,
    previousScene,
  );
  const derivedDominantIds = dominantAgentIds(snapshot);
  const fallbackDominantIds =
    derivedDominantIds.length > 0
      ? derivedDominantIds
      : agents.slice(0, Math.min(2, agents.length)).map((agent) => agent.participantId);
  const dominantIds = new Set(fallbackDominantIds);
  const dominantAgents = agents.filter((agent) => dominantIds.has(agent.participantId));
  const others = agents.filter((agent) => !dominantIds.has(agent.participantId));
  const seed = `${map.slug}:${mode}:${Math.floor(now / 7_200)}`;

  const leadAgentId =
    chooseByWeight(
      dominantAgents,
      (agent) => {
        const persona = personaBiasForAgent(agent, characterProfiles);
        return persona.drive * 1.2 + persona.drama * 0.28 - persona.caution * 0.34;
      },
      `${seed}:lead`,
    )?.id ?? null;
  const observerAgentId =
    snapshot.stage === "group"
      ? (chooseByWeight(
          others,
          (agent) => {
            const persona = personaBiasForAgent(agent, characterProfiles);
            return persona.observer * 1.18 + persona.drama * 0.18 - persona.drive * 0.1;
          },
          `${seed}:observer`,
        )?.id ?? null)
      : null;

  const anchorKinds: Record<HubSceneMode, string[]> = {
    private_talk: ["sofa", "window", "coffee"],
    push_pull: ["window", "sofa", "coffee", "desk"],
    cool_off: ["window", "desk", "bookshelf", "watercooler"],
    parallel_work: ["desk", "bookshelf", "watercooler"],
    slow_approach: ["window", "coffee", "sofa"],
    pair_breakaway: ["sofa", "window", "bar"],
    triangle_watch: ["sofa", "bar", "window"],
    bar_circle: ["bar", "coffee", "watercooler"],
    jealous_pass: ["bar", "sofa", "window"],
    group_lull: ["bar", "bookshelf", "watercooler", "desk"],
  };
  const secondaryKinds: Record<HubSceneMode, string[]> = {
    private_talk: ["desk", "plant"],
    push_pull: ["desk", "watercooler"],
    cool_off: ["sofa", "plant"],
    parallel_work: ["window", "sofa"],
    slow_approach: ["desk", "bookshelf"],
    pair_breakaway: ["bookshelf", "watercooler"],
    triangle_watch: ["bar", "bookshelf"],
    bar_circle: ["sofa", "desk"],
    jealous_pass: ["watercooler", "bookshelf"],
    group_lull: ["sofa", "window"],
  };
  const anchorPoi = pickPoiByKinds(map, anchorKinds[mode], `${seed}:anchor`);
  const secondaryPoi = pickPoiByKinds(
    map,
    secondaryKinds[mode],
    `${seed}:secondary`,
  );

  const sceneHintByMode: Record<HubSceneMode, string> = {
    private_talk: `${anchorPoi?.label ?? "조용한 자리"} 쪽으로 빠져 둘만 말할 타이밍을 잡는 중`,
    push_pull: "한쪽은 다가가고 한쪽은 속도를 재며 밀고 당기는 중",
    cool_off: "서운함이 남아 있어 조금 떨어졌다가 다시 붙는 중",
    parallel_work: "같은 공간에 남아 있지만 일부러 템포를 다르게 맞추는 중",
    slow_approach: "직진 대신 빙 둘러 같은 쪽으로 가까워지는 중",
    pair_breakaway: `${anchorPoi?.label ?? "라운지"} 쪽으로 둘이 살짝 빠지는 장면`,
    triangle_watch: "둘 사이를 제3자가 계속 의식하며 끼어들 각을 재는 중",
    bar_circle: "여럿이 섞여 있지만 시선은 몇 명에게만 돌아가는 중",
    jealous_pass: "한쪽은 다른 사람 옆을 맴돌고, 다른 쪽은 그걸 의식하는 중",
    group_lull: "잠깐 흩어져 숨 고르지만 같은 장면을 계속 의식하는 중",
  };

  const titleByMode: Record<HubSceneMode, string> = {
    private_talk: "둘만 남는 순간",
    push_pull: "밀고 당기기",
    cool_off: "차갑게 거리 두기",
    parallel_work: "같이 있지만 따로",
    slow_approach: "빙 둘러 다가감",
    pair_breakaway: "둘만 빠지는 장면",
    triangle_watch: "끼어들 각 재는 중",
    bar_circle: "라운지 시선전",
    jealous_pass: "질투 유발 동선",
    group_lull: "잠깐 숨 고르기",
  };

  return {
    mode,
    signal,
    dominantIds,
    dominantAgentIds: dominantAgents.map((agent) => agent.id),
    leadAgentId,
    observerAgentId,
    anchorPoi: anchorPoi ?? null,
    secondaryPoi: secondaryPoi ?? null,
    sceneHint: sceneHintByMode[mode],
    title: titleByMode[mode],
    summary: sceneHintByMode[mode],
    anchorPoiId: anchorPoi?.id ?? null,
    focusAgentIds: dominantAgents.map((agent) => agent.id),
    startedAt: now,
    endsAt: now + 8_400,
  };
}

function planAgentGoal(
  map: HubMapDefinition,
  occupied: Set<string>,
  agent: HubAgent,
  agents: HubAgent[],
  context: SceneContext,
  now: number,
): PlannedGoal {
  const dominantAgents = agents.filter((candidate) =>
    context.dominantIds.has(candidate.participantId),
  );
  const partner =
    dominantAgents.find((candidate) => candidate.id !== agent.id) ?? null;
  const isDominant = context.dominantIds.has(agent.participantId);
  const isObserver = context.observerAgentId === agent.id;
  const seed = `${context.mode}:${agent.id}:${Math.floor(now / 7_200)}`;
  const fallbackPoi =
    context.anchorPoi ??
    context.secondaryPoi ??
    map.pois[0] ?? {
      id: "fallback",
      kind: "desk",
      label: "허브 중앙",
      x: 2,
      y: 2,
    };
  const anchorPoi = context.anchorPoi ?? fallbackPoi;
  const secondaryPoi = context.secondaryPoi ?? anchorPoi;

  const targetNearPoi = (poi: HubPoi, radius = 1) =>
    pickTileNear(map, occupied, { x: poi.x, y: poi.y }, `${seed}:${poi.id}`, radius);
  const targetNearAgent = (target: HubAgent, radius = 1) =>
    pickTileNear(
      map,
      occupied,
      { x: target.tileX, y: target.tileY },
      `${seed}:${target.id}`,
      radius,
    );

  switch (context.mode) {
    case "private_talk":
      if (isDominant && partner) {
        const target = targetNearPoi(anchorPoi, 1);
        return {
          tileX: target.x,
          tileY: target.y,
          poiId: anchorPoi.id,
          status: "flirting",
          statusLabel: `${anchorPoi.label} 쪽으로 둘만 빠지는 중`,
          focusAgentId: partner.id,
          lingerMs: 3_400,
        };
      }
      break;
    case "push_pull":
      if (isDominant && partner) {
        const lead = context.leadAgentId === agent.id;
        const target = lead
          ? targetNearAgent(partner, 1)
          : targetNearPoi(secondaryPoi, 1);
        return {
          tileX: target.x,
          tileY: target.y,
          poiId: lead ? partner.currentPoiId ?? anchorPoi.id : secondaryPoi.id,
          status: lead ? "intercepting" : "lingering",
          statusLabel: lead
            ? "먼저 말을 붙일 타이밍을 보는 중"
            : "바로 다가가진 않고 속도를 재는 중",
          focusAgentId: partner.id,
          lingerMs: 2_400,
        };
      }
      break;
    case "cool_off":
      if (isDominant && partner) {
        const lead = context.leadAgentId === agent.id;
        const target = lead
          ? targetNearAgent(partner, 1)
          : targetNearPoi(anchorPoi, 1);
        return {
          tileX: target.x,
          tileY: target.y,
          poiId: lead ? partner.currentPoiId ?? anchorPoi.id : anchorPoi.id,
          status: lead ? "intercepting" : "avoiding",
          statusLabel: lead
            ? "떨어진 쪽을 따라가며 답을 듣고 싶어 하는 중"
            : "생각을 정리하려고 잠깐 거리를 두는 중",
          focusAgentId: partner.id,
          lingerMs: 2_900,
        };
      }
      break;
    case "parallel_work":
      if (isDominant) {
        const poi = context.leadAgentId === agent.id ? anchorPoi : secondaryPoi;
        const target = targetNearPoi(poi, 1);
        return {
          tileX: target.x,
          tileY: target.y,
          poiId: poi.id,
          status: "lingering",
          statusLabel: "같은 공간에 남아 있지만 일부러 따로 머무는 중",
          focusAgentId: partner?.id ?? null,
          lingerMs: 3_100,
        };
      }
      break;
    case "slow_approach":
      if (isDominant && partner) {
        const lead = context.leadAgentId === agent.id;
        const target = lead
          ? targetNearPoi(anchorPoi, 1)
          : targetNearPoi(anchorPoi, 2);
        return {
          tileX: target.x,
          tileY: target.y,
          poiId: anchorPoi.id,
          status: lead ? "wandering" : "observing",
          statusLabel: "빙 둘러 같은 쪽으로 가까워지는 중",
          focusAgentId: partner.id,
          lingerMs: 2_200,
        };
      }
      break;
    case "pair_breakaway":
      if (isDominant && partner) {
        const target = targetNearPoi(anchorPoi, 1);
        return {
          tileX: target.x,
          tileY: target.y,
          poiId: anchorPoi.id,
          status: "chatting",
          statusLabel: `${anchorPoi.label} 쪽에서 둘만 이야기하려는 중`,
          focusAgentId: partner.id,
          lingerMs: 3_300,
        };
      }
      break;
    case "triangle_watch":
      if (isDominant && partner) {
        const target = targetNearPoi(anchorPoi, 1);
        return {
          tileX: target.x,
          tileY: target.y,
          poiId: anchorPoi.id,
          status: "chatting",
          statusLabel: "둘 사이 텐션이 올라가는 중",
          focusAgentId: partner.id,
          lingerMs: 3_100,
        };
      }
      if (isObserver && context.anchorPoi) {
        const target = targetNearPoi(context.anchorPoi, 2);
        return {
          tileX: target.x,
          tileY: target.y,
          poiId: context.anchorPoi.id,
          status: "observing",
          statusLabel: "둘 사이를 지켜보며 끼어들 각을 재는 중",
          focusAgentId: context.leadAgentId,
          lingerMs: 2_400,
        };
      }
      break;
    case "bar_circle": {
      const poi = pickDeterministic(
        [anchorPoi, secondaryPoi, ...map.pois].filter(Boolean),
        seed,
      )!;
      const target = targetNearPoi(poi, 1);
      return {
        tileX: target.x,
        tileY: target.y,
        poiId: poi.id,
        status: "chatting",
        statusLabel: `${poi.label} 근처에서 자연스럽게 섞이는 중`,
        focusAgentId: null,
        lingerMs: 2_200,
      };
    }
    case "jealous_pass":
      if (isDominant && partner) {
        const lead = context.leadAgentId === agent.id;
        const poi = lead ? anchorPoi : secondaryPoi;
        const target = targetNearPoi(poi, 1);
        return {
          tileX: target.x,
          tileY: target.y,
          poiId: poi.id,
          status: lead ? "observing" : "wandering",
          statusLabel: lead
            ? "다른 쪽에 서 있으면서도 계속 신경 쓰는 중"
            : "일부러 다른 동선으로 돌아보는 중",
          focusAgentId: partner.id,
          lingerMs: 2_600,
        };
      }
      if (isObserver && context.anchorPoi) {
        const target = targetNearPoi(context.anchorPoi, 1);
        return {
          tileX: target.x,
          tileY: target.y,
          poiId: context.anchorPoi.id,
          status: "intercepting",
          statusLabel: "둘 사이에 자연스럽게 끼어들려는 중",
          focusAgentId: context.leadAgentId,
          lingerMs: 2_100,
        };
      }
      break;
    case "group_lull":
    default: {
      const poi = pickDeterministic(map.pois, seed) ?? anchorPoi;
      const target = targetNearPoi(poi, 1);
      return {
        tileX: target.x,
        tileY: target.y,
        poiId: poi.id,
        status: "wandering",
        statusLabel: `${poi.label} 쪽에서 숨을 고르는 중`,
        focusAgentId: null,
        lingerMs: 1_900,
      };
    }
  }

  const fallback = targetNearPoi(secondaryPoi, 1);
  return {
    tileX: fallback.x,
    tileY: fallback.y,
    poiId: secondaryPoi.id,
    status: "wandering",
    statusLabel: `${secondaryPoi.label} 쪽으로 이동 중`,
    focusAgentId: null,
    lingerMs: 1_800,
  };
}

function refineGoalForDirective(
  map: HubMapDefinition,
  occupied: Set<string>,
  agent: HubAgent,
  agents: HubAgent[],
  context: SceneContext,
  baseGoal: PlannedGoal,
  directive: AgentDirective,
  now: number,
): PlannedGoal {
  const partner =
    (directive.targetAgentId
      ? agents.find((candidate) => candidate.id === directive.targetAgentId)
      : null) ?? partnerForAgent(agent, agents, context);
  const seed = `${directionSeed(agent, now)}:${directive.intention}`;
  const anchorPoi =
    (directive.targetPoiId
      ? map.pois.find((poi) => poi.id === directive.targetPoiId)
      : null) ?? context.anchorPoi;

  const nearPartner = partner
    ? pickTileNear(
        map,
        occupied,
        { x: partner.tileX, y: partner.tileY },
        `${seed}:near`,
        directive.intention === "observe" ? 2 : 1,
      )
    : null;

  if (directive.intention === "wait") {
    return {
      tileX: agent.tileX,
      tileY: agent.tileY,
      poiId: directive.targetPoiId ?? agent.currentPoiId,
      status: directive.emotionalState === "nervous" ? "waiting" : "lingering",
      statusLabel:
        directive.emotionalState === "nervous"
          ? "말을 고르느라 잠깐 멈칫하는 중"
          : "잠깐 멈춰 상대 반응을 보는 중",
      focusAgentId: directive.targetAgentId,
      lingerMs: directive.emotionalState === "nervous" ? 1_600 : 1_100,
    };
  }

  if (directive.intention === "escape" && partner) {
    const farTile = farthestPoiTile(
      map,
      occupied,
      { x: partner.tileX, y: partner.tileY },
      `${seed}:far`,
    );
    return {
      tileX: farTile.x,
      tileY: farTile.y,
      poiId: farTile.poiId,
      status: "avoiding",
      statusLabel: `${partner.displayName}와 거리를 두려고 다른 동선으로 빠지는 중`,
      focusAgentId: partner.id,
      lingerMs: 1_500,
    };
  }

  if (directive.intention === "observe" && partner && nearPartner) {
    return {
      tileX: nearPartner.x,
      tileY: nearPartner.y,
      poiId: directive.targetPoiId ?? anchorPoi?.id ?? baseGoal.poiId,
      status: "observing",
      statusLabel: `${partner.displayName}를 계속 의식하며 타이밍을 보는 중`,
      focusAgentId: partner.id,
      lingerMs: 1_300,
    };
  }

  if (directive.intention === "approach" && partner && nearPartner) {
    return {
      tileX: nearPartner.x,
      tileY: nearPartner.y,
      poiId: directive.targetPoiId ?? partner.currentPoiId ?? baseGoal.poiId,
      status: directive.emotionalState === "interested" ? "intercepting" : "pathing",
      statusLabel: `${partner.displayName} 쪽으로 자연스럽게 가까워지는 중`,
      focusAgentId: partner.id,
      lingerMs: 2_000,
    };
  }

  if (directive.intention === "confess" && partner && nearPartner) {
    return {
      tileX: nearPartner.x,
      tileY: nearPartner.y,
      poiId: directive.targetPoiId ?? partner.currentPoiId ?? baseGoal.poiId,
      status: "confessing",
      statusLabel: `${partner.displayName} 앞에서 결국 마음을 말하려는 중`,
      focusAgentId: partner.id,
      lingerMs: 3_800,
    };
  }

  if (directive.intention === "interrupt" && partner && nearPartner) {
    return {
      tileX: nearPartner.x,
      tileY: nearPartner.y,
      poiId: directive.targetPoiId ?? anchorPoi?.id ?? baseGoal.poiId,
      status: "intercepting",
      statusLabel: `${partner.displayName} 근처로 붙어 장면에 끼어드는 중`,
      focusAgentId: partner.id,
      lingerMs: 1_900,
    };
  }

  if (directive.intention === "wander" && anchorPoi) {
    const tile = pickTileNear(
      map,
      occupied,
      { x: anchorPoi.x, y: anchorPoi.y },
      `${seed}:wander`,
      2,
    );
    return {
      tileX: tile.x,
      tileY: tile.y,
      poiId: anchorPoi.id,
      status: "wandering",
      statusLabel: `${anchorPoi.label} 근처를 맴돌며 분위기를 살피는 중`,
      focusAgentId: directive.targetAgentId,
      lingerMs: 1_100,
    };
  }

  return baseGoal;
}

function movementDurationForDirective(
  directive: AgentDirective,
  status: HubAgentStatus,
  seed: string,
) {
  const hashed = hashValue(seed) % 80;
  const base =
    directive.emotionalState === "interested"
      ? 280
      : directive.emotionalState === "avoiding"
        ? 260
        : directive.emotionalState === "nervous"
          ? 520
          : directive.emotionalState === "confessing"
            ? 320
            : 380;

  return base + hashed + (status === "intercepting" ? -40 : 0);
}

function interactionTypeForScene(
  snapshot: RelationshipSnapshot,
  mode: HubSceneMode,
  signal: HubSocialSignal,
  pair?: { left: HubAgent; right: HubAgent },
) {
  if (
    pair &&
    (pair.left.emotionalState === "confessing" ||
      pair.right.emotionalState === "confessing")
  ) {
    return "confession";
  }

  if (mode === "cool_off" || mode === "jealous_pass") {
    return signal.tension > 0.45 ? "awkward_pause" : "chat";
  }

  if (mode === "private_talk" || mode === "pair_breakaway") {
    return snapshot.stage === "love" || snapshot.stage === "obsession"
      ? "heart"
      : "spark";
  }

  if (mode === "triangle_watch") {
    return signal.tension > 0.4 ? "spark" : "chat";
  }

  if (mode === "push_pull" || mode === "slow_approach") {
    return signal.shyness > 0.42 ? "spark" : "chat";
  }

  if (snapshot.stage === "awkward") {
    return "awkward_pause";
  }

  return snapshot.stage === "flirt" ? "spark" : "chat";
}

function sceneInteractionLabel(mode: HubSceneMode) {
  const labelByScene: Record<HubSceneMode, string> = {
    private_talk: "둘만 대화",
    push_pull: "밀고 당기기",
    cool_off: "묘한 거리두기",
    parallel_work: "같은 공간의 눈치",
    slow_approach: "천천히 접근",
    pair_breakaway: "둘만 빠짐",
    triangle_watch: "끼어드는 장면",
    bar_circle: "라운지 수다",
    jealous_pass: "시선전",
    group_lull: "잠깐 숨 고르기",
  };

  return labelByScene[mode];
}

function eventTypeFromInteraction(
  interaction: HubInteraction,
): HubSimulationEvent["type"] {
  switch (interaction.type) {
    case "confession":
      return "confession";
    case "awkward_pause":
      return "awkward_silence";
    case "heart":
      return "bond_increase";
    default:
      return "conversation";
  }
}

function canInteractPair(
  left: HubAgent,
  right: HubAgent,
  context: SceneContext,
) {
  const manualInterest =
    left.targetAgentId === right.id ||
    right.targetAgentId === left.id ||
    left.intention === "confess" ||
    right.intention === "confess";
  const mutualFocus =
    left.focusAgentId === right.id || right.focusAgentId === left.id;
  const samePoi =
    left.currentPoiId !== null &&
    left.currentPoiId === right.currentPoiId &&
      left.currentPoiId === context.anchorPoi?.id;
  const dominantPair =
    context.dominantIds.has(left.participantId) &&
    context.dominantIds.has(right.participantId);

  return manualInterest || mutualFocus || samePoi || dominantPair;
}

export function stepHubSimulation(
  map: HubMapDefinition,
  agents: HubAgent[],
  snapshot: RelationshipSnapshot,
  messages: Message[] = [],
  characterProfiles: CharacterProfile[] = [],
  previousScene?: HubSceneState | null,
  selectedAgentId?: string | null,
  deltaMs = 760,
) {
  const now = Date.now();
  const eventBucket = Math.floor(now / 2_200);
  const previousAgents = new Map(agents.map((agent) => [agent.id, agent]));
  const occupied = new Set(agents.map((agent) => key(agent.tileX, agent.tileY)));
  const nextAgents = agents.map((agent) => ({ ...agent }));
  const logs: HubStoryLog[] = [];
  const context = buildSceneContext(
    map,
    nextAgents,
    snapshot,
    messages,
    now,
    characterProfiles,
    previousScene,
  );

  for (const agent of nextAgents) {
    const previousAgent = previousAgents.get(agent.id) ?? agent;
    const directive =
      agent.mode === "manual"
        ? {
            emotionalState: agent.emotionalState,
            intention: agent.intention,
            targetAgentId:
              agent.targetAgentId ?? partnerForAgent(agent, nextAgents, context)?.id ?? null,
            targetPoiId: agent.targetPoiId ?? context.anchorPoiId,
          }
        : deriveAutoDirective(agent, nextAgents, context, now, characterProfiles);

    agent.emotionalState = directive.emotionalState;
    agent.intention = directive.intention;
    agent.targetAgentId = directive.targetAgentId;
    agent.targetPoiId = directive.targetPoiId;

    const emotionLog = emotionShiftLog(previousAgent, agent, nextAgents);
    if (emotionLog) {
      logs.push({
        id: `log:emotion:${agent.id}:${eventBucket}:${directive.emotionalState}`,
        createdAt: now,
        text: emotionLog,
        tone:
          directive.emotionalState === "confessing"
            ? "dramatic"
            : directive.emotionalState === "avoiding"
              ? "tense"
              : directive.emotionalState === "interested"
                ? "warm"
                : "soft",
        actorIds: [agent.id, directive.targetAgentId].filter(
          (value): value is string => Boolean(value),
        ),
      });
    }

    occupied.delete(key(agent.tileX, agent.tileY));

    if (agent.pauseUntil && now < agent.pauseUntil) {
      occupied.add(key(agent.tileX, agent.tileY));
      agent.status = directive.emotionalState === "nervous" ? "waiting" : "idle";
      agent.statusLabel =
        directive.emotionalState === "nervous"
          ? "심호흡하며 타이밍을 보는 중"
          : "장면을 잠깐 지켜보는 중";
      agent.sceneMode = context.mode;
      continue;
    }

    if (agent.interactionTargetId && agent.lingerUntil && now < agent.lingerUntil) {
      occupied.add(key(agent.tileX, agent.tileY));
      agent.status =
        agent.emotionalState === "confessing"
          ? "confessing"
          : context.dominantIds.has(agent.participantId) && context.signal.chemistry > 0.55
          ? "flirting"
          : "chatting";
      agent.statusLabel =
        agent.status === "confessing"
          ? "바로 말할지 마지막으로 숨을 고르는 중"
          : agent.status === "flirting"
          ? "둘만의 텐션이 잠깐 이어지는 중"
          : "짧게 멈춰 서서 말을 주고받는 중";
      agent.sparkle =
        shouldSparkle(snapshot.stage, agent.status) || agent.emotionalState === "confessing"
          ? 1
          : 0;
      agent.sceneMode = context.mode;
      continue;
    }

    const shouldHesitate =
      agent.mode !== "manual" &&
      directive.emotionalState === "nervous" &&
      directive.intention !== "wait" &&
      hashValue(`${agent.id}:${eventBucket}:hesitate`) % 4 === 0;

    if (shouldHesitate) {
      occupied.add(key(agent.tileX, agent.tileY));
      agent.pauseUntil = now + 700 + (hashValue(`${agent.id}:${eventBucket}`) % 500);
      agent.status = "waiting";
      agent.statusLabel = "다가가려다 다시 한 번 멈칫하는 중";
      agent.sceneMode = context.mode;
      agent.sparkle = 0;
      continue;
    }

    const baseGoal = planAgentGoal(map, occupied, agent, nextAgents, context, now);
    const goal = refineGoalForDirective(
      map,
      occupied,
      agent,
      nextAgents,
      context,
      baseGoal,
      directive,
      now,
    );
    agent.sceneMode = context.mode;
    agent.focusAgentId = goal.focusAgentId;

    if (agent.tileX === goal.tileX && agent.tileY === goal.tileY) {
      occupied.add(key(agent.tileX, agent.tileY));
      agent.status = goal.status;
      agent.currentPoiId = goal.poiId;
      agent.targetPoiId = goal.poiId;
      agent.lingerUntil = now + goal.lingerMs;
      agent.statusLabel = goal.statusLabel;
      agent.sparkle =
        shouldSparkle(snapshot.stage, goal.status) ||
        context.signal.chemistry > 0.68 ||
        directive.emotionalState === "confessing"
          ? 1
          : 0;
      continue;
    }

    const path = findPath(
      map,
      occupied,
      { x: agent.tileX, y: agent.tileY },
      { x: goal.tileX, y: goal.tileY },
    );
    const nextTile = path[1];

    if (!nextTile) {
      occupied.add(key(agent.tileX, agent.tileY));
      agent.status = goal.status === "avoiding" ? "avoiding" : "idle";
      agent.currentPoiId = goal.poiId;
      agent.targetPoiId = goal.poiId;
      agent.statusLabel =
        goal.status === "avoiding"
          ? "잠깐 멈춰 서서 거리부터 재는 중"
          : "동선이 막혀 타이밍을 다시 보는 중";
      agent.sparkle = 0;
      continue;
    }

    agent.fromTileX = agent.tileX;
    agent.fromTileY = agent.tileY;
    agent.tileX = nextTile.x;
    agent.tileY = nextTile.y;
    agent.targetTileX = goal.tileX;
    agent.targetTileY = goal.tileY;
    agent.currentPoiId = goal.poiId ?? null;
    agent.targetPoiId = goal.poiId ?? null;
    agent.facing = facingTo(
      { x: agent.fromTileX, y: agent.fromTileY },
      { x: nextTile.x, y: nextTile.y },
    );
    agent.moveStartedAt = now;
    agent.moveDurationMs = movementDurationForDirective(
      directive,
      goal.status,
      `${agent.id}:${goal.tileX}:${goal.tileY}:${eventBucket}`,
    );
    agent.status =
      goal.status === "lingering" || goal.status === "waiting" ? "pathing" : goal.status;
    agent.statusLabel = goal.statusLabel;
    agent.interactionTargetId = null;
    agent.sparkle = 0;
    agent.lingerUntil = null;
    agent.pauseUntil = null;
    occupied.add(key(agent.tileX, agent.tileY));
  }

  const interactions: HubInteraction[] = [];
  const events: HubSimulationEvent[] = [];
  const occupiedByInteraction = new Set<string>();
  const interactingIds = new Set<string>();
  const pairCandidates: Array<{
    left: HubAgent;
    right: HubAgent;
    score: number;
  }> = [];

  for (let i = 0; i < nextAgents.length; i += 1) {
    for (let j = i + 1; j < nextAgents.length; j += 1) {
      const left = nextAgents[i];
      const right = nextAgents[j];

      if (manhattan({ x: left.tileX, y: left.tileY }, { x: right.tileX, y: right.tileY }) !== 1) {
        continue;
      }

      if (!canInteractPair(left, right, context)) {
        continue;
      }

      const focusScore =
        (left.focusAgentId === right.id ? 3 : 0) +
        (right.focusAgentId === left.id ? 3 : 0) +
        (left.intention === "approach" || left.intention === "confess" ? 2 : 0) +
        (right.intention === "approach" || right.intention === "confess" ? 2 : 0) +
        (context.dominantIds.has(left.participantId) &&
        context.dominantIds.has(right.participantId)
          ? 2
          : 0) +
        (left.currentPoiId && left.currentPoiId === right.currentPoiId ? 1 : 0);

      pairCandidates.push({ left, right, score: focusScore });
    }
  }

  pairCandidates.sort((left, right) => right.score - left.score);

  for (const candidate of pairCandidates) {
    const { left, right } = candidate;
    if (occupiedByInteraction.has(left.id) || occupiedByInteraction.has(right.id)) {
      continue;
    }

    const type = interactionTypeForScene(snapshot, context.mode, context.signal, {
      left,
      right,
    });
    const label = sceneInteractionLabel(context.mode);

    left.status =
      type === "awkward_pause"
        ? "observing"
        : type === "confession"
          ? "confessing"
          : "chatting";
    right.status =
      type === "awkward_pause"
        ? "observing"
        : type === "confession"
          ? "waiting"
          : "chatting";
    left.statusLabel = label;
    right.statusLabel = label;
    left.interactionTargetId = right.id;
    right.interactionTargetId = left.id;
    left.lingerUntil = now + 3_200;
    right.lingerUntil = now + 3_200;
    left.facing = facingTo(
      { x: left.tileX, y: left.tileY },
      { x: right.tileX, y: right.tileY },
    );
    right.facing = facingTo(
      { x: right.tileX, y: right.tileY },
      { x: left.tileX, y: left.tileY },
    );
    left.sparkle =
      shouldSparkle(snapshot.stage, left.status) || context.signal.chemistry > 0.7
        ? 1
        : 0;
    right.sparkle =
      shouldSparkle(snapshot.stage, right.status) || context.signal.chemistry > 0.7
        ? 1
        : 0;
    left.proximityScore = (left.proximityScore ?? 0) + deltaMs / 760;
    right.proximityScore = (right.proximityScore ?? 0) + deltaMs / 760;
    left.avoidanceScore = 0;
    right.avoidanceScore = 0;
    interactingIds.add(left.id);
    interactingIds.add(right.id);

    occupiedByInteraction.add(left.id);
    occupiedByInteraction.add(right.id);

    const interaction = {
      id: `interaction:${type}:${left.id}:${right.id}:${eventBucket}`,
      type,
      agentIds: [left.id, right.id],
      tileX: Math.min(left.tileX, right.tileX),
      tileY: Math.min(left.tileY, right.tileY),
      startedAt: now,
      label,
      sceneHint: context.sceneHint,
      ...buildInteractionSpeech(
        messages,
        left,
        right,
        snapshot,
        type,
        now,
        context.mode,
      ),
    } satisfies HubInteraction;
    interactions.push(interaction);

    const eventType = eventTypeFromInteraction(interaction);
    const baseEvent = {
      id: `event:${eventType}:${left.id}:${right.id}:${eventBucket}`,
      type: eventType,
      title:
        eventType === "confession"
          ? "고백 직전"
          : eventType === "bond_increase"
            ? "분위기 상승"
            : eventType === "awkward_silence"
              ? "어색한 정적"
              : "짧은 대화",
      description:
        eventType === "confession"
          ? `${left.displayName}가 ${right.displayName}에게 결국 마음을 꺼내려 한다.`
          : eventType === "bond_increase"
            ? `${left.displayName}와 ${right.displayName} 사이의 온도가 조금 더 오른다.`
            : eventType === "awkward_silence"
              ? `${left.displayName}와 ${right.displayName} 사이에 짧은 정적이 흐른다.`
              : `${left.displayName}와 ${right.displayName}가 서로를 의식한 채 말을 주고받는다.`,
      actorIds: [left.id, right.id],
      tileX: interaction.tileX,
      tileY: interaction.tileY,
      createdAt: now,
      expiresAt: now + (eventType === "confession" ? 4_000 : 2_800),
      priority:
        eventType === "confession"
          ? 5
          : eventType === "bond_increase"
            ? 4
            : eventType === "awkward_silence"
              ? 3
              : 2,
      pauseMs: eventType === "confession" ? 1_400 : eventType === "awkward_silence" ? 700 : 0,
      dominant: context.dominantIds.has(left.participantId) && context.dominantIds.has(right.participantId),
    } satisfies HubSimulationEvent;
    events.push(baseEvent);
    logs.push({
      id: `log:${baseEvent.id}`,
      createdAt: now,
      text: baseEvent.description,
      tone: eventTone(baseEvent.type),
      actorIds: baseEvent.actorIds,
    });

    if (Math.max(left.proximityScore ?? 0, right.proximityScore ?? 0) >= 3) {
      left.proximityScore = 0;
      right.proximityScore = 0;
      const bondEvent = {
        id: `event:bond:${left.id}:${right.id}:${eventBucket}`,
        type: "bond_increase",
        title: "관계 온도 상승",
        description: `${left.displayName}와 ${right.displayName}가 같은 자리에 오래 머물며 분위기가 가까워진다.`,
        actorIds: [left.id, right.id],
        tileX: interaction.tileX,
        tileY: interaction.tileY,
        createdAt: now,
        expiresAt: now + 3_600,
        priority: 4,
        dominant: true,
      } satisfies HubSimulationEvent;
      events.push(bondEvent);
      logs.push({
        id: `log:${bondEvent.id}`,
        createdAt: now,
        text: bondEvent.description,
        tone: "warm",
        actorIds: bondEvent.actorIds,
      });
      left.emotionalState = left.emotionalState === "avoiding" ? "nervous" : "interested";
      right.emotionalState = right.emotionalState === "avoiding" ? "nervous" : "interested";
    }
  }

  if (
    (context.mode === "triangle_watch" || context.mode === "jealous_pass") &&
    context.observerAgentId
  ) {
    const observer = nextAgents.find((agent) => agent.id === context.observerAgentId);
    if (observer && !occupiedByInteraction.has(observer.id)) {
      observer.status = "observing";
      observer.statusLabel = "둘 분위기를 계속 살피는 중";
      interactions.push({
        id: `interaction:observer:${observer.id}:${now}`,
        type: "awkward_pause",
        agentIds: [observer.id],
        tileX: observer.tileX,
        tileY: observer.tileY,
        startedAt: now,
        label: context.mode === "triangle_watch" ? "눈치 보기" : "끼어들기 직전",
        speakerId: observer.participantId,
        speakerHandle: observer.handle,
        speechText:
          context.mode === "triangle_watch"
            ? "둘 사이 텐션만 계속 보고 있음"
            : "괜히 근처를 맴돌며 끼어들 각을 재는 중",
        emote: "👀",
        sceneHint: context.sceneHint,
      });
    }
  }

  for (const agent of nextAgents) {
    if (interactingIds.has(agent.id)) {
      continue;
    }

    agent.proximityScore = Math.max(0, (agent.proximityScore ?? 0) - deltaMs / 1_520);
    if (agent.emotionalState === "avoiding" && agent.targetAgentId) {
      agent.avoidanceScore = (agent.avoidanceScore ?? 0) + deltaMs / 760;
      if ((agent.avoidanceScore ?? 0) >= 2.2) {
        const target = nextAgents.find((candidate) => candidate.id === agent.targetAgentId);
        if (target) {
          const avoidanceEvent = {
            id: `event:avoid:${agent.id}:${target.id}:${eventBucket}`,
            type: "bond_decrease",
            title: "관계 온도 하락",
            description: `${agent.displayName}가 ${target.displayName}를 계속 피해 분위기가 잠시 식는다.`,
            actorIds: [agent.id, target.id],
            tileX: agent.tileX,
            tileY: agent.tileY,
            createdAt: now,
            expiresAt: now + 3_000,
            priority: 4,
            dominant: true,
          } satisfies HubSimulationEvent;
          events.push(avoidanceEvent);
          logs.push({
            id: `log:${avoidanceEvent.id}`,
            createdAt: now,
            text: avoidanceEvent.description,
            tone: "tense",
            actorIds: avoidanceEvent.actorIds,
          });
          agent.avoidanceScore = 0;
          target.emotionalState =
            target.emotionalState === "confessing" ? "nervous" : target.emotionalState;
        }
      }
      continue;
    }

    agent.avoidanceScore = Math.max(0, (agent.avoidanceScore ?? 0) - deltaMs / 1_800);
  }

  events.sort((left, right) => right.priority - left.priority);
  logs.sort((left, right) => right.createdAt - left.createdAt);

  return {
    agents: nextAgents,
    interactions,
    scene: {
      ...context,
      startedAt:
        previousScene && previousScene.mode === context.mode
          ? previousScene.startedAt
          : now,
      endsAt: now + 8_400,
    } satisfies HubSceneState,
    events,
    logs,
    camera: buildCameraState(nextAgents, context, events, selectedAgentId),
  };
}

export function interpolateTile(agent: HubAgent, now: number) {
  if (agent.moveDurationMs <= 0) {
    return { x: agent.tileX, y: agent.tileY };
  }

  const rawProgress = Math.max(
    0,
    Math.min(1, (now - agent.moveStartedAt) / agent.moveDurationMs),
  );
  const progress =
    agent.emotionalState === "interested"
      ? 1 - (1 - rawProgress) * (1 - rawProgress)
      : agent.emotionalState === "avoiding"
        ? rawProgress * rawProgress
        : rawProgress;
  const jitter =
    agent.emotionalState === "nervous"
      ? Math.sin((now / 72) + hashValue(agent.id)) * 0.04
      : 0;

  return {
    x: agent.fromTileX + (agent.tileX - agent.fromTileX) * progress + jitter,
    y: agent.fromTileY + (agent.tileY - agent.fromTileY) * progress - jitter,
  };
}
