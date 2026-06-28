import apiClient from './apiClient';

export const documentsApi = {
  delete: (id: number) => apiClient.delete<void>(`/api/documents/${id}/`),
};
