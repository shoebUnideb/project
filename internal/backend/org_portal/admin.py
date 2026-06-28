from django.contrib import admin
from .models import (
    InternalRole, OrgMember, OrgNotification,
    Department,
    OnboardingTemplate, TaskTemplateItem,
    OnboardingInstance, TaskInstance,
    DocumentTemplate, MemberDocument,
    TrainingCourse, TrainingModule, TrainingLesson, TrainingEnrollment, LessonProgress,
    Event, EventAttendance,
    Contribution, CheckIn,
    Resource, AuditLog,
)


@admin.register(InternalRole)
class InternalRoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'level', 'can_manage_members', 'can_view_all_contributions', 'member_count')
    ordering     = ('-level', 'name')

    def member_count(self, obj):
        return obj.members.filter(status='active').count()
    member_count.short_description = 'Active members'


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display  = ('name', 'head', 'parent', 'member_count', 'created_at')
    list_filter   = ('parent',)
    search_fields = ('name',)
    raw_id_fields = ('head', 'parent')

    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = 'Members'


@admin.register(OrgMember)
class OrgMemberAdmin(admin.ModelAdmin):
    list_display    = ('user', 'role', 'department', 'status', 'joined_date', 'approved_by')
    list_filter     = ('status', 'role', 'department')
    search_fields   = ('user__username', 'user__email', 'employee_id')
    raw_id_fields   = ('user', 'approved_by', 'buddy', 'manager')
    readonly_fields = ('joined_date',)


@admin.register(OrgNotification)
class OrgNotificationAdmin(admin.ModelAdmin):
    list_display  = ('recipient', 'type', 'title', 'is_read', 'created_at')
    list_filter   = ('type', 'is_read')
    search_fields = ('recipient__username', 'title')
    readonly_fields = ('created_at',)


@admin.register(OnboardingTemplate)
class OnboardingTemplateAdmin(admin.ModelAdmin):
    list_display  = ('name', 'department', 'is_active', 'task_count', 'created_by', 'created_at')
    list_filter   = ('is_active', 'department')
    search_fields = ('name',)

    def task_count(self, obj):
        return obj.tasks.count()
    task_count.short_description = 'Tasks'


@admin.register(TaskTemplateItem)
class TaskTemplateItemAdmin(admin.ModelAdmin):
    list_display  = ('title', 'template', 'task_type', 'order', 'due_offset_days', 'required')
    list_filter   = ('task_type', 'required', 'approval_required')
    search_fields = ('title', 'template__name')
    ordering      = ('template', 'order')


@admin.register(OnboardingInstance)
class OnboardingInstanceAdmin(admin.ModelAdmin):
    list_display    = ('user', 'template', 'status', 'start_date', 'due_date', 'created_at')
    list_filter     = ('status',)
    search_fields   = ('user__username', 'user__email')
    raw_id_fields   = ('user', 'assigned_by', 'buddy', 'manager')
    readonly_fields = ('created_at',)


@admin.register(TaskInstance)
class TaskInstanceAdmin(admin.ModelAdmin):
    list_display  = ('title', 'onboarding', 'task_type', 'status', 'due_date')
    list_filter   = ('status', 'task_type')
    search_fields = ('title', 'onboarding__user__username')


@admin.register(DocumentTemplate)
class DocumentTemplateAdmin(admin.ModelAdmin):
    list_display  = ('name', 'category', 'department', 'version', 'is_mandatory', 'requires_signature')
    list_filter   = ('category', 'is_mandatory', 'requires_signature', 'department')
    search_fields = ('name',)


@admin.register(MemberDocument)
class MemberDocumentAdmin(admin.ModelAdmin):
    list_display    = ('user', 'title', 'category', 'status', 'uploaded_at', 'reviewed_by')
    list_filter     = ('status', 'category')
    search_fields   = ('user__username', 'title')
    raw_id_fields   = ('user', 'reviewed_by')
    readonly_fields = ('uploaded_at',)


@admin.register(TrainingCourse)
class TrainingCourseAdmin(admin.ModelAdmin):
    list_display  = ('title', 'department', 'is_mandatory', 'pass_score', 'created_by')
    list_filter   = ('is_mandatory', 'department')
    search_fields = ('title',)


@admin.register(TrainingModule)
class TrainingModuleAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'order')
    ordering     = ('course', 'order')


@admin.register(TrainingLesson)
class TrainingLessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'module', 'lesson_type', 'duration_minutes', 'order')
    list_filter  = ('lesson_type',)


@admin.register(TrainingEnrollment)
class TrainingEnrollmentAdmin(admin.ModelAdmin):
    list_display    = ('user', 'course', 'status', 'score', 'certificate_issued', 'enrolled_at')
    list_filter     = ('status', 'certificate_issued')
    search_fields   = ('user__username', 'course__title')
    readonly_fields = ('enrolled_at',)


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ('enrollment', 'lesson', 'completed', 'completed_at')
    list_filter  = ('completed',)


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display  = ('title', 'event_type', 'start_dt', 'end_dt', 'organizer', 'is_recurring')
    list_filter   = ('event_type', 'is_recurring')
    search_fields = ('title',)
    raw_id_fields = ('organizer', 'created_by')


@admin.register(EventAttendance)
class EventAttendanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'event', 'rsvp', 'attended')
    list_filter  = ('rsvp', 'attended')


@admin.register(Contribution)
class ContributionAdmin(admin.ModelAdmin):
    list_display    = ('member', 'title', 'contribution_type', 'hours', 'date', 'status')
    list_filter     = ('status', 'contribution_type')
    search_fields   = ('member__user__username', 'title')
    raw_id_fields   = ('approved_by',)
    readonly_fields = ('created_at',)


@admin.register(CheckIn)
class CheckInAdmin(admin.ModelAdmin):
    list_display    = ('member', 'period_type', 'period_start', 'period_end', 'submitted_at', 'reviewed_by')
    list_filter     = ('period_type',)
    search_fields   = ('member__user__username',)
    readonly_fields = ('submitted_at',)


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    list_display  = ('title', 'category', 'is_published', 'created_by', 'created_at')
    list_filter   = ('category', 'is_published')
    search_fields = ('title',)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display    = ('actor', 'action', 'module', 'record_id', 'record_repr', 'ip_address', 'created_at')
    list_filter     = ('action', 'module')
    search_fields   = ('actor__username', 'module', 'record_repr')
    readonly_fields = ('actor', 'action', 'module', 'record_id', 'record_repr', 'changes', 'ip_address', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
