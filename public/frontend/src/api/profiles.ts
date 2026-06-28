import apiClient from './apiClient';
import type { StudentProfile, MentorProfile } from '../types';

export const profilesApi = {
  // Student
  getStudentProfile: () =>
    apiClient.get<StudentProfile>('/api/student/profile/'),

  updateStudentProfile: (data: FormData) =>
    apiClient.patch<StudentProfile>('/api/student/profile/', data),

  // Mentor
  getMentorProfile: () =>
    apiClient.get<MentorProfile>('/api/mentor/profile/'),

  updateMentorProfile: (data: FormData) =>
    apiClient.patch<MentorProfile>('/api/mentor/profile/', data),

  // Student → their assigned mentor
  getMyMentor: () =>
    apiClient.get<MentorProfile | null>('/api/student/mentor/'),

  // Mentor → their students
  getMentorStudents: () =>
    apiClient.get<StudentProfile[]>('/api/mentor/students/'),

  getMentorStudentDetail: (studentId: number) =>
    apiClient.get<StudentProfile>(`/api/mentor/students/${studentId}/`),

  // Public profile — connected users ("friends") or mentor viewing their student
  getPublicProfile: (userId: number) =>
    apiClient.get<StudentProfile | MentorProfile>(`/api/profiles/${userId}/`),

  getMentorPendingFeed: () =>
    apiClient.get<{
      steps: Array<{
        id: number;
        title: string;
        application_id: number;
        application_title: string;
        student_name: string;
        updated_at: string;
      }>;
      workspace_requests: Array<{
        id: number;
        workspace_id: number;
        workspace_name: string;
        student_name: string;
        requested_at: string;
      }>;
    }>('/api/mentor/pending/'),
};
