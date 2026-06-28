import apiClient from './apiClient';
import type { MentorRatingSummary, MentorRatingItem } from '../types';

export const ratingsApi = {
  getSummary: (mentorId: number) =>
    apiClient.get<MentorRatingSummary>(`/api/ratings/${mentorId}/`),
  rate: (mentorId: number, rating: number, review: string) =>
    apiClient.post<MentorRatingItem>(`/api/ratings/${mentorId}/rate/`, { rating, review }),
};
