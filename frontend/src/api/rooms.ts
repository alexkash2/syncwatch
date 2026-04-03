import type { Room, RoomDetail, RoomListResponse } from '../types/room';
import client from './client';

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
