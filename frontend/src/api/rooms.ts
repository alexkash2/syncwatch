import type { Room, RoomDetail, RoomListResponse } from '../types/room';
import type { ChatMessage } from '../types/ws';
import { apiClient } from './client';

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  next_cursor: string | null;
}

export interface FileInfoPayload {
  file_hash: string;
  file_size: number;
  file_duration_ms: number;
  file_name: string;
}

export async function createRoom(name: string) {
  const response = await apiClient.post<Room>('/rooms', { name });
  return response.data;
}

export async function listRooms(page = 1, size = 20) {
  const response = await apiClient.get<RoomListResponse>('/rooms', {
    params: { page, size },
  });

  return response.data;
}

export async function getRoom(roomId: string) {
  const response = await apiClient.get<RoomDetail>(`/rooms/${roomId}`);
  return response.data;
}

export async function joinRoom(roomCode: string) {
  const response = await apiClient.post<Room>('/rooms/join', {
    room_code: roomCode,
  });

  return response.data;
}

export async function leaveRoom(roomId: string) {
  const response = await apiClient.post<{ ok: boolean }>(`/rooms/${roomId}/leave`);
  return response.data;
}

export async function deleteRoom(roomId: string) {
  const response = await apiClient.delete<{ ok: boolean }>(`/rooms/${roomId}`);
  return response.data;
}

export async function updateFileInfo(roomId: string, payload: FileInfoPayload) {
  const response = await apiClient.put<Room>(`/rooms/${roomId}/file-info`, payload);
  return response.data;
}

export async function getChatHistory(roomId: string, cursor?: string, limit = 50) {
  const response = await apiClient.get<ChatHistoryResponse>(`/rooms/${roomId}/messages`, {
    params: {
      cursor,
      limit,
    },
  });

  return response.data;
}
