from django.db import models
from django.conf import settings


# ---------------------------------------------------------------------------
# 1. StudentProfile
# ---------------------------------------------------------------------------

class StudentProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='student_profile',
        limit_choices_to={'role': 'student'},
    )
    bio = models.TextField(blank=True)
    headline = models.CharField(max_length=120, blank=True, null=True, help_text='One-line professional headline')
    pronouns = models.CharField(max_length=50, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True)
    linkedin_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True, null=True)
    portfolio_url = models.URLField(blank=True, null=True)
    profile_picture = models.ImageField(
        upload_to='profile_pics/students/', blank=True, null=True
    )
    # Personal
    city = models.CharField(max_length=100, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    # Academic / professional
    university = models.CharField(max_length=255, blank=True, null=True)
    field_of_study = models.CharField(max_length=255, blank=True, null=True)
    graduation_year = models.CharField(max_length=4, blank=True, null=True)
    CAREER_STAGE_CHOICES = [
        ('high_school',    'High school student'),
        ('undergraduate',  'Undergraduate student'),
        ('postgraduate',   'Postgraduate student'),
        ('early_career',   'Early career (0–3 years)'),
        ('mid_career',     'Mid career (3–10 years)'),
        ('career_changer', 'Career changer'),
        ('other',          'Other'),
    ]
    career_stage = models.CharField(max_length=30, choices=CAREER_STAGE_CHOICES, blank=True, null=True)
    skills = models.TextField(blank=True, null=True, help_text='Comma-separated list of skills')
    # Interests & hobbies
    interests = models.TextField(blank=True, null=True, help_text='Areas of interest (comma-separated or free text)')
    hobbies = models.TextField(blank=True, null=True, help_text='Hobbies and things you enjoy outside of work/study')
    # Mentee introduction
    mentorship_goals = models.TextField(blank=True, null=True, help_text='What are you hoping to achieve through mentorship?')
    background_experience = models.TextField(blank=True, null=True, help_text='Your background / experience level')
    mentor_expectations = models.TextField(blank=True, null=True, help_text='What are you looking for in a mentor?')
    availability_info = models.TextField(blank=True, default='', help_text='Hours/week, time zone, preferred days')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Student: {self.user.username}"

    class Meta:
        verbose_name = 'Student Profile'
        verbose_name_plural = 'Student Profiles'
        ordering = ['user__username']


# ---------------------------------------------------------------------------
# 2. MentorProfile
# ---------------------------------------------------------------------------

class MentorProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mentor_profile',
        limit_choices_to={'role': 'mentor'},
    )
    # Personal
    bio                 = models.TextField(blank=True)
    headline            = models.CharField(max_length=160, blank=True)
    nationality         = models.CharField(max_length=100, blank=True)
    city                = models.CharField(max_length=100, blank=True)
    profile_picture     = models.ImageField(upload_to='profile_pics/mentors/', blank=True, null=True)
    # Contact & links
    phone               = models.CharField(max_length=30, blank=True)
    linkedin_url        = models.URLField(blank=True)
    github_url          = models.URLField(blank=True)
    website_url         = models.URLField(blank=True)
    # Professional background
    current_role        = models.CharField(max_length=120, blank=True)
    current_company     = models.CharField(max_length=120, blank=True)
    years_experience    = models.CharField(max_length=10, blank=True)
    education           = models.CharField(max_length=255, blank=True)
    languages           = models.CharField(max_length=300, blank=True)
    # Expertise
    expertise           = models.CharField(max_length=255, blank=True)
    mentoring_areas     = models.CharField(max_length=500, blank=True)
    countries_expertise = models.CharField(max_length=300, blank=True)
    # Mentoring approach
    mentoring_style     = models.TextField(blank=True)
    what_i_offer        = models.TextField(blank=True)
    # Domain & matching
    DOMAIN_CHOICES = [
        ('stem',            'STEM'),
        ('business',        'Business & Economics'),
        ('humanities',      'Humanities'),
        ('medicine',        'Medicine & Health Sciences'),
        ('law',             'Law'),
        ('arts',            'Arts & Design'),
        ('social_sciences', 'Social Sciences'),
        ('other',           'Other'),
    ]
    domain              = models.CharField(max_length=30, choices=DOMAIN_CHOICES, blank=True)
    LEVEL_CHOICES = [
        ('undergraduate', 'Undergraduate'),
        ('masters',       "Master's"),
        ('phd',           'PhD'),
        ('any',           'Any level'),
    ]
    preferred_student_level = models.CharField(max_length=20, choices=LEVEL_CHOICES, blank=True)
    timezone            = models.CharField(max_length=60, blank=True)
    # Academic background (mentor's own degrees)
    own_degree          = models.CharField(max_length=60, blank=True, help_text='e.g. BSc, MSc, PhD, MBA')
    own_field_of_study  = models.CharField(max_length=150, blank=True)
    own_university      = models.CharField(max_length=200, blank=True)
    own_graduation_year = models.CharField(max_length=4, blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Mentor: {self.user.username}"

    class Meta:
        verbose_name = 'Mentor Profile'
        verbose_name_plural = 'Mentor Profiles'
        ordering = ['user__username']


# ---------------------------------------------------------------------------
# 3. Assignment  (student ↔ mentor, created by superadmin)
# ---------------------------------------------------------------------------

class Assignment(models.Model):
    student = models.OneToOneField(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='assignment',
    )
    mentor = models.ForeignKey(
        MentorProfile,
        on_delete=models.SET_NULL,
        null=True,
        related_name='assignments',
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='assignments_made',
        limit_choices_to={'role': 'superadmin'},
    )
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        mentor_name = self.mentor.user.username if self.mentor else "Unassigned"
        return f"{self.student.user.username} → {mentor_name}"

    class Meta:
        verbose_name = 'Assignment'
        verbose_name_plural = 'Assignments'
        ordering = ['-assigned_at']


# ---------------------------------------------------------------------------
# 4. Message  (mentor ↔ superadmin direct chat)
# ---------------------------------------------------------------------------

class Message(models.Model):
    sender   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages',
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_messages',
    )
    body       = models.TextField(blank=True)
    attachment = models.FileField(upload_to='message_attachments/', blank=True, null=True)
    timestamp  = models.DateTimeField(auto_now_add=True)
    is_read    = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.sender.username} → {self.receiver.username}: {self.body[:40]}"

    class Meta:
        verbose_name = 'Message'
        verbose_name_plural = 'Messages'
        ordering = ['timestamp']


# ---------------------------------------------------------------------------
# 9. Workspace  (mentor-created group space)
# ---------------------------------------------------------------------------

class Workspace(models.Model):
    COLORS = ['indigo', 'blue', 'emerald', 'amber', 'rose', 'violet']

    CATEGORY_CHOICES = [
        ('career_coaching',   'Career Coaching'),
        ('skill_development', 'Skill Development'),
        ('academic',          'Academic Support'),
        ('interview_prep',    'Interview Prep'),
        ('project',           'Project-Based'),
        ('personal_growth',   'Personal Growth'),
        ('networking',        'Networking'),
        ('other',             'Other'),
    ]
    PRIVACY_PUBLIC  = 'public'
    PRIVACY_PRIVATE = 'private'
    PRIVACY_SECRET  = 'secret'
    PRIVACY_CHOICES = [
        (PRIVACY_PUBLIC,  'Public'),
        (PRIVACY_PRIVATE, 'Private'),
        (PRIVACY_SECRET,  'Secret'),
    ]
    DEGREE_CHOICES = [
        ('bachelor', 'Bachelor'),
        ('master',   'Master'),
        ('phd',      'PhD'),
        ('exchange', 'Exchange'),
        ('other',    'Other'),
    ]
    STATUS_ACTIVE      = 'active'
    STATUS_WINDING     = 'winding_down'
    STATUS_ARCHIVED    = 'archived'
    STATUS_CHOICES = [
        (STATUS_ACTIVE,   'Active'),
        (STATUS_WINDING,  'Winding Down'),
        (STATUS_ARCHIVED, 'Archived'),
    ]
    LEVEL_CHOICES = [
        ('beginner',     'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced',     'Advanced'),
    ]
    GRADE_DISPLAY_CHOICES = [
        ('points',     'Points'),
        ('percentage', 'Percentage'),
        ('letter',     'Letter Grade'),
    ]

    mentor = models.ForeignKey(
        MentorProfile,
        on_delete=models.CASCADE,
        related_name='workspaces',
    )
    # Identity
    slug              = models.SlugField(max_length=120, unique=True, blank=True)
    accent_color      = models.CharField(max_length=20, blank=True, default='blue')
    logo              = models.ImageField(upload_to='workspace_logos/', blank=True, null=True)
    # Core
    name              = models.CharField(max_length=120)
    description       = models.TextField(blank=True)
    cover_image       = models.ImageField(upload_to='workspace_covers/', blank=True, null=True)
    icon_emoji        = models.CharField(max_length=10, blank=True)
    tags              = models.CharField(max_length=255, blank=True)
    announcement      = models.TextField(blank=True)
    # Classification
    category          = models.CharField(max_length=30, choices=CATEGORY_CHOICES, blank=True)
    level             = models.CharField(max_length=15, choices=LEVEL_CHOICES, blank=True)
    language          = models.CharField(max_length=50, blank=True)
    target_country    = models.CharField(max_length=100, blank=True)
    target_degree     = models.CharField(max_length=20, choices=DEGREE_CHOICES, blank=True)
    estimated_duration = models.CharField(max_length=100, blank=True)
    # Scheduling
    target_deadline    = models.DateField(null=True, blank=True)
    course_start_date  = models.DateField(null=True, blank=True)
    course_end_date    = models.DateField(null=True, blank=True)
    enrollment_deadline = models.DateField(null=True, blank=True)
    office_hours       = models.CharField(max_length=200, blank=True)
    # Upcoming event (shown on workspace home)
    event_title        = models.CharField(max_length=200, blank=True)
    event_date         = models.DateField(null=True, blank=True)
    event_start_time   = models.TimeField(null=True, blank=True)
    event_end_time     = models.TimeField(null=True, blank=True)
    event_description  = models.TextField(blank=True)
    event_link         = models.URLField(blank=True)
    # Access
    privacy           = models.CharField(max_length=10, choices=PRIVACY_CHOICES, default=PRIVACY_PUBLIC)
    max_members       = models.PositiveIntegerField(null=True, blank=True)
    auto_accept       = models.BooleanField(default=False)
    allow_self_unenroll = models.BooleanField(default=True)
    invite_token      = models.CharField(max_length=64, blank=True, db_index=True)
    # Engagement
    goal              = models.TextField(blank=True)
    welcome_message   = models.TextField(blank=True)
    pinned_url        = models.URLField(blank=True)
    pinned_url_title  = models.CharField(max_length=200, blank=True)
    syllabus_url      = models.URLField(blank=True)
    # Feature toggles
    enable_chat       = models.BooleanField(default=True)
    enable_resources  = models.BooleanField(default=True)
    enable_tasks      = models.BooleanField(default=True)
    enable_progress   = models.BooleanField(default=False)
    # Progress & grading
    grade_display          = models.CharField(max_length=15, choices=GRADE_DISPLAY_CHOICES, default='points')
    completion_certificate = models.BooleanField(default=False)
    min_completion_pct     = models.PositiveIntegerField(default=80)
    # Status
    workspace_status  = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    is_active         = models.BooleanField(default=True)
    # Related
    related_workspace = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='related_to'
    )
    created_at        = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = 'Workspace'
        verbose_name_plural = 'Workspaces'
        ordering = ['-created_at']


# ---------------------------------------------------------------------------
# 10. WorkspaceMembership  (student ↔ workspace request/approval)
# ---------------------------------------------------------------------------

class WorkspaceMembership(models.Model):
    STATUS_PENDING  = 'pending'
    STATUS_INVITED  = 'invited'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES  = [
        (STATUS_PENDING,  'Pending'),
        (STATUS_INVITED,  'Invited'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    workspace    = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='memberships')
    student      = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='workspace_memberships')
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('workspace', 'student')
        verbose_name = 'Workspace Membership'
        verbose_name_plural = 'Workspace Memberships'

    def __str__(self):
        return f"{self.student.user.username} → {self.workspace.name} ({self.status})"


# ---------------------------------------------------------------------------
# 11a. WorkspaceMentor  (another mentor invited with full write access)
# ---------------------------------------------------------------------------

class WorkspaceMentor(models.Model):
    STATUS_INVITED = 'invited'
    STATUS_ACTIVE  = 'active'
    STATUS_CHOICES = [
        (STATUS_INVITED, 'Invited'),
        (STATUS_ACTIVE,  'Active'),
    ]

    workspace  = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='workspace_mentors')
    mentor     = models.ForeignKey(MentorProfile, on_delete=models.CASCADE, related_name='mentor_workspaces')
    status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_INVITED)
    invited_at = models.DateTimeField(auto_now_add=True)
    joined_at  = models.DateTimeField(null=True, blank=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+'
    )

    class Meta:
        unique_together = ('workspace', 'mentor')
        verbose_name = 'Workspace Mentor'
        verbose_name_plural = 'Workspace Mentors'

    def __str__(self):
        return f"{self.mentor.user.username} mentors in {self.workspace.name} ({self.status})"


# ---------------------------------------------------------------------------
# 11b. WorkspaceOnboardingQuestion / WorkspaceOnboardingAnswer
# ---------------------------------------------------------------------------

class WorkspaceOnboardingQuestion(models.Model):
    workspace     = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='onboarding_questions')
    question_text = models.CharField(max_length=500)
    order         = models.PositiveIntegerField(default=0)
    required      = models.BooleanField(default=False)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = 'Workspace Onboarding Question'
        verbose_name_plural = 'Workspace Onboarding Questions'

    def __str__(self):
        return f"[{self.workspace.name}] {self.question_text[:60]}"


class WorkspaceOnboardingAnswer(models.Model):
    question     = models.ForeignKey(WorkspaceOnboardingQuestion, on_delete=models.CASCADE, related_name='answers')
    student      = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='ws_onboarding_answers')
    answer_text  = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('question', 'student')]
        verbose_name = 'Workspace Onboarding Answer'
        verbose_name_plural = 'Workspace Onboarding Answers'

    def __str__(self):
        return f"{self.student.user.username} → Q{self.question_id}"
# ---------------------------------------------------------------------------

class WorkspaceResource(models.Model):
    TYPE_FILE = 'file'
    TYPE_LINK = 'link'
    TYPE_NOTE = 'note'
    TYPE_CHOICES = [
        (TYPE_FILE, 'File'),
        (TYPE_LINK, 'Link'),
        (TYPE_NOTE, 'Note'),
    ]
    CAT_DOCUMENTS     = 'documents'
    CAT_PRESENTATIONS = 'presentations'
    CAT_GUIDES        = 'guides'
    CAT_LINKS         = 'links'
    CAT_OTHER         = 'other'
    CATEGORY_CHOICES = [
        (CAT_DOCUMENTS,     'Documents'),
        (CAT_PRESENTATIONS, 'Presentations'),
        (CAT_GUIDES,        'Guides'),
        (CAT_LINKS,         'Links'),
        (CAT_OTHER,         'Other'),
    ]

    workspace     = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='resources')
    title         = models.CharField(max_length=255)
    description   = models.TextField(blank=True)
    resource_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    category      = models.CharField(max_length=30, choices=CATEGORY_CHOICES, blank=True, default='other')
    file          = models.FileField(upload_to='workspace_resources/', null=True, blank=True)
    url           = models.URLField(blank=True)
    body          = models.TextField(blank=True, help_text='Content for note type resources')
    posted_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='workspace_resources'
    )
    is_template   = models.BooleanField(default=False, help_text='Mark as a downloadable template for members')
    is_hidden     = models.BooleanField(default=False, help_text='Hidden from students when True')
    is_featured   = models.BooleanField(default=False)
    created_at    = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.resource_type.upper()}: {self.title}"

    class Meta:
        verbose_name = 'Workspace Resource'
        verbose_name_plural = 'Workspace Resources'
        ordering = ['-created_at']


# ---------------------------------------------------------------------------
# 12. Notification
# ---------------------------------------------------------------------------

class Notification(models.Model):
    TYPE_STEP_SUBMITTED  = 'step_submitted'
    TYPE_STEP_REVIEWED   = 'step_reviewed'
    TYPE_APP_STATUS      = 'app_status'
    TYPE_WS_REQUEST      = 'ws_request'
    TYPE_WS_APPROVED     = 'ws_approved'
    TYPE_WS_REJECTED     = 'ws_rejected'
    TYPE_WS_INVITE       = 'ws_invite'
    TYPE_MENTOR_INVITE   = 'mentor_invite'
    TYPE_MESSAGE         = 'new_message'
    TYPE_FEED_POST       = 'feed_post'
    TYPE_SESSION         = 'session'
    TYPE_DEADLINE        = 'deadline'
    TYPE_MENTION         = 'mention'
    TYPE_PEER_REVIEW     = 'peer_review_assigned'
    TYPE_CHOICES = [
        (TYPE_STEP_SUBMITTED, 'Step Submitted'),
        (TYPE_STEP_REVIEWED,  'Step Reviewed'),
        (TYPE_APP_STATUS,     'Application Status Changed'),
        (TYPE_WS_REQUEST,     'Workspace Join Request'),
        (TYPE_WS_APPROVED,    'Workspace Request Approved'),
        (TYPE_WS_REJECTED,    'Workspace Request Rejected'),
        (TYPE_WS_INVITE,      'Workspace Invitation'),
        (TYPE_MENTOR_INVITE,   'Workspace Mentor Invite'),
        (TYPE_MESSAGE,        'New Message'),
        (TYPE_FEED_POST,      'New Feed Post'),
        (TYPE_SESSION,        'Session Booked'),
        (TYPE_DEADLINE,       'Deadline Reminder'),
        ('task_reminder',     'Personal Task Reminder'),
        (TYPE_MENTION,        'Mentioned in Comment'),
        (TYPE_PEER_REVIEW,    'Peer Review Assigned'),
    ]

    recipient  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications'
    )
    notif_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title      = models.CharField(max_length=255)
    body       = models.TextField(blank=True)
    link       = models.CharField(max_length=255, blank=True, help_text='Frontend route to navigate to')
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'

    def __str__(self):
        return f"[{self.notif_type}] → {self.recipient.username}"


# ---------------------------------------------------------------------------
# 13. ContactRequest
# ---------------------------------------------------------------------------

class ContactRequest(models.Model):
    STATUS_PENDING  = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_DECLINED = 'declined'
    STATUS_CHOICES  = [
        (STATUS_PENDING,  'Pending'),
        (STATUS_ACCEPTED, 'Accepted'),
        (STATUS_DECLINED, 'Declined'),
    ]

    sender     = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_contact_requests'
    )
    receiver   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_contact_requests'
    )
    status     = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('sender', 'receiver')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sender.username} → {self.receiver.username} ({self.status})"


# ---------------------------------------------------------------------------
# 14. Block
# ---------------------------------------------------------------------------

class Block(models.Model):
    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocks_made'
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocks_received'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.blocker.username} blocked {self.blocked.username}"


# ---------------------------------------------------------------------------
# 15. Post
# ---------------------------------------------------------------------------

class Post(models.Model):
    TYPE_GENERAL = 'general'
    TYPE_EVENT   = 'event'
    TYPE_CHOICES = [(TYPE_GENERAL, 'General'), (TYPE_EVENT, 'Event')]

    author          = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts'
    )
    post_type       = models.CharField(max_length=10, choices=TYPE_CHOICES, default=TYPE_GENERAL)
    title           = models.CharField(max_length=255)
    body            = models.TextField(blank=True)
    image           = models.ImageField(upload_to='feed/', blank=True, null=True)
    link_url        = models.URLField(blank=True)
    link_title      = models.CharField(max_length=255, blank=True)
    event_date      = models.DateTimeField(null=True, blank=True)
    event_location  = models.CharField(max_length=255, blank=True)
    tags            = models.CharField(max_length=500, blank=True)
    allow_comments  = models.BooleanField(default=True)
    allow_reactions = models.BooleanField(default=True)
    is_pinned       = models.BooleanField(default=False)
    is_hidden       = models.BooleanField(default=False)
    workspace       = models.ForeignKey(
        'Workspace', on_delete=models.CASCADE,
        related_name='posts', null=True, blank=True
    )
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-created_at']

    def __str__(self):
        return f"{self.title} by {self.author.username}"


# ---------------------------------------------------------------------------
# 16. PostReaction
# ---------------------------------------------------------------------------

class PostReaction(models.Model):
    EMOJI_CHOICES = [
        ('like',      'Like'),
        ('love',      'Love'),
        ('clap',      'Clap'),
        ('fire',      'Fire'),
        ('celebrate', 'Celebrate'),
    ]

    post  = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reactions')
    user  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='post_reactions'
    )
    emoji = models.CharField(max_length=10, choices=EMOJI_CHOICES)

    class Meta:
        unique_together = ('post', 'user')

    def __str__(self):
        return f"{self.user.username} reacted {self.emoji} to post {self.post_id}"


# ---------------------------------------------------------------------------
# 17. PostComment
# ---------------------------------------------------------------------------

class PostComment(models.Model):
    post       = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author     = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='post_comments'
    )
    body       = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.author.username} on post {self.post_id}"


# ---------------------------------------------------------------------------
# 18. MentorAvailabilitySlot  (recurring weekly availability)
# ---------------------------------------------------------------------------

class MentorAvailabilitySlot(models.Model):
    DAY_CHOICES = [
        (0, 'Monday'), (1, 'Tuesday'), (2, 'Wednesday'),
        (3, 'Thursday'), (4, 'Friday'), (5, 'Saturday'), (6, 'Sunday'),
    ]

    mentor     = models.ForeignKey(
        'MentorProfile', on_delete=models.CASCADE, related_name='availability_slots'
    )
    day_of_week = models.IntegerField(choices=DAY_CHOICES)
    start_time  = models.TimeField()
    end_time    = models.TimeField()

    class Meta:
        ordering = ['day_of_week', 'start_time']

    def __str__(self):
        return f"{self.mentor} — {self.get_day_of_week_display()} {self.start_time}–{self.end_time}"


# ---------------------------------------------------------------------------
# 19. Session
# ---------------------------------------------------------------------------

class Session(models.Model):
    STATUS_PENDING   = 'pending'
    STATUS_CONFIRMED = 'confirmed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES   = [
        (STATUS_PENDING,   'Pending'),
        (STATUS_CONFIRMED, 'Confirmed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    mentor       = models.ForeignKey(
        'MentorProfile', on_delete=models.CASCADE, related_name='sessions'
    )
    student      = models.ForeignKey(
        'StudentProfile', on_delete=models.CASCADE, related_name='sessions'
    )
    date         = models.DateField()
    start_time   = models.TimeField()
    end_time     = models.TimeField()
    title        = models.CharField(max_length=255, blank=True)
    meeting_link = models.CharField(max_length=255, blank=True)
    status       = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING)
    notes        = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'start_time']

    def __str__(self):
        return f"Session {self.mentor} ↔ {self.student} on {self.date}"


# ---------------------------------------------------------------------------
# 13. MentorRating
# ---------------------------------------------------------------------------

class MentorRating(models.Model):
    mentor    = models.ForeignKey('MentorProfile', on_delete=models.CASCADE, related_name='ratings')
    student   = models.ForeignKey('StudentProfile', on_delete=models.CASCADE, related_name='mentor_ratings')
    rating    = models.PositiveSmallIntegerField()  # 1-5
    review    = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('mentor', 'student')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student} → {self.mentor}: {self.rating}★"


# ---------------------------------------------------------------------------
# 14. PostBookmark
# ---------------------------------------------------------------------------

class PostBookmark(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bookmarks')
    post = models.ForeignKey('Post', on_delete=models.CASCADE, related_name='bookmarks')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'post')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} bookmarked post {self.post_id}"


# ---------------------------------------------------------------------------
# 15. ProfileView
# ---------------------------------------------------------------------------

class ProfileView(models.Model):
    viewed_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile_views_received'
    )
    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile_views_given'
    )
    viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('viewed_user', 'viewer')
        ordering = ['-viewed_at']

    def __str__(self):
        return f"{self.viewer} viewed {self.viewed_user}"


# ---------------------------------------------------------------------------
# 16. WorkspaceChatMessage
# ---------------------------------------------------------------------------

class WorkspaceChatChannel(models.Model):
    CHANNEL_TYPE_CHOICES = [
        ('general',       'General'),
        ('announcements', 'Announcements'),
        ('random',        'Random'),
        ('custom',        'Custom'),
    ]
    workspace    = models.ForeignKey('Workspace', on_delete=models.CASCADE, related_name='channels')
    name         = models.CharField(max_length=80)
    description  = models.TextField(blank=True)
    channel_type = models.CharField(max_length=15, choices=CHANNEL_TYPE_CHOICES, default='custom')
    created_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='created_channels')
    is_archived  = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"#{self.name} ({self.workspace.name})"


class WorkspaceChatMessage(models.Model):
    workspace    = models.ForeignKey('Workspace', on_delete=models.CASCADE, related_name='chat_messages')
    channel      = models.ForeignKey('WorkspaceChatChannel', on_delete=models.CASCADE,
                                     null=True, blank=True, related_name='messages')
    sender       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                     related_name='workspace_chat_messages')
    body         = models.TextField(blank=True)
    attachment   = models.FileField(upload_to='chat_attachments/', null=True, blank=True)
    message_type = models.CharField(max_length=15, default='message')
    is_pinned    = models.BooleanField(default=False)
    reply_to     = models.ForeignKey('self', on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='replies')
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"WS#{self.workspace_id} — {self.sender}: {self.body[:40]}"


class WorkspaceChatReaction(models.Model):
    EMOJI_CHOICES = [
        ('like',      'Like'),
        ('love',      'Love'),
        ('clap',      'Clap'),
        ('fire',      'Fire'),
        ('celebrate', 'Celebrate'),
    ]
    message = models.ForeignKey(WorkspaceChatMessage, on_delete=models.CASCADE, related_name='reactions')
    user    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name='chat_reactions')
    emoji   = models.CharField(max_length=20, choices=EMOJI_CHOICES)

    class Meta:
        unique_together = ('message', 'user', 'emoji')

    def __str__(self):
        return f"{self.user.username} {self.emoji} on msg#{self.message_id}"


class WorkspaceDMMessage(models.Model):
    workspace  = models.ForeignKey('Workspace', on_delete=models.CASCADE, related_name='dm_messages')
    sender     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                   related_name='ws_dm_sent')
    receiver   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                   related_name='ws_dm_received')
    body       = models.TextField(blank=True)
    attachment = models.FileField(upload_to='ws_dm_attachments/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read    = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"DM {self.sender} → {self.receiver}: {self.body[:40]}"


class WorkspacePoll(models.Model):
    workspace      = models.ForeignKey('Workspace', on_delete=models.CASCADE, related_name='polls')
    channel        = models.ForeignKey('WorkspaceChatChannel', on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name='polls')
    author         = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                       related_name='workspace_polls')
    question       = models.TextField()
    allow_multiple = models.BooleanField(default=False)
    is_closed      = models.BooleanField(default=False)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Poll: {self.question[:60]}"


class WorkspacePollOption(models.Model):
    poll   = models.ForeignKey(WorkspacePoll, on_delete=models.CASCADE, related_name='options')
    text   = models.CharField(max_length=200)
    voters = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True,
                                    related_name='voted_poll_options')

    def __str__(self):
        return f"{self.text} (poll#{self.poll_id})"


# ---------------------------------------------------------------------------
# 17. WorkspaceEvent
# ---------------------------------------------------------------------------

class WorkspaceEvent(models.Model):
    workspace   = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='events')
    title       = models.CharField(max_length=200)
    date        = models.DateField()
    start_time  = models.TimeField(null=True, blank=True)
    end_time    = models.TimeField(null=True, blank=True)
    description = models.TextField(blank=True)
    link        = models.URLField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'start_time']


# ---------------------------------------------------------------------------
# 18. PersonalTask
# ---------------------------------------------------------------------------

class PersonalTask(models.Model):
    REMINDER_CHOICES = [
        (0,    'At time of event'),
        (15,   '15 minutes before'),
        (30,   '30 minutes before'),
        (60,   '1 hour before'),
        (120,  '2 hours before'),
        (1440, '1 day before'),
    ]

    student         = models.ForeignKey('StudentProfile', on_delete=models.CASCADE, related_name='personal_tasks')
    title           = models.CharField(max_length=200)
    date            = models.DateField()
    start_time      = models.TimeField(null=True, blank=True)
    end_time        = models.TimeField(null=True, blank=True)
    description     = models.TextField(blank=True)
    reminder_offset = models.IntegerField(null=True, blank=True)
    reminder_sent   = models.BooleanField(default=False)
    is_done         = models.BooleanField(default=False)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'start_time']

    def __str__(self):
        return f"{self.student.user.username} — {self.title} ({self.date})"


# ---------------------------------------------------------------------------
# Workspace Task System
# ---------------------------------------------------------------------------

class WorkspaceTaskSection(models.Model):
    """Groups of tasks within a workspace (like Moodle course sections)."""
    workspace   = models.ForeignKey('Workspace', on_delete=models.CASCADE, related_name='task_sections')
    title       = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    color       = models.CharField(max_length=20, blank=True, default='gray')
    order       = models.PositiveSmallIntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.workspace.name} — Section: {self.title}"


class WorkspaceTask(models.Model):
    TYPE_ASSIGNMENT = 'assignment'
    TYPE_PROJECT    = 'project'
    TYPE_RESOURCE   = 'resource'
    TYPE_QUIZ       = 'quiz'
    TYPE_CHOICES = [
        (TYPE_ASSIGNMENT, 'Assignment'),
        (TYPE_PROJECT,    'Project'),
        (TYPE_RESOURCE,   'Resource'),
        (TYPE_QUIZ,       'Quiz'),
    ]

    STATUS_DRAFT     = 'draft'
    STATUS_PUBLISHED = 'published'
    STATUS_ARCHIVED  = 'archived'
    STATUS_CHOICES = [
        (STATUS_DRAFT,     'Draft'),
        (STATUS_PUBLISHED, 'Published'),
        (STATUS_ARCHIVED,  'Archived'),
    ]

    workspace    = models.ForeignKey('Workspace', on_delete=models.CASCADE, related_name='workspace_tasks')
    title        = models.CharField(max_length=255)
    description  = models.TextField(blank=True)
    task_type    = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_ASSIGNMENT)
    status       = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    due_date     = models.DateField(null=True, blank=True)
    available_from  = models.DateTimeField(null=True, blank=True, help_text='Task becomes visible to students from this datetime')
    available_until = models.DateTimeField(null=True, blank=True, help_text='Task auto-hides after this datetime')
    peer_visible = models.BooleanField(default=False)
    is_template  = models.BooleanField(default=False)
    # Feature 16: Peer review
    peer_review_enabled = models.BooleanField(default=False)
    peer_review_count   = models.PositiveSmallIntegerField(default=1)
    # Feature 17: Late submission policy
    LATE_ACCEPT  = 'accept'
    LATE_REJECT  = 'reject'
    LATE_PENALTY = 'penalty'
    LATE_CHOICES = [
        (LATE_ACCEPT,  'Accept Late'),
        (LATE_REJECT,  'Reject Late'),
        (LATE_PENALTY, 'Accept with Penalty Flag'),
    ]
    late_policy        = models.CharField(max_length=10, choices=LATE_CHOICES, default=LATE_ACCEPT)
    grace_period_hours = models.PositiveSmallIntegerField(default=0)
    assigned_members = models.ManyToManyField(
        'StudentProfile', blank=True, related_name='selective_tasks',
        help_text='If empty, assigned to all workspace members; if set, only these students.',
    )
    section = models.ForeignKey(
        'WorkspaceTaskSection', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='tasks',
    )
    created_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_workspace_tasks',
    )
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date', 'created_at']
        verbose_name = 'Workspace Task'
        verbose_name_plural = 'Workspace Tasks'

    def __str__(self):
        return f"[{self.task_type}] {self.title} ({self.workspace.name})"


class WorkspaceTaskDeliverable(models.Model):
    task        = models.ForeignKey(WorkspaceTask, on_delete=models.CASCADE, related_name='deliverables')
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order       = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.task.title} — {self.title}"


class WorkspaceTaskPrerequisite(models.Model):
    """A task can require other tasks to be completed before it unlocks."""
    task          = models.ForeignKey(WorkspaceTask, on_delete=models.CASCADE, related_name='prerequisites')
    required_task = models.ForeignKey(WorkspaceTask, on_delete=models.CASCADE, related_name='unlocks')

    class Meta:
        unique_together = ('task', 'required_task')

    def __str__(self):
        return f"{self.task.title} requires {self.required_task.title}"


class WorkspaceTaskSubmission(models.Model):
    STATUS_NOT_STARTED   = 'not_started'
    STATUS_IN_PROGRESS   = 'in_progress'
    STATUS_SUBMITTED     = 'submitted'
    STATUS_NEEDS_REVISION = 'needs_revision'
    STATUS_RESUBMITTED   = 'resubmitted'
    STATUS_COMPLETED     = 'completed'
    STATUS_CHOICES = [
        (STATUS_NOT_STARTED,    'Not Started'),
        (STATUS_IN_PROGRESS,    'In Progress'),
        (STATUS_SUBMITTED,      'Submitted'),
        (STATUS_NEEDS_REVISION, 'Needs Revision'),
        (STATUS_RESUBMITTED,    'Resubmitted'),
        (STATUS_COMPLETED,      'Completed'),
    ]

    task              = models.ForeignKey(WorkspaceTask, on_delete=models.CASCADE, related_name='submissions')
    student           = models.ForeignKey('StudentProfile', on_delete=models.CASCADE, related_name='task_submissions')
    status            = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NOT_STARTED)
    assigned_at       = models.DateTimeField(auto_now_add=True)
    submitted_at      = models.DateTimeField(null=True, blank=True)
    completed_at      = models.DateTimeField(null=True, blank=True)
    due_date_override = models.DateField(null=True, blank=True)
    # Feature 17
    is_late       = models.BooleanField(default=False)
    late_override = models.BooleanField(null=True, blank=True)
    reminder_48h_sent = models.BooleanField(default=False)
    reminder_24h_sent = models.BooleanField(default=False)

    class Meta:
        unique_together = ('task', 'student')
        ordering = ['assigned_at']

    def __str__(self):
        return f"{self.student.user.username} — {self.task.title} ({self.status})"

    @property
    def effective_due_date(self):
        return self.due_date_override or self.task.due_date


class WorkspaceTaskDeliverableCheck(models.Model):
    """Tracks whether a student has completed a specific deliverable."""
    submission   = models.ForeignKey(WorkspaceTaskSubmission, on_delete=models.CASCADE, related_name='checks')
    deliverable  = models.ForeignKey(WorkspaceTaskDeliverable, on_delete=models.CASCADE, related_name='checks')
    is_done      = models.BooleanField(default=False)
    done_at      = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('submission', 'deliverable')

    def __str__(self):
        return f"{self.submission} — {self.deliverable.title} ({'done' if self.is_done else 'pending'})"


class WorkspaceTaskComment(models.Model):
    submission = models.ForeignKey(WorkspaceTaskSubmission, on_delete=models.CASCADE, related_name='comments')
    author     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='task_comments')
    text       = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.author.username} on {self.submission}"


class WorkspaceTaskDocument(models.Model):
    submission   = models.ForeignKey(WorkspaceTaskSubmission, on_delete=models.CASCADE, related_name='documents')
    uploaded_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='task_documents')
    title        = models.CharField(max_length=255)
    file         = models.FileField(upload_to='task_documents/')
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} — {self.submission}"


class WorkspaceTaskMentorNote(models.Model):
    """Private notes a mentor writes on a student's submission — students never see these."""
    submission = models.ForeignKey(WorkspaceTaskSubmission, on_delete=models.CASCADE, related_name='mentor_notes')
    author     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='task_mentor_notes')
    text       = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Note by {self.author.username} on {self.submission}"


class WorkspaceTaskStatusEvent(models.Model):
    """Immutable audit log of every status transition on a submission."""
    submission  = models.ForeignKey(WorkspaceTaskSubmission, on_delete=models.CASCADE, related_name='status_events')
    from_status = models.CharField(max_length=20, blank=True)
    to_status   = models.CharField(max_length=20)
    actor       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='task_status_events')
    note        = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.submission} · {self.from_status} → {self.to_status}"


class WorkspaceTaskRubricCriteria(models.Model):
    """A single grading criterion on a task."""
    task        = models.ForeignKey(WorkspaceTask, on_delete=models.CASCADE, related_name='rubric_criteria')
    title       = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    max_points  = models.PositiveSmallIntegerField(default=10)
    order       = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.task.title} — {self.title} ({self.max_points}pts)"


class WorkspaceTaskRubricScore(models.Model):
    """Mentor's score for a single criterion on one submission."""
    submission = models.ForeignKey(WorkspaceTaskSubmission, on_delete=models.CASCADE, related_name='rubric_scores')
    criteria   = models.ForeignKey(WorkspaceTaskRubricCriteria, on_delete=models.CASCADE, related_name='scores')
    points     = models.PositiveSmallIntegerField(default=0)
    feedback   = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('submission', 'criteria')

    def __str__(self):
        return f"{self.submission} — {self.criteria.title}: {self.points}/{self.criteria.max_points}"


# ── Feature 16: Peer Review ───────────────────────────────────────────────────

class WorkspaceTaskPeerReview(models.Model):
    STATUS_ASSIGNED  = 'assigned'
    STATUS_SUBMITTED = 'submitted'
    STATUS_CHOICES = [
        (STATUS_ASSIGNED,  'Assigned'),
        (STATUS_SUBMITTED, 'Submitted'),
    ]

    task                 = models.ForeignKey(WorkspaceTask, on_delete=models.CASCADE, related_name='peer_reviews')
    reviewer             = models.ForeignKey('StudentProfile', on_delete=models.CASCADE, related_name='peer_reviews_given')
    reviewee_submission  = models.ForeignKey(WorkspaceTaskSubmission, on_delete=models.CASCADE, related_name='peer_reviews')
    status               = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_ASSIGNED)
    assigned_at          = models.DateTimeField(auto_now_add=True)
    submitted_at         = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('task', 'reviewer', 'reviewee_submission')
        ordering = ['assigned_at']

    def __str__(self):
        return f"PeerReview: {self.reviewer} reviews {self.reviewee_submission}"


class WorkspaceTaskPeerReviewScore(models.Model):
    peer_review = models.ForeignKey(WorkspaceTaskPeerReview, on_delete=models.CASCADE, related_name='scores')
    criteria    = models.ForeignKey(WorkspaceTaskRubricCriteria, on_delete=models.CASCADE, related_name='peer_scores')
    points      = models.PositiveSmallIntegerField(default=0)
    feedback    = models.TextField(blank=True)

    class Meta:
        unique_together = ('peer_review', 'criteria')


# ── Feature 18: Inline Document Comments ─────────────────────────────────────

class DocumentInlineComment(models.Model):
    document    = models.ForeignKey(WorkspaceTaskDocument, on_delete=models.CASCADE, related_name='inline_comments')
    author      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='doc_inline_comments')
    page_number = models.PositiveSmallIntegerField(default=1)
    x_pct       = models.FloatField(default=50.0)
    y_pct       = models.FloatField(default=50.0)
    body        = models.TextField()
    parent      = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    is_resolved = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['page_number', 'created_at']

    def __str__(self):
        return f"InlineComment on {self.document} p{self.page_number}"


# ── Feature 20: Student Self-Assessment ──────────────────────────────────────

class WorkspaceTaskSelfAssessQuestion(models.Model):
    task  = models.ForeignKey(WorkspaceTask, on_delete=models.CASCADE, related_name='self_assess_questions')
    text  = models.CharField(max_length=255)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.task.title} — Q{self.order}: {self.text[:40]}"


class WorkspaceTaskSelfAssessResponse(models.Model):
    submission = models.ForeignKey(WorkspaceTaskSubmission, on_delete=models.CASCADE, related_name='self_assess_responses')
    question   = models.ForeignKey(WorkspaceTaskSelfAssessQuestion, on_delete=models.CASCADE, related_name='responses')
    rating     = models.PositiveSmallIntegerField()  # 1–5

    class Meta:
        unique_together = ('submission', 'question')

    def __str__(self):
        return f"{self.submission} — Q{self.question_id}: {self.rating}/5"

