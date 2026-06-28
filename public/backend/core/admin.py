from django.contrib import admin
from .models import (
    StudentProfile, MentorProfile,
    Assignment, Message,
    Workspace, WorkspaceMembership, WorkspaceResource,
    WorkspaceChatChannel, WorkspaceChatMessage,
    WorkspaceTask, WorkspaceTaskSubmission,
    WorkspaceTaskSection, WorkspaceTaskComment, WorkspaceTaskDocument,
    WorkspaceEvent, WorkspacePoll,
    Notification, ContactRequest, Block,
    Post, PostReaction, PostComment, PostBookmark,
    MentorAvailabilitySlot, Session, MentorRating,
    PersonalTask, ProfileView,
)


# ===========================================================================
# Helpers
# ===========================================================================

class ReadOnlyMixin:
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
    def has_delete_permission(self, request, obj=None): return False


# ===========================================================================
# Inlines
# ===========================================================================

class WorkspaceMembershipInline(admin.TabularInline):
    model = WorkspaceMembership
    extra = 0
    fields = ('student', 'status', 'requested_at')
    readonly_fields = ('requested_at',)


class WorkspaceResourceInline(admin.TabularInline):
    model = WorkspaceResource
    extra = 0
    fields = ('title', 'resource_type', 'url', 'is_hidden')


class WorkspaceTaskInline(admin.TabularInline):
    model = WorkspaceTask
    extra = 0
    fields = ('title', 'status', 'due_date')
    readonly_fields = ()
    show_change_link = True


# ===========================================================================
# Profiles
# ===========================================================================

@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display   = ('user', 'get_email', 'university', 'field_of_study', 'career_stage', 'get_mentor', 'created_at')
    search_fields  = ('user__username', 'user__email', 'university', 'field_of_study')
    list_filter    = ('career_stage',)
    readonly_fields = ('created_at', 'updated_at')

    @admin.display(description='Email')
    def get_email(self, obj): return obj.user.email

    @admin.display(description='Mentor')
    def get_mentor(self, obj):
        a = obj.assignment if hasattr(obj, 'assignment') else None
        return a.mentor.user.username if a and a.mentor else '—'


@admin.register(MentorProfile)
class MentorProfileAdmin(admin.ModelAdmin):
    list_display   = ('user', 'get_email', 'domain', 'preferred_student_level', 'expertise', 'get_student_count', 'created_at')
    search_fields  = ('user__username', 'user__email', 'expertise', 'domain')
    list_filter    = ('domain', 'preferred_student_level')
    readonly_fields = ('created_at', 'updated_at')

    @admin.display(description='Email')
    def get_email(self, obj): return obj.user.email

    @admin.display(description='Students')
    def get_student_count(self, obj): return obj.assignments.filter(is_active=True).count()


# ===========================================================================
# Assignment
# ===========================================================================

@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display    = ('student', 'mentor', 'is_active', 'assigned_by', 'assigned_at')
    list_filter     = ('is_active', 'mentor')
    search_fields   = ('student__user__username', 'mentor__user__username')
    readonly_fields = ('assigned_at', 'updated_at')

    def save_model(self, request, obj, form, change):
        if not obj.assigned_by_id:
            obj.assigned_by = request.user
        super().save_model(request, obj, form, change)


# ===========================================================================
# Workspaces
# ===========================================================================

@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display    = ('name', 'mentor', 'category', 'level', 'privacy', 'member_count', 'auto_accept', 'is_active', 'created_at')
    list_filter     = ('category', 'level', 'privacy', 'is_active', 'auto_accept')
    search_fields   = ('name', 'mentor__user__username', 'slug')
    readonly_fields = ('slug', 'created_at', 'invite_token')
    inlines         = [WorkspaceMembershipInline, WorkspaceResourceInline, WorkspaceTaskInline]

    @admin.display(description='Members')
    def member_count(self, obj):
        return obj.memberships.filter(status='approved').count()


@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(admin.ModelAdmin):
    list_display    = ('student', 'workspace', 'status', 'requested_at')
    list_filter     = ('status',)
    search_fields   = ('student__user__username', 'workspace__name')
    readonly_fields = ('requested_at',)


@admin.register(WorkspaceTask)
class WorkspaceTaskAdmin(admin.ModelAdmin):
    list_display    = ('title', 'workspace', 'status', 'task_type', 'due_date', 'created_at')
    list_filter     = ('status', 'task_type', 'workspace')
    search_fields   = ('title', 'workspace__name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(WorkspaceTaskSubmission)
class WorkspaceTaskSubmissionAdmin(admin.ModelAdmin):
    list_display    = ('task', 'student', 'status', 'submitted_at', 'completed_at')
    list_filter     = ('status',)
    search_fields   = ('task__title', 'student__user__username')
    readonly_fields = ('assigned_at', 'submitted_at', 'completed_at')


# ===========================================================================
# Feed / Posts
# ===========================================================================

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display    = ('get_author', 'get_preview', 'post_type', 'is_pinned', 'reaction_count', 'created_at')
    list_filter     = ('post_type', 'is_pinned')
    search_fields   = ('author__username', 'body')
    readonly_fields = ('created_at', 'updated_at')

    @admin.display(description='Author')
    def get_author(self, obj): return obj.author.username

    @admin.display(description='Preview')
    def get_preview(self, obj): return (obj.body or '')[:60]

    @admin.display(description='Reactions')
    def reaction_count(self, obj): return obj.reactions.count()


# ===========================================================================
# Sessions & Availability
# ===========================================================================

@admin.register(MentorAvailabilitySlot)
class MentorAvailabilitySlotAdmin(admin.ModelAdmin):
    list_display    = ('mentor', 'day_of_week', 'start_time', 'end_time')
    list_filter     = ('day_of_week',)
    search_fields   = ('mentor__user__username',)


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display    = ('mentor', 'student', 'status', 'date', 'start_time')
    list_filter     = ('status',)
    search_fields   = ('mentor__user__username', 'student__user__username')
    readonly_fields = ('created_at',)


@admin.register(MentorRating)
class MentorRatingAdmin(admin.ModelAdmin):
    list_display    = ('mentor', 'student', 'rating', 'created_at')
    list_filter     = ('rating',)
    readonly_fields = ('created_at',)


# ===========================================================================
# Messaging & Social
# ===========================================================================

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display    = ('sender', 'receiver', 'get_preview', 'timestamp', 'is_read')
    list_filter     = ('is_read',)
    readonly_fields = ('sender', 'receiver', 'body', 'timestamp')

    @admin.display(description='Message')
    def get_preview(self, obj): return obj.body[:60]


@admin.register(ContactRequest)
class ContactRequestAdmin(admin.ModelAdmin):
    list_display    = ('sender', 'receiver', 'status', 'created_at')
    list_filter     = ('status',)
    readonly_fields = ('created_at',)


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display    = ('blocker', 'blocked', 'created_at')
    readonly_fields = ('created_at',)


# ===========================================================================
# Notifications
# ===========================================================================

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display    = ('recipient', 'notif_type', 'title', 'is_read', 'created_at')
    list_filter     = ('notif_type', 'is_read')
    search_fields   = ('recipient__username', 'title')
    readonly_fields = ('created_at',)


# ===========================================================================
# Misc
# ===========================================================================

@admin.register(PersonalTask)
class PersonalTaskAdmin(admin.ModelAdmin):
    list_display    = ('student', 'title', 'is_done', 'date', 'created_at')
    list_filter     = ('is_done',)
    search_fields   = ('student__user__username', 'title')
    readonly_fields = ('created_at',)


@admin.register(ProfileView)
class ProfileViewAdmin(ReadOnlyMixin, admin.ModelAdmin):
    list_display    = ('viewer', 'viewed_user', 'viewed_at')
    readonly_fields = ('viewer', 'viewed_user', 'viewed_at')
