/* ──────────────────────────────────────────────
   TypeScript Domain Interfaces
   ────────────────────────────────────────────── */

export type Role = 'superadmin' | 'mentor' | 'student';
export type MessagePermission = 'open' | 'request_required';
export type MessagingStatus = 'open' | 'can_message' | 'request_pending' | 'request_received' | 'request_required' | 'blocked';

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  is_approved: boolean;
  onboarding_complete: boolean;
  first_name?: string;
  last_name?: string;
  message_permission: MessagePermission;
  theme_color?: string;
  font_style?: string;
  profile_picture?: string | null;
  has_internal_access?: boolean;
}

// ── Profiles ──────────────────────────────────

export interface StudentProfile {
  id: number;
  user: User;
  // Personal
  bio: string;
  headline?: string;
  pronouns?: string;
  profile_picture?: string;
  // Contact & links
  phone: string;
  linkedin_url: string;
  github_url?: string;
  portfolio_url?: string;
  // Personal / location
  city?: string;
  date_of_birth?: string;
  // Academic / professional
  university?: string;
  field_of_study?: string;
  graduation_year?: string;
  career_stage?: string;
  skills?: string;
  // Interests & hobbies
  interests?: string;
  hobbies?: string;
  // Mentee intro
  mentorship_goals?: string;
  background_experience?: string;
  mentor_expectations?: string;
  availability_info?: string;
  created_at: string;
  updated_at: string;
}

export interface MentorProfile {
  id: number;
  user: User;
  // Personal
  bio: string;
  headline?: string;
  nationality?: string;
  city?: string;
  profile_picture?: string;
  // Contact & links
  phone: string;
  linkedin_url: string;
  github_url?: string;
  website_url?: string;
  // Professional
  current_role?: string;
  current_company?: string;
  years_experience?: string;
  education?: string;
  languages?: string;
  // Expertise
  expertise: string;
  mentoring_areas?: string;
  countries_expertise?: string;
  // Mentoring approach
  mentoring_style?: string;
  what_i_offer?: string;
  // Domain & matching
  domain?: string;
  preferred_student_level?: string;
  timezone?: string;
  // Academic background
  own_degree?: string;
  own_field_of_study?: string;
  own_university?: string;
  own_graduation_year?: string;
  created_at: string;
  updated_at: string;
}

// ── Assignment ────────────────────────────────

export interface Assignment {
  id: number;
  student: StudentProfile;
  mentor: MentorProfile;
  assigned_by?: User;
  notes: string;
  is_active: boolean;
  assigned_at: string;
}

// ── Message ───────────────────────────────────

export interface Message {
  id: number;
  sender: User;
  receiver: User;
  body: string;
  attachment?: string;
  timestamp: string;
  is_read: boolean;
}

// ── Workspace ─────────────────────────────────

export type WorkspaceMemberStatus = 'owner' | 'approved' | 'pending' | 'rejected' | 'invited' | 'mentor' | 'mentor_invited' | null;

export interface WorkspaceMentorItem {
  id: number;
  mentor_id: number;
  mentor_name: string;
  mentor_picture: string | null;
  status: 'invited' | 'active';
  invited_at: string;
  joined_at: string | null;
}
export type WorkspacePrivacy = 'public' | 'private' | 'secret';
export type WorkspaceStatus = 'active' | 'winding_down' | 'archived';
export type WorkspaceDegree = 'bachelor' | 'master' | 'phd' | 'exchange' | 'other';

export interface UserSearchResult {
  user_id: number;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
}
export type WorkspaceCategory = 'career_coaching' | 'skill_development' | 'academic' | 'interview_prep' | 'project' | 'personal_growth' | 'networking' | 'other';
export type WorkspaceLevel = 'beginner' | 'intermediate' | 'advanced';
export type WorkspaceGradeDisplay = 'points' | 'percentage' | 'letter';

export interface Workspace {
  id: number;
  slug: string;
  accent_color: string;
  logo_url?: string;
  name: string;
  description: string;
  cover_image_url?: string;
  icon_emoji: string;
  tags: string;
  tags_list: string[];
  announcement: string;
  // Classification
  category: WorkspaceCategory | '';
  level: WorkspaceLevel | '';
  language: string;
  target_country: string;
  target_degree: WorkspaceDegree | '';
  estimated_duration: string;
  // Scheduling
  target_deadline?: string;
  course_start_date?: string;
  course_end_date?: string;
  enrollment_deadline?: string;
  office_hours: string;
  // Upcoming event
  event_title: string;
  event_date?: string;
  event_start_time?: string;
  event_end_time?: string;
  event_description: string;
  event_link: string;
  // Access
  privacy: WorkspacePrivacy;
  max_members?: number;
  auto_accept: boolean;
  allow_self_unenroll: boolean;
  // Engagement
  goal: string;
  welcome_message: string;
  pinned_url: string;
  pinned_url_title: string;
  syllabus_url: string;
  // Feature toggles
  enable_chat: boolean;
  enable_resources: boolean;
  enable_tasks: boolean;
  enable_progress: boolean;
  // Progress & grading
  grade_display: WorkspaceGradeDisplay;
  completion_certificate: boolean;
  min_completion_pct: number;
  // Status
  workspace_status: WorkspaceStatus;
  is_active: boolean;
  // Related
  related_workspace?: number;
  related_workspace_name?: string;
  // Computed
  mentor_id: number;
  mentor_user_id: number;
  mentor_name: string;
  mentor_expertise: string;
  mentor_picture?: string;
  member_count: number;
  resource_count: number;
  my_status: WorkspaceMemberStatus;
  is_full: boolean;
  created_at: string;
}

export interface WorkspaceResource {
  id: number;
  title: string;
  description: string;
  resource_type: 'file' | 'link' | 'note';
  category: string;
  file?: string;
  file_url?: string;
  file_size?: number | null;
  url?: string;
  body?: string;
  posted_by: User;
  is_template: boolean;
  is_hidden: boolean;
  is_featured: boolean;
  created_at: string;
}

export interface WorkspaceMembership {
  id: number;
  student: StudentProfile;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  approved_at?: string;
  last_active?: string | null;
  workspace_task_count: number;
  workspace_task_approved: number;
}

export interface WorkspaceMembers {
  approved: WorkspaceMembership[];
  pending: WorkspaceMembership[];
  invited: WorkspaceMembership[];
  owner: User | null;
}

// ── Marketplace ───────────────────────────────

export interface MarketplaceUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: 'mentor' | 'student';
  date_joined: string;
  bio: string;
  headline: string;
  expertise: string;
  phone: string;
  linkedin_url: string;
  university: string;
  field_of_study: string;
  career_stage?: string;
  profile_picture?: string;
  tags: string[];
  skills: string[];
  is_assigned: boolean;
  profile_completeness: number;
  messaging_status: MessagingStatus;
  // Mentor-specific new fields
  domain?: string;
  preferred_student_level?: string;
  timezone?: string;
}

export interface Conversation {
  user: User;
  last_message: Message | null;
  unread: number;
}

// ── Contact Request ───────────────────────────

export type ContactRequestStatus = 'pending' | 'accepted' | 'declined';

export interface ContactRequestItem {
  id: number;
  user: User;
  status: ContactRequestStatus;
  created_at: string;
}

export interface ContactRequestList {
  incoming: ContactRequestItem[];
  outgoing: ContactRequestItem[];
}

// ── Block ─────────────────────────────────────

export interface BlockStatus {
  blocked_ids: number[];
  blocked_me_ids: number[];
}

// ── Feed ──────────────────────────────────────

export type PostType = 'general' | 'event';
export type ReactionEmoji = 'like' | 'love' | 'clap' | 'fire' | 'celebrate';

export interface FeedPost {
  id: number;
  author: User;
  post_type: PostType;
  title: string;
  body: string;
  image?: string;
  link_url?: string;
  link_title?: string;
  event_date?: string;
  event_location?: string;
  tags: string;
  tags_list: string[];
  allow_comments: boolean;
  allow_reactions: boolean;
  is_pinned: boolean;
  is_hidden: boolean;
  workspace?: number;
  created_at: string;
  updated_at: string;
  my_reaction: ReactionEmoji | null;
  comment_count: number;
  is_bookmarked: boolean;
  comments?: FeedComment[];
}

export interface FeedComment {
  id: number;
  author: User;
  body: string;
  created_at: string;
}

// ── Sessions ──────────────────────────────────

export interface AvailabilitySlot {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export type SessionStatus = 'pending' | 'confirmed' | 'cancelled';

export interface MentorSession {
  id: number;
  mentor: User;
  student: User;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  meeting_link: string;
  status: SessionStatus;
  notes: string;
  created_at: string;
}

// ── Auth ──────────────────────────────────────

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ── Ratings ───────────────────────────────────────────────────────────────

export interface MentorRatingItem {
  id: number;
  rating: number;
  review: string;
  student_name: string;
  student_picture?: string;
  created_at: string;
}

export interface MentorRatingSummary {
  average: number | null;
  count: number;
  my_rating: MentorRatingItem | null;
  reviews: MentorRatingItem[];
}

// ── Workspace Chat ────────────────────────────────────────────────────────

export interface WorkspaceChatChannel {
  id: number;
  name: string;
  description: string;
  channel_type: 'general' | 'announcements' | 'random' | 'custom';
  is_archived: boolean;
  created_at: string;
}

export interface WorkspaceChatReaction {
  id: number;
  emoji: string;
  user: User;
}

export interface WorkspaceChatMessage {
  id: number;
  sender: User;
  body: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  message_type: 'message' | 'announcement';
  is_pinned: boolean;
  reply_to?: {
    id: number;
    body: string;
    sender_name: string;
  } | null;
  reactions: WorkspaceChatReaction[];
  created_at: string;
}

export interface WorkspaceDMMessage {
  id: number;
  sender: User;
  receiver: User;
  body: string;
  attachment_url?: string | null;
  created_at: string;
  is_read: boolean;
}

export interface WorkspaceDMConversation {
  user: User;
  last_message: string;
  last_at: string;
  unread: number;
}

export interface WorkspacePollOption {
  id: number;
  text: string;
  vote_count: number;
  my_vote: boolean;
}

export interface WorkspacePoll {
  id: number;
  author: User;
  question: string;
  options: WorkspacePollOption[];
  allow_multiple: boolean;
  is_closed: boolean;
  total_votes: number;
  created_at: string;
}

// ── WorkspaceEvent ────────────────────────────────────────────────────────

export interface WorkspaceEvent {
  id: number;
  title: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  description: string;
  link: string;
  created_at: string;
}

// ── PersonalTask ──────────────────────────────────────────────────────────

export interface PersonalTask {
  id: number;
  title: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  description?: string;
  reminder_offset?: number | null;
  reminder_sent: boolean;
  is_done: boolean;
  created_at: string;
}

// ── Workspace Task System ─────────────────────────────────────────────────

export type WorkspaceTaskType   = 'assignment' | 'project' | 'resource' | 'quiz';
export type WorkspaceTaskStatus = 'draft' | 'published' | 'archived';
export type SubmissionStatus    = 'not_started' | 'in_progress' | 'submitted' | 'needs_revision' | 'resubmitted' | 'completed';

export interface WorkspaceTaskSection {
  id: number;
  workspace: number;
  title: string;
  description: string;
  color: string;
  order: number;
  created_at: string;
  task_count: number;
}

export interface WorkspaceTaskRubricCriteria {
  id: number;
  title: string;
  description: string;
  max_points: number;
  order: number;
}

export interface WorkspaceTaskRubricScore {
  id: number;
  criteria: WorkspaceTaskRubricCriteria;
  points: number;
  feedback: string;
  updated_at: string;
}

// ── Feature 16: Peer Review ────────────────────────────────────────────────────

export interface PeerReviewScore {
  id: number;
  criteria: WorkspaceTaskRubricCriteria;
  points: number;
  feedback: string;
}

export interface PeerReviewAssignment {
  id: number;
  reviewer_label: string;
  status: 'assigned' | 'submitted';
  assigned_at: string;
  submitted_at: string | null;
  scores: PeerReviewScore[];
  total_score: number;
}

// ── Feature 18: Inline document comments ──────────────────────────────────────

export interface DocumentInlineComment {
  id: number;
  document: number;
  author: User;
  page_number: number;
  x_pct: number;
  y_pct: number;
  body: string;
  parent: number | null;
  is_resolved: boolean;
  created_at: string;
  replies: DocumentInlineComment[];
}

// ── Feature 19: Mention autocomplete ──────────────────────────────────────────

export interface MentionUser {
  id: number;
  username: string;
  display_name: string;
  profile_picture_url?: string;
}

// ── Feature 20: Self-Assessment ────────────────────────────────────────────────

export interface WorkspaceTaskSelfAssessQuestion {
  id: number;
  text: string;
  order: number;
}

export interface WorkspaceTaskSelfAssessResponse {
  id: number;
  question: WorkspaceTaskSelfAssessQuestion;
  rating: number;
}

export interface WorkspaceTaskDeliverable {
  id: number;
  title: string;
  description: string;
  order: number;
}

export interface WorkspaceTaskDeliverableCheck {
  id: number;
  deliverable: WorkspaceTaskDeliverable;
  is_done: boolean;
  done_at: string | null;
}

export interface WorkspaceTaskComment {
  id: number;
  author: User;
  text: string;
  created_at: string;
}

export interface WorkspaceTaskDocument {
  id: number;
  uploaded_by: User;
  title: string;
  file: string;
  file_url: string;
  created_at: string;
  inline_comments?: DocumentInlineComment[];
}

export interface WorkspaceTaskSubmission {
  id: number;
  student: StudentProfile;
  status: SubmissionStatus;
  assigned_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  due_date_override: string | null;
  effective_due_date: string | null;
  is_late: boolean;
  late_override: boolean | null;
  effective_late: boolean;
  checks: WorkspaceTaskDeliverableCheck[];
  comments: WorkspaceTaskComment[];
  documents: WorkspaceTaskDocument[];
  mentor_notes: WorkspaceTaskMentorNote[];
  status_events: WorkspaceTaskStatusEvent[];
  rubric_scores: WorkspaceTaskRubricScore[];
  total_score: number;
  max_score: number;
  peer_reviews: PeerReviewAssignment[];
  peer_avg_score: number | null;
  self_assess_responses: WorkspaceTaskSelfAssessResponse[];
}

export interface WorkspaceTaskSubmissionSummary {
  id: number;
  student: StudentProfile;
  status: SubmissionStatus;
  assigned_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  due_date_override: string | null;
  effective_due_date: string | null;
  is_late: boolean;
  late_override: boolean | null;
  effective_late: boolean;
  checks_done: number;
  checks_total: number;
}

export interface WorkspaceTask {
  id: number;
  workspace: number;
  title: string;
  description: string;
  task_type: WorkspaceTaskType;
  status: WorkspaceTaskStatus;
  due_date: string | null;
  available_from: string | null;
  available_until: string | null;
  peer_visible: boolean;
  is_template: boolean;
  peer_review_enabled: boolean;
  peer_review_count: number;
  late_policy: 'accept' | 'reject' | 'penalty';
  grace_period_hours: number;
  section: number | null;
  prerequisite_ids: number[];
  assigned_member_ids: number[];
  rubric_criteria: WorkspaceTaskRubricCriteria[];
  self_assess_questions: WorkspaceTaskSelfAssessQuestion[];
  is_locked?: boolean;
  my_submission_status?: SubmissionStatus | null;
  created_by: User | null;
  created_at: string;
  updated_at: string;
  deliverables: WorkspaceTaskDeliverable[];
  submission_count: number;
  completed_count: number;
  submitted_count: number;
}

export interface WorkspaceTaskMentorNote {
  id: number;
  author: User;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceTaskStatusEvent {
  id: number;
  from_status: string;
  to_status: string;
  actor: User | null;
  note: string;
  created_at: string;
}

export interface TaskReportRow {
  submission_id: number;
  student_id: number;
  student_name: string;
  status: SubmissionStatus;
  is_overdue: boolean;
  checks_done: number;
  checks_total: number;
  submitted_at: string | null;
  completed_at: string | null;
}

export interface TaskReport {
  task_id: number;
  title: string;
  due_date: string | null;
  counts: {
    total: number;
    not_started: number;
    in_progress: number;
    submitted: number;
    needs_revision: number;
    completed: number;
    overdue: number;
    completion_pct: number;
  };
  rows: TaskReportRow[];
}

// ── Gradebook ─────────────────────────────────────────────────────────────────

export interface GradebookTask {
  id: number;
  title: string;
  due_date: string | null;
  max_score: number;
}

export interface GradebookCellScore {
  status: SubmissionStatus;
  score: number;
  submitted_at: string | null;
}

export interface GradebookRow {
  student_id: number;
  student_name: string;
  student_picture: string | null;
  scores: Record<number, GradebookCellScore | null>;
}

export interface Gradebook {
  tasks: GradebookTask[];
  rows: GradebookRow[];
}

// ── Mentor Analytics ──────────────────────────────────────────────────────────

export interface MentorAnalyticsSummary {
  total_students: number;
  total_tasks: number;
  overall_completion_pct: number;
  active_this_week: number;
  workspaces: { id: number; name: string; slug: string }[];
}
export interface AnalyticsStudentBar {
  student_id: number; student_name: string; student_picture: string | null;
  not_started: number; in_progress: number; submitted: number;
  needs_revision: number; resubmitted: number; completed: number; total: number;
}
export interface AnalyticsStudentMatrix {
  student_id: number; student_name: string; student_picture: string | null;
  workspaces: Record<string, { pct: number; completed: number; total: number }>;
}
export interface AnalyticsLeaderboardRow {
  rank: number; student_id: number; student_name: string; student_picture: string | null;
  total_score: number; max_score: number; completed_count: number; total_tasks: number;
}
export interface AnalyticsAtRiskRow {
  student_id: number; student_name: string; student_picture: string | null;
  days_since_last_activity: number; in_progress_count: number; workspace_name: string;
}
export interface AnalyticsTaskBreakdown {
  task_id: number; task_title: string; workspace_name: string;
  not_started: number; in_progress: number; submitted: number;
  needs_revision: number; resubmitted: number; completed: number; total: number;
}
export interface AnalyticsProblemTask {
  task_id: number; task_title: string; workspace_name: string;
  needs_revision_count: number; total: number; revision_pct: number;
}
export interface AnalyticsLowEngagement {
  task_id: number; task_title: string; workspace_name: string;
  started_count: number; total_members: number; engagement_pct: number;
}
export interface AnalyticsSubmissionLogRow {
  student_name: string; student_picture: string | null;
  task_title: string; workspace_name: string;
  status: SubmissionStatus; score: number | null; updated_at: string;
}
export interface MentorAnalytics {
  summary: MentorAnalyticsSummary;
  status_distribution: { status: SubmissionStatus; count: number }[];
  workspace_completion: {
    workspace_id: number; workspace_name: string; workspace_slug: string;
    total: number; completed: number; completion_pct: number;
  }[];
  student_bars: AnalyticsStudentBar[];
  student_matrix: AnalyticsStudentMatrix[];
  leaderboard: AnalyticsLeaderboardRow[];
  at_risk: AnalyticsAtRiskRow[];
  task_breakdown: AnalyticsTaskBreakdown[];
  problem_tasks: AnalyticsProblemTask[];
  low_engagement: AnalyticsLowEngagement[];
  submission_log: AnalyticsSubmissionLogRow[];
}
export interface MentorAnalyticsTrend {
  submission_trend: { date: string; count: number }[];
  workspace_activity: {
    workspace_name: string;
    workspace_slug: string;
    data: { date: string; count: number }[];
  }[];
}

export interface ReviewQueueItem {
  submission_id: number;
  student_id: number;
  student_name: string;
  student_picture: string | null;
  task_id: number;
  task_title: string;
  workspace_id: number;
  workspace_name: string;
  workspace_slug: string;
  submitted_at: string | null;
}

export interface UpcomingDeadline {
  task_id: number;
  task_title: string;
  workspace_id: number;
  workspace_name: string;
  workspace_slug: string;
  due_date: string;
  days_until_due: number;
  total: number;
  not_started: number;
  in_progress: number;
  submitted: number;
  needs_revision: number;
  resubmitted: number;
  completed: number;
}

// ── Onboarding ──────────────────────────────────

export interface WorkspaceOnboardingQuestion {
  id: number;
  question_text: string;
  order: number;
  required: boolean;
}

export interface WorkspaceOnboardingAnswer {
  id?: number;
  question: number;
  answer_text: string;
  last_updated?: string;
}

export interface WorkspaceOnboardingSubmission {
  student_id: number;
  student_name: string;
  student_picture?: string | null;
  submitted_at?: string | null;
  answers: WorkspaceOnboardingAnswer[];
}
