export type RoomType = "couple" | "group";
export type RoomFilter = RoomType | "all";
export type RelationshipStage = "interest" | "some" | "dating" | "group";
export type RelationshipFilter = "all" | RelationshipStage;
export type MessageType = "text" | "system";

export interface Participant {
  id: number;
  handle: string;
  displayName: string;
  bio: string | null;
  traits: string[];
  avatarSeed: string | null;
  roleLabel: string | null;
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
}

export interface RoomMeta extends Omit<RoomSummary, "lastMessagePreview" | "lastMessageAt"> {
  createdAt?: string | null;
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
}

export interface RoomsPayload {
  rooms: RoomSummary[];
  serverTime: string;
}

export interface RoomDetailPayload {
  room: RoomMeta;
  participants: Participant[];
  messages: Message[];
  serverTime: string;
}

export interface RoomUpdatesPayload {
  roomSlug: string;
  messages: Message[];
  serverTime: string;
}

export interface MessageCursor {
  after?: string;
  afterId?: string;
}
