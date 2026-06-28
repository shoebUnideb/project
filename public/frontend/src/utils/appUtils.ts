import type { StudentProfile, MentorProfile } from '../types';

/** Calculate profile completeness for a student (0-100) */
export function studentCompleteness(p: StudentProfile): number {
  const fields = [
    p.bio, p.headline, p.profile_picture, p.phone,
    p.university, p.field_of_study, p.career_stage,
    p.mentorship_goals, p.interests,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

/** Calculate profile completeness for a mentor (0-100) */
export function mentorCompleteness(p: MentorProfile): number {
  const fields = [p.bio, p.expertise, p.phone, p.linkedin_url, p.profile_picture];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

