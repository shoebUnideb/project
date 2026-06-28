import apiClient from './apiClient';

export interface SearchResults {
  users: { id: number; username: string; first_name: string; last_name: string; role: string }[];
  workspaces: { id: number; name: string; description: string }[];
  posts: { id: number; title: string; body: string }[];
}

export const searchApi = {
  search: (q: string) => apiClient.get<SearchResults>(`/api/search/?q=${encodeURIComponent(q)}`),
};
