export interface WsMessage {
  type: string;
  seq?: number;
  server_time?: number;
  file_version?: number;
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
  file_info: Record<string, any>;
  file_version: number;
  room_status: string;
}
