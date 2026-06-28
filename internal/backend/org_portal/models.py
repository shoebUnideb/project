from django.db import models
from django.conf import settings


# ── Roles ────────────────────────────────────────────────────────────────────

class InternalRole(models.Model):
    name                       = models.CharField(max_length=100, unique=True)
    level                      = models.PositiveIntegerField(
                                     default=1,
                                     help_text='Higher = more access. 1=base, 2=coordinator+'
                                 )
    can_manage_members         = models.BooleanField(default=False)
    can_view_all_contributions = models.BooleanField(default=False)
    can_approve_checkins       = models.BooleanField(default=False)
    can_upload_agreements      = models.BooleanField(default=False)
    created_at                 = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-level', 'name']

    def __str__(self):
        return f"{self.name} (level {self.level})"


# ── Departments ───────────────────────────────────────────────────────────────

class Department(models.Model):
    name        = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    head        = models.ForeignKey(
                      settings.AUTH_USER_MODEL,
                      on_delete=models.SET_NULL,
                      null=True, blank=True,
                      related_name='headed_departments',
                  )
    parent      = models.ForeignKey(
                      'self',
                      on_delete=models.SET_NULL,
                      null=True, blank=True,
                      related_name='sub_departments',
                  )
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# ── Members ───────────────────────────────────────────────────────────────────

class OrgMember(models.Model):
    STATUS_CHOICES = [
        ('active',    'Active'),
        ('inactive',  'Inactive'),
        ('suspended', 'Suspended'),
    ]

    user        = models.OneToOneField(
                      settings.AUTH_USER_MODEL,
                      on_delete=models.CASCADE,
                      related_name='org_member',
                  )
    role        = models.ForeignKey(
                      InternalRole,
                      on_delete=models.PROTECT,
                      related_name='members',
                  )
    department  = models.ForeignKey(
                      Department,
                      on_delete=models.SET_NULL,
                      null=True, blank=True,
                      related_name='members',
                  )
    buddy       = models.ForeignKey(
                      'self',
                      on_delete=models.SET_NULL,
                      null=True, blank=True,
                      related_name='buddied_members',
                  )
    manager     = models.ForeignKey(
                      'self',
                      on_delete=models.SET_NULL,
                      null=True, blank=True,
                      related_name='direct_reports',
                  )
    status                  = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    joined_date             = models.DateField(auto_now_add=True)
    approved_by             = models.ForeignKey(
                                  settings.AUTH_USER_MODEL,
                                  on_delete=models.SET_NULL,
                                  null=True, blank=True,
                                  related_name='org_members_approved',
                              )
    notes                   = models.TextField(blank=True)
    employee_id             = models.CharField(max_length=50, blank=True)
    skills                  = models.JSONField(default=list, blank=True)
    emergency_contact_name  = models.CharField(max_length=200, blank=True)
    emergency_contact_phone = models.CharField(max_length=50, blank=True)
    profile_completion_pct  = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['-joined_date']

    def __str__(self):
        return f"{self.user.username} — {self.role.name}"


# ── Notifications ─────────────────────────────────────────────────────────────

class OrgNotification(models.Model):
    TYPE_CHOICES = [
        # Access
        ('access_granted',        'Access Granted'),
        ('access_revoked',        'Access Revoked'),
        ('role_changed',          'Role Changed'),
        ('department_assigned',   'Department Assigned'),
        # Onboarding
        ('onboarding_started',    'Onboarding Started'),
        ('task_assigned',         'Task Assigned'),
        ('task_overdue',          'Task Overdue'),
        # Documents
        ('document_approved',     'Document Approved'),
        ('document_rejected',     'Document Rejected'),
        ('agreement_posted',      'Agreement Posted'),
        # Training
        ('training_assigned',     'Training Assigned'),
        # Events
        ('event_scheduled',       'Event Scheduled'),
        ('checkin_due',           'Check-in Due'),
        # Contributions
        ('contribution_approved',   'Contribution Approved'),
        ('contribution_submitted',  'Contribution Submitted'),
        # Check-ins
        ('checkin_submitted',       'Check-in Submitted'),
        # Documents
        ('document_uploaded',       'Document Uploaded'),
        # Agreements
        ('agreement_signed',        'Agreement Signed'),
        # Recruitment
        ('recruitment_request',     'Recruitment Request'),
        ('application_reviewed',    'Application Reviewed'),
        # Forms
        ('form_assigned',           'Form Assigned'),
    ]

    recipient  = models.ForeignKey(
                     settings.AUTH_USER_MODEL,
                     on_delete=models.CASCADE,
                     related_name='org_notifications',
                 )
    type       = models.CharField(max_length=50, choices=TYPE_CHOICES)
    title      = models.CharField(max_length=255)
    body       = models.TextField(blank=True)
    link       = models.CharField(max_length=255, blank=True)
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.recipient.username} — {self.type}"


# ── Onboarding Templates ──────────────────────────────────────────────────────

class OnboardingTemplate(models.Model):
    name        = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category    = models.CharField(max_length=100, blank=True)
    department  = models.ForeignKey(
                      Department,
                      on_delete=models.SET_NULL,
                      null=True, blank=True,
                      related_name='onboarding_templates',
                  )
    created_by  = models.ForeignKey(
                      settings.AUTH_USER_MODEL,
                      on_delete=models.SET_NULL,
                      null=True,
                      related_name='created_templates',
                  )
    updated_by  = models.ForeignKey(
                      settings.AUTH_USER_MODEL,
                      on_delete=models.SET_NULL,
                      null=True, blank=True,
                      related_name='updated_templates',
                  )
    visible_to             = models.CharField(max_length=200, blank=True, default='All Departments')
    assignable_by          = models.CharField(max_length=200, blank=True, default='HR Admin, Managers')
    task_approval_enabled  = models.BooleanField(default=False)
    due_date_policy        = models.CharField(max_length=100, blank=True, default='Relative to start date')
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class TaskTemplateItem(models.Model):
    TASK_TYPE_CHOICES = [
        ('info',     'Information'),
        ('form',     'Form'),
        ('upload',   'Upload'),
        ('approval', 'Approval'),
        ('meeting',  'Meeting'),
    ]
    ASSIGNEE_TYPE_CHOICES = [
        ('new_hire',   'New Hire'),
        ('manager',    'Manager'),
        ('buddy',      'Buddy'),
        ('hr',         'HR'),
        ('it',         'IT'),
        ('dept_admin', 'Department Admin'),
    ]

    template         = models.ForeignKey(
                           OnboardingTemplate,
                           on_delete=models.CASCADE,
                           related_name='tasks',
                       )
    title            = models.CharField(max_length=300)
    description      = models.TextField(blank=True)
    task_type        = models.CharField(max_length=20, choices=TASK_TYPE_CHOICES, default='info')
    phase            = models.CharField(max_length=100, blank=True, default='')
    content_url      = models.CharField(max_length=500, blank=True)
    content_body     = models.TextField(blank=True)
    content_file     = models.FileField(upload_to='task_content/', null=True, blank=True)
    order            = models.PositiveIntegerField(default=0)
    due_offset_days  = models.PositiveIntegerField(
                           default=0,
                           help_text='Days after onboarding start date this task is due'
                       )
    required         = models.BooleanField(default=True)
    approval_required = models.BooleanField(default=False)
    assignee_type    = models.CharField(max_length=20, choices=ASSIGNEE_TYPE_CHOICES, default='new_hire')
    dependencies     = models.ManyToManyField(
                           'self',
                           symmetrical=False,
                           blank=True,
                           related_name='dependents',
                       )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.template.name} — {self.title}"


# ── Onboarding Instances ──────────────────────────────────────────────────────

class OnboardingInstance(models.Model):
    STATUS_CHOICES = [
        ('pending',   'Pending'),
        ('active',    'Active'),
        ('paused',    'Paused'),
        ('completed', 'Completed'),
        ('archived',  'Archived'),
    ]

    template    = models.ForeignKey(
                      OnboardingTemplate,
                      on_delete=models.SET_NULL,
                      null=True, blank=True,
                      related_name='instances',
                  )
    user        = models.ForeignKey(
                      settings.AUTH_USER_MODEL,
                      on_delete=models.CASCADE,
                      related_name='onboarding_instances',
                  )
    assigned_by = models.ForeignKey(
                      settings.AUTH_USER_MODEL,
                      on_delete=models.SET_NULL,
                      null=True,
                      related_name='assigned_onboardings',
                  )
    buddy       = models.ForeignKey(
                      OrgMember,
                      on_delete=models.SET_NULL,
                      null=True, blank=True,
                      related_name='buddy_onboardings',
                  )
    manager     = models.ForeignKey(
                      OrgMember,
                      on_delete=models.SET_NULL,
                      null=True, blank=True,
                      related_name='managed_onboardings',
                  )
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    start_date  = models.DateField()
    due_date    = models.DateField(null=True, blank=True)
    welcome_message = models.TextField(blank=True)
    completed_at    = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Onboarding: {self.user.username}"


class TaskInstance(models.Model):
    STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('completed',   'Completed'),
        ('overdue',     'Overdue'),
        ('blocked',     'Blocked'),
    ]

    onboarding     = models.ForeignKey(
                         OnboardingInstance,
                         on_delete=models.CASCADE,
                         related_name='tasks',
                     )
    template_item  = models.ForeignKey(
                         TaskTemplateItem,
                         on_delete=models.SET_NULL,
                         null=True, blank=True,
                     )
    title              = models.CharField(max_length=300)
    description        = models.TextField(blank=True)
    task_type          = models.CharField(max_length=20, default='info')
    phase              = models.CharField(max_length=100, blank=True, default='')
    content_url        = models.CharField(max_length=500, blank=True)
    content_body       = models.TextField(blank=True)
    content_file       = models.FileField(upload_to='org_task_content/', null=True, blank=True)
    required           = models.BooleanField(default=True)
    approval_required  = models.BooleanField(default=False)
    due_date           = models.DateField(null=True, blank=True)
    status             = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_started')
    completed_at       = models.DateTimeField(null=True, blank=True)
    attachment         = models.FileField(upload_to='org_task_attachments/', null=True, blank=True)
    notes              = models.TextField(blank=True)
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['due_date', 'id']

    def __str__(self):
        return f"{self.onboarding} — {self.title}"


# ── Task Comments ─────────────────────────────────────────────────────────────

class TaskComment(models.Model):
    task       = models.ForeignKey(
                     TaskInstance,
                     on_delete=models.CASCADE,
                     related_name='comments',
                 )
    author     = models.ForeignKey(
                     settings.AUTH_USER_MODEL,
                     on_delete=models.CASCADE,
                     related_name='org_task_comments',
                 )
    body       = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.author.username} on task {self.task_id}"


# ── Form Builder ──────────────────────────────────────────────────────────────

FORM_FIELD_TYPES = [
    ('text',      'Short Text'),
    ('textarea',  'Long Text'),
    ('choice',    'Multiple Choice'),
    ('boolean',   'Yes / No'),
    ('date',      'Date'),
    ('number',    'Number'),
]


class TemplateFormField(models.Model):
    """Question attached to a TaskTemplateItem — copied to TaskFormField on instantiation."""
    task       = models.ForeignKey(
                     TaskTemplateItem,
                     on_delete=models.CASCADE,
                     related_name='form_fields',
                 )
    question   = models.CharField(max_length=500)
    field_type = models.CharField(max_length=20, choices=FORM_FIELD_TYPES, default='text')
    options    = models.JSONField(default=list, blank=True)
    required   = models.BooleanField(default=True)
    order      = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.task.title} — {self.question[:50]}"


class TaskFormField(models.Model):
    """Question on a live TaskInstance — either copied from template or added directly."""
    task       = models.ForeignKey(
                     TaskInstance,
                     on_delete=models.CASCADE,
                     related_name='form_fields',
                 )
    question   = models.CharField(max_length=500)
    field_type = models.CharField(max_length=20, choices=FORM_FIELD_TYPES, default='text')
    options    = models.JSONField(default=list, blank=True)
    required   = models.BooleanField(default=True)
    order      = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.task.title} — {self.question[:50]}"


class TaskFormResponse(models.Model):
    """Member's answer to a single TaskFormField."""
    field      = models.OneToOneField(
                     TaskFormField,
                     on_delete=models.CASCADE,
                     related_name='response',
                 )
    answer     = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Response to {self.field.question[:40]}"


# ── Standalone Forms / Surveys ────────────────────────────────────────────────

STANDALONE_FORM_FIELD_TYPES = [
    ('text',        'Short Text'),
    ('textarea',    'Long Text'),
    ('choice',      'Multiple Choice (single)'),
    ('multiselect', 'Multi-select'),
    ('boolean',     'Yes / No'),
    ('date',        'Date'),
    ('number',      'Number'),
    ('rating',      'Rating Scale'),
    ('file',        'File Upload'),
]

FORM_STATUS = [
    ('draft',     'Draft'),
    ('published', 'Published'),
    ('closed',    'Closed'),
]

FORM_TYPE_CHOICES = [
    ('form',    'Form'),
    ('survey',  'Survey'),
]

DISTRIBUTION_TARGET = [
    ('org',        'Whole Org'),
    ('department', 'Department'),
    ('members',    'Specific Members'),
]


class StandaloneForm(models.Model):
    title                   = models.CharField(max_length=255)
    description             = models.TextField(blank=True)
    created_by              = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_forms')
    status                  = models.CharField(max_length=20, choices=FORM_STATUS, default='draft')
    form_type               = models.CharField(max_length=20, choices=FORM_TYPE_CHOICES, default='form')
    category                = models.CharField(max_length=50, blank=True, default='')
    due_date                = models.DateTimeField(null=True, blank=True)
    show_results_to_members = models.BooleanField(default=False)
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class StandaloneFormField(models.Model):
    form       = models.ForeignKey(StandaloneForm, on_delete=models.CASCADE, related_name='fields')
    question   = models.CharField(max_length=500)
    field_type = models.CharField(max_length=20, choices=STANDALONE_FORM_FIELD_TYPES, default='text')
    options    = models.JSONField(default=list, blank=True)
    required   = models.BooleanField(default=True)
    order      = models.PositiveIntegerField(default=0)
    rating_max = models.PositiveIntegerField(default=5)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.question[:60]


class FormDistribution(models.Model):
    form        = models.ForeignKey(StandaloneForm, on_delete=models.CASCADE, related_name='distributions')
    target_type = models.CharField(max_length=20, choices=DISTRIBUTION_TARGET, default='org')
    department  = models.ForeignKey('Department', on_delete=models.SET_NULL, null=True, blank=True)
    members     = models.ManyToManyField('OrgMember', blank=True, related_name='form_distributions')
    sent_at     = models.DateTimeField(auto_now_add=True)


class FormSubmission(models.Model):
    form              = models.ForeignKey(StandaloneForm, on_delete=models.CASCADE, related_name='submissions')
    member            = models.ForeignKey('OrgMember', on_delete=models.CASCADE, related_name='form_submissions')
    submitted_at      = models.DateTimeField(auto_now_add=True)
    is_archived       = models.BooleanField(default=False)
    response_snapshot = models.JSONField(default=dict, blank=True)


class StandaloneFormResponse(models.Model):
    form       = models.ForeignKey(StandaloneForm, on_delete=models.CASCADE, related_name='responses')
    member     = models.ForeignKey('OrgMember', on_delete=models.CASCADE, related_name='form_field_responses')
    field      = models.ForeignKey(StandaloneFormField, on_delete=models.CASCADE, related_name='responses')
    answer     = models.TextField(blank=True)
    file       = models.FileField(upload_to='form_responses/', null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('form', 'member', 'field')]


# ── Documents ────────────────────────────────────────────────────────────────

class DocumentTemplate(models.Model):
    CATEGORY_CHOICES = [
        ('required',    'Required'),
        ('policy',      'Policy'),
        ('form',        'Form'),
        ('certificate', 'Certificate'),
        ('agreement',   'Agreement'),
    ]

    name               = models.CharField(max_length=300)
    category           = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='required')
    department         = models.ForeignKey(
                             Department,
                             on_delete=models.SET_NULL,
                             null=True, blank=True,
                             related_name='document_templates',
                         )
    file               = models.FileField(upload_to='doc_templates/', null=True, blank=True)
    version            = models.CharField(max_length=20, default='1.0')
    is_mandatory       = models.BooleanField(default=True)
    requires_signature = models.BooleanField(default=False)
    allow_resign       = models.BooleanField(default=False,
                             help_text='Allow member to re-sign after already signing')
    expiration_months  = models.PositiveSmallIntegerField(
                             default=0,
                             help_text='0 = never expires'
                         )
    is_active                  = models.BooleanField(default=True)
    description                = models.TextField(blank=True)
    visible_to                 = models.CharField(max_length=200, blank=True, default='All Departments')
    assignable_by              = models.CharField(max_length=200, blank=True, default='HR Admin, Managers')
    approval_required          = models.BooleanField(default=False)
    auto_request_in_onboarding = models.BooleanField(default=False)
    reminder_enabled           = models.BooleanField(default=False)
    created_by         = models.ForeignKey(
                             settings.AUTH_USER_MODEL,
                             on_delete=models.SET_NULL,
                             null=True,
                             related_name='created_doc_templates',
                         )
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} v{self.version}"


class MemberDocument(models.Model):
    STATUS_CHOICES = [
        ('assigned',       'Assigned'),
        ('uploaded',       'Uploaded'),
        ('pending_review', 'Pending Review'),
        ('approved',       'Approved'),
        ('rejected',       'Rejected'),
        ('signed',         'Signed'),
    ]

    user            = models.ForeignKey(
                          settings.AUTH_USER_MODEL,
                          on_delete=models.CASCADE,
                          related_name='member_documents',
                      )
    template        = models.ForeignKey(
                          DocumentTemplate,
                          on_delete=models.SET_NULL,
                          null=True, blank=True,
                          related_name='assigned_documents',
                      )
    title           = models.CharField(max_length=300)
    file            = models.FileField(upload_to='org_documents/', null=True, blank=True)
    category        = models.CharField(max_length=20, default='required')
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='assigned')
    reviewed_by     = models.ForeignKey(
                          settings.AUTH_USER_MODEL,
                          on_delete=models.SET_NULL,
                          null=True, blank=True,
                          related_name='reviewed_documents',
                      )
    reviewer_note   = models.TextField(blank=True)
    uploaded_at     = models.DateTimeField(auto_now_add=True)
    reviewed_at     = models.DateTimeField(null=True, blank=True)
    signed_at       = models.DateTimeField(null=True, blank=True)
    consent_ip      = models.GenericIPAddressField(null=True, blank=True)
    expiration_date = models.DateField(null=True, blank=True)
    assigned_by     = models.ForeignKey(
                          settings.AUTH_USER_MODEL,
                          null=True, blank=True,
                          on_delete=models.SET_NULL,
                          related_name='assigned_documents',
                      )

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.user.username} — {self.title}"


# ── Training ─────────────────────────────────────────────────────────────────

class TrainingCourse(models.Model):
    CATEGORY_CHOICES = [
        ('compliance',    'Compliance'),
        ('technical',     'Technical'),
        ('soft_skills',   'Soft Skills'),
        ('leadership',    'Leadership'),
        ('onboarding',    'Onboarding'),
        ('health_safety', 'Health & Safety'),
        ('other',         'Other'),
    ]

    title        = models.CharField(max_length=300)
    description  = models.TextField(blank=True)
    department   = models.ForeignKey(
                       Department,
                       on_delete=models.SET_NULL,
                       null=True, blank=True,
                       related_name='training_courses',
                   )
    thumbnail    = models.ImageField(upload_to='training/thumbnails/', null=True, blank=True)
    category     = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other', blank=True)
    is_mandatory = models.BooleanField(default=False)
    is_active    = models.BooleanField(default=True)
    pass_score   = models.PositiveSmallIntegerField(
                       default=70,
                       help_text='Minimum score (0-100) to pass'
                   )
    created_by   = models.ForeignKey(
                       settings.AUTH_USER_MODEL,
                       on_delete=models.SET_NULL,
                       null=True,
                       related_name='created_courses',
                   )
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['title']

    def __str__(self):
        return self.title


class TrainingModule(models.Model):
    course = models.ForeignKey(TrainingCourse, on_delete=models.CASCADE, related_name='modules')
    title  = models.CharField(max_length=300)
    order  = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.course.title} — {self.title}"


class TrainingLesson(models.Model):
    LESSON_TYPE_CHOICES = [
        ('video',         'Video'),
        ('pdf',           'PDF'),
        ('quiz',          'Quiz'),
        ('assessment',    'Assessment'),
        ('external_link', 'External Link'),
        ('article',       'Article'),
        ('embed',         'Embed / SCORM'),
        ('assignment',    'Assignment'),
    ]

    module           = models.ForeignKey(TrainingModule, on_delete=models.CASCADE, related_name='lessons')
    title            = models.CharField(max_length=300)
    lesson_type      = models.CharField(max_length=20, choices=LESSON_TYPE_CHOICES, default='video')
    content_url      = models.CharField(max_length=500, blank=True)
    content_file     = models.FileField(upload_to='training/lessons/', null=True, blank=True)
    duration_minutes = models.PositiveSmallIntegerField(default=0)
    order            = models.PositiveIntegerField(default=0)
    content_data     = models.JSONField(default=dict, blank=True)
    is_published     = models.BooleanField(default=True)
    created_at       = models.DateTimeField(auto_now_add=True, null=True)
    updated_at       = models.DateTimeField(auto_now=True)
    updated_by       = models.ForeignKey(
                           settings.AUTH_USER_MODEL,
                           null=True, blank=True,
                           on_delete=models.SET_NULL,
                           related_name='updated_lessons',
                       )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.module.title} — {self.title}"


class TrainingEnrollment(models.Model):
    STATUS_CHOICES = [
        ('enrolled',    'Enrolled'),
        ('in_progress', 'In Progress'),
        ('completed',   'Completed'),
        ('failed',      'Failed'),
    ]

    user                = models.ForeignKey(
                              settings.AUTH_USER_MODEL,
                              on_delete=models.CASCADE,
                              related_name='training_enrollments',
                          )
    course              = models.ForeignKey(
                              TrainingCourse,
                              on_delete=models.CASCADE,
                              related_name='enrollments',
                          )
    enrolled_by         = models.ForeignKey(
                              settings.AUTH_USER_MODEL,
                              on_delete=models.SET_NULL,
                              null=True,
                              related_name='created_enrollments',
                          )
    status              = models.CharField(max_length=20, choices=STATUS_CHOICES, default='enrolled')
    completion_date     = models.DateField(null=True, blank=True)
    score               = models.PositiveSmallIntegerField(null=True, blank=True)
    certificate_issued  = models.BooleanField(default=False)
    enrolled_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'course')
        ordering = ['-enrolled_at']

    def __str__(self):
        return f"{self.user.username} — {self.course.title}"


class LessonProgress(models.Model):
    enrollment   = models.ForeignKey(TrainingEnrollment, on_delete=models.CASCADE, related_name='lesson_progress')
    lesson       = models.ForeignKey(TrainingLesson, on_delete=models.CASCADE, related_name='progress_records')
    completed    = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('enrollment', 'lesson')

    def __str__(self):
        return f"{self.enrollment} — {self.lesson.title}"


class QuizQuestion(models.Model):
    TYPE_CHOICES = [
        ('multiple_choice', 'Multiple Choice'),
        ('true_false',      'True / False'),
        ('short_answer',    'Short Answer'),
    ]
    lesson        = models.ForeignKey(TrainingLesson, on_delete=models.CASCADE, related_name='quiz_questions')
    text          = models.TextField()
    question_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='multiple_choice')
    points        = models.PositiveSmallIntegerField(default=1)
    order         = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.lesson.title} Q{self.order}: {self.text[:60]}"


class QuizOption(models.Model):
    question   = models.ForeignKey(QuizQuestion, on_delete=models.CASCADE, related_name='options')
    text       = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)
    order      = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.question_id} opt: {self.text[:40]}"


class LessonSubmission(models.Model):
    enrollment   = models.ForeignKey(TrainingEnrollment, on_delete=models.CASCADE, related_name='lesson_submissions')
    lesson       = models.ForeignKey(TrainingLesson, on_delete=models.CASCADE, related_name='submissions')
    answers      = models.JSONField(default=dict)
    score        = models.PositiveSmallIntegerField(null=True, blank=True)
    passed       = models.BooleanField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    file         = models.FileField(upload_to='assignment_submissions/', null=True, blank=True)

    class Meta:
        unique_together = ('enrollment', 'lesson')

    def __str__(self):
        return f"{self.enrollment} — {self.lesson.title} submission"


# ── Events ───────────────────────────────────────────────────────────────────

class Event(models.Model):
    EVENT_TYPE_CHOICES = [
        ('orientation', 'Orientation'),
        ('welcome',     'Welcome Session'),
        ('training',    'Training'),
        ('webinar',     'Webinar'),
        ('checkin',     'Check-In'),
        ('meeting',     'Meeting'),
    ]

    title           = models.CharField(max_length=300)
    description     = models.TextField(blank=True)
    event_type      = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES, default='meeting')
    start_dt        = models.DateTimeField()
    end_dt          = models.DateTimeField()
    location        = models.CharField(max_length=300, blank=True)
    virtual_link    = models.CharField(max_length=500, blank=True)
    organizer       = models.ForeignKey(
                          settings.AUTH_USER_MODEL,
                          on_delete=models.SET_NULL,
                          null=True,
                          related_name='organized_events',
                      )
    target_audience = models.CharField(max_length=200, blank=True)
    max_attendees   = models.PositiveIntegerField(null=True, blank=True)
    is_recurring      = models.BooleanField(default=False)
    recurrence_rule   = models.CharField(max_length=200, blank=True)
    created_by      = models.ForeignKey(
                          settings.AUTH_USER_MODEL,
                          on_delete=models.SET_NULL,
                          null=True,
                          related_name='created_events',
                      )
    created_at      = models.DateTimeField(auto_now_add=True)
    assigned_members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='assigned_events',
    )

    class Meta:
        ordering = ['start_dt']

    def __str__(self):
        return f"{self.title} ({self.start_dt.date()})"


class EventAttendance(models.Model):
    RSVP_CHOICES = [
        ('accepted',     'Accepted'),
        ('declined',     'Declined'),
        ('maybe',        'Maybe'),
        ('no_response',  'No Response'),
    ]

    event    = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='attendance')
    user     = models.ForeignKey(
                   settings.AUTH_USER_MODEL,
                   on_delete=models.CASCADE,
                   related_name='event_attendance',
               )
    rsvp     = models.CharField(max_length=20, choices=RSVP_CHOICES, default='no_response')
    attended = models.BooleanField(null=True, blank=True)

    class Meta:
        unique_together = ('event', 'user')

    def __str__(self):
        return f"{self.user.username} @ {self.event.title}"


# ── Event Type Config ─────────────────────────────────────────────────────────

class EventTypeConfig(models.Model):
    slug        = models.SlugField(max_length=50, unique=True)
    label       = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active   = models.BooleanField(default=True)
    is_default  = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['label']

    def __str__(self):
        return self.label


class EventSettings(models.Model):
    allow_self_rsvp            = models.BooleanField(default=True)
    rsvp_deadline_hours        = models.PositiveIntegerField(default=0)
    default_duration_minutes   = models.PositiveIntegerField(default=60)
    send_reminders             = models.BooleanField(default=True)
    reminder_hours_before      = models.PositiveIntegerField(default=24)
    require_attendance_marking = models.BooleanField(default=False)
    default_location           = models.CharField(max_length=300, blank=True)
    updated_at                 = models.DateTimeField(auto_now=True)

    def __str__(self):
        return 'Event Settings'


# ── Contributions ─────────────────────────────────────────────────────────────

class Contribution(models.Model):
    TYPE_CHOICES = [
        ('hours',       'Hours Worked'),
        ('task',        'Task Completed'),
        ('deliverable', 'Deliverable'),
    ]
    STATUS_CHOICES = [
        ('pending',  'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    CATEGORY_CHOICES = [
        ('project_work', 'Project Work'),
        ('meetings',     'Meetings'),
        ('learning',     'Learning'),
        ('other',        'Other'),
    ]

    IMPACT_CHOICES = [
        ('low',    'Low'),
        ('medium', 'Medium'),
        ('high',   'High'),
    ]

    member              = models.ForeignKey(
                              OrgMember,
                              on_delete=models.CASCADE,
                              related_name='contributions',
                          )
    title               = models.CharField(max_length=300)
    contribution_type   = models.CharField(max_length=20, choices=TYPE_CHOICES, default='hours')
    category            = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other', blank=True)
    hours               = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    description         = models.TextField(blank=True)
    project_name        = models.CharField(max_length=200, blank=True)
    impact_level        = models.CharField(max_length=10, choices=IMPACT_CHOICES, blank=True)
    collaborators       = models.CharField(max_length=300, blank=True)
    deliverable_url     = models.URLField(blank=True)
    date                = models.DateField()
    status              = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    approved_by         = models.ForeignKey(
                              settings.AUTH_USER_MODEL,
                              on_delete=models.SET_NULL,
                              null=True, blank=True,
                              related_name='approved_contributions',
                          )
    evidence_file       = models.FileField(upload_to='evidence/', null=True, blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.member} — {self.title}"


# ── Check-ins ─────────────────────────────────────────────────────────────────

class CheckIn(models.Model):
    PERIOD_CHOICES = [
        ('weekly',  'Weekly'),
        ('monthly', 'Monthly'),
    ]

    member       = models.ForeignKey(
                       OrgMember,
                       on_delete=models.CASCADE,
                       related_name='checkins',
                   )
    period_type  = models.CharField(max_length=10, choices=PERIOD_CHOICES, default='weekly')
    period_start = models.DateField()
    period_end   = models.DateField()
    responses    = models.JSONField(default=dict)
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_by  = models.ForeignKey(
                       settings.AUTH_USER_MODEL,
                       on_delete=models.SET_NULL,
                       null=True, blank=True,
                       related_name='reviewed_checkins',
                   )
    reviewed_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-period_start']

    def __str__(self):
        return f"{self.member} — {self.period_type} {self.period_start}"


# ── Resources ────────────────────────────────────────────────────────────────

class Resource(models.Model):
    CATEGORY_CHOICES = [
        ('handbook',          'Employee Handbook'),
        ('guide',             'Guide'),
        ('faq',               'FAQ'),
        ('policy',            'Policy'),
        ('training_material', 'Training Material'),
    ]

    title        = models.CharField(max_length=300)
    description  = models.TextField(blank=True)
    category     = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='guide')
    file         = models.FileField(upload_to='resources/', null=True, blank=True)
    external_url = models.CharField(max_length=500, blank=True)
    created_by   = models.ForeignKey(
                       settings.AUTH_USER_MODEL,
                       on_delete=models.SET_NULL,
                       null=True,
                       related_name='created_resources',
                   )
    is_published = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'title']

    def __str__(self):
        return self.title


# ── Audit Log ────────────────────────────────────────────────────────────────

class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('create',  'Create'),
        ('update',  'Update'),
        ('delete',  'Delete'),
        ('login',   'Login'),
        ('export',  'Export'),
        ('approve', 'Approve'),
    ]

    actor       = models.ForeignKey(
                      settings.AUTH_USER_MODEL,
                      on_delete=models.SET_NULL,
                      null=True,
                      related_name='audit_logs',
                  )
    action      = models.CharField(max_length=20, choices=ACTION_CHOICES)
    module      = models.CharField(max_length=100)
    record_id   = models.IntegerField(null=True, blank=True)
    record_repr = models.CharField(max_length=300, blank=True)
    changes     = models.JSONField(default=dict, blank=True)
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['module', 'action']),
            models.Index(fields=['created_at']),
            models.Index(fields=['actor']),
        ]

    def __str__(self):
        actor = self.actor.username if self.actor else 'system'
        return f"{actor} {self.action} {self.module} #{self.record_id}"


# ── Org Settings ──────────────────────────────────────────────────────────────

class OrgSettings(models.Model):
    org_name      = models.CharField(max_length=200, default='My Organisation')
    description   = models.TextField(blank=True)
    logo          = models.ImageField(upload_to='org/', null=True, blank=True)
    timezone      = models.CharField(max_length=50, default='UTC')
    contact_email = models.EmailField(blank=True)
    website       = models.URLField(blank=True)
    # Training settings
    training_auto_enroll_mandatory = models.BooleanField(default=False)
    training_certificate_enabled   = models.BooleanField(default=True)
    training_reminder_days         = models.PositiveSmallIntegerField(default=3)
    training_default_pass_score    = models.PositiveSmallIntegerField(default=70)
    # Contribution settings
    contribution_enabled           = models.BooleanField(default=True)
    contribution_require_evidence  = models.BooleanField(default=False)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = verbose_name_plural = 'Organisation Settings'

    def __str__(self):
        return self.org_name


# ── Agreements ────────────────────────────────────────────────────────────────

class OrgAgreement(models.Model):
    STATUS_CHOICES = [
        ('draft',    'Draft'),
        ('active',   'Active'),
        ('archived', 'Archived'),
    ]

    title      = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    file       = models.FileField(upload_to='agreements/', null=True, blank=True)
    version    = models.CharField(max_length=20, default='1.0')
    status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_by = models.ForeignKey(
                     settings.AUTH_USER_MODEL,
                     on_delete=models.SET_NULL,
                     null=True,
                     related_name='created_agreements',
                 )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} v{self.version}"


class MemberAgreementSignature(models.Model):
    agreement  = models.ForeignKey(
                     OrgAgreement,
                     on_delete=models.CASCADE,
                     related_name='signatures',
                 )
    member     = models.ForeignKey(
                     OrgMember,
                     on_delete=models.CASCADE,
                     related_name='agreement_signatures',
                 )
    signed_at  = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        unique_together = ('agreement', 'member')

    def __str__(self):
        return f"{self.member} signed {self.agreement.title}"


# ── Recruitment ───────────────────────────────────────────────────────────────

class RecruitmentRequest(models.Model):
    STATUS_CHOICES = [
        ('pending',  'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    submitted_by    = models.ForeignKey(
                          OrgMember,
                          on_delete=models.CASCADE,
                          related_name='recruitment_requests',
                      )
    candidate_name  = models.CharField(max_length=200)
    candidate_email = models.EmailField(blank=True)
    message         = models.TextField(blank=True)
    role_suggested  = models.CharField(max_length=200, blank=True)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by     = models.ForeignKey(
                          settings.AUTH_USER_MODEL,
                          on_delete=models.SET_NULL,
                          null=True, blank=True,
                          related_name='reviewed_recruitment_requests',
                      )
    reviewer_note   = models.TextField(blank=True)
    reviewed_at     = models.DateTimeField(null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.submitted_by} → {self.candidate_name}"


class AccessRequest(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')]
    user           = models.ForeignKey(
                         settings.AUTH_USER_MODEL,
                         on_delete=models.CASCADE,
                         related_name='access_requests',
                     )
    requested_role = models.ForeignKey(
                         'InternalRole',
                         null=True, blank=True,
                         on_delete=models.SET_NULL,
                     )
    department     = models.ForeignKey(
                         'Department',
                         null=True, blank=True,
                         on_delete=models.SET_NULL,
                     )
    message        = models.TextField(blank=True)
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by    = models.ForeignKey(
                         settings.AUTH_USER_MODEL,
                         null=True, blank=True,
                         on_delete=models.SET_NULL,
                         related_name='reviewed_access_requests',
                     )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} access request ({self.status})"


class ExtensionRequest(models.Model):
    STATUS_CHOICES = [
        ('pending',  'Pending'),
        ('approved', 'Approved'),
        ('denied',   'Denied'),
    ]

    user           = models.ForeignKey(
                         settings.AUTH_USER_MODEL,
                         on_delete=models.CASCADE,
                         related_name='extension_requests',
                     )
    course         = models.ForeignKey(
                         'TrainingCourse',
                         on_delete=models.CASCADE,
                         related_name='extension_requests',
                     )
    enrollment     = models.ForeignKey(
                         'TrainingEnrollment',
                         on_delete=models.CASCADE,
                         related_name='extension_requests',
                     )
    days_requested = models.PositiveIntegerField()
    reason         = models.TextField()
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_note     = models.TextField(blank=True)
    reviewed_by    = models.ForeignKey(
                         settings.AUTH_USER_MODEL,
                         null=True, blank=True,
                         on_delete=models.SET_NULL,
                         related_name='reviewed_extension_requests',
                     )
    reviewed_at    = models.DateTimeField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} — {self.course.title} extension ({self.status})"


# ── Org Chat ──────────────────────────────────────────────────────────────────

class OrgChatChannel(models.Model):
    CHANNEL_TYPE_CHOICES = [
        ('general',       'General'),
        ('announcements', 'Announcements'),
        ('random',        'Random'),
        ('department',    'Department'),
        ('custom',        'Custom'),
    ]
    name         = models.CharField(max_length=80)
    description  = models.TextField(blank=True)
    channel_type = models.CharField(max_length=20, choices=CHANNEL_TYPE_CHOICES, default='custom')
    created_by   = models.ForeignKey(
                       settings.AUTH_USER_MODEL, null=True, blank=True,
                       on_delete=models.SET_NULL, related_name='created_org_channels',
                   )
    is_archived  = models.BooleanField(default=False)
    members      = models.ManyToManyField(
                       settings.AUTH_USER_MODEL,
                       through='OrgChatChannelMember',
                       related_name='org_chat_channels',
                       blank=True,
                   )
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['channel_type', 'name']

    def __str__(self):
        return f'#{self.name}'


class OrgChatChannelMember(models.Model):
    channel   = models.ForeignKey(OrgChatChannel, on_delete=models.CASCADE, related_name='memberships')
    user      = models.ForeignKey(
                    settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                    related_name='org_channel_memberships',
                )
    joined_at = models.DateTimeField(auto_now_add=True)
    is_admin  = models.BooleanField(default=False)

    class Meta:
        unique_together = ('channel', 'user')


class OrgChatMessage(models.Model):
    channel      = models.ForeignKey(OrgChatChannel, on_delete=models.CASCADE, related_name='messages')
    sender       = models.ForeignKey(
                       settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                       related_name='org_chat_messages',
                   )
    body         = models.TextField(blank=True)
    attachment   = models.FileField(upload_to='org_chat_attachments/', blank=True, null=True)
    message_type = models.CharField(max_length=20, default='message')
    is_pinned    = models.BooleanField(default=False)
    is_deleted   = models.BooleanField(default=False)
    reply_to     = models.ForeignKey(
                       'self', null=True, blank=True,
                       on_delete=models.SET_NULL, related_name='thread_replies',
                   )
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'[#{self.channel.name}] {self.sender}: {self.body[:40]}'


class OrgChatReaction(models.Model):
    EMOJI_CHOICES = [
        ('like',      '👍'),
        ('love',      '❤️'),
        ('clap',      '👏'),
        ('fire',      '🔥'),
        ('celebrate', '🎉'),
    ]
    message = models.ForeignKey(OrgChatMessage, on_delete=models.CASCADE, related_name='reactions')
    user    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    emoji   = models.CharField(max_length=20, choices=EMOJI_CHOICES)

    class Meta:
        unique_together = ('message', 'user', 'emoji')


class OrgDMMessage(models.Model):
    sender     = models.ForeignKey(
                     settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                     related_name='org_dms_sent',
                 )
    receiver   = models.ForeignKey(
                     settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                     related_name='org_dms_received',
                 )
    body       = models.TextField(blank=True)
    attachment = models.FileField(upload_to='org_dm_attachments/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read    = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'DM {self.sender} → {self.receiver}: {self.body[:40]}'


class OrgChatPoll(models.Model):
    channel        = models.ForeignKey(OrgChatChannel, on_delete=models.CASCADE, related_name='polls')
    author         = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    question       = models.TextField()
    allow_multiple = models.BooleanField(default=False)
    is_closed      = models.BooleanField(default=False)
    created_at     = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Poll: {self.question[:60]}'


class OrgChatPollOption(models.Model):
    poll   = models.ForeignKey(OrgChatPoll, on_delete=models.CASCADE, related_name='options')
    text   = models.CharField(max_length=200)
    voters = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True)

    def __str__(self):
        return self.text
