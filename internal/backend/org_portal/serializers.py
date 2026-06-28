from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    InternalRole, OrgMember, Department,
    OnboardingTemplate, TaskTemplateItem,
    OnboardingInstance, TaskInstance, TaskComment,
    TemplateFormField, TaskFormField, TaskFormResponse,
    DocumentTemplate, MemberDocument,
    TrainingCourse, TrainingModule, TrainingLesson,
    TrainingEnrollment, LessonProgress,
    QuizQuestion, QuizOption, LessonSubmission,
    Event, EventAttendance, EventTypeConfig, EventSettings,
    Contribution, CheckIn,
    Resource, AuditLog, OrgSettings,
    OrgAgreement, MemberAgreementSignature, RecruitmentRequest,
    AccessRequest,
    StandaloneForm, StandaloneFormField, FormSubmission, StandaloneFormResponse,
    ExtensionRequest,
    OrgChatChannel, OrgChatChannelMember, OrgChatMessage, OrgChatReaction,
    OrgDMMessage, OrgChatPoll, OrgChatPollOption,
)

User = get_user_model()


# ── Roles ─────────────────────────────────────────────────────────────────────

class InternalRoleSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model  = InternalRole
        fields = [
            'id', 'name', 'level',
            'can_manage_members', 'can_view_all_contributions',
            'can_approve_checkins', 'can_upload_agreements',
            'member_count', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'member_count']

    def get_member_count(self, obj):
        return obj.members.filter(status='active').count()


# ── Departments ───────────────────────────────────────────────────────────────

class DepartmentSerializer(serializers.ModelSerializer):
    member_count         = serializers.SerializerMethodField()
    sub_department_count = serializers.SerializerMethodField()
    head_name            = serializers.SerializerMethodField()
    parent_name          = serializers.SerializerMethodField()
    head_id              = serializers.PrimaryKeyRelatedField(
                               queryset=User.objects.all(),
                               source='head', write_only=True,
                               required=False, allow_null=True,
                           )
    parent_id            = serializers.PrimaryKeyRelatedField(
                               queryset=Department.objects.all(),
                               source='parent', write_only=True,
                               required=False, allow_null=True,
                           )

    class Meta:
        model  = Department
        fields = [
            'id', 'name', 'description',
            'head_id', 'head_name',
            'parent_id', 'parent_name',
            'member_count', 'sub_department_count',
            'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'member_count', 'sub_department_count', 'head_name', 'parent_name']

    def get_member_count(self, obj):
        return obj.members.count()

    def get_sub_department_count(self, obj):
        return obj.sub_departments.count()

    def get_head_name(self, obj):
        if not obj.head:
            return None
        return f"{obj.head.first_name or ''} {obj.head.last_name or ''}".strip() or obj.head.username

    def get_parent_name(self, obj):
        return obj.parent.name if obj.parent else None


# ── Users ─────────────────────────────────────────────────────────────────────

class OrgMemberUserSerializer(serializers.ModelSerializer):
    profile_picture = serializers.SerializerMethodField()
    display_name    = serializers.SerializerMethodField()
    member_status   = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = ['id', 'username', 'email', 'role', 'first_name', 'last_name',
                  'profile_picture', 'display_name', 'last_login', 'member_status']

    def get_profile_picture(self, obj):
        request = self.context.get('request')
        pic = None
        try:
            if hasattr(obj, 'student_profile') and obj.student_profile.profile_picture:
                pic = obj.student_profile.profile_picture
        except Exception:
            pass
        if not pic:
            try:
                if hasattr(obj, 'mentor_profile') and obj.mentor_profile.profile_picture:
                    pic = obj.mentor_profile.profile_picture
            except Exception:
                pass
        return pic.url if pic else None

    def get_display_name(self, obj):
        full = f"{obj.first_name or ''} {obj.last_name or ''}".strip()
        return full or obj.username

    def get_member_status(self, obj):
        try:
            return obj.org_member.status
        except Exception:
            return None


# ── Members ───────────────────────────────────────────────────────────────────

class OrgMemberLiteSerializer(serializers.ModelSerializer):
    display_name    = serializers.SerializerMethodField()
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model  = OrgMember
        fields = ['id', 'display_name', 'profile_picture']

    def get_display_name(self, obj):
        return f"{obj.user.first_name or ''} {obj.user.last_name or ''}".strip() or obj.user.username

    def get_profile_picture(self, obj):
        request = self.context.get('request')
        pic = None
        if obj.user.role == 'student' and hasattr(obj.user, 'student_profile'):
            pic = obj.user.student_profile.profile_picture
        elif obj.user.role == 'mentor' and hasattr(obj.user, 'mentor_profile'):
            pic = obj.user.mentor_profile.profile_picture
        return pic.url if pic else None


class OrgMemberSerializer(serializers.ModelSerializer):
    user            = OrgMemberUserSerializer(read_only=True)
    role            = InternalRoleSerializer(read_only=True)
    role_id         = serializers.PrimaryKeyRelatedField(
                          queryset=InternalRole.objects.all(),
                          source='role', write_only=True,
                      )
    approved_by     = OrgMemberUserSerializer(read_only=True)
    department_name = serializers.SerializerMethodField()
    department_id   = serializers.PrimaryKeyRelatedField(
                          queryset=Department.objects.all(),
                          source='department', write_only=True,
                          required=False, allow_null=True,
                      )

    class Meta:
        model  = OrgMember
        fields = [
            'id', 'user', 'role', 'role_id', 'status',
            'joined_date', 'approved_by', 'notes',
            'department_name', 'department_id', 'employee_id',
        ]
        read_only_fields = ['id', 'joined_date', 'approved_by', 'department_name', 'employee_id']

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None


class OrgMemberProfileSerializer(serializers.ModelSerializer):
    user            = OrgMemberUserSerializer(read_only=True)
    role_name       = serializers.CharField(source='role.name', read_only=True)
    department_name = serializers.SerializerMethodField()
    department_id   = serializers.PrimaryKeyRelatedField(
                          queryset=Department.objects.all(),
                          source='department', write_only=True,
                          required=False, allow_null=True,
                      )
    buddy           = OrgMemberLiteSerializer(read_only=True)
    buddy_id        = serializers.PrimaryKeyRelatedField(
                          queryset=OrgMember.objects.all(),
                          source='buddy', write_only=True,
                          required=False, allow_null=True,
                      )
    manager         = OrgMemberLiteSerializer(read_only=True)
    manager_id      = serializers.PrimaryKeyRelatedField(
                          queryset=OrgMember.objects.all(),
                          source='manager', write_only=True,
                          required=False, allow_null=True,
                      )

    class Meta:
        model  = OrgMember
        fields = [
            'id', 'user', 'role_name', 'status', 'joined_date',
            'employee_id', 'skills',
            'emergency_contact_name', 'emergency_contact_phone',
            'profile_completion_pct', 'notes',
            'department_name', 'department_id',
            'buddy', 'buddy_id',
            'manager', 'manager_id',
        ]
        read_only_fields = [
            'id', 'user', 'role_name', 'status', 'joined_date',
            'profile_completion_pct', 'department_name',
        ]

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None


# ── Grant Access ──────────────────────────────────────────────────────────────

class GrantAccessSerializer(serializers.Serializer):
    user_id       = serializers.IntegerField()
    role_id       = serializers.IntegerField()
    department_id = serializers.IntegerField(required=False, allow_null=True)
    notes         = serializers.CharField(required=False, allow_blank=True)

    def validate_user_id(self, value):
        try:
            user = User.objects.get(pk=value)
        except User.DoesNotExist:
            raise serializers.ValidationError('User not found.')
        if hasattr(user, 'org_member'):
            raise serializers.ValidationError('User already has internal access.')
        return value

    def validate_role_id(self, value):
        if not InternalRole.objects.filter(pk=value).exists():
            raise serializers.ValidationError('Role not found.')
        return value


class AccessRequestSerializer(serializers.ModelSerializer):
    user_display_name = serializers.SerializerMethodField()
    user_username     = serializers.SerializerMethodField()
    user_email        = serializers.SerializerMethodField()
    user_avatar       = serializers.SerializerMethodField()
    role_name         = serializers.SerializerMethodField()
    department_name   = serializers.SerializerMethodField()

    class Meta:
        model  = AccessRequest
        fields = [
            'id', 'user', 'user_display_name', 'user_username', 'user_email',
            'user_avatar', 'requested_role', 'role_name', 'department',
            'department_name', 'message', 'status', 'reviewed_by',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'status', 'reviewed_by', 'created_at', 'updated_at',
            'user_display_name', 'user_username', 'user_email',
            'user_avatar', 'role_name', 'department_name',
        ]

    def get_user_display_name(self, obj):
        full = f"{obj.user.first_name or ''} {obj.user.last_name or ''}".strip()
        return full or obj.user.username

    def get_user_username(self, obj):
        return obj.user.username

    def get_user_email(self, obj):
        return obj.user.email

    def get_user_avatar(self, obj):
        request = self.context.get('request')
        pic = None
        if obj.user.role == 'student' and hasattr(obj.user, 'student_profile'):
            pic = obj.user.student_profile.profile_picture
        elif obj.user.role == 'mentor' and hasattr(obj.user, 'mentor_profile'):
            pic = obj.user.mentor_profile.profile_picture
        return pic.url if pic else None

    def get_role_name(self, obj):
        return obj.requested_role.name if obj.requested_role else None

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None


# ── Onboarding Templates ──────────────────────────────────────────────────────

class TaskTemplateItemSerializer(serializers.ModelSerializer):
    content_file_url = serializers.SerializerMethodField()

    class Meta:
        model  = TaskTemplateItem
        fields = [
            'id', 'title', 'description', 'task_type',
            'phase', 'content_url', 'content_body',
            'content_file', 'content_file_url',
            'order', 'due_offset_days', 'required', 'approval_required',
            'assignee_type',
        ]
        read_only_fields = ['id', 'content_file_url']
        extra_kwargs = {'content_file': {'write_only': True, 'required': False}}

    def get_content_file_url(self, obj):
        if not obj.content_file:
            return None
        return obj.content_file.url


class OnboardingTemplateSerializer(serializers.ModelSerializer):
    task_count      = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()
    used_in_count   = serializers.SerializerMethodField()
    tasks           = TaskTemplateItemSerializer(many=True, read_only=True)
    department_id   = serializers.PrimaryKeyRelatedField(
                          queryset=Department.objects.all(),
                          source='department', write_only=True,
                          required=False, allow_null=True,
                      )

    class Meta:
        model  = OnboardingTemplate
        fields = [
            'id', 'name', 'description', 'category',
            'department_id', 'department_name',
            'visible_to', 'assignable_by', 'task_approval_enabled', 'due_date_policy',
            'is_active', 'task_count', 'used_in_count', 'tasks',
            'created_by_name', 'updated_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'task_count', 'used_in_count',
            'department_name', 'created_by_name', 'updated_by_name', 'tasks',
        ]

    def get_task_count(self, obj):
        return obj.tasks.count()

    def get_used_in_count(self, obj):
        return obj.instances.count()

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None

    def _fmt_name(self, user):
        if not user:
            return None
        return f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username

    def get_created_by_name(self, obj):
        return self._fmt_name(obj.created_by)

    def get_updated_by_name(self, obj):
        return self._fmt_name(obj.updated_by)


# ── Onboarding Instances ──────────────────────────────────────────────────────

class TemplateFormFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model  = TemplateFormField
        fields = ['id', 'question', 'field_type', 'options', 'required', 'order']
        read_only_fields = ['id']


class TaskFormFieldSerializer(serializers.ModelSerializer):
    response = serializers.SerializerMethodField()

    class Meta:
        model  = TaskFormField
        fields = ['id', 'question', 'field_type', 'options', 'required', 'order', 'response']
        read_only_fields = ['id']

    def get_response(self, obj):
        try:
            return obj.response.answer
        except TaskFormResponse.DoesNotExist:
            return None


class TaskInstanceSerializer(serializers.ModelSerializer):
    attachment_url   = serializers.SerializerMethodField()
    content_file_url = serializers.SerializerMethodField()
    form_fields      = TaskFormFieldSerializer(many=True, read_only=True)

    class Meta:
        model  = TaskInstance
        fields = [
            'id', 'title', 'description', 'task_type',
            'phase', 'content_url', 'content_body', 'content_file_url',
            'required', 'approval_required',
            'due_date', 'status', 'completed_at',
            'attachment_url', 'notes', 'created_at',
            'form_fields',
        ]
        read_only_fields = [
            'id', 'content_file_url', 'created_at', 'completed_at',
            'attachment_url', 'form_fields',
        ]

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        return obj.attachment.url

    def get_content_file_url(self, obj):
        # Prefer the instance's own override; fall back to the template_item file.
        target = obj.content_file or (obj.template_item.content_file if obj.template_item else None)
        if not target:
            return None
        return target.url


class TaskCommentSerializer(serializers.ModelSerializer):
    author_name    = serializers.SerializerMethodField()
    author_picture = serializers.SerializerMethodField()
    is_mine        = serializers.SerializerMethodField()

    class Meta:
        model  = TaskComment
        fields = ['id', 'author_name', 'author_picture', 'body', 'created_at', 'is_mine']
        read_only_fields = ['id', 'author_name', 'author_picture', 'created_at', 'is_mine']

    def get_author_name(self, obj):
        u = obj.author
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username

    def get_author_picture(self, obj):
        u = obj.author
        pic = None
        if u.role == 'student' and hasattr(u, 'student_profile'):
            pic = u.student_profile.profile_picture
        elif u.role == 'mentor' and hasattr(u, 'mentor_profile'):
            pic = u.mentor_profile.profile_picture
        return pic.url if pic else None

    def get_is_mine(self, obj):
        request = self.context.get('request')
        return bool(request and request.user == obj.author)


class OnboardingInstanceSerializer(serializers.ModelSerializer):
    user            = OrgMemberUserSerializer(read_only=True)
    assigned_by_name = serializers.SerializerMethodField()
    template_name   = serializers.SerializerMethodField()
    progress_pct    = serializers.SerializerMethodField()
    tasks           = TaskInstanceSerializer(many=True, read_only=True)
    buddy_name      = serializers.SerializerMethodField()
    manager_name    = serializers.SerializerMethodField()

    user_id     = serializers.PrimaryKeyRelatedField(
                      queryset=User.objects.all(), source='user', write_only=True,
                  )
    template_id = serializers.PrimaryKeyRelatedField(
                      queryset=OnboardingTemplate.objects.all(), source='template',
                      write_only=True, required=False, allow_null=True,
                  )
    buddy_id    = serializers.PrimaryKeyRelatedField(
                      queryset=OrgMember.objects.all(), source='buddy',
                      write_only=True, required=False, allow_null=True,
                  )
    manager_id  = serializers.PrimaryKeyRelatedField(
                      queryset=OrgMember.objects.all(), source='manager',
                      write_only=True, required=False, allow_null=True,
                  )

    class Meta:
        model  = OnboardingInstance
        fields = [
            'id', 'user_id', 'user',
            'template_id', 'template_name',
            'status', 'start_date', 'due_date',
            'welcome_message', 'completed_at',
            'progress_pct', 'tasks',
            'buddy_id', 'buddy_name',
            'manager_id', 'manager_name',
            'assigned_by_name', 'created_at',
        ]
        read_only_fields = [
            'id', 'user', 'template_name', 'progress_pct', 'tasks',
            'buddy_name', 'manager_name', 'assigned_by_name', 'created_at',
            'completed_at',
        ]

    def get_assigned_by_name(self, obj):
        if not obj.assigned_by:
            return None
        u = obj.assigned_by
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username

    def get_template_name(self, obj):
        return obj.template.name if obj.template else None

    def get_progress_pct(self, obj):
        tasks = obj.tasks.all()
        total = tasks.count()
        if total == 0:
            return 0
        return round(tasks.filter(status='completed').count() / total * 100)

    def get_buddy_name(self, obj):
        if not obj.buddy:
            return None
        u = obj.buddy.user
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username

    def get_manager_name(self, obj):
        if not obj.manager:
            return None
        u = obj.manager.user
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username


# ── Documents ─────────────────────────────────────────────────────────────────

class DocumentTemplateSerializer(serializers.ModelSerializer):
    department_name = serializers.SerializerMethodField()
    department_id   = serializers.PrimaryKeyRelatedField(
                          queryset=Department.objects.all(), source='department',
                          write_only=True, required=False, allow_null=True)
    created_by_name = serializers.SerializerMethodField()
    file_url        = serializers.SerializerMethodField()
    used_in_count   = serializers.SerializerMethodField()

    class Meta:
        model  = DocumentTemplate
        fields = [
            'id', 'name', 'description', 'category',
            'department_id', 'department_name',
            'file', 'file_url', 'version',
            'is_mandatory', 'requires_signature', 'expiration_months',
            'is_active',
            'visible_to', 'assignable_by',
            'approval_required', 'auto_request_in_onboarding', 'reminder_enabled',
            'used_in_count', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'department_name', 'created_by_name', 'file_url', 'used_in_count']
        extra_kwargs = {'file': {'write_only': True, 'required': False}}

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        u = obj.created_by
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username

    def get_file_url(self, obj):
        if not obj.file:
            return None
        return obj.file.url

    def get_used_in_count(self, obj):
        return obj.assigned_documents.count()


class MemberDocumentSerializer(serializers.ModelSerializer):
    user               = OrgMemberUserSerializer(read_only=True)
    template_name      = serializers.SerializerMethodField()
    file_url           = serializers.SerializerMethodField()
    reviewed_by_name   = serializers.SerializerMethodField()
    requires_signature   = serializers.SerializerMethodField()
    allow_resign         = serializers.SerializerMethodField()
    template_file_url    = serializers.SerializerMethodField()
    template_description = serializers.SerializerMethodField()
    doc_reference        = serializers.SerializerMethodField()
    assigned_by_name     = serializers.SerializerMethodField()

    class Meta:
        model  = MemberDocument
        fields = [
            'id', 'user', 'template_name', 'template_description',
            'title', 'file_url', 'category',
            'status', 'reviewer_note',
            'reviewed_by_name',
            'uploaded_at', 'reviewed_at', 'signed_at', 'expiration_date',
            'requires_signature', 'allow_resign', 'template_file_url',
            'doc_reference', 'assigned_by_name',
        ]
        read_only_fields = [
            'id', 'user', 'template_name', 'file_url',
            'reviewed_by_name', 'uploaded_at', 'reviewed_at',
            'doc_reference', 'assigned_by_name',
        ]

    def get_template_name(self, obj):
        return obj.template.name if obj.template else None

    def get_file_url(self, obj):
        if not obj.file:
            return None
        return obj.file.url

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return None
        u = obj.reviewed_by
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username

    def get_template_description(self, obj):
        return obj.template.description if obj.template else None

    def get_requires_signature(self, obj):
        return obj.template.requires_signature if obj.template else False

    def get_allow_resign(self, obj):
        return obj.template.allow_resign if obj.template else False

    def get_template_file_url(self, obj):
        if not obj.template or not obj.template.file:
            return None
        return obj.template.file.url

    def get_doc_reference(self, obj):
        return f"DOC-{obj.uploaded_at.year}-{obj.id:04d}"

    def get_assigned_by_name(self, obj):
        if not obj.assigned_by:
            return None
        u = obj.assigned_by
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username


class QuizOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = QuizOption
        fields = ['id', 'text', 'is_correct', 'order']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request:
            user = request.user
            is_manager = (
                getattr(user, 'is_staff', False) or
                getattr(user, 'is_superuser', False) or
                getattr(user, 'role', None) == 'superadmin' or
                (hasattr(user, 'org_member') and (
                    user.org_member.role and user.org_member.role.can_manage_members
                ))
            )
            hide = not is_manager and not self.context.get('show_correct', False)
            if hide:
                data.pop('is_correct', None)
        return data


class QuizQuestionSerializer(serializers.ModelSerializer):
    options = QuizOptionSerializer(many=True, read_only=True)

    class Meta:
        model  = QuizQuestion
        fields = ['id', 'text', 'question_type', 'points', 'order', 'options']
        read_only_fields = ['id', 'options']


class LessonSubmissionSerializer(serializers.ModelSerializer):
    lesson_id = serializers.IntegerField(source='lesson.id', read_only=True)
    file_url  = serializers.SerializerMethodField()

    class Meta:
        model  = LessonSubmission
        fields = ['id', 'lesson_id', 'answers', 'score', 'passed', 'submitted_at', 'file_url']
        read_only_fields = ['id', 'lesson_id', 'submitted_at', 'file_url']

    def get_file_url(self, obj):
        if not obj.file:
            return None
        return obj.file.url


# ── Training ──────────────────────────────────────────────────────────────────

class TrainingLessonSerializer(serializers.ModelSerializer):
    content_file_url = serializers.SerializerMethodField()
    quiz_questions   = QuizQuestionSerializer(many=True, read_only=True)
    lesson_reference = serializers.SerializerMethodField()
    updated_by_name  = serializers.SerializerMethodField()

    class Meta:
        model  = TrainingLesson
        fields = [
            'id', 'title', 'lesson_type',
            'content_url', 'content_file', 'content_file_url',
            'content_data', 'duration_minutes', 'order',
            'is_published', 'created_at', 'updated_at',
            'lesson_reference', 'updated_by_name',
            'quiz_questions',
        ]
        read_only_fields = [
            'id', 'content_file_url', 'quiz_questions',
            'lesson_reference', 'updated_by_name', 'created_at', 'updated_at',
        ]
        extra_kwargs = {'content_file': {'write_only': True, 'required': False}}

    def get_content_file_url(self, obj):
        if not obj.content_file:
            return None
        return obj.content_file.url

    def get_lesson_reference(self, obj):
        try:
            course = obj.module.course
            words  = course.title.upper().split()
            abbrev = words[0][:3] if words else 'LES'
            all_ids = [
                les.id
                for mod in course.modules.order_by('order')
                for les in mod.lessons.order_by('order')
            ]
            pos = all_ids.index(obj.id) + 1 if obj.id in all_ids else obj.id
        except Exception:
            pos, abbrev = obj.id, 'LES'
        return f"L-{abbrev}-{pos:03d}"

    def get_updated_by_name(self, obj):
        u = obj.updated_by
        if not u:
            return None
        return (f"{u.first_name} {u.last_name}".strip() or u.username)


class TrainingModuleSerializer(serializers.ModelSerializer):
    lessons      = TrainingLessonSerializer(many=True, read_only=True)
    lesson_count = serializers.SerializerMethodField()

    class Meta:
        model  = TrainingModule
        fields = ['id', 'title', 'order', 'lesson_count', 'lessons']
        read_only_fields = ['id', 'lesson_count']

    def get_lesson_count(self, obj):
        return obj.lessons.count()


class TrainingCourseSerializer(serializers.ModelSerializer):
    modules         = TrainingModuleSerializer(many=True, read_only=True)
    department_name = serializers.SerializerMethodField()
    department_id   = serializers.PrimaryKeyRelatedField(
                          queryset=Department.objects.all(), source='department',
                          write_only=True, required=False, allow_null=True)
    created_by_name = serializers.SerializerMethodField()
    enrolled_count  = serializers.SerializerMethodField()
    completion_pct  = serializers.SerializerMethodField()
    thumbnail_url   = serializers.SerializerMethodField()
    total_duration  = serializers.SerializerMethodField()

    class Meta:
        model  = TrainingCourse
        fields = [
            'id', 'title', 'description',
            'department_id', 'department_name',
            'thumbnail', 'thumbnail_url',
            'category', 'is_mandatory', 'is_active', 'pass_score',
            'modules', 'enrolled_count', 'completion_pct', 'total_duration',
            'created_by_name', 'created_at',
        ]
        read_only_fields = [
            'id', 'created_at', 'department_name', 'created_by_name',
            'enrolled_count', 'completion_pct', 'thumbnail_url', 'modules',
            'total_duration',
        ]
        extra_kwargs = {'thumbnail': {'write_only': True, 'required': False}}

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        u = obj.created_by
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username

    def get_enrolled_count(self, obj):
        return obj.enrollments.count()

    def get_completion_pct(self, obj):
        total = obj.enrollments.count()
        if total == 0:
            return 0
        return round(obj.enrollments.filter(status='completed').count() / total * 100)

    def get_thumbnail_url(self, obj):
        if not obj.thumbnail:
            return None
        return obj.thumbnail.url

    def get_total_duration(self, obj):
        return sum(
            lesson.duration_minutes
            for mod in obj.modules.all()
            for lesson in mod.lessons.all()
        )


class LessonProgressSerializer(serializers.ModelSerializer):
    lesson_id = serializers.IntegerField(source='lesson.id', read_only=True)

    class Meta:
        model  = LessonProgress
        fields = ['id', 'lesson_id', 'completed', 'completed_at']
        read_only_fields = ['id', 'lesson_id', 'completed_at']


class TrainingEnrollmentSerializer(serializers.ModelSerializer):
    course             = TrainingCourseSerializer(read_only=True)
    progress_pct       = serializers.SerializerMethodField()
    completed_lessons  = serializers.SerializerMethodField()
    total_lessons      = serializers.SerializerMethodField()
    lesson_progress    = LessonProgressSerializer(many=True, read_only=True)
    lesson_submissions = LessonSubmissionSerializer(many=True, read_only=True)
    user_name          = serializers.SerializerMethodField()
    user_email         = serializers.SerializerMethodField()
    user_picture       = serializers.SerializerMethodField()
    department_name    = serializers.SerializerMethodField()
    user_id            = serializers.SerializerMethodField()

    class Meta:
        model  = TrainingEnrollment
        fields = [
            'id', 'course', 'status',
            'completion_date', 'score', 'certificate_issued',
            'enrolled_at', 'progress_pct',
            'completed_lessons', 'total_lessons',
            'lesson_progress', 'lesson_submissions',
            'user_name', 'user_email', 'user_picture', 'department_name', 'user_id',
        ]
        read_only_fields = [
            'id', 'course', 'status', 'completion_date', 'score',
            'certificate_issued', 'enrolled_at', 'progress_pct',
            'completed_lessons', 'total_lessons',
            'lesson_progress', 'lesson_submissions',
            'user_name', 'user_email', 'user_picture', 'department_name', 'user_id',
        ]

    def _total(self, obj):
        return sum(m.lessons.count() for m in obj.course.modules.all())

    def get_progress_pct(self, obj):
        total = self._total(obj)
        if total == 0:
            return 0
        done = obj.lesson_progress.filter(completed=True).count()
        return round(done / total * 100)

    def get_completed_lessons(self, obj):
        return obj.lesson_progress.filter(completed=True).count()

    def get_total_lessons(self, obj):
        return self._total(obj)

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_user_email(self, obj):
        return obj.user.email

    def get_user_id(self, obj):
        return obj.user_id

    def get_user_picture(self, obj):
        try:
            if hasattr(obj.user, 'student_profile') and obj.user.student_profile.profile_picture:
                return obj.user.student_profile.profile_picture.url
        except Exception:
            pass
        try:
            if hasattr(obj.user, 'mentor_profile') and obj.user.mentor_profile.profile_picture:
                return obj.user.mentor_profile.profile_picture.url
        except Exception:
            pass
        return None

    def get_department_name(self, obj):
        try:
            return obj.user.org_member.department.name if obj.user.org_member.department else None
        except Exception:
            return None


# ── Phase 5: Events ───────────────────────────────────────────────────────────

class EventSerializer(serializers.ModelSerializer):
    organizer_name        = serializers.SerializerMethodField()
    rsvp_count            = serializers.SerializerMethodField()
    my_rsvp               = serializers.SerializerMethodField()
    assigned_member_ids   = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all(),
        source='assigned_members', required=False,
    )
    assigned_members_data = serializers.SerializerMethodField()

    class Meta:
        model  = Event
        fields = [
            'id', 'title', 'description', 'event_type',
            'start_dt', 'end_dt', 'location', 'virtual_link',
            'target_audience', 'max_attendees',
            'organizer_name', 'is_recurring', 'recurrence_rule',
            'created_at', 'rsvp_count', 'my_rsvp',
            'assigned_member_ids', 'assigned_members_data',
        ]
        read_only_fields = [
            'id', 'created_at', 'organizer_name', 'rsvp_count',
            'my_rsvp', 'assigned_members_data',
        ]

    def get_organizer_name(self, obj):
        if obj.organizer:
            return obj.organizer.get_full_name() or obj.organizer.email
        return ''

    def get_rsvp_count(self, obj):
        try:
            return obj.attendance.exclude(rsvp='no_response').count()
        except Exception:
            return 0

    def get_my_rsvp(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 'no_response'
        try:
            return obj.attendance.get(user=request.user).rsvp
        except Exception:
            return 'no_response'

    def get_assigned_members_data(self, obj):
        return [
            {'id': u.id, 'name': u.get_full_name() or u.email, 'email': u.email}
            for u in obj.assigned_members.all()
        ]

    def create(self, validated_data):
        assigned = validated_data.pop('assigned_members', [])
        event = super().create(validated_data)
        if assigned:
            event.assigned_members.set(assigned)
        return event

    def update(self, instance, validated_data):
        assigned = validated_data.pop('assigned_members', None)
        event = super().update(instance, validated_data)
        if assigned is not None:
            event.assigned_members.set(assigned)
        return event


class EventAttendanceSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_id   = serializers.SerializerMethodField()

    class Meta:
        model  = EventAttendance
        fields = ['id', 'user_id', 'user_name', 'rsvp', 'attended']
        read_only_fields = ['id', 'user_id', 'user_name']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.email

    def get_user_id(self, obj):
        return obj.user_id


# ── Phase 5: Event Type Config & Settings ────────────────────────────────────

class EventTypeConfigSerializer(serializers.ModelSerializer):
    event_count = serializers.SerializerMethodField()

    class Meta:
        model  = EventTypeConfig
        fields = ['id', 'slug', 'label', 'description', 'is_active', 'is_default', 'created_at', 'event_count']
        read_only_fields = ['id', 'is_default', 'created_at', 'event_count']

    def get_event_count(self, obj):
        return Event.objects.filter(event_type=obj.slug).count()


class EventSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EventSettings
        fields = [
            'id', 'allow_self_rsvp', 'rsvp_deadline_hours', 'default_duration_minutes',
            'send_reminders', 'reminder_hours_before', 'require_attendance_marking',
            'default_location', 'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']


# ── Phase 5: Contributions ────────────────────────────────────────────────────

class ContributionSerializer(serializers.ModelSerializer):
    member_name      = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    evidence_file_url = serializers.SerializerMethodField()

    class Meta:
        model  = Contribution
        fields = [
            'id', 'member_name', 'title', 'contribution_type', 'category',
            'hours', 'description', 'project_name', 'impact_level',
            'collaborators', 'deliverable_url',
            'date', 'status',
            'approved_by_name', 'evidence_file', 'evidence_file_url', 'created_at',
        ]
        read_only_fields = [
            'id', 'member_name', 'status', 'approved_by_name',
            'evidence_file_url', 'created_at',
        ]
        extra_kwargs = {'evidence_file': {'write_only': True, 'required': False}}

    def get_member_name(self, obj):
        return obj.member.user.get_full_name() or obj.member.user.email

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.email
        return None

    def get_evidence_file_url(self, obj):
        if not obj.evidence_file:
            return None
        return obj.evidence_file.url


# ── Phase 5: Check-ins ────────────────────────────────────────────────────────

class CheckInSerializer(serializers.ModelSerializer):
    member_name      = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = CheckIn
        fields = [
            'id', 'member_name', 'period_type', 'period_start', 'period_end',
            'responses', 'submitted_at', 'reviewed_by_name', 'reviewed_at',
        ]
        read_only_fields = [
            'id', 'member_name', 'submitted_at', 'reviewed_by_name', 'reviewed_at',
        ]

    def get_member_name(self, obj):
        return obj.member.user.get_full_name() or obj.member.user.email

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.email
        return None


# ── Phase 6: Resources ────────────────────────────────────────────────────────

class ResourceSerializer(serializers.ModelSerializer):
    file_url        = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = Resource
        fields = [
            'id', 'title', 'description', 'category', 'file', 'file_url',
            'external_url', 'is_published', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_by_name', 'created_at']
        extra_kwargs = {'file': {'write_only': True, 'required': False}}

    def get_file_url(self, obj):
        if not obj.file:
            return None
        return obj.file.url

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


# ── Phase 6: Audit Log ────────────────────────────────────────────────────────

class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model  = AuditLog
        fields = [
            'id', 'actor_name', 'action', 'module', 'record_id',
            'record_repr', 'changes', 'ip_address', 'created_at',
        ]
        read_only_fields = fields

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.get_full_name() or obj.actor.username
        return 'system'


# ── Phase 7: Org Settings ─────────────────────────────────────────────────────

class OrgSettingsSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model  = OrgSettings
        fields = [
            'id', 'org_name', 'description', 'logo', 'logo_url',
            'timezone', 'contact_email', 'website',
            'training_auto_enroll_mandatory', 'training_certificate_enabled',
            'training_reminder_days', 'training_default_pass_score',
            'contribution_enabled', 'contribution_require_evidence',
            'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']
        extra_kwargs = {'logo': {'write_only': True, 'required': False}}

    def get_logo_url(self, obj):
        if not obj.logo:
            return None
        return obj.logo.url


# ── Agreements ────────────────────────────────────────────────────────────────

class OrgAgreementSerializer(serializers.ModelSerializer):
    file_url        = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    signature_count = serializers.SerializerMethodField()
    signed_by_me    = serializers.SerializerMethodField()

    class Meta:
        model  = OrgAgreement
        fields = [
            'id', 'title', 'description', 'file', 'file_url', 'version',
            'status', 'created_by_name', 'created_at',
            'signature_count', 'signed_by_me',
        ]
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {'file': {'write_only': True, 'required': False}}

    def get_file_url(self, obj):
        if not obj.file:
            return None
        return obj.file.url

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_signature_count(self, obj):
        return obj.signatures.count()

    def get_signed_by_me(self, obj):
        request = self.context.get('request')
        if not request or not hasattr(request.user, 'org_member'):
            return False
        return obj.signatures.filter(member=request.user.org_member).exists()


class AgreementSignatureSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

    class Meta:
        model  = MemberAgreementSignature
        fields = ['id', 'member_name', 'signed_at']

    def get_member_name(self, obj):
        return obj.member.user.get_full_name() or obj.member.user.username


# ── Recruitment ───────────────────────────────────────────────────────────────

class RecruitmentRequestSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()
    reviewed_by_name  = serializers.SerializerMethodField()

    class Meta:
        model  = RecruitmentRequest
        fields = [
            'id', 'submitted_by_name', 'candidate_name', 'candidate_email',
            'message', 'role_suggested', 'status',
            'reviewed_by_name', 'reviewer_note', 'reviewed_at', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'reviewed_at', 'status', 'reviewer_note']

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.user.get_full_name() or obj.submitted_by.user.username

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return None
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.username


# ── Standalone Forms / Surveys ────────────────────────────────────────────────

class StandaloneFormFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model  = StandaloneFormField
        fields = ['id', 'question', 'field_type', 'options', 'required', 'order', 'rating_max']
        read_only_fields = ['id']


class StandaloneFormSerializer(serializers.ModelSerializer):
    fields          = StandaloneFormFieldSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    total_submitted = serializers.SerializerMethodField()

    class Meta:
        model  = StandaloneForm
        fields = ['id', 'title', 'description', 'status', 'form_type', 'category', 'due_date',
                  'show_results_to_members', 'created_by_name', 'fields',
                  'total_submitted', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_total_submitted(self, obj):
        return obj.submissions.count()


class MyFormSerializer(serializers.ModelSerializer):
    fields       = StandaloneFormFieldSerializer(many=True, read_only=True)
    submitted    = serializers.SerializerMethodField()
    submitted_at = serializers.SerializerMethodField()
    my_answers   = serializers.SerializerMethodField()

    class Meta:
        model  = StandaloneForm
        fields = ['id', 'title', 'description', 'status', 'form_type', 'category', 'due_date',
                  'show_results_to_members', 'fields', 'submitted', 'submitted_at', 'my_answers', 'created_at']

    def get_submitted(self, obj):
        submitted_map = self.context.get('submitted_map')
        if submitted_map is not None:
            return obj.id in submitted_map
        member = self.context.get('member')
        return obj.submissions.filter(member=member, is_archived=False).exists() if member else False

    def get_submitted_at(self, obj):
        submitted_map = self.context.get('submitted_map')
        if submitted_map is not None:
            dt = submitted_map.get(obj.id)
            return dt.isoformat() if dt else None
        member = self.context.get('member')
        if not member:
            return None
        sub = obj.submissions.filter(member=member, is_archived=False).order_by('-submitted_at').first()
        return sub.submitted_at.isoformat() if sub else None

    def get_my_answers(self, obj):
        answers_map = self.context.get('answers_map')
        if answers_map is not None:
            return answers_map.get(obj.id, {})
        member = self.context.get('member')
        if not member:
            return {}
        result = {}
        for r in obj.responses.filter(member=member):
            value = r.file.url if r.file else r.answer
            result[str(r.field_id)] = value
        return result


# ── Extension Requests ────────────────────────────────────────────────────────

class ExtensionRequestSerializer(serializers.ModelSerializer):
    user_name        = serializers.SerializerMethodField()
    user_email       = serializers.SerializerMethodField()
    course_title     = serializers.SerializerMethodField()
    progress_pct     = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = ExtensionRequest
        fields = [
            'id', 'user_name', 'user_email', 'course_title', 'progress_pct',
            'days_requested', 'reason', 'status', 'admin_note',
            'reviewed_by_name', 'reviewed_at', 'created_at',
        ]
        read_only_fields = [
            'id', 'user_name', 'user_email', 'course_title', 'progress_pct',
            'reviewed_by_name', 'reviewed_at', 'created_at',
        ]

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_user_email(self, obj):
        return obj.user.email

    def get_course_title(self, obj):
        return obj.course.title

    def get_progress_pct(self, obj):
        enr   = obj.enrollment
        total = sum(m.lessons.count() for m in enr.course.modules.all())
        if total == 0:
            return 0
        done = enr.lesson_progress.filter(completed=True).count()
        return round(done / total * 100)

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return None
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.username


# ── Org Chat Serializers ───────────────────────────────────────────────────────

class OrgChatChannelSerializer(serializers.ModelSerializer):
    member_count    = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = OrgChatChannel
        fields = ['id', 'name', 'description', 'channel_type', 'is_archived',
                  'member_count', 'created_by_name', 'created_at']

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username


class _OrgChatSenderSerializer(serializers.ModelSerializer):
    display_name    = serializers.SerializerMethodField()
    profile_picture = serializers.SerializerMethodField()
    email           = serializers.EmailField(read_only=True)

    class Meta:
        model  = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email',
                  'display_name', 'profile_picture']

    def get_display_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def get_profile_picture(self, obj):
        try:
            if hasattr(obj, 'student_profile') and obj.student_profile.profile_picture:
                return obj.student_profile.profile_picture.url
        except Exception:
            pass
        try:
            if hasattr(obj, 'mentor_profile') and obj.mentor_profile.profile_picture:
                return obj.mentor_profile.profile_picture.url
        except Exception:
            pass
        return None


class OrgChatReactionSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model  = OrgChatReaction
        fields = ['id', 'emoji', 'user']

    def get_user(self, obj):
        return {'id': obj.user_id, 'username': obj.user.username,
                'first_name': obj.user.first_name, 'last_name': obj.user.last_name}


class OrgChatMessageSerializer(serializers.ModelSerializer):
    sender          = _OrgChatSenderSerializer(read_only=True)
    reactions       = OrgChatReactionSerializer(many=True, read_only=True)
    reply_to        = serializers.SerializerMethodField()
    attachment_url  = serializers.SerializerMethodField()
    attachment_name = serializers.SerializerMethodField()

    class Meta:
        model  = OrgChatMessage
        fields = ['id', 'channel', 'sender', 'body', 'attachment_url', 'attachment_name',
                  'message_type', 'is_pinned', 'is_deleted', 'reply_to',
                  'reactions', 'created_at', 'updated_at']

    def get_attachment_url(self, obj):
        return obj.attachment.url if obj.attachment else None

    def get_attachment_name(self, obj):
        return obj.attachment.name.split('/')[-1] if obj.attachment else None

    def get_reply_to(self, obj):
        if not obj.reply_to_id:
            return None
        try:
            rt = obj.reply_to
            return {'id': rt.id, 'body': rt.body[:80],
                    'sender_name': f"{rt.sender.first_name} {rt.sender.last_name}".strip() or rt.sender.username}
        except Exception:
            return None


class OrgDMMessageSerializer(serializers.ModelSerializer):
    sender         = _OrgChatSenderSerializer(read_only=True)
    receiver       = _OrgChatSenderSerializer(read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model  = OrgDMMessage
        fields = ['id', 'sender', 'receiver', 'body', 'attachment_url',
                  'created_at', 'is_read', 'is_deleted']

    def get_attachment_url(self, obj):
        return obj.attachment.url if obj.attachment else None


class OrgChatPollOptionSerializer(serializers.ModelSerializer):
    voter_count = serializers.SerializerMethodField()
    voter_ids   = serializers.SerializerMethodField()

    class Meta:
        model  = OrgChatPollOption
        fields = ['id', 'text', 'voter_count', 'voter_ids']

    def get_voter_count(self, obj):
        return obj.voters.count()

    def get_voter_ids(self, obj):
        return list(obj.voters.values_list('id', flat=True))


class OrgChatPollSerializer(serializers.ModelSerializer):
    author      = _OrgChatSenderSerializer(read_only=True)
    options     = OrgChatPollOptionSerializer(many=True, read_only=True)
    total_votes = serializers.SerializerMethodField()

    class Meta:
        model  = OrgChatPoll
        fields = ['id', 'channel', 'author', 'question', 'options',
                  'allow_multiple', 'is_closed', 'total_votes', 'created_at']

    def get_total_votes(self, obj):
        return sum(opt.voters.count() for opt in obj.options.all())

