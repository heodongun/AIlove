import { getN8nBaseUrl, getN8nPath, interpolatePath } from "@/lib/env";
import {
  buildHubRoomDetailFromRoomDetail,
  buildHubRoomsFromRooms,
} from "@/lib/hub-utils";
import type {
  AIReaction,
  CharacterProfile,
  ConfessionPrediction,
  DominantPair,
  EmotionEvent,
  HighlightMoment,
  HubAgent,
  HubAgentUpdate,
  HubInteraction,
  HubMapDefinition,
  HubPlacedProp,
  HubPoi,
  HubRoomDetailPayload,
  HubRoomSummary,
  HubUpdatesPayload,
  Message,
  MessageMetaUpdate,
  MessageReactions,
  Participant,
  PublicN8nConfig,
  ReactionResponsePayload,
  RelationshipSnapshot,
  RoomDetailPayload,
  RoomSummary,
  RoomUpdatesPayload,
  RoomsPayload,
  ScenePoll,
  ScenePollOption,
  UserReactionCount,
  ViewerState,
  VoteResponsePayload,
} from "@/lib/types";

type RoomsQuery = {
  limit?: string | number;
  q?: string;
  type?: string;
};

type UpdatesQuery = {
  after?: string;
  afterId?: string;
  deviceId?: string;
};

type DetailQuery = {
  deviceId?: string;
};

type HubDetailQuery = {
  deviceId?: string;
};

type HubUpdatesQuery = {
  deviceId?: string;
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

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeParticipant(value: Record<string, unknown>): Participant {
  return {
    id: Number(value.id ?? 0),
    handle: String(value.handle ?? ""),
    displayName: String(value.displayName ?? value.display_name ?? ""),
    bio: value.bio ? String(value.bio) : null,
    traits: coerceTraits(value.traits ?? value.traits_json),
    avatarSeed:
      value.avatarSeed !== undefined && value.avatarSeed !== null
        ? String(value.avatarSeed)
        : value.avatar_seed !== undefined && value.avatar_seed !== null
          ? String(value.avatar_seed)
          : null,
    roleLabel:
      value.roleLabel !== undefined && value.roleLabel !== null
        ? String(value.roleLabel)
        : value.role_label !== undefined && value.role_label !== null
          ? String(value.role_label)
          : null,
  };
}

function normalizeCharacterProfile(value: Record<string, unknown>): CharacterProfile {
  return {
    participantId: Number(value.participantId ?? value.participant_id ?? 0),
    handle: String(value.handle ?? ""),
    displayName: String(value.displayName ?? value.display_name ?? ""),
    shortHook: String(value.shortHook ?? value.short_hook ?? ""),
    personaBullets: asArray(value.personaBullets ?? value.persona_bullets).map((item) =>
      String(item),
    ),
    signatureStyle:
      value.signatureStyle !== undefined && value.signatureStyle !== null
        ? String(value.signatureStyle)
        : value.signature_style !== undefined && value.signature_style !== null
          ? String(value.signature_style)
          : null,
  };
}

function normalizeDominantPair(value: unknown): DominantPair | null {
  const object = asObject(value);
  if (!object) {
    return null;
  }

  return {
    actorIds: asArray(object.actorIds ?? object.actor_ids).map((item) => Number(item)),
    actorHandles: asArray(object.actorHandles ?? object.actor_handles).map((item) =>
      String(item),
    ),
    actorDisplayNames: asArray(
      object.actorDisplayNames ?? object.actor_display_names,
    ).map((item) => String(item)),
    label: String(object.label ?? ""),
    note:
      object.note !== undefined && object.note !== null ? String(object.note) : null,
  };
}

function normalizePrediction(value: unknown): ConfessionPrediction | null {
  const object = asObject(value);
  if (!object) {
    return null;
  }

  return {
    actorId:
      object.actorId === undefined || object.actorId === null
        ? null
        : Number(object.actorId),
    actorHandle:
      object.actorHandle === undefined || object.actorHandle === null
        ? null
        : String(object.actorHandle),
    actorDisplayName:
      object.actorDisplayName === undefined || object.actorDisplayName === null
        ? null
        : String(object.actorDisplayName),
    probability: Number(object.probability ?? 0),
  };
}

function normalizeRelationshipSnapshot(value: unknown): RelationshipSnapshot {
  const object = asObject(value) ?? {};

  return {
    stage:
      object.stage === "awkward" ||
      object.stage === "interest" ||
      object.stage === "flirt" ||
      object.stage === "love" ||
      object.stage === "obsession" ||
      object.stage === "group"
        ? object.stage
        : "interest",
    stageLabel: String(object.stageLabel ?? object.stage_label ?? "호감"),
    affectionScore: Number(object.affectionScore ?? object.affection_score ?? 0),
    trend:
      object.trend === "rising" ||
      object.trend === "falling" ||
      object.trend === "stable" ||
      object.trend === "conflict" ||
      object.trend === "recovery"
        ? object.trend
        : "stable",
    trendDelta: Number(object.trendDelta ?? object.trend_delta ?? 0),
    heroLine: String(object.heroLine ?? object.hero_line ?? "지금: 호감 단계"),
    currentSituation: String(
      object.currentSituation ?? object.current_situation ?? "분위기를 살피는 중",
    ),
    confessionPrediction: normalizePrediction(
      object.confessionPrediction ?? object.confession_prediction,
    ),
    dominantPair: normalizeDominantPair(object.dominantPair ?? object.dominant_pair),
  };
}

function normalizeEmotionEvent(value: Record<string, unknown>): EmotionEvent {
  return {
    id: String(value.id ?? value.eventId ?? crypto.randomUUID()),
    eventType:
      value.eventType === "rise" ||
      value.eventType === "drop" ||
      value.eventType === "conflict" ||
      value.eventType === "recovery" ||
      value.eventType === "confession_attempt" ||
      value.eventType === "distance"
        ? value.eventType
        : "rise",
    label: String(value.label ?? ""),
    at: String(value.at ?? value.eventAt ?? new Date().toISOString()),
    pairIds: asArray(value.pairIds ?? value.pair_ids).map((item) => Number(item)),
    pairHandles: asArray(value.pairHandles ?? value.pair_handles).map((item) =>
      String(item),
    ),
    impact: Number(value.impact ?? 0),
  };
}

function normalizeHighlight(value: unknown): HighlightMoment | null {
  const object = asObject(value);
  if (!object) {
    return null;
  }

  return {
    quote: String(object.quote ?? ""),
    speakerId:
      object.speakerId === undefined || object.speakerId === null
        ? null
        : Number(object.speakerId),
    speakerHandle:
      object.speakerHandle === undefined || object.speakerHandle === null
        ? null
        : String(object.speakerHandle),
    speakerDisplayName:
      object.speakerDisplayName === undefined || object.speakerDisplayName === null
        ? null
        : String(object.speakerDisplayName),
    reason: String(object.reason ?? ""),
    messageId:
      object.messageId === undefined || object.messageId === null
        ? null
        : Number(object.messageId),
    createdAt: String(object.createdAt ?? new Date().toISOString()),
  };
}

function normalizeUserReaction(value: Record<string, unknown>): UserReactionCount {
  return {
    emoji: String(value.emoji ?? ""),
    count: Number(value.count ?? 0),
  };
}

function normalizeAiReaction(value: Record<string, unknown>): AIReaction {
  return {
    emoji: String(value.emoji ?? ""),
    actorHandle: String(value.actorHandle ?? value.actor_handle ?? ""),
    actorDisplayName: String(
      value.actorDisplayName ?? value.actor_display_name ?? value.actorHandle ?? "",
    ),
  };
}

function normalizeReactions(value: unknown): MessageReactions {
  const object = asObject(value) ?? {};

  return {
    user: asArray(object.user ?? object.userCounts).map((item) =>
      normalizeUserReaction(asObject(item) ?? {}),
    ),
    ai: asArray(object.ai ?? object.aiReactions).map((item) =>
      normalizeAiReaction(asObject(item) ?? {}),
    ),
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
    reactions: normalizeReactions(value.reactions),
  };
}

function normalizePollOption(value: Record<string, unknown>): ScenePollOption {
  return {
    optionId: String(value.optionId ?? value.option_id ?? value.id ?? ""),
    label: String(value.label ?? ""),
    description: String(value.description ?? ""),
    voteCount: Number(value.voteCount ?? value.vote_count ?? 0),
  };
}

function normalizeScenePoll(value: unknown): ScenePoll | null {
  const object = asObject(value);
  if (!object) {
    return null;
  }

  return {
    sceneId: String(object.sceneId ?? object.scene_id ?? ""),
    title: String(object.title ?? "장면 개입"),
    prompt: String(object.prompt ?? ""),
    status: object.status === "closed" ? "closed" : "open",
    totalVotes: Number(object.totalVotes ?? object.total_votes ?? 0),
    closesAt:
      object.closesAt === undefined || object.closesAt === null
        ? null
        : String(object.closesAt),
    viewerVoteOptionId:
      object.viewerVoteOptionId === undefined || object.viewerVoteOptionId === null
        ? null
        : String(object.viewerVoteOptionId),
    options: asArray(object.options).map((item) =>
      normalizePollOption(asObject(item) ?? {}),
    ),
  };
}

function normalizeHubPoi(value: Record<string, unknown>): HubPoi {
  return {
    id: String(value.id ?? ""),
    kind:
      value.kind === "desk" ||
      value.kind === "sofa" ||
      value.kind === "watercooler" ||
      value.kind === "coffee" ||
      value.kind === "window" ||
      value.kind === "bookshelf" ||
      value.kind === "bar" ||
      value.kind === "plant"
        ? value.kind
        : "desk",
    label: String(value.label ?? ""),
    x: Number(value.x ?? 0),
    y: Number(value.y ?? 0),
    radius:
      value.radius === undefined || value.radius === null ? undefined : Number(value.radius),
  };
}

function normalizeHubProp(value: Record<string, unknown>): HubPlacedProp {
  return {
    id: String(value.id ?? ""),
    kind:
      value.kind === "wall" ||
      value.kind === "desk" ||
      value.kind === "desk_duo" ||
      value.kind === "sofa" ||
      value.kind === "table" ||
      value.kind === "watercooler" ||
      value.kind === "plant" ||
      value.kind === "bookshelf" ||
      value.kind === "counter" ||
      value.kind === "lamp" ||
      value.kind === "window"
        ? value.kind
        : "desk",
    x: Number(value.x ?? 0),
    y: Number(value.y ?? 0),
    width: Number(value.width ?? 1),
    height: Number(value.height ?? 1),
    solid: value.solid !== undefined ? Boolean(value.solid) : true,
    label:
      value.label === undefined || value.label === null ? undefined : String(value.label),
  };
}

function normalizeHubMap(value: unknown): HubMapDefinition | null {
  const object = asObject(value);
  if (!object) {
    return null;
  }

  return {
    id: String(object.id ?? ""),
    slug: String(object.slug ?? ""),
    title: String(object.title ?? ""),
    width: Number(object.width ?? 0),
    height: Number(object.height ?? 0),
    tileSize: Number(object.tileSize ?? object.tile_size ?? 32),
    palette: {
      background: String(asObject(object.palette)?.background ?? "#111"),
      wall: String(asObject(object.palette)?.wall ?? "#333"),
      woodLight: String(asObject(object.palette)?.woodLight ?? "#b58b61"),
      woodDark: String(asObject(object.palette)?.woodDark ?? "#6a4d3f"),
      tileLight: String(asObject(object.palette)?.tileLight ?? "#d7ddd9"),
      tileDark: String(asObject(object.palette)?.tileDark ?? "#9da7a2"),
      rug: String(asObject(object.palette)?.rug ?? "#734a6f"),
      accent: String(asObject(object.palette)?.accent ?? "#d6b45c"),
      panel: String(asObject(object.palette)?.panel ?? "rgba(17,20,28,0.86)"),
      panelBorder: String(
        asObject(object.palette)?.panelBorder ?? "rgba(255,255,255,0.08)",
      ),
      text: String(asObject(object.palette)?.text ?? "#f8f7f2"),
      textMuted: String(asObject(object.palette)?.textMuted ?? "#b8becc"),
      minimapBg: String(asObject(object.palette)?.minimapBg ?? "rgba(10,12,18,0.9)"),
    },
    floor: asArray(object.floor).map((row) =>
      asArray(row).map((entry) =>
        entry === "void" ||
        entry === "wood" ||
        entry === "tile" ||
        entry === "rug" ||
        entry === "stone" ||
        entry === "accent"
          ? entry
          : "wood",
      ),
    ),
    collision: asArray(object.collision).map((row) =>
      asArray(row).map((entry) => Boolean(entry)),
    ),
    props: asArray(object.props).map((item) => normalizeHubProp(asObject(item) ?? {})),
    pois: asArray(object.pois).map((item) => normalizeHubPoi(asObject(item) ?? {})),
    spawnPoints: asArray(object.spawnPoints ?? object.spawn_points).map((item) => {
      const spawn = asObject(item) ?? {};
      return {
        handle: String(spawn.handle ?? ""),
        x: Number(spawn.x ?? 0),
        y: Number(spawn.y ?? 0),
        facing:
          spawn.facing === "up" ||
          spawn.facing === "right" ||
          spawn.facing === "down" ||
          spawn.facing === "left"
            ? spawn.facing
            : "down",
      };
    }),
    ambientLabel: String(object.ambientLabel ?? object.ambient_label ?? ""),
  };
}

function normalizeHubAgent(value: Record<string, unknown>): HubAgent {
  const visual = asObject(value.visual) ?? {};

  return {
    id: String(value.id ?? ""),
    participantId: Number(value.participantId ?? value.participant_id ?? 0),
    handle: String(value.handle ?? ""),
    displayName: String(value.displayName ?? value.display_name ?? ""),
    themeColor: String(value.themeColor ?? value.theme_color ?? "#8ea2c5"),
    visual: {
      hair: String(visual.hair ?? "#d5d9e3"),
      skin: String(visual.skin ?? "#f1d6c5"),
      outfitPrimary: String(visual.outfitPrimary ?? visual.outfit_primary ?? "#8ea2c5"),
      outfitSecondary: String(visual.outfitSecondary ?? visual.outfit_secondary ?? "#566278"),
      accent: String(visual.accent ?? "#f7fbff"),
    },
    tileX: Number(value.tileX ?? value.tile_x ?? 0),
    tileY: Number(value.tileY ?? value.tile_y ?? 0),
    fromTileX: Number(value.fromTileX ?? value.from_tile_x ?? value.tileX ?? value.tile_x ?? 0),
    fromTileY: Number(value.fromTileY ?? value.from_tile_y ?? value.tileY ?? value.tile_y ?? 0),
    facing:
      value.facing === "up" ||
      value.facing === "right" ||
      value.facing === "down" ||
      value.facing === "left"
        ? value.facing
        : "down",
    status:
      value.status === "idle" ||
      value.status === "wandering" ||
      value.status === "pathing" ||
      value.status === "chatting" ||
      value.status === "flirting" ||
      value.status === "observing" ||
      value.status === "avoiding" ||
      value.status === "intercepting" ||
      value.status === "lingering" ||
      value.status === "waiting" ||
      value.status === "confessing"
        ? value.status
        : "idle",
    mood:
      value.mood === "awkward" ||
      value.mood === "interest" ||
      value.mood === "flirt" ||
      value.mood === "love" ||
      value.mood === "obsession" ||
      value.mood === "group"
        ? value.mood
        : "interest",
    emotionalState:
      value.emotionalState === "neutral" ||
      value.emotionalState === "nervous" ||
      value.emotionalState === "interested" ||
      value.emotionalState === "avoiding" ||
      value.emotionalState === "confessing"
        ? value.emotionalState
        : value.emotional_state === "neutral" ||
            value.emotional_state === "nervous" ||
            value.emotional_state === "interested" ||
            value.emotional_state === "avoiding" ||
            value.emotional_state === "confessing"
          ? value.emotional_state
          : "neutral",
    intention:
      value.intention === "approach" ||
      value.intention === "escape" ||
      value.intention === "wait" ||
      value.intention === "observe" ||
      value.intention === "confess" ||
      value.intention === "interrupt" ||
      value.intention === "wander"
        ? value.intention
        : "observe",
    mode: value.mode === "manual" ? "manual" : "auto",
    currentPoiId:
      value.currentPoiId === undefined || value.currentPoiId === null
        ? null
        : String(value.currentPoiId),
    targetAgentId:
      value.targetAgentId === undefined || value.targetAgentId === null
        ? null
        : String(value.targetAgentId),
    targetPoiId:
      value.targetPoiId === undefined || value.targetPoiId === null
        ? null
        : String(value.targetPoiId),
    targetTileX:
      value.targetTileX === undefined || value.targetTileX === null
        ? null
        : Number(value.targetTileX),
    targetTileY:
      value.targetTileY === undefined || value.targetTileY === null
        ? null
        : Number(value.targetTileY),
    moveStartedAt: Number(value.moveStartedAt ?? value.move_started_at ?? Date.now()),
    moveDurationMs: Number(value.moveDurationMs ?? value.move_duration_ms ?? 0),
    interactionTargetId:
      value.interactionTargetId === undefined || value.interactionTargetId === null
        ? null
        : String(value.interactionTargetId),
    sparkle: Number(value.sparkle ?? 0),
    pauseUntil:
      value.pauseUntil === undefined || value.pauseUntil === null
        ? null
        : Number(value.pauseUntil),
    proximityScore: Number(value.proximityScore ?? 0),
    avoidanceScore: Number(value.avoidanceScore ?? 0),
    sceneMode:
      value.sceneMode === "private_talk" ||
      value.sceneMode === "push_pull" ||
      value.sceneMode === "cool_off" ||
      value.sceneMode === "parallel_work" ||
      value.sceneMode === "slow_approach" ||
      value.sceneMode === "pair_breakaway" ||
      value.sceneMode === "triangle_watch" ||
      value.sceneMode === "bar_circle" ||
      value.sceneMode === "jealous_pass" ||
      value.sceneMode === "group_lull"
        ? value.sceneMode
        : null,
    focusAgentId:
      value.focusAgentId === undefined || value.focusAgentId === null
        ? null
        : String(value.focusAgentId),
    lingerUntil:
      value.lingerUntil === undefined || value.lingerUntil === null
        ? null
        : Number(value.lingerUntil),
    statusLabel:
      value.statusLabel === undefined || value.statusLabel === null
        ? null
        : String(value.statusLabel),
  };
}

function normalizeHubInteraction(value: Record<string, unknown>): HubInteraction {
  return {
    id: String(value.id ?? ""),
    type:
      value.type === "chat" ||
      value.type === "heart" ||
      value.type === "spark" ||
      value.type === "awkward_pause" ||
      value.type === "confession"
        ? value.type
        : "chat",
    agentIds: asArray(value.agentIds ?? value.agent_ids).map((item) => String(item)),
    tileX: Number(value.tileX ?? value.tile_x ?? 0),
    tileY: Number(value.tileY ?? value.tile_y ?? 0),
    startedAt: Number(value.startedAt ?? value.started_at ?? Date.now()),
    label: String(value.label ?? "대화 중"),
    speakerId:
      value.speakerId === undefined || value.speakerId === null
        ? null
        : Number(value.speakerId),
    speakerHandle:
      value.speakerHandle === undefined || value.speakerHandle === null
        ? null
        : String(value.speakerHandle),
    speechText:
      value.speechText === undefined || value.speechText === null
        ? null
        : String(value.speechText),
    emote:
      value.emote === undefined || value.emote === null ? null : String(value.emote),
    sceneHint:
      value.sceneHint === undefined || value.sceneHint === null
        ? null
        : String(value.sceneHint),
  };
}

function normalizeHubAgentUpdate(value: Record<string, unknown>): HubAgentUpdate {
  return {
    id: String(value.id ?? ""),
    tileX:
      value.tileX === undefined || value.tileX === null ? undefined : Number(value.tileX),
    tileY:
      value.tileY === undefined || value.tileY === null ? undefined : Number(value.tileY),
    facing:
      value.facing === "up" ||
      value.facing === "right" ||
      value.facing === "down" ||
      value.facing === "left"
        ? value.facing
        : undefined,
    status:
      value.status === "idle" ||
      value.status === "wandering" ||
      value.status === "pathing" ||
      value.status === "chatting" ||
      value.status === "flirting" ||
      value.status === "observing" ||
      value.status === "avoiding" ||
      value.status === "intercepting" ||
      value.status === "lingering" ||
      value.status === "waiting" ||
      value.status === "confessing"
        ? value.status
        : undefined,
    mood:
      value.mood === "awkward" ||
      value.mood === "interest" ||
      value.mood === "flirt" ||
      value.mood === "love" ||
      value.mood === "obsession" ||
      value.mood === "group"
        ? value.mood
        : undefined,
    emotionalState:
      value.emotionalState === "neutral" ||
      value.emotionalState === "nervous" ||
      value.emotionalState === "interested" ||
      value.emotionalState === "avoiding" ||
      value.emotionalState === "confessing"
        ? value.emotionalState
        : undefined,
    intention:
      value.intention === "approach" ||
      value.intention === "escape" ||
      value.intention === "wait" ||
      value.intention === "observe" ||
      value.intention === "confess" ||
      value.intention === "interrupt" ||
      value.intention === "wander"
        ? value.intention
        : undefined,
    mode: value.mode === "manual" || value.mode === "auto" ? value.mode : undefined,
    targetAgentId:
      value.targetAgentId === undefined
        ? undefined
        : value.targetAgentId === null
          ? null
          : String(value.targetAgentId),
    targetPoiId:
      value.targetPoiId === undefined
        ? undefined
        : value.targetPoiId === null
          ? null
          : String(value.targetPoiId),
    targetTileX:
      value.targetTileX === undefined || value.targetTileX === null
        ? undefined
        : Number(value.targetTileX),
    targetTileY:
      value.targetTileY === undefined || value.targetTileY === null
        ? undefined
        : Number(value.targetTileY),
    currentPoiId:
      value.currentPoiId === undefined ? undefined : value.currentPoiId === null ? null : String(value.currentPoiId),
    interactionTargetId:
      value.interactionTargetId === undefined
        ? undefined
        : value.interactionTargetId === null
          ? null
          : String(value.interactionTargetId),
    sparkle:
      value.sparkle === undefined || value.sparkle === null ? undefined : Number(value.sparkle),
    pauseUntil:
      value.pauseUntil === undefined || value.pauseUntil === null
        ? undefined
        : Number(value.pauseUntil),
    proximityScore:
      value.proximityScore === undefined || value.proximityScore === null
        ? undefined
        : Number(value.proximityScore),
    avoidanceScore:
      value.avoidanceScore === undefined || value.avoidanceScore === null
        ? undefined
        : Number(value.avoidanceScore),
    sceneMode:
      value.sceneMode === undefined
        ? undefined
        : value.sceneMode === "private_talk" ||
            value.sceneMode === "push_pull" ||
            value.sceneMode === "cool_off" ||
            value.sceneMode === "parallel_work" ||
            value.sceneMode === "slow_approach" ||
            value.sceneMode === "pair_breakaway" ||
            value.sceneMode === "triangle_watch" ||
            value.sceneMode === "bar_circle" ||
            value.sceneMode === "jealous_pass" ||
            value.sceneMode === "group_lull"
          ? value.sceneMode
          : undefined,
    focusAgentId:
      value.focusAgentId === undefined
        ? undefined
        : value.focusAgentId === null
          ? null
          : String(value.focusAgentId),
    lingerUntil:
      value.lingerUntil === undefined || value.lingerUntil === null
        ? undefined
        : Number(value.lingerUntil),
    statusLabel:
      value.statusLabel === undefined
        ? undefined
        : value.statusLabel === null
          ? null
          : String(value.statusLabel),
  };
}

function normalizeViewerState(value: unknown): ViewerState | null {
  const object = asObject(value);
  if (!object) {
    return null;
  }

  return {
    deviceId:
      object.deviceId === undefined || object.deviceId === null
        ? null
        : String(object.deviceId),
    lastVotedSceneId:
      object.lastVotedSceneId === undefined || object.lastVotedSceneId === null
        ? null
        : String(object.lastVotedSceneId),
  };
}

function normalizeRoomSummary(value: Record<string, unknown>): RoomSummary {
  const participants = asArray(value.participants).map((participant) =>
    normalizeParticipant(asObject(participant) ?? {}),
  );
  const relationshipSnapshot = normalizeRelationshipSnapshot(
    value.relationshipSnapshot ?? value.relationship_snapshot,
  );
  const openScenePoll = normalizeScenePoll(value.openScenePoll ?? value.open_scene_poll);
  const dominantPair =
    normalizeDominantPair(value.dominantPair ?? value.dominant_pair) ??
    relationshipSnapshot.dominantPair;

  return {
    id: Number(value.id ?? 0),
    slug: String(value.slug ?? ""),
    title: String(value.title ?? ""),
    subtitle: value.subtitle ? String(value.subtitle) : null,
    description: value.description ? String(value.description) : null,
    roomType: value.roomType === "group" ? "group" : "couple",
    coverColor: value.coverColor ? String(value.coverColor) : null,
    participants,
    lastMessagePreview: String(value.lastMessagePreview ?? value.last_message_preview ?? ""),
    lastMessageAt:
      value.lastMessageAt !== undefined && value.lastMessageAt !== null
        ? String(value.lastMessageAt)
        : null,
    relationshipSnapshot,
    currentSituation: String(
      value.currentSituation ??
        value.current_situation ??
        relationshipSnapshot.currentSituation,
    ),
    dominantPair,
    highlightQuote:
      value.highlightQuote !== undefined && value.highlightQuote !== null
        ? String(value.highlightQuote)
        : value.highlight_quote !== undefined && value.highlight_quote !== null
          ? String(value.highlight_quote)
          : null,
    openScenePoll,
  };
}

function normalizeMessageMeta(value: Record<string, unknown>): MessageMetaUpdate {
  return {
    messageId: Number(value.messageId ?? value.message_id ?? 0),
    reactions: normalizeReactions(value.reactions),
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
    publicVotePath: getN8nPath("publicVote"),
    publicReactionPath: getN8nPath("publicReaction"),
    publicHubRoomsPath: getN8nPath("publicHubRooms"),
    publicHubRoomDetailPath: getN8nPath("publicHubRoomDetail"),
    publicHubRoomUpdatesPath: getN8nPath("publicHubRoomUpdates"),
  } satisfies PublicN8nConfig;
}

async function fetchPublicJson(
  path: string,
  {
    method = "GET",
    query = {},
    body,
    config,
  }: {
    method?: "GET" | "POST";
    query?: Record<string, string | number | undefined>;
    body?: Record<string, unknown>;
    config?: PublicN8nConfig;
  } = {},
) {
  const resolved = resolveConfig(config);
  const url = withQuery(new URL(path, resolved.baseUrl), query);
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let payload: Record<string, unknown> | null = null;

  try {
    payload = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload.message === "string"
        ? payload.message
        : text || response.statusText || "n8n upstream 요청이 실패했습니다.";

    throw new UpstreamError(message, response.status);
  }

  return payload ?? {};
}

export async function getPublicRooms(
  query: RoomsQuery = {},
  config?: PublicN8nConfig,
): Promise<RoomsPayload> {
  const payload = await fetchPublicJson(resolveConfig(config).publicRoomsPath, {
    query,
    config,
  });

  return {
    rooms: asArray(payload.rooms).map((room) =>
      normalizeRoomSummary(asObject(room) ?? {}),
    ),
    serverTime: String(payload.serverTime ?? new Date().toISOString()),
  };
}

export async function getPublicRoomDetail(
  slug: string,
  config?: PublicN8nConfig,
  query: DetailQuery = {},
): Promise<RoomDetailPayload> {
  const resolved = resolveConfig(config);
  const payload = await fetchPublicJson(
    interpolatePath(resolved.publicRoomDetailPath, { slug }),
    {
      query,
      config,
    },
  );

  const roomRaw = asObject(payload.room);
  if (!roomRaw) {
    throw new UpstreamError("채팅방 정보를 찾지 못했습니다.", 404);
  }

  const participants = asArray(payload.participants).map((participant) =>
    normalizeParticipant(asObject(participant) ?? {}),
  );
  const relationshipSnapshot = normalizeRelationshipSnapshot(
    payload.relationshipSnapshot ?? payload.relationship_snapshot,
  );
  const roomSummary = normalizeRoomSummary({
    ...roomRaw,
    participants,
    relationshipSnapshot,
    currentSituation: payload.currentSituation ?? payload.current_situation,
    dominantPair: payload.dominantPair ?? payload.dominant_pair,
    highlightQuote: normalizeHighlight(payload.highlight)?.quote ?? null,
    openScenePoll: payload.scenePoll ?? payload.scene_poll,
    lastMessagePreview: "",
    lastMessageAt: null,
  });

  return {
    room: {
      ...roomSummary,
      createdAt:
        roomRaw.createdAt !== undefined && roomRaw.createdAt !== null
          ? String(roomRaw.createdAt)
          : null,
    },
    participants,
    characterProfiles: asArray(payload.characterProfiles ?? payload.character_profiles).map(
      (profile) => normalizeCharacterProfile(asObject(profile) ?? {}),
    ),
    messages: asArray(payload.messages).map((message) =>
      normalizeMessage(asObject(message) ?? {}),
    ),
    relationshipSnapshot,
    emotionTimeline: asArray(payload.emotionTimeline ?? payload.emotion_timeline).map(
      (event) => normalizeEmotionEvent(asObject(event) ?? {}),
    ),
    highlight: normalizeHighlight(payload.highlight),
    scenePoll: normalizeScenePoll(payload.scenePoll ?? payload.scene_poll),
    viewerState: normalizeViewerState(payload.viewerState ?? payload.viewer_state),
    currentSituation: String(
      payload.currentSituation ??
        payload.current_situation ??
        relationshipSnapshot.currentSituation,
    ),
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
    {
      query,
      config,
    },
  );

  return {
    roomSlug: String(payload.roomSlug ?? slug),
    messages: asArray(payload.messages).map((message) =>
      normalizeMessage(asObject(message) ?? {}),
    ),
    messageMeta: asArray(payload.messageMeta ?? payload.message_meta).map((entry) =>
      normalizeMessageMeta(asObject(entry) ?? {}),
    ),
    relationshipSnapshot: payload.relationshipSnapshot || payload.relationship_snapshot
      ? normalizeRelationshipSnapshot(
          payload.relationshipSnapshot ?? payload.relationship_snapshot,
        )
      : null,
    emotionTimeline: asArray(payload.emotionTimeline ?? payload.emotion_timeline).map(
      (event) => normalizeEmotionEvent(asObject(event) ?? {}),
    ),
    highlight: normalizeHighlight(payload.highlight),
    scenePoll: normalizeScenePoll(payload.scenePoll ?? payload.scene_poll),
    viewerState: normalizeViewerState(payload.viewerState ?? payload.viewer_state),
    currentSituation:
      payload.currentSituation !== undefined && payload.currentSituation !== null
        ? String(payload.currentSituation)
        : payload.current_situation !== undefined && payload.current_situation !== null
          ? String(payload.current_situation)
          : null,
    serverTime: String(payload.serverTime ?? new Date().toISOString()),
  };
}

export async function submitSceneVote(
  slug: string,
  body: {
    sceneId: string;
    optionId: string;
    deviceId: string;
  },
  config?: PublicN8nConfig,
): Promise<VoteResponsePayload> {
  const resolved = resolveConfig(config);
  const payload = await fetchPublicJson(interpolatePath(resolved.publicVotePath, { slug }), {
    method: "POST",
    body,
    config,
  });

  return {
    ok: Boolean(payload.ok ?? true),
    scenePoll:
      normalizeScenePoll(payload.scenePoll ?? payload.scene_poll) ?? {
        sceneId: body.sceneId,
        title: "장면 개입",
        prompt: "",
        status: "open",
        totalVotes: 0,
        closesAt: null,
        viewerVoteOptionId: body.optionId,
        options: [],
      },
    viewerState: normalizeViewerState(payload.viewerState ?? payload.viewer_state),
    serverTime: String(payload.serverTime ?? new Date().toISOString()),
  };
}

export async function submitMessageReaction(
  messageId: number,
  body: {
    emoji: string;
    deviceId: string;
  },
  config?: PublicN8nConfig,
): Promise<ReactionResponsePayload> {
  const resolved = resolveConfig(config);
  const payload = await fetchPublicJson(
    interpolatePath(resolved.publicReactionPath, { messageId }),
    {
      method: "POST",
      body,
      config,
    },
  );

  return {
    ok: Boolean(payload.ok ?? true),
    messageId: Number(payload.messageId ?? messageId),
    reactions: normalizeReactions(payload.reactions),
    serverTime: String(payload.serverTime ?? new Date().toISOString()),
  };
}

export async function getPublicHubRooms(
  config?: PublicN8nConfig,
): Promise<{ rooms: HubRoomSummary[]; serverTime: string }> {
  const resolved = resolveConfig(config);

  try {
    const payload = await fetchPublicJson(resolved.publicHubRoomsPath, { config });
    const rawRooms = asArray(payload.rooms);

    return {
      rooms: rawRooms.map((entry) => {
        const rawRoom = asObject(entry) ?? {};
        const room = normalizeRoomSummary(rawRoom);
        const fallbackRoom = buildHubRoomsFromRooms([room])[0];

        return {
          ...fallbackRoom,
          mapId: String(rawRoom.mapId ?? fallbackRoom.mapId),
          ambientLabel: String(rawRoom.ambientLabel ?? fallbackRoom.ambientLabel),
          paletteKey: String(rawRoom.paletteKey ?? fallbackRoom.paletteKey),
        };
      }),
      serverTime: String(payload.serverTime ?? new Date().toISOString()),
    };
  } catch {
    const roomsPayload = await getPublicRooms({ limit: 24 }, config);

    return {
      rooms: buildHubRoomsFromRooms(roomsPayload.rooms),
      serverTime: roomsPayload.serverTime,
    };
  }
}

export async function getPublicHubRoomDetail(
  slug: string,
  config?: PublicN8nConfig,
  query: HubDetailQuery = {},
): Promise<HubRoomDetailPayload> {
  const resolved = resolveConfig(config);

  try {
    const payload = await fetchPublicJson(
      interpolatePath(resolved.publicHubRoomDetailPath, { slug }),
      {
        query,
        config,
      },
    );
    const roomRaw = asObject(payload.room);
    const map = normalizeHubMap(payload.map);

    if (!roomRaw || !map) {
      throw new Error("hub detail payload is incomplete");
    }

    const roomSummary = normalizeRoomSummary({
      ...roomRaw,
      participants: payload.participants,
      relationshipSnapshot: payload.relationshipSnapshot,
      currentSituation: payload.currentSituation,
    });
    const hubRoom = buildHubRoomsFromRooms([roomSummary])[0];

    return {
      room: {
        ...hubRoom,
        mapId: String(roomRaw.mapId ?? hubRoom.mapId),
        ambientLabel: String(roomRaw.ambientLabel ?? hubRoom.ambientLabel),
        paletteKey: String(roomRaw.paletteKey ?? hubRoom.paletteKey),
        createdAt:
          roomRaw.createdAt === undefined || roomRaw.createdAt === null
            ? null
            : String(roomRaw.createdAt),
      },
      participants: asArray(payload.participants).map((participant) =>
        normalizeParticipant(asObject(participant) ?? {}),
      ),
      characterProfiles: asArray(payload.characterProfiles ?? payload.character_profiles).map(
        (profile) => normalizeCharacterProfile(asObject(profile) ?? {}),
      ),
      relationshipSnapshot: normalizeRelationshipSnapshot(
        payload.relationshipSnapshot ?? payload.relationship_snapshot,
      ),
      currentSituation: String(payload.currentSituation ?? payload.current_situation ?? ""),
      messages: asArray(payload.messages).map((message) =>
        normalizeMessage(asObject(message) ?? {}),
      ),
      map,
      agents: asArray(payload.agents).map((agent) => normalizeHubAgent(asObject(agent) ?? {})),
      interactions: asArray(payload.interactions).map((interaction) =>
        normalizeHubInteraction(asObject(interaction) ?? {}),
      ),
      serverTime: String(payload.serverTime ?? new Date().toISOString()),
    };
  } catch {
    const detail = await getPublicRoomDetail(slug, config, query);
    return buildHubRoomDetailFromRoomDetail(detail);
  }
}

export async function getPublicHubRoomUpdates(
  slug: string,
  query: HubUpdatesQuery = {},
  config?: PublicN8nConfig,
): Promise<HubUpdatesPayload> {
  const resolved = resolveConfig(config);

  try {
    const payload = await fetchPublicJson(
      interpolatePath(resolved.publicHubRoomUpdatesPath, { slug }),
      {
        query,
        config,
      },
    );

    return {
      roomSlug: String(payload.roomSlug ?? slug),
      relationshipSnapshot: payload.relationshipSnapshot || payload.relationship_snapshot
        ? normalizeRelationshipSnapshot(
            payload.relationshipSnapshot ?? payload.relationship_snapshot,
          )
        : null,
      currentSituation:
        payload.currentSituation === undefined || payload.currentSituation === null
          ? payload.current_situation === undefined || payload.current_situation === null
            ? null
            : String(payload.current_situation)
          : String(payload.currentSituation),
      messages: asArray(payload.messages).map((message) =>
        normalizeMessage(asObject(message) ?? {}),
      ),
      interactions: asArray(payload.interactions).map((interaction) =>
        normalizeHubInteraction(asObject(interaction) ?? {}),
      ),
      agentUpdates: asArray(payload.agentUpdates ?? payload.agent_updates).map((entry) =>
        normalizeHubAgentUpdate(asObject(entry) ?? {}),
      ),
      serverTime: String(payload.serverTime ?? new Date().toISOString()),
    };
  } catch {
    const roomUpdates = await getPublicRoomUpdates(
      slug,
      {
        after: query.after,
        afterId: query.afterId,
        deviceId: query.deviceId,
      },
      config,
    );

    return {
      roomSlug: slug,
      relationshipSnapshot: roomUpdates.relationshipSnapshot,
      currentSituation: roomUpdates.currentSituation,
      messages: roomUpdates.messages,
      interactions: [],
      agentUpdates: [],
      serverTime: roomUpdates.serverTime,
    };
  }
}
