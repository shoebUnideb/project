import apiClient from './apiClient';
import type {
  WorkspaceOnboardingQuestion,
  WorkspaceOnboardingAnswer,
  WorkspaceOnboardingSubmission,
} from '../types';

export const onboardingApi = {
  completeGlobal: () =>
    apiClient.post<{ status: string }>('/api/student/onboarding/complete/', {}),

  getQuestions: (id: number) =>
    apiClient.get<WorkspaceOnboardingQuestion[]>(`/api/workspaces/${id}/onboarding/questions/`),

  createQuestion: (id: number, data: { question_text: string; required?: boolean }) =>
    apiClient.post<WorkspaceOnboardingQuestion>(`/api/workspaces/${id}/onboarding/questions/`, data),

  updateQuestion: (id: number, qid: number, data: Partial<WorkspaceOnboardingQuestion>) =>
    apiClient.patch<WorkspaceOnboardingQuestion>(`/api/workspaces/${id}/onboarding/questions/${qid}/`, data),

  deleteQuestion: (id: number, qid: number) =>
    apiClient.delete(`/api/workspaces/${id}/onboarding/questions/${qid}/`),

  getMyResponse: (id: number) =>
    apiClient.get<WorkspaceOnboardingAnswer[]>(`/api/workspaces/${id}/onboarding/my-response/`),

  submitMyResponse: (id: number, answers: WorkspaceOnboardingAnswer[]) =>
    apiClient.patch<WorkspaceOnboardingAnswer[]>(`/api/workspaces/${id}/onboarding/my-response/`, answers),

  getSubmissions: (id: number) =>
    apiClient.get<WorkspaceOnboardingSubmission[]>(`/api/workspaces/${id}/onboarding/submissions/`),
};
