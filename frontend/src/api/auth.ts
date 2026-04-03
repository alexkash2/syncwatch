import type { LoginRequest, RegisterRequest, TokenResponse, User } from '../types/auth';
import client from './client';

export async function register(data: RegisterRequest): Promise<User> {
  const res = await client.post<User>('/auth/register', data);
  return res.data;
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const res = await client.post<TokenResponse>('/auth/login', data);
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await client.get<User>('/auth/me');
  return res.data;
}
