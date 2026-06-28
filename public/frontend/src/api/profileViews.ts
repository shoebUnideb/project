import apiClient from './apiClient';

export interface ProfileViewEntry {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  viewed_at: string;
}

export const profileViewsApi = {
  record: (userId: number) => apiClient.post(`/api/profile-views/${userId}/`, {}),
  getMyViews: () => apiClient.get<ProfileViewEntry[]>('/api/profile-views/me/'),
};
