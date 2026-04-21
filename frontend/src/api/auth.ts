import { apiClient } from './client';
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  User,
} from '../types/auth';

interface WsTicketResponse {
  ticket: string;
}

export async function register(data: RegisterRequest) {
  const response = await apiClient.post<User>('/auth/register', data);
  return response.data;
}

export async function login(data: LoginRequest) {
  const response = await apiClient.post<TokenResponse>('/auth/login', data);
  return response.data;
}

export async function refreshTokens(refreshToken: string) {
  const response = await apiClient.post<TokenResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  });

  return response.data;
}

export async function getMe() {
  const response = await apiClient.get<User>('/auth/me');
  return response.data;
}

export async function createWsTicket(roomId: string) {
  const response = await apiClient.post<WsTicketResponse>('/auth/ws-ticket', {
    room_id: roomId,
  });

  return response.data.ticket;
}
