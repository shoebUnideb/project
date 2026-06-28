from rest_framework import serializers
from .models import (
    StudentProfile, MentorProfile, Assignment,
    Message, Workspace, WorkspaceMembership, WorkspaceResource,
    PersonalTask, WorkspaceEvent,
    WorkspaceTask, WorkspaceTaskDeliverable, WorkspaceTaskSubmission,
    WorkspaceTaskDeliverableCheck, WorkspaceTaskComment, WorkspaceTaskDocument,
    WorkspaceTaskPrerequisite, WorkspaceTaskMentorNote, WorkspaceTaskStatusEvent,
    WorkspaceTaskSection, WorkspaceTaskRubricCriteria, WorkspaceTaskRubricScore,
    WorkspaceTaskPeerReview, WorkspaceTaskPeerReviewScore,
    DocumentInlineComment,
    WorkspaceTaskSelfAssessQuestion, WorkspaceTaskSelfAssessResponse,
    WorkspaceOnboardingQuestion, WorkspaceOnboardingAnswer,
)
from accounts.serializers import UserSerializer


class StudentProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = StudentProfile
        fields = [
            'id', 'user',
            # Personal
            'bio', 'headline', 'pronouns', 'profile_picture',
            # Contact & links
            'phone', 'linkedin_url', 'github_url', 'portfolio_url',
            # Personal / location
            'city', 'date_of_birth',
            # Academic / professional
            'university', 'field_of_study', 'graduation_year', 'career_stage',
            'skills',
            # Interests & hobbies
            'interests', 'hobbies',
            # Mentee intro
            'mentorship_goals', 'background_experience', 'mentor_expectations',
            'availability_info',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class MentorProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = MentorProfile
        fields = [
            'id', 'user',
            # Personal
            'bio', 'headline', 'nationality', 'city', 'profile_picture',
            # Contact & links
            'phone', 'linkedin_url', 'github_url', 'website_url',
            # Professional
            'current_role', 'current_company', 'years_experience', 'education', 'languages',
            # Expertise
            'expertise', 'mentoring_areas', 'countries_expertise',
            # Mentoring approach
            'mentoring_style', 'what_i_offer',
            # Domain & matching
            'domain', 'preferred_student_level', 'timezone',
            # Academic background
            'own_degree', 'own_field_of_study', 'own_university', 'own_graduation_year',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class AssignmentSerializer(serializers.ModelSerializer):
    student = StudentProfileSerializer(read_only=True)
    mentor  = MentorProfileSerializer(read_only=True)
    assigned_by = UserSerializer(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=StudentProfile.objects.all(), source='student', write_only=True
    )
    mentor_id = serializers.PrimaryKeyRelatedField(
        queryset=MentorProfile.objects.all(), source='mentor', write_only=True
    )

    class Meta:
        model = Assignment
        fields = [
            'id', 'student', 'mentor', 'assigned_by', 'notes', 'is_active', 'assigned_at', 'updated_at',
            'student_id', 'mentor_id',
        ]
        read_only_fields = ['id', 'student', 'mentor', 'assigned_by', 'assigned_at', 'updated_at']


class MessageSerializer(serializers.ModelSerializer):
    sender   = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    receiver_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'receiver', 'receiver_id', 'body', 'attachment', 'timestamp', 'is_read']
        read_only_fields = ['id', 'sender', 'receiver', 'timestamp', 'is_read']


# ── Workspace serializers ───────────────────────

class WorkspaceSerializer(serializers.ModelSerializer):
    mentor_name         = serializers.SerializerMethodField()
    mentor_expertise    = serializers.SerializerMethodField()
    mentor_picture      = serializers.SerializerMethodField()
    mentor_id           = serializers.SerializerMethodField()
    mentor_user_id      = serializers.SerializerMethodField()
    member_count        = serializers.SerializerMethodField()
    resource_count      = serializers.SerializerMethodField()
    my_status           = serializers.SerializerMethodField()
    tags_list           = serializers.SerializerMethodField()
    cover_image_url     = serializers.SerializerMethodField()
    logo_url            = serializers.SerializerMethodField()
    related_workspace_name = serializers.SerializerMethodField()
    is_full             = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = [
            'id', 'slug', 'accent_color', 'logo_url',
            'name', 'description', 'cover_image_url', 'icon_emoji',
            'tags', 'tags_list', 'announcement',
            'category', 'level', 'language', 'target_country', 'target_degree',
            'estimated_duration',
            'target_deadline', 'course_start_date', 'course_end_date',
            'enrollment_deadline', 'office_hours',
            'event_title', 'event_date', 'event_start_time', 'event_end_time',
            'event_description', 'event_link',
            'privacy', 'max_members', 'auto_accept', 'allow_self_unenroll',
            'goal', 'welcome_message', 'pinned_url', 'pinned_url_title', 'syllabus_url',
            'enable_chat', 'enable_resources', 'enable_tasks', 'enable_progress',
            'grade_display', 'completion_certificate', 'min_completion_pct',
            'workspace_status', 'is_active',
            'related_workspace', 'related_workspace_name',
            'mentor_id', 'mentor_user_id', 'mentor_name', 'mentor_expertise', 'mentor_picture',
            'member_count', 'resource_count', 'my_status', 'is_full', 'created_at',
        ]

    def get_mentor_id(self, obj):
        return obj.mentor.id

    def get_mentor_user_id(self, obj):
        return obj.mentor.user.id

    def get_mentor_name(self, obj):
        u = obj.mentor.user
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_mentor_expertise(self, obj):
        return obj.mentor.expertise

    def get_mentor_picture(self, obj):
        if obj.mentor.profile_picture:
            return obj.mentor.profile_picture.url
        return None

    def get_member_count(self, obj):
        return obj.memberships.filter(status='approved').count()

    def get_resource_count(self, obj):
        return obj.resources.count()

    def get_my_status(self, obj):
        req = self.context.get('request')
        if not req or not req.user.is_authenticated:
            return None
        user = req.user
        if user.role == 'superadmin':
            return 'owner'
        if user.role == 'mentor':
            mp = MentorProfile.objects.filter(user=user).first()
            if mp and obj.mentor == mp:
                return 'owner'
            if mp:
                from .models import WorkspaceMentor
                guest = WorkspaceMentor.objects.filter(workspace=obj, mentor=mp).first()
                if guest:
                    return 'mentor' if guest.status == WorkspaceMentor.STATUS_ACTIVE else 'mentor_invited'
            return None
        sp = StudentProfile.objects.filter(user=user).first()
        if not sp:
            return None
        m = WorkspaceMembership.objects.filter(workspace=obj, student=sp).first()
        return m.status if m else None

    def get_tags_list(self, obj):
        return [t.strip() for t in obj.tags.split(',') if t.strip()]

    def get_cover_image_url(self, obj):
        if obj.cover_image:
            return obj.cover_image.url
        return None

    def get_logo_url(self, obj):
        if obj.logo:
            return obj.logo.url
        return None

    def get_related_workspace_name(self, obj):
        return obj.related_workspace.name if obj.related_workspace else None

    def get_is_full(self, obj):
        if not obj.max_members:
            return False
        return obj.memberships.filter(status='approved').count() >= obj.max_members


class WorkspaceResourceSerializer(serializers.ModelSerializer):
    posted_by = UserSerializer(read_only=True)
    file_url  = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceResource
        fields = ['id', 'title', 'description', 'resource_type', 'category', 'file', 'file_url', 'file_size',
                  'url', 'body', 'posted_by', 'is_template', 'is_hidden', 'is_featured', 'created_at']
        read_only_fields = ['id', 'posted_by', 'created_at', 'file_url', 'file_size']

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None

    def get_file_size(self, obj):
        try:
            return obj.file.size if obj.file else None
        except Exception:
            return None


class WorkspaceMembershipSerializer(serializers.ModelSerializer):
    student              = StudentProfileSerializer(read_only=True)
    workspace_task_count    = serializers.SerializerMethodField()
    workspace_task_approved = serializers.SerializerMethodField()
    last_active             = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceMembership
        fields = ['id', 'student', 'status', 'requested_at', 'approved_at',
                  'workspace_task_count', 'workspace_task_approved', 'last_active']

    def get_workspace_task_count(self, obj):
        return WorkspaceTaskSubmission.objects.filter(task__workspace=obj.workspace, student=obj.student).count()

    def get_workspace_task_approved(self, obj):
        return WorkspaceTaskSubmission.objects.filter(
            task__workspace=obj.workspace, student=obj.student, status='completed'
        ).count()

    def get_last_active(self, obj):
        last_login = obj.student.user.last_login
        return last_login.isoformat() if last_login else None


class WorkspaceEventSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WorkspaceEvent
        fields = ['id', 'title', 'date', 'start_time', 'end_time', 'description', 'link', 'created_at']
        read_only_fields = ['id', 'created_at']


class PersonalTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PersonalTask
        fields = [
            'id', 'title', 'date', 'start_time', 'end_time',
            'description', 'reminder_offset', 'reminder_sent',
            'is_done', 'created_at',
        ]
        read_only_fields = ['id', 'reminder_sent', 'created_at']


# ── Workspace Task System serializers ──────────────────────────────────────────

class WorkspaceTaskDeliverableSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WorkspaceTaskDeliverable
        fields = ['id', 'title', 'description', 'order']


class WorkspaceTaskDeliverableCheckSerializer(serializers.ModelSerializer):
    deliverable = WorkspaceTaskDeliverableSerializer(read_only=True)

    class Meta:
        model  = WorkspaceTaskDeliverableCheck
        fields = ['id', 'deliverable', 'is_done', 'done_at']
        read_only_fields = ['id', 'deliverable', 'done_at']


class WorkspaceTaskCommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model  = WorkspaceTaskComment
        fields = ['id', 'author', 'text', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']


class WorkspaceTaskDocumentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)
    file_url    = serializers.SerializerMethodField()

    class Meta:
        model  = WorkspaceTaskDocument
        fields = ['id', 'uploaded_by', 'title', 'file', 'file_url', 'created_at']
        read_only_fields = ['id', 'uploaded_by', 'file_url', 'created_at']

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class WorkspaceTaskMentorNoteSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model  = WorkspaceTaskMentorNote
        fields = ['id', 'author', 'text', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']


class WorkspaceTaskStatusEventSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model  = WorkspaceTaskStatusEvent
        fields = ['id', 'from_status', 'to_status', 'actor', 'note', 'created_at']
        read_only_fields = ['id', 'actor', 'created_at']


class WorkspaceTaskSectionSerializer(serializers.ModelSerializer):
    task_count = serializers.SerializerMethodField()

    class Meta:
        model  = WorkspaceTaskSection
        fields = ['id', 'workspace', 'title', 'description', 'color', 'order', 'created_at', 'task_count']
        read_only_fields = ['id', 'created_at']

    def get_task_count(self, obj):
        return obj.tasks.filter(is_template=False).count()


class WorkspaceTaskRubricCriteriaSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WorkspaceTaskRubricCriteria
        fields = ['id', 'title', 'description', 'max_points', 'order']


class WorkspaceTaskRubricScoreSerializer(serializers.ModelSerializer):
    criteria = WorkspaceTaskRubricCriteriaSerializer(read_only=True)

    class Meta:
        model  = WorkspaceTaskRubricScore
        fields = ['id', 'criteria', 'points', 'feedback', 'updated_at']
        read_only_fields = ['id', 'criteria', 'updated_at']


# ── Feature 16: Peer Review serializers ──────────────────────────────────────

class WorkspaceTaskPeerReviewScoreSerializer(serializers.ModelSerializer):
    criteria = WorkspaceTaskRubricCriteriaSerializer(read_only=True)

    class Meta:
        model  = WorkspaceTaskPeerReviewScore
        fields = ['id', 'criteria', 'points', 'feedback']
        read_only_fields = ['id', 'criteria']


class WorkspaceTaskPeerReviewSerializer(serializers.ModelSerializer):
    scores       = WorkspaceTaskPeerReviewScoreSerializer(many=True, read_only=True)
    reviewer_label = serializers.SerializerMethodField()
    total_score  = serializers.SerializerMethodField()

    class Meta:
        model  = WorkspaceTaskPeerReview
        fields = ['id', 'reviewer_label', 'status', 'assigned_at', 'submitted_at', 'scores', 'total_score']
        read_only_fields = ['id', 'reviewer_label', 'assigned_at', 'submitted_at', 'scores', 'total_score']

    def get_reviewer_label(self, obj):
        req = self.context.get('request')
        if req and getattr(req, '_is_mentor_context', False):
            u = obj.reviewer.user
            return f"{u.first_name} {u.last_name}".strip() or u.username
        return 'Anonymous Peer'

    def get_total_score(self, obj):
        return sum(s.points for s in obj.scores.all())


# ── Feature 18: Inline document comment serializers ──────────────────────────

class DocumentInlineCommentSerializer(serializers.ModelSerializer):
    author  = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model  = DocumentInlineComment
        fields = ['id', 'document', 'author', 'page_number', 'x_pct', 'y_pct',
                  'body', 'parent', 'is_resolved', 'created_at', 'replies']
        read_only_fields = ['id', 'author', 'created_at', 'replies']

    def get_author(self, obj):
        from accounts.serializers import UserSerializer
        return UserSerializer(obj.author, context=self.context).data

    def get_replies(self, obj):
        if obj.parent is not None:
            return []
        return DocumentInlineCommentSerializer(
            obj.replies.all(), many=True, context=self.context
        ).data


# ── Feature 20: Self-assessment serializers ───────────────────────────────────

class WorkspaceTaskSelfAssessQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WorkspaceTaskSelfAssessQuestion
        fields = ['id', 'text', 'order']


class WorkspaceTaskSelfAssessResponseSerializer(serializers.ModelSerializer):
    question = WorkspaceTaskSelfAssessQuestionSerializer(read_only=True)

    class Meta:
        model  = WorkspaceTaskSelfAssessResponse
        fields = ['id', 'question', 'rating']
        read_only_fields = ['id', 'question']


class WorkspaceTaskSubmissionSerializer(serializers.ModelSerializer):
    student        = StudentProfileSerializer(read_only=True)
    checks         = WorkspaceTaskDeliverableCheckSerializer(many=True, read_only=True)
    comments       = WorkspaceTaskCommentSerializer(many=True, read_only=True)
    documents      = WorkspaceTaskDocumentSerializer(many=True, read_only=True)
    mentor_notes   = serializers.SerializerMethodField()
    effective_due_date = serializers.SerializerMethodField()
    status_events  = WorkspaceTaskStatusEventSerializer(many=True, read_only=True)
    rubric_scores  = WorkspaceTaskRubricScoreSerializer(many=True, read_only=True)
    total_score    = serializers.SerializerMethodField()
    max_score      = serializers.SerializerMethodField()
    effective_late = serializers.SerializerMethodField()
    peer_reviews   = serializers.SerializerMethodField()
    peer_avg_score = serializers.SerializerMethodField()
    self_assess_responses = serializers.SerializerMethodField()

    class Meta:
        model  = WorkspaceTaskSubmission
        fields = [
            'id', 'student', 'status',
            'assigned_at', 'submitted_at', 'completed_at',
            'due_date_override', 'effective_due_date',
            'is_late', 'late_override', 'effective_late',
            'checks', 'comments', 'documents', 'mentor_notes',
            'status_events',
            'rubric_scores', 'total_score', 'max_score',
            'peer_reviews', 'peer_avg_score',
            'self_assess_responses',
        ]
        read_only_fields = ['id', 'student', 'assigned_at', 'submitted_at', 'completed_at',
                            'effective_due_date', 'is_late', 'effective_late']

    def get_mentor_notes(self, obj):
        request = self.context.get('request')
        if request and getattr(request, '_is_mentor_context', False):
            return WorkspaceTaskMentorNoteSerializer(obj.mentor_notes.all(), many=True, context=self.context).data
        return []

    def get_effective_due_date(self, obj):
        d = obj.effective_due_date
        return str(d) if d else None

    def get_total_score(self, obj):
        return sum(s.points for s in obj.rubric_scores.all())

    def get_max_score(self, obj):
        return sum(c.max_points for c in obj.task.rubric_criteria.all())

    def get_effective_late(self, obj):
        if obj.late_override is not None:
            return obj.late_override
        return obj.is_late

    def get_peer_reviews(self, obj):
        req = self.context.get('request')
        if req and getattr(req, '_is_mentor_context', False):
            return WorkspaceTaskPeerReviewSerializer(
                obj.peer_reviews.all(), many=True, context=self.context
            ).data
        return []

    def get_peer_avg_score(self, obj):
        submitted = obj.peer_reviews.filter(status='submitted')
        if not submitted.exists():
            return None
        totals = [sum(s.points for s in pr.scores.all()) for pr in submitted]
        return round(sum(totals) / len(totals), 1)

    def get_self_assess_responses(self, obj):
        return WorkspaceTaskSelfAssessResponseSerializer(
            obj.self_assess_responses.all(), many=True
        ).data


class WorkspaceTaskSubmissionSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for the submissions list (no nested comments/docs)."""
    student            = StudentProfileSerializer(read_only=True)
    checks_done        = serializers.SerializerMethodField()
    checks_total       = serializers.SerializerMethodField()
    effective_due_date = serializers.SerializerMethodField()
    effective_late     = serializers.SerializerMethodField()

    class Meta:
        model  = WorkspaceTaskSubmission
        fields = [
            'id', 'student', 'status',
            'assigned_at', 'submitted_at', 'completed_at',
            'due_date_override', 'effective_due_date',
            'is_late', 'late_override', 'effective_late',
            'checks_done', 'checks_total',
        ]

    def get_checks_done(self, obj):
        return obj.checks.filter(is_done=True).count()

    def get_checks_total(self, obj):
        return obj.checks.count()

    def get_effective_due_date(self, obj):
        d = obj.effective_due_date
        return str(d) if d else None

    def get_effective_late(self, obj):
        if obj.late_override is not None:
            return obj.late_override
        return obj.is_late


class WorkspaceTaskSerializer(serializers.ModelSerializer):
    deliverables      = WorkspaceTaskDeliverableSerializer(many=True, read_only=True)
    created_by        = UserSerializer(read_only=True)
    submission_count  = serializers.SerializerMethodField()
    completed_count   = serializers.SerializerMethodField()
    submitted_count   = serializers.SerializerMethodField()
    prerequisite_ids  = serializers.SerializerMethodField()
    assigned_member_ids = serializers.SerializerMethodField()
    rubric_criteria   = serializers.SerializerMethodField()
    self_assess_questions = serializers.SerializerMethodField()

    class Meta:
        model  = WorkspaceTask
        fields = [
            'id', 'workspace', 'title', 'description', 'task_type',
            'status', 'due_date', 'available_from', 'available_until',
            'peer_visible', 'is_template',
            'peer_review_enabled', 'peer_review_count',
            'late_policy', 'grace_period_hours',
            'section',
            'created_by', 'created_at', 'updated_at',
            'deliverables', 'prerequisite_ids', 'assigned_member_ids',
            'rubric_criteria', 'self_assess_questions',
            'submission_count', 'completed_count', 'submitted_count',
        ]
        read_only_fields = ['id', 'workspace', 'created_by', 'created_at', 'updated_at']

    def get_submission_count(self, obj):
        return obj.submissions.count()

    def get_completed_count(self, obj):
        return obj.submissions.filter(status='completed').count()

    def get_submitted_count(self, obj):
        return obj.submissions.filter(status__in=['submitted', 'resubmitted']).count()

    def get_prerequisite_ids(self, obj):
        return list(obj.prerequisites.values_list('required_task_id', flat=True))

    def get_assigned_member_ids(self, obj):
        return list(obj.assigned_members.values_list('id', flat=True))

    def get_rubric_criteria(self, obj):
        return WorkspaceTaskRubricCriteriaSerializer(obj.rubric_criteria.all(), many=True).data

    def get_self_assess_questions(self, obj):
        return WorkspaceTaskSelfAssessQuestionSerializer(obj.self_assess_questions.all(), many=True).data


# ---------------------------------------------------------------------------
# Onboarding serializers
# ---------------------------------------------------------------------------

class WorkspaceOnboardingQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WorkspaceOnboardingQuestion
        fields = ['id', 'question_text', 'order', 'required']


class WorkspaceOnboardingAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WorkspaceOnboardingAnswer
        fields = ['id', 'question', 'answer_text', 'last_updated']
        read_only_fields = ['id', 'last_updated']


class WorkspaceOnboardingSubmissionSerializer(serializers.Serializer):
    student_id      = serializers.IntegerField()
    student_name    = serializers.CharField()
    student_picture = serializers.CharField(allow_null=True)
    submitted_at    = serializers.DateTimeField(allow_null=True)
    answers         = WorkspaceOnboardingAnswerSerializer(many=True)
