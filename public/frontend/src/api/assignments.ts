import apiClient from './apiClient';
import type { Assignment } from '../types';

export interface CreateAssignmentPayload {
  student_id: number;
  mentor_id: number;
  notes?: string;
}

export const assignmentsApi = {
  list: () =>
    apiClient.get<Assignment[]>('/api/assignments/'),

  create: (payload: CreateAssignmentPayload) =>
    apiClient.post<Assignment>('/api/assignments/', payload),

  deactivate: (id: number) =>
    apiClient.delete(`/api/assignments/${id}/`),
};
