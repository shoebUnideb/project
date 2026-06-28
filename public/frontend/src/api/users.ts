import apiClient from './apiClient';
import type { User } from '../types';

export interface UpdateUserPayload {
  role?: string;
  is_approved?: boolean;
  is_active?: boolean;
}

export interface CreateMentorPayload {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export const usersApi = {
  list: () =>
    apiClient.get<User[]>('/api/auth/users/'),

  create: (payload: CreateMentorPayload) =>
    apiClient.post<User>('/api/auth/users/', payload),

  update: (id: number, payload: UpdateUserPayload) =>
    apiClient.patch<User>(`/api/auth/users/${id}/`, payload),
};
