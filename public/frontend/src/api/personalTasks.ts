import apiClient from './apiClient';
import type { PersonalTask } from '../types';

export const personalTasksApi = {
  list:   ()                              => apiClient.get<PersonalTask[]>('/api/personal-tasks/'),
  create: (data: Partial<PersonalTask>)  => apiClient.post<PersonalTask>('/api/personal-tasks/', data),
  update: (id: number, data: Partial<PersonalTask>) => apiClient.patch<PersonalTask>(`/api/personal-tasks/${id}/`, data),
  delete: (id: number)                   => apiClient.delete(`/api/personal-tasks/${id}/`),
};
