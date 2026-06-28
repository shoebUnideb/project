import apiClient, { tokens } from '../../api/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InternalRole {
  id: number;
  name: string;
  level: number;
  can_manage_members: boolean;
  can_view_all_contributions: boolean;
  can_approve_checkins: boolean;
  can_upload_agreements: boolean;
  member_count: number;
  created_at: string;
}

export interface Department {
  id: number;
  name: string;
  description: string;
  head_id: number | null;
  head_name: string | null;
  parent_id: number | null;
  parent_name: string | null;
  member_count: number;
  sub_department_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeptStats {
  total_departments: number;
  active_departments: number;
  inactive_departments: number;
  total_employees: number;
  department_heads: number;
  avg_team_size: number;
  new_this_month: number;
  new_employees_this_month: number;
}

export interface OrgMemberUser {
  id: number;
  username: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  display_name: string;
  last_login: string | null;
  member_status: string | null;
}

export interface OrgMemberLite {
  id: number;
  display_name: string;
  profile_picture: string | null;
}

export interface OrgMember {
  id: number;
  user: OrgMemberUser;
  role: InternalRole;
  status: 'active' | 'inactive' | 'suspended';
  joined_date: string;
  approved_by: OrgMemberUser | null;
  notes: string;
  department_name: string | null;
  employee_id: string;
}

export interface MemberStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  total_roles: number;
  admins: number;
}

export interface OrgAccessRequest {
  id: number;
  user: number;
  user_display_name: string;
  user_username: string;
  user_email: string;
  user_avatar: string | null;
  requested_role: number | null;
  role_name: string | null;
  department: number | null;
  department_name: string | null;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMemberProfile {
  id: number;
  user: OrgMemberUser;
  role_name: string;
  status: string;
  joined_date: string;
  employee_id: string;
  skills: string[];
  emergency_contact_name: string;
  emergency_contact_phone: string;
  profile_completion_pct: number;
  notes: string;
  department_name: string | null;
  buddy: OrgMemberLite | null;
  manager: OrgMemberLite | null;
}

// ── Onboarding Template Types ─────────────────────────────────────────────────

export type TaskType = 'info' | 'form' | 'upload' | 'approval' | 'meeting';
export type AssigneeType = 'new_hire' | 'manager' | 'buddy' | 'hr' | 'it' | 'dept_admin';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'blocked';
export type OnboardingStatus = 'pending' | 'active' | 'paused' | 'completed' | 'archived';
export type FormFieldType = 'text' | 'textarea' | 'choice' | 'boolean' | 'date' | 'number';

export interface TemplateFormField {
  id: number;
  question: string;
  field_type: FormFieldType;
  options: string[];
  required: boolean;
  order: number;
}

export interface TaskFormField {
  id: number;
  question: string;
  field_type: FormFieldType;
  options: string[];
  required: boolean;
  order: number;
  response: string | null;
}

export interface TaskTemplateItem {
  id: number;
  title: string;
  description: string;
  task_type: TaskType;
  phase: string;
  content_url: string;
  content_body: string;
  content_file_url: string | null;
  order: number;
  due_offset_days: number;
  required: boolean;
  approval_required: boolean;
  assignee_type: AssigneeType;
  form_fields: TemplateFormField[];
}

export interface OnboardingTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  department_id: number | null;
  department_name: string | null;
  visible_to: string;
  assignable_by: string;
  task_approval_enabled: boolean;
  due_date_policy: string;
  is_active: boolean;
  task_count: number;
  used_in_count: number;
  tasks: TaskTemplateItem[];
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInstance {
  id: number;
  title: string;
  description: string;
  task_type: TaskType;
  phase: string;
  content_url: string;
  content_body: string;
  content_file_url: string | null;
  required: boolean;
  approval_required: boolean;
  due_date: string | null;
  status: TaskStatus;
  completed_at: string | null;
  attachment_url: string | null;
  notes: string;
  created_at: string;
  form_fields: TaskFormField[];
}

export interface OnboardingInstance {
  id: number;
  user: OrgMemberUser;
  template_name: string | null;
  status: OnboardingStatus;
  start_date: string;
  due_date: string | null;
  welcome_message: string;
  completed_at: string | null;
  progress_pct: number;
  buddy_name: string | null;
  manager_name: string | null;
  assigned_by_name: string | null;
  tasks: TaskInstance[];
  created_at: string;
}

export interface TaskComment {
  id: number;
  author_name: string;
  author_picture: string | null;
  body: string;
  created_at: string;
  is_mine: boolean;
}

export interface OnboardingStats {
  total: number;
  pending: number;
  active: number;
  paused: number;
  completed: number;
  archived: number;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const orgApi = {
  // Roles
  getRoles: () =>
    apiClient.get<InternalRole[]>('/api/org/roles/'),
  createRole: (data: Partial<InternalRole>) =>
    apiClient.post<InternalRole>('/api/org/roles/', data),
  updateRole: (id: number, data: Partial<InternalRole>) =>
    apiClient.patch<InternalRole>(`/api/org/roles/${id}/`, data),
  deleteRole: (id: number) =>
    apiClient.delete(`/api/org/roles/${id}/`),

  // Departments
  getDepartmentStats: () =>
    apiClient.get<DeptStats>('/api/org/departments/stats/'),
  getDepartments: () =>
    apiClient.get<Department[]>('/api/org/departments/'),
  createDepartment: (data: { name: string; description?: string; parent_id?: number | null; head_id?: number | null }) =>
    apiClient.post<Department>('/api/org/departments/', data),
  updateDepartment: (id: number, data: { name?: string; description?: string; parent_id?: number | null; head_id?: number | null; is_active?: boolean }) =>
    apiClient.patch<Department>(`/api/org/departments/${id}/`, data),
  deleteDepartment: (id: number) =>
    apiClient.delete(`/api/org/departments/${id}/`),

  // Members
  getMembers: (params?: { deptId?: number; search?: string; role?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.deptId)  qs.set('dept', String(params.deptId));
    if (params?.search)  qs.set('search', params.search);
    if (params?.role)    qs.set('role', String(params.role));
    if (params?.status)  qs.set('status', params.status);
    const q = qs.toString();
    return apiClient.get<OrgMember[]>(`/api/org/members/${q ? `?${q}` : ''}`);
  },
  exportMembers: async () => {
    const res = await fetch('/api/org/members/export/', {
      headers: { 'Authorization': `Bearer ${tokens.getAccess()}` },
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'members.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
  grantAccess: (userId: number, roleId: number, notes?: string, departmentId?: number | null) =>
    apiClient.post<OrgMember>('/api/org/members/', {
      user_id: userId, role_id: roleId, notes,
      ...(departmentId != null ? { department_id: departmentId } : {}),
    }),
  updateMember: (id: number, data: { role_id?: number; status?: string; notes?: string; department_id?: number | null }) =>
    apiClient.patch<OrgMember>(`/api/org/members/${id}/`, data),
  revokeAccess: (id: number) =>
    apiClient.delete(`/api/org/members/${id}/`),

  // Member profile
  getMemberProfile: (id: number) =>
    apiClient.get<OrgMemberProfile>(`/api/org/members/${id}/profile/`),
  updateMemberProfile: (id: number, data: Partial<{
    employee_id: string;
    skills: string[];
    emergency_contact_name: string;
    emergency_contact_phone: string;
    notes: string;
    department_id: number | null;
    buddy_id: number | null;
    manager_id: number | null;
  }>) =>
    apiClient.patch<OrgMemberProfile>(`/api/org/members/${id}/profile/`, data),

  // Member Fingerprint
  getMemberTraining: (memberId: number) =>
    apiClient.get<TrainingEnrollment[]>(`/api/org/members/${memberId}/training/`),

  // Current user
  getMe: () =>
    apiClient.get<OrgMember>('/api/org/me/'),

  // Onboarding Templates
  getTemplates: () =>
    apiClient.get<OnboardingTemplate[]>('/api/org/templates/'),
  createTemplate: (data: { name: string; description?: string; category?: string; department_id?: number | null; is_active?: boolean; visible_to?: string; assignable_by?: string; task_approval_enabled?: boolean; due_date_policy?: string }) =>
    apiClient.post<OnboardingTemplate>('/api/org/templates/', data),
  updateTemplate: (id: number, data: Partial<Pick<OnboardingTemplate, 'name' | 'description' | 'category' | 'department_id' | 'is_active' | 'visible_to' | 'assignable_by' | 'task_approval_enabled' | 'due_date_policy'>>) =>
    apiClient.patch<OnboardingTemplate>(`/api/org/templates/${id}/`, data),
  deleteTemplate: (id: number) =>
    apiClient.delete(`/api/org/templates/${id}/`),
  cloneTemplate: (id: number) =>
    apiClient.post<OnboardingTemplate>(`/api/org/templates/${id}/clone/`, {}),
  importTemplate: (data: object) =>
    apiClient.post<OnboardingTemplate>('/api/org/templates/import/', data),
  addTaskItem: (templateId: number, data: Partial<Omit<TaskTemplateItem, 'id' | 'form_fields' | 'content_file_url'>>) =>
    apiClient.post<TaskTemplateItem>(`/api/org/templates/${templateId}/tasks/`, data),
  updateTaskItem: (itemId: number, data: Partial<Omit<TaskTemplateItem, 'id' | 'form_fields' | 'content_file_url'>> | FormData) =>
    data instanceof FormData
      ? apiClient.patchForm<TaskTemplateItem>(`/api/org/template-tasks/${itemId}/`, data)
      : apiClient.patch<TaskTemplateItem>(`/api/org/template-tasks/${itemId}/`, data),
  deleteTaskItem: (itemId: number) =>
    apiClient.delete(`/api/org/template-tasks/${itemId}/`),

  // Onboarding Instances
  getOnboardings: (params?: { user_id?: number }) => {
    const qs = params?.user_id ? `?user_id=${params.user_id}` : '';
    return apiClient.get<OnboardingInstance[]>(`/api/org/onboardings/${qs}`);
  },
  createOnboarding: (data: {
    user_id: number;
    template_id?: number | null;
    start_date: string;
    due_date?: string | null;
    buddy_id?: number | null;
    manager_id?: number | null;
    welcome_message?: string;
  }) =>
    apiClient.post<OnboardingInstance>('/api/org/onboardings/', data),
  updateOnboarding: (id: number, data: { status?: string; due_date?: string | null; welcome_message?: string; buddy_id?: number | null; manager_id?: number | null }) =>
    apiClient.patch<OnboardingInstance>(`/api/org/onboardings/${id}/`, data),
  deleteOnboarding: (id: number) =>
    apiClient.delete(`/api/org/onboardings/${id}/`),
  resetOnboarding: (id: number) =>
    apiClient.post<OnboardingInstance>(`/api/org/onboardings/${id}/reset/`, {}),
  remindOnboarding: (id: number) =>
    apiClient.post<{ sent: boolean }>(`/api/org/onboardings/${id}/remind/`, {}),
  updateTaskInstance: (
    onboardingId: number,
    taskId: number,
    data:
      | Partial<{
          status: string;
          notes: string;
          title: string;
          description: string;
          task_type: string;
          phase: string;
          content_url: string;
          content_body: string;
          due_date: string | null;
          required: boolean;
          approval_required: boolean;
        }>
      | FormData,
  ) => {
    if (data instanceof FormData) {
      return apiClient.patchForm<TaskInstance>(`/api/org/onboardings/${onboardingId}/tasks/${taskId}/`, data);
    }
    return apiClient.patch<TaskInstance>(`/api/org/onboardings/${onboardingId}/tasks/${taskId}/`, data);
  },
  uploadTaskFile: (onboardingId: number, taskId: number, file: File, markComplete?: boolean) => {
    const fd = new FormData();
    fd.append('attachment', file);
    if (markComplete) fd.append('status', 'completed');
    return apiClient.patchForm<TaskInstance>(`/api/org/onboardings/${onboardingId}/tasks/${taskId}/`, fd);
  },
  addTaskInstance: (
    onboardingId: number,
    payload: {
      title: string;
      description?: string;
      task_type?: string;
      phase?: string;
      content_url?: string;
      content_body?: string;
      due_date?: string | null;
      required?: boolean;
      approval_required?: boolean;
    } | FormData,
  ) => {
    if (payload instanceof FormData) {
      return apiClient.postForm<TaskInstance>(`/api/org/onboardings/${onboardingId}/tasks/`, payload);
    }
    return apiClient.post<TaskInstance>(`/api/org/onboardings/${onboardingId}/tasks/`, payload);
  },
  deleteTaskInstance: (onboardingId: number, taskId: number) =>
    apiClient.delete(`/api/org/onboardings/${onboardingId}/tasks/${taskId}/`),
  getOnboardingStats: () =>
    apiClient.get<OnboardingStats>('/api/org/onboardings/stats/'),
  getMyOnboarding: () =>
    apiClient.get<OnboardingInstance | null>('/api/org/my-onboarding/'),
};

// ── Form Builder API ──────────────────────────────────────────────────────────

export const formBuilderApi = {
  // Template-level form fields (admin)
  getTemplateFields: (taskId: number) =>
    apiClient.get<TemplateFormField[]>(`/api/org/template-tasks/${taskId}/form-fields/`),
  addTemplateField: (taskId: number, data: Omit<TemplateFormField, 'id'>) =>
    apiClient.post<TemplateFormField>(`/api/org/template-tasks/${taskId}/form-fields/`, data),
  updateTemplateField: (id: number, data: Partial<Omit<TemplateFormField, 'id'>>) =>
    apiClient.patch<TemplateFormField>(`/api/org/template-form-fields/${id}/`, data),
  deleteTemplateField: (id: number) =>
    apiClient.delete(`/api/org/template-form-fields/${id}/`),

  // Instance-level form fields (admin — add/edit fields on a live task)
  getInstanceFields: (onboardingId: number, taskId: number) =>
    apiClient.get<TaskFormField[]>(`/api/org/onboardings/${onboardingId}/tasks/${taskId}/form-fields/`),
  addInstanceField: (onboardingId: number, taskId: number, data: Omit<TaskFormField, 'id' | 'response'>) =>
    apiClient.post<TaskFormField>(`/api/org/onboardings/${onboardingId}/tasks/${taskId}/form-fields/`, data),
  updateInstanceField: (id: number, data: Partial<Omit<TaskFormField, 'id' | 'response'>>) =>
    apiClient.patch<TaskFormField>(`/api/org/task-form-fields/${id}/`, data),
  deleteInstanceField: (id: number) =>
    apiClient.delete(`/api/org/task-form-fields/${id}/`),

  // Member form submission
  submitForm: (onboardingId: number, taskId: number, responses: { field_id: number; answer: string }[]) =>
    apiClient.post<TaskInstance>(`/api/org/onboardings/${onboardingId}/tasks/${taskId}/submit-form/`, { responses }),
};

export const commentsApi = {
  getComments: (onboardingId: number, taskId: number) =>
    apiClient.get<TaskComment[]>(`/api/org/onboardings/${onboardingId}/tasks/${taskId}/comments/`),
  postComment: (onboardingId: number, taskId: number, body: string) =>
    apiClient.post<TaskComment>(`/api/org/onboardings/${onboardingId}/tasks/${taskId}/comments/`, { body }),
};

// ── Document Types ─────────────────────────────────────────────────────────────

export type DocCategory   = 'required' | 'policy' | 'form' | 'certificate' | 'agreement';
export type MemberDocStatus = 'assigned' | 'uploaded' | 'pending_review' | 'approved' | 'rejected' | 'signed';

export interface DocumentTemplate {
  id: number;
  name: string;
  description: string;
  category: DocCategory;
  department_name: string | null;
  file_url: string | null;
  version: string;
  is_mandatory: boolean;
  requires_signature: boolean;
  allow_resign: boolean;
  expiration_months: number;
  is_active: boolean;
  visible_to: string;
  assignable_by: string;
  approval_required: boolean;
  auto_request_in_onboarding: boolean;
  reminder_enabled: boolean;
  used_in_count: number;
  created_by_name: string | null;
  created_at: string;
}

export interface MemberDocument {
  id: number;
  user: OrgMemberUser;
  template_name: string | null;
  template_description: string | null;
  title: string;
  file_url: string | null;
  category: string;
  status: MemberDocStatus;
  reviewer_note: string;
  reviewed_by_name: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  signed_at: string | null;
  expiration_date: string | null;
  requires_signature: boolean;
  allow_resign: boolean;
  template_file_url: string | null;
  doc_reference: string;
  assigned_by_name: string | null;
}

export interface DocGlobalStats {
  total_members:           number;
  total_documents:         number;
  pending_actions:         number;
  signed_documents:        number;
  signed_completion_pct:   number;
  expiring_soon_count:     number;
  avg_response_time_days:  number | null;
}

// ── Training Types ─────────────────────────────────────────────────────────────

export type LessonType      = 'video' | 'pdf' | 'quiz' | 'assessment' | 'external_link' | 'article' | 'embed' | 'assignment';
export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'failed';

export interface QuizOption {
  id: number;
  text: string;
  is_correct?: boolean;
  order: number;
}

export interface QuizQuestion {
  id: number;
  text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  points: number;
  order: number;
  options: QuizOption[];
}

export interface LessonSubmission {
  id: number;
  lesson_id: number;
  answers: Record<string, string>;
  score: number | null;
  passed: boolean | null;
  submitted_at: string;
  file_url: string | null;
}

export interface QuizFeedback {
  [questionId: string]: { correct_option_id: string | null; earned: number };
}

export interface TrainingLesson {
  id: number;
  title: string;
  lesson_type: LessonType;
  content_url: string;
  content_file_url: string | null;
  content_data: Record<string, unknown>;
  duration_minutes: number;
  order: number;
  is_published: boolean;
  created_at: string | null;
  updated_at: string;
  lesson_reference: string;
  updated_by_name: string | null;
  quiz_questions: QuizQuestion[];
}

export interface TrainingModule {
  id: number;
  title: string;
  order: number;
  lesson_count: number;
  lessons: TrainingLesson[];
}

export type TrainingCategory = 'compliance' | 'technical' | 'soft_skills' | 'leadership' | 'onboarding' | 'health_safety' | 'other';

export interface TrainingCourse {
  id: number;
  title: string;
  description: string;
  department_name: string | null;
  thumbnail_url: string | null;
  category: TrainingCategory;
  is_mandatory: boolean;
  is_active: boolean;
  pass_score: number;
  modules: TrainingModule[];
  enrolled_count: number;
  completion_pct: number;
  total_duration: number;
  created_by_name: string | null;
  created_at: string;
}

export interface LessonProgress {
  id: number;
  lesson_id: number;
  completed: boolean;
  completed_at: string | null;
}

export interface TrainingEnrollment {
  id: number;
  course: TrainingCourse;
  status: EnrollmentStatus;
  completion_date: string | null;
  score: number | null;
  certificate_issued: boolean;
  enrolled_at: string;
  progress_pct: number;
  completed_lessons: number;
  total_lessons: number;
  lesson_progress: LessonProgress[];
  lesson_submissions: LessonSubmission[];
  user_name?: string;
  user_email?: string;
  user_picture?: string | null;
  department_name?: string | null;
  user_id?: number;
}

// ── Extended API ───────────────────────────────────────────────────────────────

export const docApi = {
  // Document Templates (admin)
  getDocTemplates: () =>
    apiClient.get<DocumentTemplate[]>('/api/org/doc-templates/'),
  createDocTemplate: (data: FormData) =>
    apiClient.postForm<DocumentTemplate>('/api/org/doc-templates/', data),
  updateDocTemplate: (id: number, data: FormData | Record<string, unknown>) =>
    data instanceof FormData
      ? apiClient.patchForm<DocumentTemplate>(`/api/org/doc-templates/${id}/`, data)
      : apiClient.patch<DocumentTemplate>(`/api/org/doc-templates/${id}/`, data),
  deleteDocTemplate: (id: number) =>
    apiClient.delete(`/api/org/doc-templates/${id}/`),
  importDocTemplate: (data: object) =>
    apiClient.post<DocumentTemplate>('/api/org/doc-templates/import/', data),
  toggleDocTemplate: (id: number, is_active: boolean) =>
    apiClient.patch<DocumentTemplate>(`/api/org/doc-templates/${id}/`, { is_active }),
  assignDocTemplate: (id: number, data: { user_ids?: number[]; department_id?: number | null }) =>
    apiClient.post<{ created: number }>(`/api/org/doc-templates/${id}/assign/`, data),

  // All Documents (admin)
  getDocuments: (filters?: { status?: string; user_id?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status)  params.set('status', filters.status);
    if (filters?.user_id) params.set('user_id', String(filters.user_id));
    const q = params.toString();
    return apiClient.get<MemberDocument[]>(`/api/org/documents/${q ? `?${q}` : ''}`);
  },
  reviewDocument: (id: number, data: { action: 'approve' | 'reject'; note?: string }) =>
    apiClient.patch<MemberDocument>(`/api/org/documents/${id}/review/`, data),
  deleteDocument: (id: number) =>
    apiClient.delete(`/api/org/documents/${id}/delete/`),

  // My Documents (member)
  getMyDocuments: () =>
    apiClient.get<MemberDocument[]>('/api/org/my-documents/'),
  uploadMyDocument: (id: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.postForm<MemberDocument>(`/api/org/my-documents/${id}/upload/`, fd);
  },
  signMyDocument: (id: number) =>
    apiClient.post<MemberDocument>(`/api/org/my-documents/${id}/sign/`, {}),
  remindDocument: (id: number) =>
    apiClient.post<{ sent: boolean }>(`/api/org/documents/${id}/remind/`, {}),

  getDocGlobalStats: () =>
    apiClient.get<DocGlobalStats>('/api/org/documents/global-stats/'),

  exportDocuments: async () => {
    const res = await fetch('/api/org/documents/export/', {
      headers: { Authorization: `Bearer ${tokens.getAccess()}` },
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'documents.csv'; a.click();
    URL.revokeObjectURL(url);
  },
};

export const trainingApi = {
  // Courses
  getCourses: () =>
    apiClient.get<TrainingCourse[]>('/api/org/courses/'),
  createCourse: (data: FormData | Record<string, unknown>) =>
    data instanceof FormData
      ? apiClient.postForm<TrainingCourse>('/api/org/courses/', data)
      : apiClient.post<TrainingCourse>('/api/org/courses/', data),
  updateCourse: (id: number, data: FormData | Record<string, unknown>) =>
    data instanceof FormData
      ? apiClient.patchForm<TrainingCourse>(`/api/org/courses/${id}/`, data)
      : apiClient.patch<TrainingCourse>(`/api/org/courses/${id}/`, data),
  deleteCourse: (id: number) =>
    apiClient.delete(`/api/org/courses/${id}/`),
  toggleCourse: (id: number, is_active: boolean) =>
    apiClient.patch<TrainingCourse>(`/api/org/courses/${id}/`, { is_active }),
  enrollUsers: (id: number, data: { user_ids?: number[]; department_id?: number | null }) =>
    apiClient.post<{ enrolled: number }>(`/api/org/courses/${id}/enroll/`, data),

  // Modules
  createModule: (courseId: number, data: { title: string; order?: number }) =>
    apiClient.post<TrainingModule>(`/api/org/courses/${courseId}/modules/`, data),
  updateModule: (id: number, data: { title?: string; order?: number }) =>
    apiClient.patch<TrainingModule>(`/api/org/modules/${id}/`, data),
  deleteModule: (id: number) =>
    apiClient.delete(`/api/org/modules/${id}/`),

  // Lessons
  createLesson: (moduleId: number, data: FormData | Record<string, unknown>) =>
    data instanceof FormData
      ? apiClient.postForm<TrainingLesson>(`/api/org/modules/${moduleId}/lessons/`, data)
      : apiClient.post<TrainingLesson>(`/api/org/modules/${moduleId}/lessons/`, data),
  updateLesson: (id: number, data: FormData | Record<string, unknown>) =>
    data instanceof FormData
      ? apiClient.patchForm<TrainingLesson>(`/api/org/lessons/${id}/`, data)
      : apiClient.patch<TrainingLesson>(`/api/org/lessons/${id}/`, data),
  deleteLesson: (id: number) =>
    apiClient.delete(`/api/org/lessons/${id}/`),
  uploadLessonFile: (id: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.postForm<{ content_file_url: string }>(`/api/org/lessons/${id}/upload/`, fd);
  },
  deleteLessonFile: (id: number) =>
    apiClient.delete(`/api/org/lessons/${id}/upload/`),
  duplicateLesson: (id: number) =>
    apiClient.post<TrainingLesson>(`/api/org/lessons/${id}/duplicate/`, {}),
  reorderLessons: (moduleId: number, ordered_ids: number[]) =>
    apiClient.post<{ detail: string }>(`/api/org/modules/${moduleId}/reorder/`, { ordered_ids }),

  // My Training (member)
  getMyTraining: () =>
    apiClient.get<TrainingEnrollment[]>('/api/org/my-training/'),
  completeLesson: (enrollmentId: number, lessonId: number) =>
    apiClient.patch<TrainingEnrollment>(`/api/org/my-training/${enrollmentId}/lessons/${lessonId}/`, {}),
  uncompleteLesson: (enrollmentId: number, lessonId: number) =>
    apiClient.delete<TrainingEnrollment>(`/api/org/my-training/${enrollmentId}/lessons/${lessonId}/`),
  submitLesson: (enrollmentId: number, lessonId: number, data: FormData | { answers: Record<string, string> }) =>
    data instanceof FormData
      ? apiClient.postForm<{ enrollment: TrainingEnrollment; feedback: QuizFeedback }>(
          `/api/org/my-training/${enrollmentId}/lessons/${lessonId}/submit/`, data)
      : apiClient.post<{ enrollment: TrainingEnrollment; feedback: QuizFeedback }>(
          `/api/org/my-training/${enrollmentId}/lessons/${lessonId}/submit/`, data),

  // Quiz questions (admin)
  loadQuestions: (lessonId: number) =>
    apiClient.get<QuizQuestion[]>(`/api/org/lessons/${lessonId}/questions/`),
  createQuestion: (lessonId: number, data: {
    text: string; question_type: string; points: number; order: number;
    options: { text: string; is_correct: boolean; order: number }[];
  }) =>
    apiClient.post<QuizQuestion>(`/api/org/lessons/${lessonId}/questions/`, data),
  updateQuestion: (id: number, data: Partial<Omit<QuizQuestion, 'id' | 'options'>> & {
    options?: { text: string; is_correct: boolean; order: number }[];
  }) =>
    apiClient.patch<QuizQuestion>(`/api/org/questions/${id}/`, data),
  deleteQuestion: (id: number) =>
    apiClient.delete(`/api/org/questions/${id}/`),

  getCourseEnrollments: (courseId: number) =>
    apiClient.get<TrainingEnrollment[]>(`/api/org/courses/${courseId}/enrollments/`),
  unenrollUser: (courseId: number, userId: number) =>
    apiClient.delete(`/api/org/courses/${courseId}/enrollments/${userId}/`),
};

// ── Phase 5 Types ─────────────────────────────────────────────────────────────

export type EventType = 'orientation' | 'welcome' | 'training' | 'webinar' | 'checkin' | 'meeting' | string;
export type RSVPStatus = 'accepted' | 'declined' | 'maybe' | 'no_response';
export type ContributionType = 'hours' | 'task' | 'deliverable';
export type ContributionStatus = 'pending' | 'approved' | 'rejected';
export type ContributionCategory = 'project_work' | 'meetings' | 'learning' | 'other';
export type CheckInPeriod = 'weekly' | 'monthly';

export interface EventTypeConfig {
  id: number;
  slug: string;
  label: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  event_count: number;
}

export interface EventSettingsData {
  id: number;
  allow_self_rsvp: boolean;
  rsvp_deadline_hours: number;
  default_duration_minutes: number;
  send_reminders: boolean;
  reminder_hours_before: number;
  require_attendance_marking: boolean;
  default_location: string;
  updated_at: string;
}

export interface EventAttendance {
  id: number;
  user_id: number;
  user_name: string;
  rsvp: RSVPStatus;
  attended: boolean | null;
}

export interface OrgEvent {
  id: number;
  title: string;
  description: string;
  event_type: EventType;
  start_dt: string;
  end_dt: string;
  location: string;
  virtual_link: string;
  target_audience: string;
  max_attendees: number | null;
  organizer_name: string;
  is_recurring: boolean;
  recurrence_rule: string;
  created_at: string;
  rsvp_count: number;
  my_rsvp: RSVPStatus;
  assigned_member_ids: number[];
  assigned_members_data: { id: number; name: string; email: string }[];
  attendances?: EventAttendance[];
}

export interface Contribution {
  id: number;
  member_name: string;
  title: string;
  contribution_type: ContributionType;
  category: ContributionCategory;
  hours: string | null;
  description: string;
  project_name: string;
  impact_level: string;
  collaborators: string;
  deliverable_url: string;
  date: string;
  status: ContributionStatus;
  approved_by_name: string | null;
  evidence_file_url: string | null;
  created_at: string;
}

export interface ContributionMemberSummary {
  member_id:       number;
  member_name:     string;
  member_picture:  string | null;
  email:           string;
  role_name:       string;
  department_name: string;
  total:           number;
  pending:         number;
  approved:        number;
  total_hours:     number;
  pending_hours:   number;
  approved_hours:  number;
  last_activity:   string | null;
  status:          'pending_review' | 'approved' | 'no_activity';
}

export interface ContributionSummary {
  total_hours: number;
  total_contributions: number;
  pending: number;
  approved: number;
  month_hours: number;
  month_contributions: number;
  week_hours: number;
  week_contributions: number;
  approved_hours_month: number;
  approved_pct: number;
  streak: number;
}

export interface ContributionInsights {
  by_category: { category: ContributionCategory; label: string; hours: number; count: number }[];
  daily_trend: { date: string; hours: number }[];
}

export interface ContributionAdminSummary {
  pending_review:      number;
  pending_delta:       number;
  active_contributors: number;
  active_delta:        number;
  total_hours:         number;
  hours_delta:         number;
  approval_rate:       number;
  approval_rate_delta: number;
  recent_activity: {
    member_name:    string;
    member_picture: string | null;
    title:          string;
    hours:          number | null;
    action:         string;
    time_ago:       string;
  }[];
}

export interface ContributionOverview {
  daily:           { date: string; submitted: number; approved: number }[];
  total_submitted: number;
  total_approved:  number;
  pending_hours:   number;
  avg_per_member:  number;
}

export interface ContributionByDept {
  department: string;
  hours:      number;
  pct:        number;
}

export interface CheckIn {
  id: number;
  member_name: string;
  period_type: CheckInPeriod;
  period_start: string;
  period_end: string;
  responses: Record<string, string>;
  submitted_at: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
}

// ── Events API ────────────────────────────────────────────────────────────────

export const eventsApi = {
  getEvents: (params?: { type?: EventType; upcoming?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set('type', params.type);
    if (params?.upcoming) q.set('upcoming', 'true');
    const qs = q.toString();
    return apiClient.get<OrgEvent[]>(`/api/org/events/${qs ? `?${qs}` : ''}`);
  },
  getEvent:    (id: number) => apiClient.get<OrgEvent>(`/api/org/events/${id}/`),
  createEvent: (data: Partial<OrgEvent>) => apiClient.post<OrgEvent>('/api/org/events/', data),
  updateEvent: (id: number, data: Partial<OrgEvent>) => apiClient.patch<OrgEvent>(`/api/org/events/${id}/`, data),
  deleteEvent: (id: number) => apiClient.delete(`/api/org/events/${id}/`),
  rsvp: (id: number, rsvp: RSVPStatus) => apiClient.post<EventAttendance>(`/api/org/events/${id}/rsvp/`, { rsvp }),
  markAttended: (eventId: number, userId: number, attended: boolean) =>
    apiClient.patch<EventAttendance>(`/api/org/events/${eventId}/attendance/${userId}/`, { attended }),
};

export const eventTypesApi = {
  getTypes:   () => apiClient.get<EventTypeConfig[]>('/api/org/event-types/'),
  createType: (data: Partial<EventTypeConfig>) =>
    apiClient.post<EventTypeConfig>('/api/org/event-types/', data),
  updateType: (id: number, data: Partial<EventTypeConfig>) =>
    apiClient.patch<EventTypeConfig>(`/api/org/event-types/${id}/`, data),
  deleteType: (id: number) => apiClient.delete(`/api/org/event-types/${id}/`),
};

export const eventSettingsApi = {
  getSettings:    () => apiClient.get<EventSettingsData>('/api/org/event-settings/'),
  updateSettings: (data: Partial<EventSettingsData>) =>
    apiClient.patch<EventSettingsData>('/api/org/event-settings/', data),
};

// ── Contributions API ─────────────────────────────────────────────────────────

export const contributionsApi = {
  getContributions: (params?: { status?: ContributionStatus; member_id?: number }) => {
    const q = new URLSearchParams();
    if (params?.status)    q.set('status', params.status);
    if (params?.member_id) q.set('member_id', String(params.member_id));
    const qs = q.toString();
    return apiClient.get<Contribution[]>(`/api/org/contributions/${qs ? `?${qs}` : ''}`);
  },
  getSummary: () => apiClient.get<ContributionSummary>('/api/org/contributions/summary/'),
  getInsights: () => apiClient.get<ContributionInsights>('/api/org/contributions/insights/'),
  getMembersSummary: () => apiClient.get<ContributionMemberSummary[]>('/api/org/contributions/members/'),
  getAdminSummary: () => apiClient.get<ContributionAdminSummary>('/api/org/contributions/admin-summary/'),
  getOverview: (period: 'month' | 'week' | 'year' = 'month') =>
    apiClient.get<ContributionOverview>(`/api/org/contributions/overview/?period=${period}`),
  getByDepartment: (period: 'month' | 'all_time' = 'month') =>
    apiClient.get<ContributionByDept[]>(`/api/org/contributions/by-department/?period=${period}`),
  exportCsv: async () => {
    const resp = await fetch('/api/org/contributions/export/', {
      headers: { 'Authorization': `Bearer ${tokens.getAccess()}` },
    });
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'contributions.csv'; a.click();
    URL.revokeObjectURL(url);
  },
  bulkReview: (ids: number[], action: 'approve' | 'reject') =>
    apiClient.post<{ updated: number[]; count: number }>('/api/org/contributions/bulk-review/', { ids, action }),
  submitContribution: (data: FormData) =>
    apiClient.postForm<Contribution>('/api/org/contributions/', data),
  reviewContribution: (id: number, action: 'approve' | 'reject' | 'reset') =>
    apiClient.patch<Contribution>(`/api/org/contributions/${id}/review/`, { action }),
};

// ── Check-ins API ─────────────────────────────────────────────────────────────

export const checkinsApi = {
  getCheckins: (params?: { period_type?: CheckInPeriod; reviewed?: boolean; member_id?: number }) => {
    const q = new URLSearchParams();
    if (params?.period_type)              q.set('period_type', params.period_type);
    if (params?.reviewed !== undefined)   q.set('reviewed', String(params.reviewed));
    if (params?.member_id)                q.set('member_id', String(params.member_id));
    const qs = q.toString();
    return apiClient.get<CheckIn[]>(`/api/org/checkins/${qs ? `?${qs}` : ''}`);
  },
  submitCheckin: (data: {
    period_type: CheckInPeriod;
    period_start: string;
    period_end: string;
    responses: Record<string, string>;
  }) => apiClient.post<CheckIn>('/api/org/checkins/', data),
  reviewCheckin: (id: number) => apiClient.patch<CheckIn>(`/api/org/checkins/${id}/review/`, {}),
};

// ── Phase 6 Types ─────────────────────────────────────────────────────────────

export type ResourceCategory = 'handbook' | 'guide' | 'faq' | 'policy' | 'training_material';

export interface OrgResource {
  id: number;
  title: string;
  description: string;
  category: ResourceCategory;
  file_url: string | null;
  external_url: string;
  is_published: boolean;
  created_by_name: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  actor_name: string;
  action: string;
  module: string;
  record_id: number | null;
  record_repr: string;
  changes: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface AdminDashboard {
  members: { total: number; active: number; inactive: number };
  onboarding: OnboardingStats;
  pending_contributions: number;
  pending_documents: number;
  pending_checkins: number;
  upcoming_events_count: number;
  upcoming_events: OrgEvent[];
}

export interface MemberDashboard {
  onboarding: OnboardingInstance | null;
  contributions: ContributionSummary;
  upcoming_events: OrgEvent[];
  pending_documents: MemberDocument[];
}

// ── Dashboard API ─────────────────────────────────────────────────────────────

export const dashboardApi = {
  getDashboard: () =>
    apiClient.get<AdminDashboard | MemberDashboard>('/api/org/dashboard/'),
};

// ── Resources API ─────────────────────────────────────────────────────────────

export const resourcesApi = {
  getResources: () =>
    apiClient.get<OrgResource[]>('/api/org/resources/'),
  createResource: (fd: FormData) =>
    apiClient.postForm<OrgResource>('/api/org/resources/', fd),
  updateResource: (id: number, data: Partial<Pick<OrgResource, 'title' | 'description' | 'category' | 'external_url' | 'is_published'>>) =>
    apiClient.patch<OrgResource>(`/api/org/resources/${id}/`, data),
  deleteResource: (id: number) =>
    apiClient.delete(`/api/org/resources/${id}/`),
};

// ── Audit Log API ─────────────────────────────────────────────────────────────

export const auditApi = {
  getLogs: (params?: { module?: string; action?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.module) qs.set('module', params.module);
    if (params?.action) qs.set('action', params.action);
    if (params?.limit)  qs.set('limit', String(params.limit));
    const q = qs.toString();
    return apiClient.get<AuditLogEntry[]>(`/api/org/audit/${q ? `?${q}` : ''}`);
  },
};

// ── Phase 7 Types ─────────────────────────────────────────────────────────────

export interface OrgSettingsData {
  id: number;
  org_name: string;
  description: string;
  logo_url: string | null;
  timezone: string;
  contact_email: string;
  website: string;
  training_auto_enroll_mandatory: boolean;
  training_certificate_enabled: boolean;
  training_reminder_days: number;
  training_default_pass_score:   number;
  contribution_enabled:          boolean;
  contribution_require_evidence: boolean;
  updated_at: string;
}

export interface AnalyticsData {
  contributions: {
    total_hours: number;
    total_contributions: number;
    approved: number;
    by_member: { member_name: string; total_hours: number; count: number }[];
    monthly_hours: { month: string; hours: number }[];
  };
  training: {
    total_enrollments: number;
    completed: number;
    completion_rate: number;
    by_course: { course_title: string; enrolled: number; completed: number }[];
  };
  checkins: {
    total: number;
    reviewed: number;
    by_type: { weekly: number; monthly: number };
  };
  documents: {
    total: number;
    approved: number;
    pending: number;
  };
}

export interface MemberPerformanceData {
  contributions: { total_hours: number; approved: number; monthly: { month: string; hours: number }[] };
  training:      { enrolled: number; completed: number; completion_rate: number };
  checkins:      { total: number; streak: number };
  onboarding:    { progress_pct: number | null; status: string | null };
}

// ── Settings API ──────────────────────────────────────────────────────────────

export const settingsApi = {
  getSettings: () =>
    apiClient.get<OrgSettingsData>('/api/org/settings/'),
  updateSettings: (data: Partial<OrgSettingsData>) =>
    apiClient.patch<OrgSettingsData>('/api/org/settings/', data),
  updateSettingsWithLogo: (fd: FormData) =>
    apiClient.patchForm<OrgSettingsData>('/api/org/settings/', fd),
};

// ── Analytics API ─────────────────────────────────────────────────────────────

export const analyticsApi = {
  getAnalytics: () =>
    apiClient.get<AnalyticsData>('/api/org/analytics/'),
};

// ── Performance API ───────────────────────────────────────────────────────────

export const performanceApi = {
  getMyPerformance: () =>
    apiClient.get<MemberPerformanceData>('/api/org/my-performance/'),
};

// ── Phase 8 Types ─────────────────────────────────────────────────────────────

export interface RecruitmentRequest {
  id: number;
  submitted_by_name: string;
  candidate_name: string;
  candidate_email: string;
  message: string;
  role_suggested: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_name: string | null;
  reviewer_note: string;
  reviewed_at: string | null;
  created_at: string;
}

// ── Recruitment API ───────────────────────────────────────────────────────────

export const recruitmentApi = {
  getRequests: (reqStatus?: string) =>
    apiClient.get<RecruitmentRequest[]>(`/api/org/recruitment/${reqStatus ? `?status=${reqStatus}` : ''}`),
  submitRequest: (data: { candidate_name: string; candidate_email?: string; message?: string; role_suggested?: string }) =>
    apiClient.post<RecruitmentRequest>('/api/org/recruitment/', data),
  reviewRequest: (id: number, action: 'approve' | 'reject', note?: string) =>
    apiClient.patch<RecruitmentRequest>(`/api/org/recruitment/${id}/review/`, { action, note }),
};

// ── Member Stats API ──────────────────────────────────────────────────────────

export const membersStatsApi = {
  getStats: () => apiClient.get<MemberStats>('/api/org/members/stats/'),
};

// ── Access Requests API ───────────────────────────────────────────────────────

export const accessRequestsApi = {
  getRequests: () => apiClient.get<OrgAccessRequest[]>('/api/org/access-requests/'),
  reviewRequest: (id: number, data: { action: 'approve' | 'reject'; role_id?: number }) =>
    apiClient.post(`/api/org/access-requests/${id}/review/`, data),
};

// ── Standalone Forms / Surveys ────────────────────────────────────────────────

export type StandaloneFormFieldType =
  | 'text' | 'textarea' | 'choice' | 'multiselect'
  | 'boolean' | 'date' | 'number' | 'rating' | 'file';

export interface StandaloneFormField {
  id: number;
  question: string;
  field_type: StandaloneFormFieldType;
  options: string[];
  required: boolean;
  order: number;
  rating_max: number;
}

export interface StandaloneForm {
  id: number;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'closed';
  form_type: 'form' | 'survey';
  category: string;
  due_date: string | null;
  show_results_to_members: boolean;
  created_by_name: string;
  fields: StandaloneFormField[];
  total_submitted: number;
  created_at: string;
  updated_at: string;
}

export interface MyForm extends Omit<StandaloneForm, 'total_submitted' | 'created_by_name'> {
  submitted: boolean;
  submitted_at: string | null;
  my_answers: Record<string, string>;
  poll_results?: Record<string, Record<string, number>>;
}

export interface FormResponsesReport {
  total_recipients: number;
  total_submitted: number;
  per_question: {
    field_id: number;
    question: string;
    field_type: StandaloneFormFieldType;
    options: string[];
    counts: Record<string, number>;
    answers: string[];
  }[];
  per_member: {
    member_id: number;
    name: string;
    submitted_at: string;
    answers: Record<string, string>;
  }[];
  archived_members: {
    member_id: number;
    name: string;
    submitted_at: string;
    answers: Record<string, string>;
  }[];
}

export const formsApi = {
  // Admin
  getForms:     () =>
    apiClient.get<StandaloneForm[]>('/api/org/forms/'),
  createForm:   (d: Partial<StandaloneForm>) =>
    apiClient.post<StandaloneForm>('/api/org/forms/', d),
  updateForm:   (id: number, d: Partial<StandaloneForm>) =>
    apiClient.patch<StandaloneForm>(`/api/org/forms/${id}/`, d),
  deleteForm:   (id: number) =>
    apiClient.delete(`/api/org/forms/${id}/`),
  createField:  (formId: number, d: Partial<StandaloneFormField>) =>
    apiClient.post<StandaloneFormField>(`/api/org/forms/${formId}/fields/`, d),
  updateField:  (fieldId: number, d: Partial<StandaloneFormField>) =>
    apiClient.patch<StandaloneFormField>(`/api/org/form-fields/${fieldId}/`, d),
  deleteField:  (fieldId: number) =>
    apiClient.delete(`/api/org/form-fields/${fieldId}/`),
  distributeForm: (id: number, p: { target_type: string; department_id?: number; member_ids?: number[] }) =>
    apiClient.post<{ recipients_notified: number }>(`/api/org/forms/${id}/distribute/`, p),
  getResponses: (id: number) =>
    apiClient.get<FormResponsesReport>(`/api/org/forms/${id}/responses/`),
  exportCsvUrl: (id: number) =>
    `/api/org/forms/${id}/responses/?format=csv`,
  getInsights: () =>
    apiClient.get<{ week: string; count: number }[]>('/api/org/forms/insights/'),
  // Member
  getMyForms:   () =>
    apiClient.get<MyForm[]>('/api/org/my-forms/'),
  submitForm:      (id: number, responses: { field_id: number; answer: string }[]) =>
    apiClient.post<MyForm>(`/api/org/forms/${id}/submit/`, { responses }),
  submitFormWithFiles: (id: number, fd: FormData) =>
    apiClient.postForm<MyForm>(`/api/org/forms/${id}/submit/`, fd),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Org Chat — Types
// ═══════════════════════════════════════════════════════════════════════════════

export type OrgChannelType = 'general' | 'announcements' | 'random' | 'department' | 'custom';

export interface OrgChatChannel {
  id:              number;
  name:            string;
  description:     string;
  channel_type:    OrgChannelType;
  is_archived:     boolean;
  member_count:    number;
  created_at:      string;
  created_by_name: string | null;
}

export interface OrgChatSender {
  id:              number;
  username:        string;
  first_name:      string;
  last_name:       string;
  display_name:    string;
  profile_picture: string | null;
}

export interface OrgChatReaction {
  id:    number;
  emoji: string;
  user: {
    id:         number;
    username:   string;
    first_name: string;
    last_name:  string;
  };
}

export interface OrgChatMessage {
  id:              number;
  sender:          OrgChatSender;
  body:            string;
  attachment_url:  string | null;
  attachment_name: string | null;
  message_type:    string;
  is_pinned:       boolean;
  is_deleted:      boolean;
  reply_to:        { id: number; body: string; sender_name: string } | null;
  reactions:       OrgChatReaction[];
  created_at:      string;
  updated_at:      string;
}

export interface OrgDMMessage {
  id:             number;
  sender:         OrgChatSender;
  receiver:       OrgChatSender;
  body:           string;
  attachment_url: string | null;
  created_at:     string;
  is_read:        boolean;
  is_deleted:     boolean;
}

export interface OrgDMConversation {
  partner: {
    id:           number;
    username:     string;
    first_name:   string;
    last_name:    string;
    display_name: string;
  };
  unread:       number;
  last_message: string;
  last_at:      string | null;
}

export interface OrgChatPollOption {
  id:         number;
  text:       string;
  voter_count: number;
  voter_ids:  number[];
}

export interface OrgChatPoll {
  id:             number;
  question:       string;
  allow_multiple: boolean;
  is_closed:      boolean;
  created_at:     string;
  author: {
    id:         number;
    username:   string;
    first_name: string;
    last_name:  string;
  };
  options:     OrgChatPollOption[];
  total_votes: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Org Chat — API Client
// ═══════════════════════════════════════════════════════════════════════════════

export const orgChatApi = {
  // Channels
  getChannels: () =>
    apiClient.get<OrgChatChannel[]>('/api/org/chat/channels/'),

  createChannel: (data: { name: string; description?: string; channel_type?: OrgChannelType }) =>
    apiClient.post<OrgChatChannel>('/api/org/chat/channels/', data),

  getChannel: (id: number) =>
    apiClient.get<OrgChatChannel>(`/api/org/chat/channels/${id}/`),

  updateChannel: (id: number, data: Partial<OrgChatChannel>) =>
    apiClient.patch<OrgChatChannel>(`/api/org/chat/channels/${id}/`, data),

  deleteChannel: (id: number) =>
    apiClient.delete(`/api/org/chat/channels/${id}/`),

  getChannelMembers: (channelId: number) =>
    apiClient.get<{ id: number; username: string; first_name: string; last_name: string; is_admin: boolean; joined_at: string }[]>(
      `/api/org/chat/channels/${channelId}/members/`
    ),

  addChannelMember: (channelId: number, userId: number) =>
    apiClient.post(`/api/org/chat/channels/${channelId}/members/`, { user_id: userId }),

  removeChannelMember: (channelId: number, userId: number) =>
    apiClient.delete(`/api/org/chat/channels/${channelId}/members/`, { user_id: userId }),

  // Messages
  getMessages: (channelId: number, before?: number) =>
    apiClient.get<OrgChatMessage[]>(
      `/api/org/chat/channels/${channelId}/messages/${before ? `?before=${before}` : ''}`
    ),

  sendMessage: (channelId: number, data: { body?: string; message_type?: string; reply_to_id?: number }) =>
    apiClient.post<OrgChatMessage>(`/api/org/chat/channels/${channelId}/messages/`, data),

  sendMessageWithFile: (channelId: number, fd: FormData) =>
    apiClient.postForm<OrgChatMessage>(`/api/org/chat/channels/${channelId}/messages/`, fd),

  editMessage: (channelId: number, mid: number, body: string) =>
    apiClient.patch<OrgChatMessage>(`/api/org/chat/channels/${channelId}/messages/${mid}/`, { body }),

  deleteMessage: (channelId: number, mid: number) =>
    apiClient.delete(`/api/org/chat/channels/${channelId}/messages/${mid}/`),

  pinMessage: (channelId: number, mid: number) =>
    apiClient.post<{ is_pinned: boolean }>(`/api/org/chat/channels/${channelId}/messages/${mid}/pin/`, {}),

  reactToMessage: (channelId: number, mid: number, emoji: string) =>
    apiClient.post<OrgChatReaction[]>(`/api/org/chat/channels/${channelId}/messages/${mid}/react/`, { emoji }),

  // DMs
  getDMConversations: () =>
    apiClient.get<OrgDMConversation[]>('/api/org/chat/dms/'),

  getDMMessages: (userId: number, before?: number) =>
    apiClient.get<OrgDMMessage[]>(
      `/api/org/chat/dms/${userId}/${before ? `?before=${before}` : ''}`
    ),

  sendDM: (userId: number, data: { body?: string }) =>
    apiClient.post<OrgDMMessage>(`/api/org/chat/dms/${userId}/`, data),

  sendDMWithFile: (userId: number, fd: FormData) =>
    apiClient.postForm<OrgDMMessage>(`/api/org/chat/dms/${userId}/`, fd),

  deleteDM: (userId: number, mid: number) =>
    apiClient.delete(`/api/org/chat/dms/${userId}/${mid}/`),

  // Polls
  getPolls: (channelId: number) =>
    apiClient.get<OrgChatPoll[]>(`/api/org/chat/channels/${channelId}/polls/`),

  createPoll: (channelId: number, data: { question: string; options: string[]; allow_multiple?: boolean }) =>
    apiClient.post<OrgChatPoll>(`/api/org/chat/channels/${channelId}/polls/`, data),

  closePoll: (channelId: number, pid: number) =>
    apiClient.patch<OrgChatPoll>(`/api/org/chat/channels/${channelId}/polls/${pid}/`, { is_closed: true }),

  deletePoll: (channelId: number, pid: number) =>
    apiClient.delete(`/api/org/chat/channels/${channelId}/polls/${pid}/`),

  votePoll: (channelId: number, pid: number, option_ids: number[]) =>
    apiClient.post<OrgChatPoll>(`/api/org/chat/channels/${channelId}/polls/${pid}/vote/`, { option_ids }),
};
