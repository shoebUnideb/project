import apiClient from './apiClient';
import type { FeedPost, FeedComment, ReactionEmoji } from '../types';

export const feedApi = {
  list:          (tag?: string) =>
    apiClient.get<FeedPost[]>(`/api/feed/${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`),
  detail:        (id: number) => apiClient.get<FeedPost>(`/api/feed/${id}/`),
  create:        (fd: FormData) => apiClient.post<FeedPost>('/api/feed/', fd),
  update:        (id: number, fd: FormData) => apiClient.patch<FeedPost>(`/api/feed/${id}/`, fd),
  delete:        (id: number) => apiClient.delete(`/api/feed/${id}/`),
  react:         (id: number, emoji: ReactionEmoji) =>
    apiClient.post(`/api/feed/${id}/react/`, { emoji }),
  unreact:       (id: number) => apiClient.delete(`/api/feed/${id}/react/`),
  getComments:   (id: number) => apiClient.get<FeedComment[]>(`/api/feed/${id}/comments/`),
  addComment:    (id: number, body: string) =>
    apiClient.post<FeedComment>(`/api/feed/${id}/comments/`, { body }),
  deleteComment: (id: number, cid: number) =>
    apiClient.delete(`/api/feed/${id}/comments/${cid}/`),
  pin:           (id: number) => apiClient.post<FeedPost>(`/api/feed/${id}/pin/`, {}),
  hide:          (id: number) => apiClient.post<FeedPost>(`/api/feed/${id}/hide/`, {}),
  bookmark:      (id: number) => apiClient.post(`/api/feed/${id}/bookmark/`, {}),
  unbookmark:    (id: number) => apiClient.delete(`/api/feed/${id}/bookmark/`),
  bookmarked:    () => apiClient.get<FeedPost[]>('/api/bookmarks/'),
};
