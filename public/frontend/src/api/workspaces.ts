import apiClient from './apiClient';
import type {
  Workspace, WorkspaceMembers, WorkspaceResource, WorkspaceChatMessage,
  WorkspaceChatChannel, WorkspaceDMMessage, WorkspaceDMConversation,
  WorkspacePoll, WorkspaceEvent, FeedPost,
  WorkspaceTask, WorkspaceTaskSubmission, WorkspaceTaskSubmissionSummary,
  WorkspaceTaskComment, WorkspaceTaskDocument, TaskReport,
  WorkspaceTaskMentorNote, WorkspaceTaskSection, WorkspaceTaskRubricScore,
  Gradebook, PeerReviewAssignment, DocumentInlineComment, MentionUser,
  MentorAnalytics, MentorAnalyticsTrend, ReviewQueueItem, UpcomingDeadline,
  UserSearchResult, WorkspaceMentorItem,
} from '../types';

export interface CreateTaskPayload {
  title: string;
  description?: string;
  task_type?: string;
  status?: 'draft' | 'archived';
  due_date?: string | null;
  available_from?: string | null;
  available_until?: string | null;
  peer_visible?: boolean;
  section?: number | null;
  assigned_member_ids?: number[] | 'all';
  deliverables?: { title: string; description?: string; order: number }[];
  rubric_criteria?: { title: string; description?: string; max_points: number; order: number }[];
  prerequisite_ids?: number[];
  // Feature 16
  peer_review_enabled?: boolean;
  peer_review_count?: number;
  // Feature 17
  late_policy?: 'accept' | 'reject' | 'penalty';
  grace_period_hours?: number;
  // Feature 20
  self_assess_questions?: { text: string; order: number }[];
}

export const workspacesApi = {
  list: () =>
    apiClient.get<Workspace[]>('/api/workspaces/'),

  get: (id: number) =>
    apiClient.get<Workspace>(`/api/workspaces/${id}/`),

  getBySlug: (slug: string) =>
    apiClient.get<Workspace>(`/api/workspaces/by-slug/${slug}/`),

  create: (fd: FormData) =>
    apiClient.postForm<Workspace>('/api/workspaces/', fd),

  update: (id: number, fd: FormData) =>
    apiClient.patchForm<Workspace>(`/api/workspaces/${id}/`, fd),

  delete: (id: number) =>
    apiClient.delete(`/api/workspaces/${id}/`),

  join: (id: number) =>
    apiClient.post(`/api/workspaces/${id}/join/`, {}),

  cancelJoin: (id: number) =>
    apiClient.delete(`/api/workspaces/${id}/join/cancel/`),

  leave: (id: number) =>
    apiClient.delete(`/api/workspaces/${id}/leave/`),

  joinByInvite: (token: string) =>
    apiClient.post<Workspace>('/api/workspaces/join-invite/', { token }),

  searchUsers: (id: number, q: string) =>
    apiClient.get<UserSearchResult[]>(`/api/workspaces/${id}/search-users/?q=${encodeURIComponent(q)}`),

  directInvite: (id: number, userId: number) =>
    apiClient.post(`/api/workspaces/${id}/members/direct-invite/`, { user_id: userId }),

  acceptInvite: (id: number) =>
    apiClient.post<Workspace>(`/api/workspaces/${id}/accept-invite/`, {}),

  declineInvite: (id: number) =>
    apiClient.delete(`/api/workspaces/${id}/accept-invite/`),

  getMembers: (id: number) =>
    apiClient.get<WorkspaceMembers>(`/api/workspaces/${id}/members/`),

  memberAction: (workspaceId: number, membershipId: number, action: 'approve' | 'reject' | 'remove') =>
    apiClient.post(`/api/workspaces/${workspaceId}/members/${membershipId}/`, { action }),

  memberBulkAction: (workspaceId: number, action: 'approve' | 'reject', ids: number[]) =>
    apiClient.post(`/api/workspaces/${workspaceId}/members/bulk/`, { action, ids }),

  getResources: (id: number) =>
    apiClient.get<WorkspaceResource[]>(`/api/workspaces/${id}/resources/`),

  addResource: (id: number, data: FormData | object) =>
    apiClient.post<WorkspaceResource>(`/api/workspaces/${id}/resources/`, data),

  deleteResource: (workspaceId: number, resourceId: number) =>
    apiClient.delete(`/api/workspaces/${workspaceId}/resources/${resourceId}/`),

  updateResource: (workspaceId: number, resourceId: number, data: Record<string, unknown>) =>
    apiClient.patch(`/api/workspaces/${workspaceId}/resources/${resourceId}/`, data),

  updateAnnouncement: (id: number, announcement: string) =>
    apiClient.patch<Workspace>(`/api/workspaces/${id}/`, { announcement }),

  updateWelcomeMessage: (id: number, welcome_message: string) =>
    apiClient.patch<Workspace>(`/api/workspaces/${id}/`, { welcome_message }),

  // ── Task Sections (Feature 12) ────────────────────────────────────────

  getSections: (workspaceId: number) =>
    apiClient.get<WorkspaceTaskSection[]>(`/api/workspaces/${workspaceId}/sections/`),

  createSection: (workspaceId: number, data: { title: string; description?: string; color?: string; order?: number }) =>
    apiClient.post<WorkspaceTaskSection>(`/api/workspaces/${workspaceId}/sections/`, data),

  updateSection: (workspaceId: number, sectionId: number, data: Partial<WorkspaceTaskSection>) =>
    apiClient.patch<WorkspaceTaskSection>(`/api/workspaces/${workspaceId}/sections/${sectionId}/`, data),

  deleteSection: (workspaceId: number, sectionId: number) =>
    apiClient.delete(`/api/workspaces/${workspaceId}/sections/${sectionId}/`),

  // ── Task System ───────────────────────────────────────────────────────

  getTasks: (workspaceId: number) =>
    apiClient.get<WorkspaceTask[]>(`/api/workspaces/${workspaceId}/tasks/`),

  createTask: (workspaceId: number, payload: CreateTaskPayload) =>
    apiClient.post<WorkspaceTask>(`/api/workspaces/${workspaceId}/tasks/`, payload),

  getTask: (workspaceId: number, taskId: number) =>
    apiClient.get<WorkspaceTask>(`/api/workspaces/${workspaceId}/tasks/${taskId}/`),

  updateTask: (workspaceId: number, taskId: number, payload: Partial<CreateTaskPayload>) =>
    apiClient.patch<WorkspaceTask>(`/api/workspaces/${workspaceId}/tasks/${taskId}/`, payload),

  deleteTask: (workspaceId: number, taskId: number) =>
    apiClient.delete(`/api/workspaces/${workspaceId}/tasks/${taskId}/`),

  publishTask: (workspaceId: number, taskId: number, assignTo: 'all' | number[]) =>
    apiClient.post<WorkspaceTask>(`/api/workspaces/${workspaceId}/tasks/${taskId}/publish/`, { assign_to: assignTo }),

  assignTask: (workspaceId: number, taskId: number, assignTo: 'all' | number[]) =>
    apiClient.post<{ assigned: number }>(`/api/workspaces/${workspaceId}/tasks/${taskId}/assign/`, { assign_to: assignTo }),

  // Submissions (mentor)
  getSubmissions: (workspaceId: number, taskId: number, filterStatus?: string) =>
    apiClient.get<WorkspaceTaskSubmissionSummary[]>(
      `/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/` + (filterStatus ? `?status=${filterStatus}` : '')
    ),

  getSubmission: (workspaceId: number, taskId: number, submissionId: number) =>
    apiClient.get<WorkspaceTaskSubmission>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/`),

  reviewSubmission: (workspaceId: number, taskId: number, submissionId: number, status: 'completed' | 'needs_revision') =>
    apiClient.patch<WorkspaceTaskSubmission>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/`, { status }),

  // My submission (student)
  getMySubmission: (workspaceId: number, taskId: number) =>
    apiClient.get<WorkspaceTaskSubmission>(`/api/workspaces/${workspaceId}/tasks/${taskId}/my-submission/`),

  startMySubmission: (workspaceId: number, taskId: number) =>
    apiClient.post<WorkspaceTaskSubmission>(`/api/workspaces/${workspaceId}/tasks/${taskId}/my-submission/start/`, {}),

  submitMySubmission: (workspaceId: number, taskId: number, note?: string, self_assess_responses?: { question_id: number; rating: number }[]) =>
    apiClient.post<WorkspaceTaskSubmission>(`/api/workspaces/${workspaceId}/tasks/${taskId}/my-submission/submit/`, { note: note ?? '', self_assess_responses: self_assess_responses ?? [] }),

  resubmitMySubmission: (workspaceId: number, taskId: number, note?: string, self_assess_responses?: { question_id: number; rating: number }[]) =>
    apiClient.post<WorkspaceTaskSubmission>(`/api/workspaces/${workspaceId}/tasks/${taskId}/my-submission/resubmit/`, { note: note ?? '', self_assess_responses: self_assess_responses ?? [] }),

  recallMySubmission: (workspaceId: number, taskId: number) =>
    apiClient.post<WorkspaceTaskSubmission>(`/api/workspaces/${workspaceId}/tasks/${taskId}/my-submission/recall/`, {}),

  reopenSubmission: (workspaceId: number, taskId: number, submissionId: number) =>
    apiClient.post<WorkspaceTaskSubmission>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/reopen/`, {}),

  undoReviewSubmission: (workspaceId: number, taskId: number, submissionId: number) =>
    apiClient.post<WorkspaceTaskSubmission>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/undo-review/`, {}),

  toggleDeliverableCheck: (workspaceId: number, taskId: number, checkId: number) =>
    apiClient.patch(`/api/workspaces/${workspaceId}/tasks/${taskId}/my-submission/checks/${checkId}/`, {}),

  // Comments
  addComment: (workspaceId: number, taskId: number, submissionId: number, text: string) =>
    apiClient.post<WorkspaceTaskComment>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/comments/`, { text }),

  // Documents
  uploadDocument: (workspaceId: number, taskId: number, submissionId: number, file: File, title: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    return apiClient.postForm<WorkspaceTaskDocument>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/documents/`, fd);
  },

  deleteDocument: (workspaceId: number, taskId: number, submissionId: number, docId: number) =>
    apiClient.delete(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/documents/${docId}/`),

  // Reports
  getTaskReport: (workspaceId: number, taskId: number) =>
    apiClient.get<TaskReport>(`/api/workspaces/${workspaceId}/tasks/${taskId}/report/`),

  exportTaskReport: (workspaceId: number, taskId: number) =>
    `/api/workspaces/${workspaceId}/tasks/${taskId}/report/export/`,

  // Templates
  getTaskTemplates: (workspaceId: number) =>
    apiClient.get<WorkspaceTask[]>(`/api/workspaces/${workspaceId}/task-templates/`),

  saveAsTemplate: (workspaceId: number, taskId: number, title?: string) =>
    apiClient.post<WorkspaceTask>(`/api/workspaces/${workspaceId}/tasks/${taskId}/save-as-template/`, { title }),

  createFromTemplate: (workspaceId: number, templateId: number, overrides?: { title?: string; due_date?: string }) =>
    apiClient.post<WorkspaceTask>(`/api/workspaces/${workspaceId}/tasks/${templateId}/from-template/`, overrides ?? {}),

  deleteTemplate: (workspaceId: number, templateId: number) =>
    apiClient.delete(`/api/workspaces/${workspaceId}/task-templates/${templateId}/`),

  // Task Duplication (Feature 9)
  duplicateTask: (workspaceId: number, taskId: number) =>
    apiClient.post<WorkspaceTask>(`/api/workspaces/${workspaceId}/tasks/${taskId}/duplicate/`, {}),

  // Bulk Review (Feature 10)
  bulkReview: (workspaceId: number, taskId: number, submissionIds: number[], reviewStatus: 'completed' | 'needs_revision') =>
    apiClient.post<{ updated: number }>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/bulk-review/`, {
      submission_ids: submissionIds,
      status: reviewStatus,
    }),

  // Per-submission due date override
  setSubmissionDueDate: (workspaceId: number, taskId: number, submissionId: number, due_date_override: string | null) =>
    apiClient.patch<WorkspaceTaskSubmission>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/`, { due_date_override }),

  // Private Mentor Notes
  getNotes: (workspaceId: number, taskId: number, submissionId: number) =>
    apiClient.get<WorkspaceTaskMentorNote[]>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/notes/`),

  addNote: (workspaceId: number, taskId: number, submissionId: number, text: string) =>
    apiClient.post<WorkspaceTaskMentorNote>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/notes/`, { text }),

  updateNote: (workspaceId: number, taskId: number, submissionId: number, noteId: number, text: string) =>
    apiClient.patch<WorkspaceTaskMentorNote>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/notes/${noteId}/`, { text }),

  deleteNote: (workspaceId: number, taskId: number, submissionId: number, noteId: number) =>
    apiClient.delete(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/notes/${noteId}/`),

  // Rubric Scores (Feature 13)
  getRubricScores: (workspaceId: number, taskId: number, submissionId: number) =>
    apiClient.get<WorkspaceTaskRubricScore[]>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/rubric/`),

  setRubricScores: (workspaceId: number, taskId: number, submissionId: number, scores: { criteria_id: number; points: number; feedback?: string }[]) =>
    apiClient.post<WorkspaceTaskRubricScore[]>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/rubric/`, scores),

  // Gradebook (Feature 14)
  getGradebook: (workspaceId: number) =>
    apiClient.get<Gradebook>(`/api/workspaces/${workspaceId}/gradebook/`),

  // ── Chat (legacy) ─────────────────────────────────────────────────────
  getChatMessages: (id: number) =>
    apiClient.get<WorkspaceChatMessage[]>(`/api/workspaces/${id}/chat/`),

  sendChatMessage: (id: number, body: string) =>
    apiClient.post<WorkspaceChatMessage>(`/api/workspaces/${id}/chat/`, { body }),

  getEvents: (id: number) =>
    apiClient.get<WorkspaceEvent[]>(`/api/workspaces/${id}/events/`),

  createEvent: (id: number, data: Partial<WorkspaceEvent>) =>
    apiClient.post<WorkspaceEvent>(`/api/workspaces/${id}/events/`, data),

  updateEvent: (id: number, eid: number, data: Partial<WorkspaceEvent>) =>
    apiClient.patch<WorkspaceEvent>(`/api/workspaces/${id}/events/${eid}/`, data),

  deleteEvent: (id: number, eid: number) =>
    apiClient.delete(`/api/workspaces/${id}/events/${eid}/`),

  listFeed: (id: number) =>
    apiClient.get<FeedPost[]>(`/api/workspaces/${id}/feed/`),

  createPost: (id: number, fd: FormData) =>
    apiClient.postForm<FeedPost>(`/api/workspaces/${id}/feed/`, fd),

  updatePost: (id: number, postId: number, fd: FormData) =>
    apiClient.patchForm<FeedPost>(`/api/workspaces/${id}/feed/${postId}/`, fd),

  pinPost: (id: number, postId: number, is_pinned: boolean) =>
    apiClient.patch<FeedPost>(`/api/workspaces/${id}/feed/${postId}/`, { is_pinned }),

  deletePost: (id: number, postId: number) =>
    apiClient.delete(`/api/workspaces/${id}/feed/${postId}/`),

  // ── Channels ──────────────────────────────────────────────────────────
  getChannels: (id: number) =>
    apiClient.get<WorkspaceChatChannel[]>(`/api/workspaces/${id}/channels/`),

  createChannel: (id: number, data: { name: string; description?: string }) =>
    apiClient.post<WorkspaceChatChannel>(`/api/workspaces/${id}/channels/`, data),

  updateChannel: (id: number, cid: number, data: object) =>
    apiClient.patch<WorkspaceChatChannel>(`/api/workspaces/${id}/channels/${cid}/`, data),

  deleteChannel: (id: number, cid: number) =>
    apiClient.delete(`/api/workspaces/${id}/channels/${cid}/`),

  // ── Channel messages ──────────────────────────────────────────────────
  getChannelMessages: (id: number, cid: number) =>
    apiClient.get<WorkspaceChatMessage[]>(`/api/workspaces/${id}/channels/${cid}/messages/`),

  sendChannelMessage: (id: number, cid: number, fd: FormData) =>
    apiClient.postForm<WorkspaceChatMessage>(`/api/workspaces/${id}/channels/${cid}/messages/`, fd),

  pinMessage: (id: number, cid: number, mid: number, is_pinned: boolean) =>
    apiClient.patch<WorkspaceChatMessage>(`/api/workspaces/${id}/channels/${cid}/messages/${mid}/`, { is_pinned }),

  deleteChannelMessage: (id: number, cid: number, mid: number) =>
    apiClient.delete(`/api/workspaces/${id}/channels/${cid}/messages/${mid}/`),

  editChannelMessage: (id: number, cid: number, mid: number, body: string) =>
    apiClient.patch<WorkspaceChatMessage>(`/api/workspaces/${id}/channels/${cid}/messages/${mid}/`, { body }),

  reactToMessage: (id: number, cid: number, mid: number, emoji: string) =>
    apiClient.post<{ message_id: number; reactions: import('../types').WorkspaceChatReaction[] }>(`/api/workspaces/${id}/channels/${cid}/messages/${mid}/react/`, { emoji }),

  // ── Workspace DMs ─────────────────────────────────────────────────────
  getDMConversations: (id: number) =>
    apiClient.get<WorkspaceDMConversation[]>(`/api/workspaces/${id}/dms/`),

  getDMMessages: (id: number, userId: number) =>
    apiClient.get<WorkspaceDMMessage[]>(`/api/workspaces/${id}/dms/${userId}/`),

  sendDMMessage: (id: number, userId: number, fd: FormData) =>
    apiClient.postForm<WorkspaceDMMessage>(`/api/workspaces/${id}/dms/${userId}/`, fd),

  editDMMessage: (id: number, userId: number, mid: number, body: string) =>
    apiClient.patch<WorkspaceDMMessage>(`/api/workspaces/${id}/dms/${userId}/${mid}/`, { body }),

  deleteDMMessage: (id: number, userId: number, mid: number) =>
    apiClient.delete(`/api/workspaces/${id}/dms/${userId}/${mid}/`),

  // ── Polls ─────────────────────────────────────────────────────────────
  getPolls: (id: number) =>
    apiClient.get<WorkspacePoll[]>(`/api/workspaces/${id}/polls/`),

  createPoll: (id: number, data: { question: string; options: string[]; allow_multiple?: boolean }) =>
    apiClient.post<WorkspacePoll>(`/api/workspaces/${id}/polls/`, data),

  votePoll: (id: number, pid: number, option_id: number) =>
    apiClient.post<WorkspacePoll>(`/api/workspaces/${id}/polls/${pid}/vote/`, { option_id }),

  closePoll: (id: number, pid: number) =>
    apiClient.patch<WorkspacePoll>(`/api/workspaces/${id}/polls/${pid}/`, { is_closed: true }),

  deletePoll: (id: number, pid: number) =>
    apiClient.delete(`/api/workspaces/${id}/polls/${pid}/`),

  // ── Peer Review (Feature 16) ──────────────────────────────────────────
  triggerPeerReview: (workspaceId: number, taskId: number) =>
    apiClient.post<{ assigned: number }>(`/api/workspaces/${workspaceId}/tasks/${taskId}/peer-review/trigger/`, {}),

  getMyPeerReviews: (workspaceId: number, taskId: number) =>
    apiClient.get<PeerReviewAssignment[]>(`/api/workspaces/${workspaceId}/tasks/${taskId}/my-peer-reviews/`),

  submitPeerReview: (workspaceId: number, taskId: number, prId: number, scores: { criteria_id: number; points: number; feedback?: string }[]) =>
    apiClient.post<PeerReviewAssignment>(`/api/workspaces/${workspaceId}/tasks/${taskId}/peer-reviews/${prId}/submit/`, { scores }),

  // ── Late Override (Feature 17) ────────────────────────────────────────
  setLateOverride: (workspaceId: number, taskId: number, submissionId: number, late_override: boolean | null) =>
    apiClient.patch<WorkspaceTaskSubmission>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/late-override/`, { late_override }),

  // ── Inline Document Comments (Feature 18) ────────────────────────────
  getDocInlineComments: (workspaceId: number, taskId: number, submissionId: number, docId: number) =>
    apiClient.get<DocumentInlineComment[]>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/documents/${docId}/comments/`),

  addDocInlineComment: (workspaceId: number, taskId: number, submissionId: number, docId: number, data: { page_number: number; x_pct: number; y_pct: number; body: string; parent?: number }) =>
    apiClient.post<DocumentInlineComment>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/documents/${docId}/comments/`, data),

  updateDocInlineComment: (workspaceId: number, taskId: number, submissionId: number, docId: number, commentId: number, data: { body?: string; is_resolved?: boolean }) =>
    apiClient.patch<DocumentInlineComment>(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/documents/${docId}/comments/${commentId}/`, data),

  deleteDocInlineComment: (workspaceId: number, taskId: number, submissionId: number, docId: number, commentId: number) =>
    apiClient.delete(`/api/workspaces/${workspaceId}/tasks/${taskId}/submissions/${submissionId}/documents/${docId}/comments/${commentId}/`),

  // ── Mention Autocomplete (Feature 19) ────────────────────────────────
  getMentionAutocomplete: (workspaceId: number, q: string) =>
    apiClient.get<MentionUser[]>(`/api/workspaces/${workspaceId}/mention-autocomplete/?q=${encodeURIComponent(q)}`),

  // ── Analytics ─────────────────────────────────────────────────────────────
  getAnalytics: (workspaceId?: number) => {
    const qs = workspaceId ? `?workspace=${workspaceId}` : '';
    return apiClient.get<MentorAnalytics>(`/api/mentor/analytics/${qs}`);
  },

  getAnalyticsTrend: (workspaceId?: number, range = '30d') => {
    const params = new URLSearchParams({ range });
    if (workspaceId) params.set('workspace', String(workspaceId));
    return apiClient.get<MentorAnalyticsTrend>(`/api/mentor/analytics/trend/?${params}`);
  },

  getReviewQueue: () => apiClient.get<ReviewQueueItem[]>('/api/mentor/review-queue/'),
  getUpcomingDeadlines: () => apiClient.get<UpcomingDeadline[]>('/api/mentor/upcoming-deadlines/'),

  // ── Mentor Guest (Observer) ───────────────────────────────────────────────
  searchMentors:            (id: number, q: string) =>
    apiClient.get<UserSearchResult[]>(`/api/workspaces/${id}/search-mentors/?q=${encodeURIComponent(q)}`),
  getMentors:          (id: number) =>
    apiClient.get<WorkspaceMentorItem[]>(`/api/workspaces/${id}/mentors/`),
  inviteMentor:        (id: number, userId: number) =>
    apiClient.post(`/api/workspaces/${id}/mentors/invite/`, { user_id: userId }),
  acceptMentorInvite:  (id: number) =>
    apiClient.post<Workspace>(`/api/workspaces/${id}/mentors/accept/`, {}),
  declineMentorInvite: (id: number) =>
    apiClient.delete(`/api/workspaces/${id}/mentors/accept/`),
  removeMentor:        (id: number, guestId: number) =>
    apiClient.delete(`/api/workspaces/${id}/mentors/${guestId}/`),
};
