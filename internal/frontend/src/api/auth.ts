import apiClient, { tokens } from './apiClient';
import type { User } from '../types';

export interface LoginPayload    { username: string; password: string; }
export interface LoginResponse   { access: string; refresh: string; user: User; }

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  password2: string;
  first_name?: string;
  last_name?: string;
}

export const authApi = {
  register: async (payload: RegisterPayload): Promise<User> => {
    const data = await apiClient.post<LoginResponse>('/api/auth/register/', payload);
    tokens.set(data.access, data.refresh);
    return data.user;
  },

  login: async (payload: LoginPayload): Promise<User> => {
    const data = await apiClient.post<LoginResponse>('/api/auth/login/', payload);
    tokens.set(data.access, data.refresh);
    return data.user;
  },

  logout: async (): Promise<void> => {
    const refresh = tokens.getRefresh();
    // Fire and forget — even if it fails we clear locally
    await apiClient.post('/api/auth/logout/', { refresh }).catch(() => {});
    tokens.clear();
  },

  me: () => apiClient.get<User>('/api/auth/me/'),

  updateSettings: (payload: { message_permission?: string; theme_color?: string; font_style?: string }) =>
    apiClient.patch<User>('/api/auth/settings/', payload),

  changePassword: async (payload: { current_password: string; new_password: string }): Promise<void> => {
    // Backend re-issues tokens so the user stays logged in after password change
    const data = await apiClient.post<LoginResponse>('/api/auth/change-password/', payload);
    tokens.set(data.access, data.refresh);
  },
};
