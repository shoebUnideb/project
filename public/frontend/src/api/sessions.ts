import apiClient from './apiClient';
import type { AvailabilitySlot, MentorSession } from '../types';

export const sessionsApi = {
  getSlots:    (mentorId?: number) =>
    apiClient.get<AvailabilitySlot[]>(`/api/sessions/slots/${mentorId ? `?mentor_id=${mentorId}` : ''}`),
  addSlot:     (data: { day_of_week: number; start_time: string; end_time: string }) =>
    apiClient.post<AvailabilitySlot>('/api/sessions/slots/', data),
  deleteSlot:  (id: number) => apiClient.delete(`/api/sessions/slots/${id}/`),

  list:        () => apiClient.get<MentorSession[]>('/api/sessions/'),
  book:        (data: { mentor_id: number; date: string; start_time: string; end_time: string; title?: string }) =>
    apiClient.post<MentorSession>('/api/sessions/', data),
  update:      (id: number, data: Partial<{ status: string; notes: string }>) =>
    apiClient.patch<MentorSession>(`/api/sessions/${id}/`, data),
  delete:      (id: number) => apiClient.delete(`/api/sessions/${id}/`),
};
