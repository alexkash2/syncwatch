export interface WsMessage {
  type: string;
  seq?: number;
  server_time?: number;
  file_version?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export interface WsParticipant {
  user_id: string;
  username: string;
  is_ready: boolean;
}

export interface RoomStateMessage {
  type: 'room_state';
  participants: WsParticipant[];
  playback_state: {
    is_playing: boolean;
    current_time_ms: number;
    playback_rate: number;
  };
  file_info: Record<string, string | number | null>;
  file_version: number;
  room_status: string;
}
