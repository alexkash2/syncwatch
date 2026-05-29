export type RoomStatus = 'waiting_file' | 'waiting_ready' | 'paused' | 'playing' | 'closing';

export interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export type ParticipantRuntimeStatus =
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'error'
  | 'waiting_interaction';

export interface WsParticipant {
  user_id: string;
  username: string;
  is_ready: boolean;
  joined_at?: string;
  status?: ParticipantRuntimeStatus;
  status_detail?: string;
}

export interface PlaybackState {
  is_playing: boolean;
  current_time_ms: number;
  playback_rate: number;
}

export interface RoomFileInfo {
  file_hash: string | null;
  file_size: number | null;
  file_duration_ms: number | null;
  file_name: string | null;
  file_version: number;
}

export interface FileVerifyResult {
  match: boolean;
  reason?: string;
  file_version?: number;
  file_hash?: string;
}

export interface ReferenceFileState {
  fileName: string | null;
  fileVersion: number;
}

export interface BaseWsMessage {
  type: string;
  seq?: number;
  server_time?: number;
  file_version?: number;
}

export interface RoomStateMessage extends BaseWsMessage {
  type: 'room_state';
  participants: WsParticipant[];
  playback_state: PlaybackState;
  file_info: RoomFileInfo;
  room_status: RoomStatus;
  host_disconnected?: boolean;
  host_grace_remaining_ms?: number | null;
}

export interface UserJoinedMessage extends BaseWsMessage {
  type: 'user_joined';
  user_id: string;
  username: string;
  connection_id: string;
}

export interface UserLeftMessage extends BaseWsMessage {
  type: 'user_left';
  user_id: string;
  username: string;
  reason: string;
}

export interface ChatWsMessage extends BaseWsMessage, ChatMessage {
  type: 'chat_message';
}

export interface FileVerifyResponseMessage extends BaseWsMessage, FileVerifyResult {
  type: 'file_verify_response';
}

export interface FileChangedMessage extends BaseWsMessage {
  type: 'file_changed';
  file_hash: string;
  file_size: number;
  file_duration_ms: number;
  file_name: string;
}

export interface ParticipantReadyMessage extends BaseWsMessage {
  type: 'participant_ready';
  user_id: string;
  is_ready: boolean;
}

export interface HostDisconnectedMessage extends BaseWsMessage {
  type: 'host_disconnected';
  grace_period_ms: number;
}

export interface HostReconnectedMessage extends BaseWsMessage {
  type: 'host_reconnected';
  room_status?: RoomStatus;
}

export interface RoomClosedMessage extends BaseWsMessage {
  type: 'room_closed';
  reason: string;
}

export interface SyncStateMessage extends BaseWsMessage {
  type: 'sync_state';
  is_playing: boolean;
  current_time_ms: number;
}

export interface SyncCorrectionMessage extends BaseWsMessage {
  type: 'sync_correction';
  action: 'seek';
  target_time_ms: number;
}

export interface SyncCheckMessage extends BaseWsMessage {
  type: 'sync_check';
  current_time_ms?: number;
  is_playing?: boolean;
}

export interface PlaybackRateMessage extends BaseWsMessage {
  type: 'playback_rate';
  rate: number;
}

export interface ParticipantStatusMessage extends BaseWsMessage {
  type: 'participant_status';
  user_id: string;
  status: string;
  detail?: string;
}

export interface ErrorWsMessage extends BaseWsMessage {
  type: 'error';
  code: string;
  message: string;
}

export type SyncRelatedMessage =
  | SyncStateMessage
  | SyncCorrectionMessage
  | SyncCheckMessage
  | PlaybackRateMessage;

export type WsMessage =
  | RoomStateMessage
  | UserJoinedMessage
  | UserLeftMessage
  | ChatWsMessage
  | FileVerifyResponseMessage
  | FileChangedMessage
  | ParticipantReadyMessage
  | HostDisconnectedMessage
  | HostReconnectedMessage
  | RoomClosedMessage
  | SyncRelatedMessage
  | ParticipantStatusMessage
  | ErrorWsMessage;
