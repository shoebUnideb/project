import apiClient from './apiClient';
import type { Message, Conversation, ContactRequestList, BlockStatus } from '../types';

export interface InboxItem {
  mentor: import('../types').User;
  unread: number;
}

export const messagesApi = {
  getThread: (userId?: number, mentorId?: number) => {
    if (userId) return apiClient.get<Message[]>(`/api/messages/?user_id=${userId}`);
    if (mentorId) return apiClient.get<Message[]>(`/api/messages/?mentor_id=${mentorId}`);
    return apiClient.get<Message[]>('/api/messages/');
  },
  getConversations: () => apiClient.get<Conversation[]>('/api/messages/conversations/'),
  getInbox: () => apiClient.get<InboxItem[]>('/api/messages/inbox/'),
  clearThread: (userId: number) => apiClient.delete(`/api/messages/thread/${userId}/`),
  send: (receiverId: number | null, body: string, attachment?: File) => {
    if (attachment) {
      const fd = new FormData();
      if (receiverId) fd.append('receiver_id', String(receiverId));
      fd.append('body', body);
      fd.append('attachment', attachment);
      return apiClient.post<Message>('/api/messages/send/', fd);
    }
    return apiClient.post<Message>('/api/messages/send/', { receiver_id: receiverId, body });
  },
};

export const contactRequestApi = {
  list: () => apiClient.get<ContactRequestList>('/api/contact-requests/'),
  send: (receiverId: number) =>
    apiClient.post<{ id: number; status: string }>('/api/contact-requests/', { receiver_id: receiverId }),
  respond: (id: number, action: 'accept' | 'decline') =>
    apiClient.post<{ id: number; status: string }>(`/api/contact-requests/${id}/`, { action }),
  cancel: (id: number) =>
    apiClient.delete(`/api/contact-requests/${id}/`),
};

export const blocksApi = {
  list:    () => apiClient.get<BlockStatus>('/api/blocks/'),
  block:   (userId: number) => apiClient.post<{ id: number; blocked_id: number }>('/api/blocks/', { blocked_id: userId }),
  unblock: (userId: number) => apiClient.delete(`/api/blocks/${userId}/`),
};
