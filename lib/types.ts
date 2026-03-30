export type RoomType = "couple" | "group";
export type MessageType = "text" | "system";
export type RelationshipStage =
  | "awkward"
  | "interest"
  | "flirt"
  | "love"
  | "obsession"
  | "group";
export type RelationshipFilter = "all" | RelationshipStage;
export type RelationshipTrend =
  | "rising"
  | "falling"
  | "stable"
  | "conflict"
  | "recovery";
export type EmotionEventType =
  | "rise"
  | "drop"
  | "conflict"
  | "recovery"
  | "confession_attempt"
  | "distance";

export interface PublicN8nConfig {
  baseUrl: string;
  publicRoomsPath: string;
  publicRoomDetailPath: string;
  publicRoomUpdatesPath: string;
  publicVotePath: string;
  publicReactionPath: string;
  publicHubRoomsPath: string;
  publicHubRoomDetailPath: string;
  publicHubRoomUpdatesPath: string;
}

export type AppSection = "chat" | "hub";
export type HubFacing = "up" | "right" | "down" | "left";
export type HubAgentStatus =
  | "idle"
  | "wandering"
  | "pathing"
  | "chatting"
  | "flirting"
  | "observing";
export type HubInteractionType = "chat" | "heart" | "spark" | "awkward_pause";
export type HubPoiKind =
  | "desk"
  | "sofa"
  | "watercooler"
  | "coffee"
  | "window"
  | "bookshelf"
  | "bar"
  | "plant";
export type HubFloorKind =
  | "void"
  | "wood"
  | "tile"
  | "rug"
  | "stone"
  | "accent";
export type HubPropKind =
  | "wall"
  | "desk"
  | "desk_duo"
  | "sofa"
  | "table"
  | "watercooler"
  | "plant"
  | "bookshelf"
  | "counter"
  | "lamp"
  | "window";

export interface HubPalette {
  background: string;
  wall: string;
  woodLight: string;
  woodDark: string;
  tileLight: string;
  tileDark: string;
  rug: string;
  accent: string;
  panel: string;
  panelBorder: string;
  text: string;
  textMuted: string;
  minimapBg: string;
}

export interface HubPoi {
  id: string;
  kind: HubPoiKind;
  label: string;
  x: number;
  y: number;
  radius?: number;
}

export interface HubPlacedProp {
  id: string;
  kind: HubPropKind;
  x: number;
  y: number;
  width: number;
  height: number;
  solid?: boolean;
  label?: string;
}

export interface HubSpawnPoint {
  handle: string;
  x: number;
  y: number;
  facing?: HubFacing;
}

export interface HubMapDefinition {
  id: string;
  slug: string;
  title: string;
  width: number;
  height: number;
  tileSize: number;
  palette: HubPalette;
  floor: HubFloorKind[][];
  collision: boolean[][];
  props: HubPlacedProp[];
  pois: HubPoi[];
  spawnPoints: HubSpawnPoint[];
  ambientLabel: string;
}

export interface HubAgentVisual {
  hair: string;
  skin: string;
  outfitPrimary: string;
  outfitSecondary: string;
  accent: string;
}

export interface HubAgent {
  id: string;
  participantId: number;
  handle: string;
  displayName: string;
  themeColor: string;
  visual: HubAgentVisual;
  tileX: number;
  tileY: number;
  fromTileX: number;
  fromTileY: number;
  facing: HubFacing;
  status: HubAgentStatus;
  mood: RelationshipStage;
  currentPoiId: string | null;
  targetTileX: number | null;
  targetTileY: number | null;
  moveStartedAt: number;
  moveDurationMs: number;
  interactionTargetId: string | null;
  sparkle: number;
}

export interface HubInteraction {
  id: string;
  type: HubInteractionType;
  agentIds: string[];
  tileX: number;
  tileY: number;
  startedAt: number;
  label: string;
  speakerId?: number | null;
  speakerHandle?: string | null;
  speechText?: string | null;
  emote?: string | null;
}

export interface HubRoomSummary extends RoomSummary {
  mapId: string;
  ambientLabel: string;
  paletteKey: string;
}

export interface HubRoomMeta extends Omit<HubRoomSummary, "openScenePoll"> {
  createdAt?: string | null;
}

export interface HubRoomDetailPayload {
  room: HubRoomMeta;
  participants: Participant[];
  characterProfiles: CharacterProfile[];
  relationshipSnapshot: RelationshipSnapshot;
  currentSituation: string;
  messages: Message[];
  map: HubMapDefinition;
  agents: HubAgent[];
  interactions: HubInteraction[];
  serverTime: string;
}

export interface HubAgentUpdate {
  id: string;
  tileX?: number;
  tileY?: number;
  facing?: HubFacing;
  status?: HubAgentStatus;
  mood?: RelationshipStage;
  targetTileX?: number | null;
  targetTileY?: number | null;
  currentPoiId?: string | null;
  interactionTargetId?: string | null;
  sparkle?: number;
}

export interface HubUpdatesPayload {
  roomSlug: string;
  relationshipSnapshot: RelationshipSnapshot | null;
  currentSituation: string | null;
  messages: Message[];
  interactions: HubInteraction[];
  agentUpdates: HubAgentUpdate[];
  serverTime: string;
}

export interface Participant {
  id: number;
  handle: string;
  displayName: string;
  bio: string | null;
  traits: string[];
  avatarSeed: string | null;
  roleLabel: string | null;
}

export interface CharacterProfile {
  participantId: number;
  handle: string;
  displayName: string;
  shortHook: string;
  personaBullets: string[];
  signatureStyle: string | null;
}

export interface DominantPair {
  actorIds: number[];
  actorHandles: string[];
  actorDisplayNames: string[];
  label: string;
  note: string | null;
}

export interface ConfessionPrediction {
  actorId: number | null;
  actorHandle: string | null;
  actorDisplayName: string | null;
  probability: number;
}

export interface RelationshipSnapshot {
  stage: RelationshipStage;
  stageLabel: string;
  affectionScore: number;
  trend: RelationshipTrend;
  trendDelta: number;
  heroLine: string;
  currentSituation: string;
  confessionPrediction: ConfessionPrediction | null;
  dominantPair: DominantPair | null;
}

export interface EmotionEvent {
  id: string;
  eventType: EmotionEventType;
  label: string;
  at: string;
  pairIds: number[];
  pairHandles: string[];
  impact: number;
}

export interface HighlightMoment {
  quote: string;
  speakerId: number | null;
  speakerHandle: string | null;
  speakerDisplayName: string | null;
  reason: string;
  messageId: number | null;
  createdAt: string;
}

export interface UserReactionCount {
  emoji: string;
  count: number;
}

export interface AIReaction {
  emoji: string;
  actorHandle: string;
  actorDisplayName: string;
}

export interface MessageReactions {
  user: UserReactionCount[];
  ai: AIReaction[];
}

export interface ScenePollOption {
  optionId: string;
  label: string;
  description: string;
  voteCount: number;
}

export interface ScenePoll {
  sceneId: string;
  title: string;
  prompt: string;
  status: "open" | "closed";
  totalVotes: number;
  closesAt: string | null;
  viewerVoteOptionId: string | null;
  options: ScenePollOption[];
}

export interface ViewerState {
  deviceId: string | null;
  lastVotedSceneId: string | null;
}

export interface Message {
  id: number;
  roomId: number;
  speakerId: number | null;
  speakerHandle: string | null;
  speakerDisplayName: string | null;
  roleLabel: string | null;
  messageType: MessageType;
  content: string;
  postedAt: string;
  reactions: MessageReactions;
}

export interface RoomSummary {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  roomType: RoomType;
  coverColor: string | null;
  participants: Participant[];
  lastMessagePreview: string;
  lastMessageAt: string | null;
  relationshipSnapshot: RelationshipSnapshot;
  currentSituation: string;
  dominantPair: DominantPair | null;
  highlightQuote: string | null;
  openScenePoll: ScenePoll | null;
}

export interface RoomMeta extends Omit<RoomSummary, "openScenePoll"> {
  createdAt?: string | null;
}

export interface RoomsPayload {
  rooms: RoomSummary[];
  serverTime: string;
}

export interface RoomDetailPayload {
  room: RoomMeta;
  participants: Participant[];
  characterProfiles: CharacterProfile[];
  messages: Message[];
  relationshipSnapshot: RelationshipSnapshot;
  emotionTimeline: EmotionEvent[];
  highlight: HighlightMoment | null;
  scenePoll: ScenePoll | null;
  viewerState: ViewerState | null;
  currentSituation: string;
  serverTime: string;
}

export interface MessageMetaUpdate {
  messageId: number;
  reactions: MessageReactions;
}

export interface RoomUpdatesPayload {
  roomSlug: string;
  messages: Message[];
  messageMeta: MessageMetaUpdate[];
  relationshipSnapshot: RelationshipSnapshot | null;
  emotionTimeline: EmotionEvent[];
  highlight: HighlightMoment | null;
  scenePoll: ScenePoll | null;
  viewerState: ViewerState | null;
  currentSituation: string | null;
  serverTime: string;
}

export interface MessageCursor {
  after?: string;
  afterId?: string;
  deviceId?: string;
}

export interface VoteResponsePayload {
  ok: boolean;
  scenePoll: ScenePoll;
  viewerState: ViewerState | null;
  serverTime: string;
}

export interface ReactionResponsePayload {
  ok: boolean;
  messageId: number;
  reactions: MessageReactions;
  serverTime: string;
}
