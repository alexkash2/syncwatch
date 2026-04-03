export interface Room {
  id: string;
  name: string;
  room_code: string;
  host_id: string;
  is_active: boolean;
  max_participants: number;
  file_version: number;
  created_at: string;
}

export interface RoomDetail extends Room {
  participants: Participant[];
  host_username: string;
}

export interface Participant {
  user_id: string;
  username: string;
  is_ready: boolean;
  joined_at: string;
}

export interface RoomListResponse {
  rooms: Room[];
  total: number;
}
