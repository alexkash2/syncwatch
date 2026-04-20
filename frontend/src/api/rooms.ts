import type { Room, RoomDetail, RoomListResponse } from '../types/room';
import type { ChatMessage } from '../types/ws';
import client from './client';

interface ChatHistoryResponse {
  messages: ChatMessage[];
  next_cursor: string | null;
}

export async function createRoom(name: string): Promise<Room> {
  const res = await client.post<Room>('/rooms/', { name });
  return res.data;
}

export async function listRooms(page = 1, size = 20): Promise<RoomListResponse> {
  const res = await client.get<RoomListResponse>('/rooms/', { params: { page, size } });
  return res.data;
}

export async function getRoom(roomId: string): Promise<RoomDetail> {
  const res = await client.get<RoomDetail>(`/rooms/${roomId}`);
  return res.data;
}

export async function joinRoom(roomCode: string): Promise<Room> {
  const res = await client.post<Room>('/rooms/join', { room_code: roomCode });
  return res.data;
}

export async function leaveRoom(roomId: string): Promise<void> {
  await client.post(`/rooms/${roomId}/leave`);
}

export async function deleteRoom(roomId: string): Promise<void> {
  await client.delete(`/rooms/${roomId}`);
}

export async function getChatHistory(roomId: string, cursor?: string): Promise<ChatHistoryResponse> {
  const params: Record<string, string | number> = { limit: 50 };
  if (cursor) params.cursor = cursor;
  const res = await client.get<ChatHistoryResponse>(`/rooms/${roomId}/messages`, { params });
  return res.data;
}
