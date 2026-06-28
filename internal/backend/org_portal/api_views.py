import csv
import re
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.db.models import Q, Count
from django.db.models.functions import TruncWeek
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView


def _get_user_pic(user):
    try:
        if hasattr(user, 'student_profile') and user.student_profile.profile_picture:
            return user.student_profile.profile_picture.url
    except Exception:
        pass
    try:
        if hasattr(user, 'mentor_profile') and user.mentor_profile.profile_picture:
            return user.mentor_profile.profile_picture.url
    except Exception:
        pass
    return None
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import (
    InternalRole, OrgMember, OrgNotification, Department,
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
    StandaloneForm, StandaloneFormField, FormDistribution, FormSubmission, StandaloneFormResponse,
    ExtensionRequest,
    OrgChatChannel, OrgChatChannelMember, OrgChatMessage, OrgChatReaction,
    OrgDMMessage, OrgChatPoll, OrgChatPollOption,
)
from .serializers import (
    InternalRoleSerializer,
    DepartmentSerializer,
    OrgMemberSerializer,
    OrgMemberProfileSerializer,
    GrantAccessSerializer,
    OnboardingTemplateSerializer,
    TaskTemplateItemSerializer,
    OnboardingInstanceSerializer,
    TaskInstanceSerializer,
    TaskCommentSerializer,
    TemplateFormFieldSerializer,
    TaskFormFieldSerializer,
    DocumentTemplateSerializer,
    MemberDocumentSerializer,
    TrainingCourseSerializer,
    TrainingModuleSerializer,
    TrainingLessonSerializer,
    TrainingEnrollmentSerializer,
    QuizQuestionSerializer,
    LessonSubmissionSerializer,
    EventSerializer,
    EventAttendanceSerializer,
    EventTypeConfigSerializer,
    EventSettingsSerializer,
    ContributionSerializer,
    CheckInSerializer,
    ResourceSerializer,
    AuditLogSerializer,
    OrgSettingsSerializer,
    OrgAgreementSerializer,
    AgreementSignatureSerializer,
    RecruitmentRequestSerializer,
    AccessRequestSerializer,
    StandaloneFormSerializer, StandaloneFormFieldSerializer, MyFormSerializer,
    ExtensionRequestSerializer,
    OrgChatChannelSerializer,
    OrgChatMessageSerializer,
    OrgDMMessageSerializer,
    OrgChatPollSerializer,
    OrgChatReactionSerializer,
)

User = get_user_model()


# ── Permission helpers ────────────────────────────────────────────────────────

def is_superadmin(user):
    return user.is_authenticated and user.role == 'superadmin'


def can_manage(user):
    if is_superadmin(user):
        return True
    if hasattr(user, 'org_member') and user.org_member.role.can_manage_members:
        return True
    return False


def is_org_member(user):
    return is_superadmin(user) or OrgMember.objects.filter(user=user).exists()


def _notify(recipient, notif_type, title, body='', link=''):
    OrgNotification.objects.create(
        recipient=recipient, type=notif_type, title=title, body=body, link=link,
    )


def _notify_admins(notif_type, title, body='', link='', permission='manage'):
    """Notify all superadmins and role-based admins for a given permission."""
    notified = set()
    for u in User.objects.filter(role='superadmin', is_active=True):
        _notify(u, notif_type, title, body, link)
        notified.add(u.pk)
    perm_filter = {
        'manage':        {'role__can_manage_members': True},
        'contributions': {'role__can_view_all_contributions': True},
        'checkins':      {'role__can_approve_checkins': True},
    }.get(permission, {'role__can_manage_members': True})
    for m in OrgMember.objects.filter(status='active', **perm_filter).select_related('user'):
        if m.user.pk not in notified:
            _notify(m.user, notif_type, title, body, link)
            notified.add(m.user.pk)


# ── Roles ─────────────────────────────────────────────────────────────────────

class InternalRoleListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = InternalRole.objects.all()
        return Response(InternalRoleSerializer(roles, many=True, context={'request': request}).data)

    def post(self, request):
        if not is_superadmin(request.user):
            return Response({'detail': 'Superadmin only.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = InternalRoleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InternalRoleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_role(self, pk):
        try:
            return InternalRole.objects.get(pk=pk)
        except InternalRole.DoesNotExist:
            return None

    def patch(self, request, pk):
        if not is_superadmin(request.user):
            return Response({'detail': 'Superadmin only.'}, status=status.HTTP_403_FORBIDDEN)
        role = self._get_role(pk)
        if not role:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = InternalRoleSerializer(role, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not is_superadmin(request.user):
            return Response({'detail': 'Superadmin only.'}, status=status.HTTP_403_FORBIDDEN)
        role = self._get_role(pk)
        if not role:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if role.members.exists():
            return Response(
                {'detail': 'Cannot delete a role that has members assigned to it.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Departments ───────────────────────────────────────────────────────────────

class DepartmentStatsView(APIView):
    """Aggregate stats for the Departments Overview page."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        from django.utils import timezone
        now         = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        total        = Department.objects.count()
        active_cnt   = Department.objects.filter(is_active=True).count()
        inactive_cnt = Department.objects.filter(is_active=False).count()
        heads_cnt    = Department.objects.filter(head__isnull=False).count()
        new_month    = Department.objects.filter(created_at__gte=month_start).count()

        total_emp = OrgMember.objects.filter(status='active').count()
        new_emp   = OrgMember.objects.filter(joined_date__gte=month_start.date()).count()
        avg_team  = round(total_emp / active_cnt, 1) if active_cnt > 0 else 0.0

        return Response({
            'total_departments':        total,
            'active_departments':       active_cnt,
            'inactive_departments':     inactive_cnt,
            'total_employees':          total_emp,
            'department_heads':         heads_cnt,
            'avg_team_size':            avg_team,
            'new_this_month':           new_month,
            'new_employees_this_month': new_emp,
        })


class DepartmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (can_manage(request.user) or hasattr(request.user, 'org_member')):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        depts = Department.objects.select_related('head', 'parent').all()
        return Response(DepartmentSerializer(depts, many=True, context={'request': request}).data)

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = DepartmentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DepartmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        try:
            return Department.objects.select_related('head', 'parent').get(pk=pk)
        except Department.DoesNotExist:
            return None

    def get(self, request, pk):
        if not (can_manage(request.user) or hasattr(request.user, 'org_member')):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        dept = self._get(pk)
        if not dept:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(DepartmentSerializer(dept, context={'request': request}).data)

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        dept = self._get(pk)
        if not dept:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DepartmentSerializer(dept, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        dept = self._get(pk)
        if not dept:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if dept.members.exists():
            return Response(
                {'detail': f'Cannot delete: {dept.members.count()} member(s) are assigned to this department.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if dept.sub_departments.exists():
            return Response(
                {'detail': f'Cannot delete: department has {dept.sub_departments.count()} sub-department(s). Remove them first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        dept.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Members ───────────────────────────────────────────────────────────────────

class OrgMemberListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_org_member(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        qs = OrgMember.objects.select_related('user', 'role', 'approved_by', 'department').all()
        dept_id = request.GET.get('dept')
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        search = request.GET.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(user__username__icontains=search) |
                Q(user__email__icontains=search) |
                Q(role__name__icontains=search)
            )
        role_id = request.GET.get('role')
        if role_id:
            qs = qs.filter(role_id=role_id)
        status_filter = request.GET.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(OrgMemberSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        if not is_superadmin(request.user):
            return Response({'detail': 'Superadmin only.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = GrantAccessSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data   = serializer.validated_data
        user   = User.objects.get(pk=data['user_id'])
        role   = InternalRole.objects.get(pk=data['role_id'])
        dept   = None
        if data.get('department_id'):
            try:
                dept = Department.objects.get(pk=data['department_id'])
            except Department.DoesNotExist:
                pass

        user.has_internal_access = True
        user.save(update_fields=['has_internal_access'])

        member = OrgMember.objects.create(
            user=user, role=role, department=dept,
            notes=data.get('notes', ''), approved_by=request.user,
        )
        _notify(
            user, 'access_granted',
            title='Welcome to GILE Internal Portal',
            body=f'You have been granted access as {role.name}.',
            link='/org/dashboard',
        )
        return Response(
            OrgMemberSerializer(member, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class OrgMemberDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_member(self, pk):
        try:
            return OrgMember.objects.select_related('user', 'role', 'approved_by', 'department').get(pk=pk)
        except OrgMember.DoesNotExist:
            return None

    def patch(self, request, pk):
        if not is_superadmin(request.user):
            return Response({'detail': 'Superadmin only.'}, status=status.HTTP_403_FORBIDDEN)
        member = self._get_member(pk)
        if not member:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        old_role = member.role
        old_dept = member.department
        serializer = OrgMemberSerializer(member, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            member.refresh_from_db()
            if 'role_id' in request.data and old_role != member.role:
                _notify(
                    member.user, 'role_changed',
                    title='Your internal role has been updated',
                    body=f'Your role has been changed to {member.role.name}.',
                    link='/org/dashboard',
                )
            if 'department_id' in request.data and old_dept != member.department:
                dept_name = member.department.name if member.department else 'None'
                _notify(
                    member.user, 'department_assigned',
                    title='Your department has been updated',
                    body=f'You have been assigned to {dept_name}.',
                    link='/org/dashboard',
                )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not is_superadmin(request.user):
            return Response({'detail': 'Superadmin only.'}, status=status.HTTP_403_FORBIDDEN)
        member = self._get_member(pk)
        if not member:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        user = member.user
        _notify(
            user, 'access_revoked',
            title='Your internal portal access has been removed',
            body='Contact your administrator if you think this is a mistake.',
        )
        user.has_internal_access = False
        user.save(update_fields=['has_internal_access'])
        member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrgMembersExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="members.csv"'
        writer = csv.writer(response)
        writer.writerow(['Name', 'Username', 'Email', 'Role', 'Department', 'Employee ID', 'Status', 'Joined Date'])
        members = OrgMember.objects.select_related('user', 'role', 'department').all().order_by('user__first_name')
        for m in members:
            display_name = f"{m.user.first_name or ''} {m.user.last_name or ''}".strip() or m.user.username
            writer.writerow([
                display_name,
                m.user.username,
                m.user.email,
                m.role.name,
                m.department.name if m.department else '',
                m.employee_id or '',
                m.status,
                m.joined_date.strftime('%Y-%m-%d') if m.joined_date else '',
            ])
        return response


class MemberProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_member(self, pk):
        try:
            return OrgMember.objects.select_related(
                'user', 'role', 'department', 'buddy__user', 'manager__user'
            ).get(pk=pk)
        except OrgMember.DoesNotExist:
            return None

    def _can_access(self, request, member):
        if can_manage(request.user):
            return True
        if is_org_member(request.user):
            return True
        return False

    def get(self, request, pk):
        member = self._get_member(pk)
        if not member:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not self._can_access(request, member):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(OrgMemberProfileSerializer(member, context={'request': request}).data)

    def patch(self, request, pk):
        member = self._get_member(pk)
        if not member:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not self._can_access(request, member):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = OrgMemberProfileSerializer(
            member, data=request.data, partial=True, context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(OrgMemberProfileSerializer(
                member, context={'request': request}
            ).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── Current user ──────────────────────────────────────────────────────────────

class OrgMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'org_member'):
            return Response({'detail': 'Not an org member.'}, status=status.HTTP_404_NOT_FOUND)
        member = OrgMember.objects.select_related(
            'role', 'department', 'buddy__user', 'manager__user'
        ).get(user=request.user)
        return Response(OrgMemberSerializer(member, context={'request': request}).data)


class OrgUserSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_superadmin(request.user):
            return Response({'detail': 'Superadmin only.'}, status=status.HTTP_403_FORBIDDEN)
        q = request.GET.get('q', '').strip()
        if len(q) < 2:
            return Response([])

        users = (
            User.objects
            .filter(
                Q(username__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(email__icontains=q)
            )
            .exclude(has_internal_access=True)
            .exclude(role='superadmin')
            .select_related('student_profile', 'mentor_profile')
            [:10]
        )

        results = []
        for u in users:
            pic = None
            if u.role == 'student' and hasattr(u, 'student_profile'):
                pic = u.student_profile.profile_picture
            elif u.role == 'mentor' and hasattr(u, 'mentor_profile'):
                pic = u.mentor_profile.profile_picture
            display_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username
            results.append({
                'user_id':      u.id,
                'username':     u.username,
                'email':        u.email,
                'display_name': display_name,
                'role':         u.role,
                'avatar_url':   pic.url if pic else None,
            })

        return Response(results)


# ── Notifications ─────────────────────────────────────────────────────────────

class OrgNotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifs = OrgNotification.objects.filter(recipient=request.user)[:30]
        unread = OrgNotification.objects.filter(recipient=request.user, is_read=False).count()
        data = [
            {
                'id':         n.id,
                'type':       n.type,
                'title':      n.title,
                'body':       n.body,
                'link':       n.link,
                'is_read':    n.is_read,
                'created_at': n.created_at,
            }
            for n in notifs
        ]
        return Response({'results': data, 'unread': unread})

    def post(self, request):
        OrgNotification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'ok'})


class OrgNotificationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        OrgNotification.objects.filter(pk=pk, recipient=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Onboarding Templates ──────────────────────────────────────────────────────

class OnboardingTemplateListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        templates = (
            OnboardingTemplate.objects
            .select_related('department', 'created_by')
            .prefetch_related('tasks')
            .all()
        )
        return Response(OnboardingTemplateSerializer(templates, many=True, context={'request': request}).data)

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = OnboardingTemplateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OnboardingTemplateDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        try:
            return (
                OnboardingTemplate.objects
                .select_related('department', 'created_by')
                .prefetch_related('tasks')
                .get(pk=pk)
            )
        except OnboardingTemplate.DoesNotExist:
            return None

    def get(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        tmpl = self._get(pk)
        if not tmpl:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OnboardingTemplateSerializer(tmpl, context={'request': request}).data)

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        tmpl = self._get(pk)
        if not tmpl:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = OnboardingTemplateSerializer(tmpl, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        tmpl = self._get(pk)
        if not tmpl:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        count = tmpl.instances.count()
        if count:
            return Response(
                {'detail': f'Cannot delete: {count} onboarding instance(s) use this template.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tmpl.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OnboardingTemplateCloneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            tmpl = OnboardingTemplate.objects.prefetch_related('tasks').get(pk=pk)
        except OnboardingTemplate.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_tmpl = OnboardingTemplate.objects.create(
            name=f"{tmpl.name} (Copy)",
            description=tmpl.description,
            category=tmpl.category,
            department=tmpl.department,
            visible_to=tmpl.visible_to,
            assignable_by=tmpl.assignable_by,
            task_approval_enabled=tmpl.task_approval_enabled,
            due_date_policy=tmpl.due_date_policy,
            created_by=request.user,
            is_active=tmpl.is_active,
        )
        for item in tmpl.tasks.all().order_by('order'):
            TaskTemplateItem.objects.create(
                template=new_tmpl,
                title=item.title,
                description=item.description,
                task_type=item.task_type,
                order=item.order,
                due_offset_days=item.due_offset_days,
                required=item.required,
                approval_required=item.approval_required,
                assignee_type=item.assignee_type,
            )
        new_tmpl = (
            OnboardingTemplate.objects
            .select_related('department', 'created_by')
            .prefetch_related('tasks')
            .get(pk=new_tmpl.pk)
        )
        return Response(
            OnboardingTemplateSerializer(new_tmpl, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class OnboardingTemplateImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        data = request.data
        if not isinstance(data, dict) or not data.get('name'):
            return Response({'detail': 'Invalid import format. Expected JSON with a "name" field.'}, status=status.HTTP_400_BAD_REQUEST)

        dept = None
        if data.get('department'):
            dept = Department.objects.filter(name=data['department']).first()

        tmpl = OnboardingTemplate.objects.create(
            name=data.get('name', 'Imported Template'),
            description=data.get('description', ''),
            category=data.get('category', ''),
            visible_to=data.get('visible_to', 'All Departments'),
            assignable_by=data.get('assignable_by', 'HR Admin, Managers'),
            task_approval_enabled=bool(data.get('task_approval_enabled', False)),
            due_date_policy=data.get('due_date_policy', 'Relative to start date'),
            department=dept,
            created_by=request.user,
            is_active=False,
        )
        for i, t in enumerate(data.get('tasks', [])):
            TaskTemplateItem.objects.create(
                template=tmpl,
                title=t.get('title', 'Untitled'),
                description=t.get('description', ''),
                task_type=t.get('task_type', 'info'),
                phase=t.get('phase', ''),
                order=t.get('order', i),
                due_offset_days=int(t.get('due_offset_days', 0)),
                required=bool(t.get('required', True)),
                approval_required=bool(t.get('approval_required', False)),
                assignee_type=t.get('assignee_type', 'new_hire'),
            )
        tmpl = (
            OnboardingTemplate.objects
            .select_related('department', 'created_by')
            .prefetch_related('tasks')
            .get(pk=tmpl.pk)
        )
        return Response(
            OnboardingTemplateSerializer(tmpl, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class TaskTemplateItemListView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            template = OnboardingTemplate.objects.get(pk=pk)
        except OnboardingTemplate.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TaskTemplateItemSerializer(data=request.data)
        if serializer.is_valid():
            order = serializer.validated_data.get('order', template.tasks.count())
            serializer.save(template=template, order=order)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskTemplateItemDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def _get(self, pk):
        try:
            return TaskTemplateItem.objects.select_related('template').get(pk=pk)
        except TaskTemplateItem.DoesNotExist:
            return None

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        item = self._get(pk)
        if not item:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TaskTemplateItemSerializer(item, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        item = self._get(pk)
        if not item:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Onboarding Instances ──────────────────────────────────────────────────────

class OnboardingInstanceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (can_manage(request.user) or hasattr(request.user, 'org_member')):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        if can_manage(request.user):
            qs = (
                OnboardingInstance.objects
                .select_related('user', 'template', 'assigned_by', 'buddy__user', 'manager__user')
                .prefetch_related('tasks', 'tasks__template_item', 'tasks__form_fields', 'tasks__form_fields__response')
                .all()
            )
            user_id = request.query_params.get('user_id')
            if user_id:
                qs = qs.filter(user_id=user_id)
        else:
            qs = (
                OnboardingInstance.objects
                .filter(user=request.user)
                .select_related('template', 'assigned_by')
                .prefetch_related('tasks', 'tasks__template_item', 'tasks__form_fields', 'tasks__form_fields__response')
            )
        return Response(OnboardingInstanceSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = OnboardingInstanceSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            from datetime import timedelta
            instance = serializer.save(assigned_by=request.user, status='active')
            if instance.template:
                for item in instance.template.tasks.all().order_by('order'):
                    due = (
                        instance.start_date + timedelta(days=item.due_offset_days)
                        if item.due_offset_days else None
                    )
                    task_inst = TaskInstance.objects.create(
                        onboarding=instance,
                        template_item=item,
                        title=item.title,
                        description=item.description,
                        task_type=item.task_type,
                        phase=item.phase,
                        content_url=item.content_url,
                        content_body=item.content_body,
                        content_file=item.content_file or None,
                        required=item.required,
                        approval_required=item.approval_required,
                        due_date=due,
                    )
                    for field in item.form_fields.all():
                        TaskFormField.objects.create(
                            task=task_inst,
                            question=field.question,
                            field_type=field.field_type,
                            options=field.options,
                            required=field.required,
                            order=field.order,
                        )
            _notify(
                instance.user, 'onboarding_started',
                title='Your onboarding has started',
                body='Welcome! Your onboarding program has been set up. Complete your tasks to get started.',
                link='/org/onboarding',
            )
            instance = (
                OnboardingInstance.objects
                .select_related('user', 'template', 'assigned_by', 'buddy__user', 'manager__user')
                .prefetch_related('tasks')
                .get(pk=instance.pk)
            )
            return Response(
                OnboardingInstanceSerializer(instance, context={'request': request}).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OnboardingInstanceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, pk, user):
        try:
            qs = (
                OnboardingInstance.objects
                .select_related('user', 'template', 'assigned_by', 'buddy__user', 'manager__user')
                .prefetch_related('tasks')
            )
            if can_manage(user):
                return qs.get(pk=pk)
            return qs.get(pk=pk, user=user)
        except OnboardingInstance.DoesNotExist:
            return None

    def get(self, request, pk):
        if not (can_manage(request.user) or hasattr(request.user, 'org_member')):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        instance = self._get(pk, request.user)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OnboardingInstanceSerializer(instance, context={'request': request}).data)

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        instance = self._get(pk, request.user)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = OnboardingInstanceSerializer(
            instance, data=request.data, partial=True, context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        instance = self._get(pk, request.user)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OnboardingResetView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            instance = OnboardingInstance.objects.prefetch_related('tasks').get(pk=pk)
        except OnboardingInstance.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        instance.tasks.all().update(status='not_started', notes='', completed_at=None)
        instance.status = 'active'
        instance.completed_at = None
        instance.save(update_fields=['status', 'completed_at'])
        return Response(OnboardingInstanceSerializer(instance, context={'request': request}).data)


class OnboardingRemindView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            instance = OnboardingInstance.objects.select_related('user').get(pk=pk)
        except OnboardingInstance.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        pending_count = instance.tasks.exclude(status='completed').count()
        _notify(
            instance.user,
            'task_assigned',
            title='Reminder: Complete your onboarding tasks',
            body=f'You have {pending_count} task(s) remaining in your onboarding. Please log in to complete them.',
            link='/org/onboarding',
        )
        return Response({'sent': True})


class TaskInstanceListView(APIView):
    """POST a brand-new TaskInstance on a live onboarding. Admin only; never touches the template."""
    permission_classes = [IsAuthenticated]

    def post(self, request, onboarding_pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            onboarding = OnboardingInstance.objects.get(pk=onboarding_pk)
        except OnboardingInstance.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        title = (request.data.get('title') or '').strip()
        if not title:
            return Response({'title': ['Title is required.']}, status=status.HTTP_400_BAD_REQUEST)

        def _bool(key, default=False):
            v = request.data.get(key)
            if v is None:
                return default
            return str(v).lower() in ('true', '1', 'yes', 'on')

        due_date = request.data.get('due_date') or None
        if due_date in ('', 'null'):
            due_date = None

        task = TaskInstance.objects.create(
            onboarding=onboarding,
            template_item=None,
            title=title,
            description=(request.data.get('description') or '').strip(),
            task_type=request.data.get('task_type') or 'info',
            phase=(request.data.get('phase') or '').strip(),
            content_url=(request.data.get('content_url') or '').strip(),
            content_body=request.data.get('content_body') or '',
            required=_bool('required', True),
            approval_required=_bool('approval_required', False),
            due_date=due_date,
        )
        if 'content_file' in request.FILES:
            task.content_file = request.FILES['content_file']
            task.save(update_fields=['content_file'])
        return Response(
            TaskInstanceSerializer(task, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class TaskInstanceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, onboarding_pk, task_pk):
        try:
            task = TaskInstance.objects.select_related('onboarding__user').get(
                pk=task_pk, onboarding_id=onboarding_pk
            )
        except TaskInstance.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        is_admin = can_manage(request.user)
        if not (is_admin or task.onboarding.user == request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        # Runtime field: member or admin can attach a deliverable file
        if 'attachment' in request.FILES:
            task.attachment = request.FILES['attachment']

        # Runtime field: status transitions
        new_status = request.data.get('status')
        if new_status:
            task.status = new_status
            if new_status == 'completed' and not task.completed_at:
                from django.utils import timezone
                task.completed_at = timezone.now()

        # Runtime field: notes
        if 'notes' in request.data:
            task.notes = request.data['notes']

        # Authoring fields (admin only) — edits the live instance, never the template
        if is_admin:
            AUTHORING_FIELDS = (
                'title', 'description', 'task_type', 'phase',
                'content_url', 'content_body', 'due_date',
                'required', 'approval_required',
            )
            for f in AUTHORING_FIELDS:
                if f in request.data:
                    val = request.data[f]
                    # Cast booleans coming from multipart form-data
                    if f in ('required', 'approval_required'):
                        val = str(val).lower() in ('true', '1', 'yes', 'on')
                    elif f == 'due_date' and val in ('', None, 'null'):
                        val = None
                    setattr(task, f, val)

            if 'content_file' in request.FILES:
                task.content_file = request.FILES['content_file']
            elif request.data.get('content_file_clear') in ('true', '1', True):
                task.content_file = None

        task.save()

        # Auto-complete the onboarding when every task is done
        onboarding = task.onboarding
        if (
            onboarding.status not in ('completed', 'archived')
            and not onboarding.tasks.exclude(status='completed').exists()
            and onboarding.tasks.exists()
        ):
            from django.utils import timezone as tz
            onboarding.status = 'completed'
            onboarding.completed_at = tz.now()
            onboarding.save(update_fields=['status', 'completed_at'])

        return Response(TaskInstanceSerializer(task, context={'request': request}).data)

    def delete(self, request, onboarding_pk, task_pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            task = TaskInstance.objects.get(pk=task_pk, onboarding_id=onboarding_pk)
        except TaskInstance.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskCommentListView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_task(self, onboarding_pk, task_pk, user):
        try:
            task = TaskInstance.objects.select_related('onboarding__user').get(
                pk=task_pk, onboarding_id=onboarding_pk
            )
        except TaskInstance.DoesNotExist:
            return None, False
        allowed = can_manage(user) or task.onboarding.user == user
        return task, allowed

    def get(self, request, onboarding_pk, task_pk):
        task, allowed = self._get_task(onboarding_pk, task_pk, request.user)
        if task is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not allowed:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        comments = task.comments.select_related('author').all()
        return Response(TaskCommentSerializer(comments, many=True, context={'request': request}).data)

    def post(self, request, onboarding_pk, task_pk):
        task, allowed = self._get_task(onboarding_pk, task_pk, request.user)
        if task is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not allowed:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        body = (request.data.get('body') or '').strip()
        if not body:
            return Response({'detail': 'Comment body is required.'}, status=status.HTTP_400_BAD_REQUEST)
        comment = TaskComment.objects.create(task=task, author=request.user, body=body)
        if can_manage(request.user) and task.onboarding.user != request.user:
            _notify(
                task.onboarding.user, 'task_assigned',
                title=f'New comment on: {task.title}',
                body=f'{request.user.get_full_name() or request.user.username} left a comment.',
                link='/org/my-onboarding',
            )
        return Response(
            TaskCommentSerializer(comment, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class MyOnboardingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'org_member'):
            return Response({'detail': 'Not an org member.'}, status=status.HTTP_404_NOT_FOUND)
        instance = (
            OnboardingInstance.objects
            .filter(user=request.user)
            .exclude(status='archived')
            .select_related('template', 'assigned_by')
            .prefetch_related('tasks', 'tasks__template_item', 'tasks__form_fields', 'tasks__form_fields__response')
            .order_by('-created_at')
            .first()
        )
        if not instance:
            return Response(None)
        return Response(OnboardingInstanceSerializer(instance, context={'request': request}).data)


class OnboardingStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        from django.db.models import Count
        qs = OnboardingInstance.objects.values('status').annotate(count=Count('id'))
        stats = {item['status']: item['count'] for item in qs}
        return Response({
            'total':     sum(stats.values()),
            'pending':   stats.get('pending', 0),
            'active':    stats.get('active', 0),
            'paused':    stats.get('paused', 0),
            'completed': stats.get('completed', 0),
            'archived':  stats.get('archived', 0),
        })


# ─────────────────────────── Document Templates ───────────────────────────────

class DocumentTemplateImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        data = request.data
        name = data.get('name', '').strip()
        if not name:
            return Response({'detail': 'name is required.'}, status=status.HTTP_400_BAD_REQUEST)
        tmpl = DocumentTemplate.objects.create(
            name=name,
            description=data.get('description', ''),
            category=data.get('category', 'required'),
            version=data.get('version', '1.0'),
            is_mandatory=data.get('is_mandatory', True),
            requires_signature=data.get('requires_signature', False),
            is_active=False,
            created_by=request.user,
        )
        ser = DocumentTemplateSerializer(tmpl, context={'request': request})
        return Response(ser.data, status=status.HTTP_201_CREATED)


class DocumentTemplateListView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        qs = DocumentTemplate.objects.select_related('department', 'created_by').all()
        return Response(DocumentTemplateSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = DocumentTemplateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DocumentTemplateDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def _get_obj(self, pk):
        try:
            return DocumentTemplate.objects.select_related('department', 'created_by').get(pk=pk)
        except DocumentTemplate.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get_obj(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(DocumentTemplateSerializer(obj, context={'request': request}).data)

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get_obj(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DocumentTemplateSerializer(obj, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get_obj(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentTemplateAssignView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            template = DocumentTemplate.objects.get(pk=pk)
        except DocumentTemplate.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        user_ids   = request.data.get('user_ids', [])
        dept_id    = request.data.get('department_id')
        assign_all = request.data.get('assign_all', False)
        created    = 0

        from datetime import date
        try:
            from dateutil.relativedelta import relativedelta as _rd
            exp_date = (date.today() + _rd(months=template.expiration_months)
                        if template.expiration_months else None)
        except ImportError:
            exp_date = (date.today() + timedelta(days=template.expiration_months * 30)
                        if template.expiration_months else None)

        def _defaults():
            d = {'title': template.name, 'category': template.category, 'assigned_by': request.user}
            if exp_date:
                d['expiration_date'] = exp_date
            return d

        if assign_all:
            for member in OrgMember.objects.filter(status='active').select_related('user'):
                _, c = MemberDocument.objects.get_or_create(
                    user=member.user, template=template,
                    defaults=_defaults(),
                )
                if c:
                    created += 1

        if dept_id:
            for member in OrgMember.objects.filter(department_id=dept_id, status='active').select_related('user'):
                _, c = MemberDocument.objects.get_or_create(
                    user=member.user, template=template,
                    defaults=_defaults(),
                )
                if c:
                    created += 1

        for uid in user_ids:
            try:
                user = User.objects.get(pk=uid)
                _, c = MemberDocument.objects.get_or_create(
                    user=user, template=template,
                    defaults=_defaults(),
                )
                if c:
                    created += 1
            except User.DoesNotExist:
                pass

        return Response({'created': created})


# ─────────────────────────── Member Documents ─────────────────────────────────

class AllDocumentsAdminView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        qs = MemberDocument.objects.select_related('user', 'template', 'reviewed_by').all()
        st = request.query_params.get('status')
        if st:
            qs = qs.filter(status=st)
        uid = request.query_params.get('user_id')
        if uid:
            qs = qs.filter(user_id=uid)
        return Response(MemberDocumentSerializer(qs, many=True, context={'request': request}).data)


class DocumentGlobalStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        from django.db.models import Avg, F, ExpressionWrapper, DurationField

        today       = timezone.now().date()
        thirty_days = today + timedelta(days=30)

        total_members    = OrgMember.objects.filter(status='active').count()
        total_documents  = MemberDocument.objects.count()
        pending_actions  = MemberDocument.objects.filter(
            status__in=['assigned', 'uploaded', 'pending_review']
        ).count()
        signed_documents = MemberDocument.objects.filter(
            status__in=['signed', 'approved']
        ).count()
        signed_pct = round(signed_documents / total_documents * 100) if total_documents else 0
        expiring_soon = MemberDocument.objects.filter(
            expiration_date__isnull=False,
            expiration_date__lte=thirty_days,
            expiration_date__gte=today,
        ).count()
        reviewed_qs = MemberDocument.objects.filter(reviewed_at__isnull=False).annotate(
            dur=ExpressionWrapper(
                F('reviewed_at') - F('uploaded_at'),
                output_field=DurationField(),
            )
        )
        avg_dur  = reviewed_qs.aggregate(avg=Avg('dur'))['avg']
        avg_days = round(avg_dur.total_seconds() / 86400, 1) if avg_dur else None

        return Response({
            'total_members':          total_members,
            'total_documents':        total_documents,
            'pending_actions':        pending_actions,
            'signed_documents':       signed_documents,
            'signed_completion_pct':  signed_pct,
            'expiring_soon_count':    expiring_soon,
            'avg_response_time_days': avg_days,
        })


class DocumentExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="documents.csv"'
        writer = csv.writer(response)
        writer.writerow(['DOC REF', 'MEMBER', 'EMAIL', 'DEPARTMENT', 'TITLE',
                         'CATEGORY', 'STATUS', 'ASSIGNED ON', 'ASSIGNED BY',
                         'SIGNED ON', 'REVIEWED BY', 'EXPIRES ON'])
        qs = MemberDocument.objects.select_related(
            'user', 'user__org_member__department', 'reviewed_by', 'assigned_by'
        ).order_by('-uploaded_at')
        for doc in qs:
            dept = ''
            try:
                dept = doc.user.org_member.department.name if doc.user.org_member.department else ''
            except Exception:
                pass
            writer.writerow([
                f"DOC-{doc.uploaded_at.year}-{doc.id:04d}",
                doc.user.get_full_name() or doc.user.username,
                doc.user.email,
                dept,
                doc.title,
                doc.category,
                doc.status,
                doc.uploaded_at.strftime('%Y-%m-%d'),
                doc.assigned_by.get_full_name() if doc.assigned_by else '',
                doc.signed_at.strftime('%Y-%m-%d') if doc.signed_at else '',
                doc.reviewed_by.get_full_name() if doc.reviewed_by else '',
                doc.expiration_date.isoformat() if doc.expiration_date else '',
            ])
        return response


class DocumentReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            doc = MemberDocument.objects.select_related('user', 'template').get(pk=pk)
        except MemberDocument.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        from django.utils import timezone
        action = request.data.get('action')
        if action == 'approve':
            doc.status      = 'approved'
            doc.reviewed_by = request.user
            doc.reviewed_at = timezone.now()
            doc.reviewer_note = request.data.get('note', '')
            doc.save()
            _notify(doc.user, 'document_approved',
                    title='Document approved',
                    body=f'Your document "{doc.title}" has been approved.',
                    link='/org/documents')
        elif action == 'reject':
            doc.status      = 'rejected'
            doc.reviewed_by = request.user
            doc.reviewed_at = timezone.now()
            doc.reviewer_note = request.data.get('note', '')
            doc.save()
            _notify(doc.user, 'document_rejected',
                    title='Document rejected',
                    body=f'Your document "{doc.title}" requires revision.',
                    link='/org/documents')
        else:
            return Response({'detail': 'action must be approve or reject.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(MemberDocumentSerializer(doc, context={'request': request}).data)


class MyDocumentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = MemberDocument.objects.filter(user=request.user).select_related('template', 'reviewed_by')
        return Response(MemberDocumentSerializer(qs, many=True, context={'request': request}).data)


class MyDocumentUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser]

    def post(self, request, pk):
        try:
            doc = MemberDocument.objects.get(pk=pk, user=request.user)
        except MemberDocument.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if 'file' not in request.FILES:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        doc.file   = request.FILES['file']
        doc.status = 'pending_review'
        doc.save()
        member_name = request.user.get_full_name() or request.user.username
        _notify_admins(
            'document_uploaded',
            f'{member_name} uploaded a document: {doc.title}',
            link='/org/documents',
        )
        return Response(MemberDocumentSerializer(doc, context={'request': request}).data)


class MyDocumentSignView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            doc = MemberDocument.objects.select_related('template').get(pk=pk, user=request.user)
        except MemberDocument.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if doc.status == 'signed' and not (doc.template and doc.template.allow_resign):
            return Response({'detail': 'Already signed.'}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils import timezone
        doc.signed_at = timezone.now()
        if doc.template and doc.template.requires_signature:
            doc.status     = 'signed'
            doc.consent_ip = request.META.get('REMOTE_ADDR')
            doc.save()
            _notify(request.user, 'document_signed',
                    title=f'You signed: {doc.title}',
                    body=f'Your consent for "{doc.title}" has been recorded.',
                    link='/org/documents')
            member_name = request.user.get_full_name() or request.user.username
            _notify_admins('document_signed',
                           f'{member_name} signed: {doc.title}',
                           link='/org/documents')
        else:
            doc.save()
        return Response(MemberDocumentSerializer(doc, context={'request': request}).data)


class DocumentRemindView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            doc = MemberDocument.objects.select_related('user').get(pk=pk)
        except MemberDocument.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        _notify(doc.user, 'document_reminder',
                title=f'Reminder: {doc.title}',
                body=f'You have a pending document to sign: "{doc.title}".',
                link='/org/documents')
        return Response({'sent': True})


class DocumentDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            doc = MemberDocument.objects.get(pk=pk)
        except MemberDocument.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────── Training Courses ─────────────────────────────────

class CourseListView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        qs = (TrainingCourse.objects
              .select_related('department', 'created_by')
              .prefetch_related('modules__lessons', 'enrollments')
              .all())
        return Response(TrainingCourseSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = TrainingCourseSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CourseDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def _get_obj(self, pk):
        try:
            return (TrainingCourse.objects
                    .select_related('department', 'created_by')
                    .prefetch_related('modules__lessons', 'enrollments')
                    .get(pk=pk))
        except TrainingCourse.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get_obj(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(TrainingCourseSerializer(obj, context={'request': request}).data)

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get_obj(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TrainingCourseSerializer(obj, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get_obj(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CourseModuleListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            course = TrainingCourse.objects.get(pk=pk)
        except TrainingCourse.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        modules = course.modules.prefetch_related('lessons').all()
        return Response(TrainingModuleSerializer(modules, many=True, context={'request': request}).data)

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            course = TrainingCourse.objects.get(pk=pk)
        except TrainingCourse.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TrainingModuleSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            order = serializer.validated_data.get('order', course.modules.count())
            serializer.save(course=course, order=order)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CourseModuleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_obj(self, pk):
        try:
            return TrainingModule.objects.prefetch_related('lessons').get(pk=pk)
        except TrainingModule.DoesNotExist:
            return None

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get_obj(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TrainingModuleSerializer(obj, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get_obj(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ModuleLessonListView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk):
        try:
            module = TrainingModule.objects.get(pk=pk)
        except TrainingModule.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(TrainingLessonSerializer(module.lessons.all(), many=True, context={'request': request}).data)

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            module = TrainingModule.objects.get(pk=pk)
        except TrainingModule.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TrainingLessonSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            order = serializer.validated_data.get('order', module.lessons.count())
            serializer.save(module=module, order=order)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ModuleLessonDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def _get_obj(self, pk):
        try:
            return TrainingLesson.objects.get(pk=pk)
        except TrainingLesson.DoesNotExist:
            return None

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get_obj(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TrainingLessonSerializer(obj, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get_obj(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DuplicateLessonView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            lesson = TrainingLesson.objects.get(pk=pk)
        except TrainingLesson.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        new_lesson = TrainingLesson.objects.create(
            module=lesson.module,
            title=f"{lesson.title} (Copy)",
            lesson_type=lesson.lesson_type,
            content_url=lesson.content_url,
            duration_minutes=lesson.duration_minutes,
            order=lesson.module.lessons.count(),
            content_data=lesson.content_data,
            is_published=False,
            updated_by=request.user,
        )
        return Response(
            TrainingLessonSerializer(new_lesson, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class ReorderLessonsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            module = TrainingModule.objects.get(pk=pk)
        except TrainingModule.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        ordered_ids = request.data.get('ordered_ids', [])
        if not isinstance(ordered_ids, list):
            return Response({'detail': 'ordered_ids must be a list.'}, status=status.HTTP_400_BAD_REQUEST)
        for i, lesson_id in enumerate(ordered_ids):
            TrainingLesson.objects.filter(pk=lesson_id, module=module).update(order=i)
        return Response({'detail': 'Reordered.'})


class LessonFileUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            lesson = TrainingLesson.objects.get(pk=pk)
        except TrainingLesson.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        f = request.FILES.get('file')
        if not f:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        lesson.content_file.save(f.name, f, save=True)
        return Response({'content_file_url': lesson.content_file.url})

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            lesson = TrainingLesson.objects.get(pk=pk)
        except TrainingLesson.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if lesson.content_file:
            lesson.content_file.delete(save=True)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CourseEnrollView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            course = TrainingCourse.objects.get(pk=pk)
        except TrainingCourse.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        user_ids = request.data.get('user_ids', [])
        dept_id  = request.data.get('department_id')
        enrolled = 0

        def _enroll(user):
            nonlocal enrolled
            _, created = TrainingEnrollment.objects.get_or_create(
                user=user, course=course,
                defaults={'enrolled_by': request.user},
            )
            if created:
                enrolled += 1
                _notify(user, 'training_assigned',
                        title=f'New training: {course.title}',
                        body='You have been enrolled in a new training course.',
                        link='/org/training')

        if dept_id:
            for member in OrgMember.objects.filter(department_id=dept_id, status='active').select_related('user'):
                _enroll(member.user)

        for uid in user_ids:
            try:
                _enroll(User.objects.get(pk=uid))
            except User.DoesNotExist:
                pass

        return Response({'enrolled': enrolled})


class CourseEnrollmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        enrollments = (TrainingEnrollment.objects
                       .filter(course_id=pk)
                       .select_related('user', 'course', 'user__org_member__department')
                       .prefetch_related(
                           'lesson_progress', 'lesson_submissions',
                           'course__modules__lessons',
                       )
                       .order_by('-enrolled_at'))
        ser = TrainingEnrollmentSerializer(enrollments, many=True, context={'request': request})
        return Response(ser.data)


class CourseUnenrollView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, user_pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        deleted, _ = TrainingEnrollment.objects.filter(course_id=pk, user_id=user_pk).delete()
        if not deleted:
            return Response({'detail': 'Enrollment not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────── My Training ──────────────────────────────────────

class MyTrainingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (TrainingEnrollment.objects
              .filter(user=request.user)
              .select_related('course__department', 'course__created_by')
              .prefetch_related('course__modules__lessons', 'lesson_progress'))
        return Response(TrainingEnrollmentSerializer(qs, many=True, context={'request': request}).data)


class LessonCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, enrollment_pk, lesson_pk):
        try:
            enrollment = (TrainingEnrollment.objects
                          .select_related('course')
                          .prefetch_related('course__modules__lessons', 'lesson_progress')
                          .get(pk=enrollment_pk, user=request.user))
        except TrainingEnrollment.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            lesson = TrainingLesson.objects.get(pk=lesson_pk)
        except TrainingLesson.DoesNotExist:
            return Response({'detail': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

        from django.utils import timezone
        progress, _ = LessonProgress.objects.get_or_create(
            enrollment=enrollment, lesson=lesson,
            defaults={'completed': True, 'completed_at': timezone.now()},
        )
        if not progress.completed:
            progress.completed    = True
            progress.completed_at = timezone.now()
            progress.save()

        if enrollment.status == 'enrolled':
            enrollment.status = 'in_progress'
            enrollment.save(update_fields=['status'])

        total = sum(m.lessons.count() for m in enrollment.course.modules.all())
        done  = LessonProgress.objects.filter(enrollment=enrollment, completed=True).count()
        if total > 0 and done >= total:
            enrollment.status             = 'completed'
            enrollment.completion_date    = timezone.now().date()
            enrollment.certificate_issued = True
            enrollment.save(update_fields=['status', 'completion_date', 'certificate_issued'])

        fresh = (TrainingEnrollment.objects
                 .select_related('course__department', 'course__created_by')
                 .prefetch_related('course__modules__lessons', 'lesson_progress')
                 .get(pk=enrollment_pk))
        return Response(TrainingEnrollmentSerializer(fresh, context={'request': request}).data)

    def delete(self, request, enrollment_pk, lesson_pk):
        try:
            enrollment = TrainingEnrollment.objects.get(pk=enrollment_pk, user=request.user)
        except TrainingEnrollment.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        LessonProgress.objects.filter(enrollment=enrollment, lesson_id=lesson_pk).update(
            completed=False, completed_at=None
        )

        # Revert completed enrollment status back to in_progress
        if enrollment.status == 'completed':
            enrollment.status          = 'in_progress'
            enrollment.completion_date = None
            enrollment.certificate_issued = False
            enrollment.save(update_fields=['status', 'completion_date', 'certificate_issued'])

        fresh = (TrainingEnrollment.objects
                 .select_related('course__department', 'course__created_by')
                 .prefetch_related('course__modules__lessons', 'lesson_progress')
                 .get(pk=enrollment_pk))
        return Response(TrainingEnrollmentSerializer(fresh, context={'request': request}).data)



class QuizQuestionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, lesson_id):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        qs = QuizQuestion.objects.filter(lesson_id=lesson_id).prefetch_related('options')
        return Response(QuizQuestionSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request, lesson_id):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            lesson = TrainingLesson.objects.get(pk=lesson_id)
        except TrainingLesson.DoesNotExist:
            return Response({'detail': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

        from django.db import transaction
        with transaction.atomic():
            q = QuizQuestion.objects.create(
                lesson=lesson,
                text=request.data.get('text', ''),
                question_type=request.data.get('question_type', 'multiple_choice'),
                points=request.data.get('points', 1),
                order=request.data.get('order', 0),
            )
            for opt in request.data.get('options', []):
                QuizOption.objects.create(
                    question=q,
                    text=opt.get('text', ''),
                    is_correct=opt.get('is_correct', False),
                    order=opt.get('order', 0),
                )
        q.refresh_from_db()
        qs = QuizQuestion.objects.prefetch_related('options').get(pk=q.pk)
        return Response(QuizQuestionSerializer(qs, context={'request': request}).data,
                        status=status.HTTP_201_CREATED)


class QuizQuestionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_question(self, pk):
        try:
            return QuizQuestion.objects.prefetch_related('options').get(pk=pk)
        except QuizQuestion.DoesNotExist:
            return None

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        q = self._get_question(pk)
        if not q:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        from django.db import transaction
        with transaction.atomic():
            for field in ('text', 'question_type', 'points', 'order'):
                if field in request.data:
                    setattr(q, field, request.data[field])
            q.save()
            if 'options' in request.data:
                q.options.all().delete()
                for opt in request.data['options']:
                    QuizOption.objects.create(
                        question=q,
                        text=opt.get('text', ''),
                        is_correct=opt.get('is_correct', False),
                        order=opt.get('order', 0),
                    )
        q = QuizQuestion.objects.prefetch_related('options').get(pk=pk)
        return Response(QuizQuestionSerializer(q, context={'request': request}).data)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        q = self._get_question(pk)
        if not q:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        q.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Lesson submit (member quiz / assignment) ───────────────────────────────────

def _mark_lesson_complete(enrollment, lesson):
    from django.utils import timezone
    progress, _ = LessonProgress.objects.get_or_create(
        enrollment=enrollment, lesson=lesson,
        defaults={'completed': True, 'completed_at': timezone.now()},
    )
    if not progress.completed:
        progress.completed    = True
        progress.completed_at = timezone.now()
        progress.save()
    if enrollment.status == 'enrolled':
        enrollment.status = 'in_progress'
        enrollment.save(update_fields=['status'])
    total = sum(m.lessons.count() for m in enrollment.course.modules.all())
    done  = LessonProgress.objects.filter(enrollment=enrollment, completed=True).count()
    if total > 0 and done >= total:
        enrollment.status             = 'completed'
        enrollment.completion_date    = timezone.now().date()
        enrollment.certificate_issued = True
        enrollment.save(update_fields=['status', 'completion_date', 'certificate_issued'])


class LessonSubmitView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, enrollment_id, lesson_id):
        try:
            enrollment = (TrainingEnrollment.objects
                          .select_related('course')
                          .prefetch_related('course__modules__lessons', 'lesson_progress')
                          .get(pk=enrollment_id, user=request.user))
        except TrainingEnrollment.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            lesson = TrainingLesson.objects.get(pk=lesson_id)
        except TrainingLesson.DoesNotExist:
            return Response({'detail': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Validate lesson belongs to this enrollment's course
        course_lesson_ids = [
            l.id for m in enrollment.course.modules.all() for l in m.lessons.all()
        ]
        if lesson.id not in course_lesson_ids:
            return Response({'detail': 'Lesson does not belong to this course.'},
                            status=status.HTTP_400_BAD_REQUEST)

        answers = request.data.get('answers', {})
        if isinstance(answers, str):
            import json
            try:
                answers = json.loads(answers)
            except Exception:
                answers = {}

        score  = None
        passed = None
        feedback = {}

        if lesson.lesson_type in ('quiz', 'assessment'):
            questions = QuizQuestion.objects.prefetch_related('options').filter(lesson=lesson)
            total_points = sum(q.points for q in questions) or 1
            earned = 0
            for q in questions:
                qid     = str(q.id)
                answer  = str(answers.get(qid, ''))
                correct_opt = q.options.filter(is_correct=True).first()
                correct_id  = str(correct_opt.id) if correct_opt else None
                if q.question_type in ('multiple_choice', 'true_false'):
                    pts = q.points if answer == correct_id else 0
                else:
                    pts = 0  # short answer: manual review, no auto-points
                earned += pts
                feedback[qid] = {'correct_option_id': correct_id, 'earned': pts}
            score  = round(earned / total_points * 100)
            passed = score >= enrollment.course.pass_score
            submission, _ = LessonSubmission.objects.update_or_create(
                enrollment=enrollment, lesson=lesson,
                defaults={'answers': answers, 'score': score, 'passed': passed},
            )
            if passed:
                _mark_lesson_complete(enrollment, lesson)

        elif lesson.lesson_type == 'assignment':
            submission, _ = LessonSubmission.objects.update_or_create(
                enrollment=enrollment, lesson=lesson,
                defaults={
                    'answers': answers,
                    'score': None,
                    'passed': True,
                    'file': request.FILES.get('file', None),
                },
            )
            _mark_lesson_complete(enrollment, lesson)

        else:
            return Response({'detail': 'This lesson type does not support submissions.'},
                            status=status.HTTP_400_BAD_REQUEST)

        fresh = (TrainingEnrollment.objects
                 .select_related('course__department', 'course__created_by')
                 .prefetch_related(
                     'course__modules__lessons__quiz_questions__options',
                     'lesson_progress', 'lesson_submissions',
                 )
                 .get(pk=enrollment_id))
        return Response({
            'enrollment': TrainingEnrollmentSerializer(fresh, context={'request': request}).data,
            'feedback':   feedback,
        }, status=status.HTTP_200_OK)


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 5 — Events, Contributions, Check-ins
# ═══════════════════════════════════════════════════════════════════════════════

# ── Events ────────────────────────────────────────────────────────────────────

class EventListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Event.objects.select_related('organizer').prefetch_related('assigned_members').order_by('start_dt')
        if request.query_params.get('type'):
            qs = qs.filter(event_type=request.query_params['type'])
        if request.query_params.get('upcoming') == 'true':
            from django.utils import timezone
            qs = qs.filter(start_dt__gte=timezone.now())
        if not can_manage(request.user):
            from django.db.models import Count, Q
            qs = qs.annotate(_assign_count=Count('assigned_members')).filter(
                Q(_assign_count=0) | Q(assigned_members=request.user)
            ).distinct()
        return Response(EventSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = EventSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(organizer=request.user, created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class EventDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        try:
            return Event.objects.select_related('organizer').prefetch_related('attendance__user', 'assigned_members').get(pk=pk)
        except Event.DoesNotExist:
            return None

    def get(self, request, pk):
        event = self._get(pk)
        if not event:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        data = EventSerializer(event, context={'request': request}).data
        data['attendances'] = EventAttendanceSerializer(
            event.attendance.select_related('user').all(), many=True, context={'request': request}
        ).data
        return Response(data)

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        event = self._get(pk)
        if not event:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = EventSerializer(event, data=request.data, partial=True, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        event = self._get(pk)
        if not event:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        event.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventRSVPView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            event = Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        rsvp_value = request.data.get('rsvp', 'accepted')
        attendance, _ = EventAttendance.objects.get_or_create(
            event=event, user=request.user,
            defaults={'rsvp': rsvp_value},
        )
        attendance.rsvp = rsvp_value
        attendance.save(update_fields=['rsvp'])
        if rsvp_value == 'accepted':
            _notify(
                request.user,
                'event_scheduled',
                title=f'You\'re attending: {event.title}',
                body=f'Scheduled for {event.start_dt.strftime("%b %d")}.',
                link='/org/events',
            )
        return Response(EventAttendanceSerializer(attendance, context={'request': request}).data)


class EventAttendanceAdminView(APIView):
    """Admin marks whether an attendee actually attended the event."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, user_pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            attendance = EventAttendance.objects.select_related('user').get(event_id=pk, user_id=user_pk)
        except EventAttendance.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        attended = request.data.get('attended')
        if attended is None:
            return Response({'detail': 'attended field required.'}, status=status.HTTP_400_BAD_REQUEST)
        attendance.attended = attended
        attendance.save(update_fields=['attended'])
        return Response(EventAttendanceSerializer(attendance, context={'request': request}).data)


# ── Event Type Config ────────────────────────────────────────────────────────

class EventTypeConfigListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        configs = EventTypeConfig.objects.all()
        return Response(EventTypeConfigSerializer(configs, many=True).data)

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        from django.utils.text import slugify
        data = request.data.copy()
        if 'slug' in data:
            data['slug'] = slugify(data['slug'])
        ser = EventTypeConfigSerializer(data=data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response(ser.data, status=status.HTTP_201_CREATED)


class EventTypeConfigDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        try:
            return EventTypeConfig.objects.get(pk=pk)
        except EventTypeConfig.DoesNotExist:
            return None

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        data = {k: v for k, v in request.data.items() if k != 'slug'}
        ser = EventTypeConfigSerializer(obj, data=data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if obj.is_default:
            return Response({'detail': 'Cannot delete a default event type.'}, status=status.HTTP_400_BAD_REQUEST)
        if Event.objects.filter(event_type=obj.slug).exists():
            return Response({'detail': 'Cannot delete a type that is used by existing events.'}, status=status.HTTP_400_BAD_REQUEST)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        obj, _ = EventSettings.objects.get_or_create(pk=1)
        return Response(EventSettingsSerializer(obj).data)

    def patch(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        obj, _ = EventSettings.objects.get_or_create(pk=1)
        ser = EventSettingsSerializer(obj, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response(ser.data)


# ── Contributions ─────────────────────────────────────────────────────────────

class ContributionListView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _can_view_all(self, user):
        if is_superadmin(user):
            return True
        if hasattr(user, 'org_member') and user.org_member.role.can_view_all_contributions:
            return True
        return False

    def get(self, request):
        if self._can_view_all(request.user):
            qs = Contribution.objects.select_related('member__user', 'approved_by').order_by('-created_at')
            if request.query_params.get('status'):
                qs = qs.filter(status=request.query_params['status'])
            member_id = request.query_params.get('member_id')
            if member_id:
                qs = qs.filter(member_id=member_id)
        else:
            if not hasattr(request.user, 'org_member'):
                return Response([])
            qs = Contribution.objects.select_related('member__user', 'approved_by').filter(
                member=request.user.org_member
            ).order_by('-created_at')
        return Response(ContributionSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        if not hasattr(request.user, 'org_member'):
            return Response({'detail': 'No org member profile found.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ContributionSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        contrib = serializer.save(member=request.user.org_member, status='pending')
        member_name = request.user.get_full_name() or request.user.username
        _notify_admins(
            'contribution_submitted',
            f'{member_name} logged: {contrib.title}',
            link='/org/contributions',
            permission='contributions',
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ContributionSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum
        from datetime import timedelta
        zeros = {
            'total_hours': 0, 'total_contributions': 0, 'pending': 0, 'approved': 0,
            'month_hours': 0, 'month_contributions': 0, 'week_hours': 0,
            'week_contributions': 0, 'approved_hours_month': 0, 'approved_pct': 0, 'streak': 0,
        }
        if not hasattr(request.user, 'org_member'):
            return Response(zeros)
        qs    = Contribution.objects.filter(member=request.user.org_member)
        today = timezone.now().date()
        month_start = today.replace(day=1)
        week_start  = today - timedelta(days=today.weekday())

        month_qs = qs.filter(date__gte=month_start)
        week_qs  = qs.filter(date__gte=week_start)

        total_hours    = qs.filter(contribution_type='hours', status='approved').aggregate(s=Sum('hours'))['s'] or 0
        month_hours    = month_qs.filter(contribution_type='hours').aggregate(s=Sum('hours'))['s'] or 0
        week_hours     = week_qs.filter(contribution_type='hours').aggregate(s=Sum('hours'))['s'] or 0
        approved_hours = month_qs.filter(contribution_type='hours', status='approved').aggregate(s=Sum('hours'))['s'] or 0
        approved_pct   = int(approved_hours / month_hours * 100) if month_hours else 0

        streak, d = 0, today
        while qs.filter(date=d).exists():
            streak += 1
            d -= timedelta(days=1)

        return Response({
            'total_hours':          float(total_hours),
            'total_contributions':  qs.count(),
            'pending':              qs.filter(status='pending').count(),
            'approved':             qs.filter(status='approved').count(),
            'month_hours':          float(month_hours),
            'month_contributions':  month_qs.count(),
            'week_hours':           float(week_hours),
            'week_contributions':   week_qs.count(),
            'approved_hours_month': float(approved_hours),
            'approved_pct':         approved_pct,
            'streak':               streak,
        })


class ContributionInsightsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum
        from datetime import timedelta
        if not hasattr(request.user, 'org_member'):
            return Response({'by_category': [], 'daily_trend': []})
        qs = Contribution.objects.filter(member=request.user.org_member)

        CATS = [
            ('project_work', 'Project Work'),
            ('meetings',     'Meetings'),
            ('learning',     'Learning'),
            ('other',        'Other'),
        ]
        by_cat = []
        for key, label in CATS:
            cat_qs = qs.filter(category=key)
            hrs = cat_qs.filter(contribution_type='hours').aggregate(s=Sum('hours'))['s'] or 0
            by_cat.append({'category': key, 'label': label,
                           'hours': float(hrs), 'count': cat_qs.count()})

        today = timezone.now().date()
        start = today - timedelta(days=29)
        daily = {(start + timedelta(days=i)).isoformat(): 0.0 for i in range(30)}
        for c in qs.filter(date__gte=start, contribution_type='hours').only('date', 'hours'):
            k = c.date.isoformat()
            if k in daily:
                daily[k] = round(daily[k] + float(c.hours or 0), 2)
        trend = [{'date': d, 'hours': h} for d, h in sorted(daily.items())]

        return Response({'by_category': by_cat, 'daily_trend': trend})


class ContributionMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        from django.db.models import Sum

        members = OrgMember.objects.filter(
            contributions__isnull=False
        ).distinct().select_related('user', 'role', 'department')

        result = []
        for member in members:
            qs              = Contribution.objects.filter(member=member)
            total           = qs.count()
            pending_count   = qs.filter(status='pending').count()
            approved_count  = qs.filter(status='approved').count()
            total_hours_sub = qs.filter(contribution_type='hours').aggregate(s=Sum('hours'))['s'] or 0
            pending_hours   = qs.filter(contribution_type='hours', status='pending').aggregate(s=Sum('hours'))['s'] or 0
            approved_hours  = qs.filter(contribution_type='hours', status='approved').aggregate(s=Sum('hours'))['s'] or 0
            last            = qs.order_by('-date').values('date').first()
            status_label    = ('pending_review' if pending_count > 0
                               else ('approved' if approved_count > 0 else 'no_activity'))
            result.append({
                'member_id':       member.id,
                'member_name':     member.user.get_full_name() or member.user.username,
                'member_picture':  _get_user_pic(member.user),
                'email':           member.user.email,
                'role_name':       member.role.name if member.role else '',
                'department_name': member.department.name if member.department else '',
                'total':           total,
                'pending':         pending_count,
                'approved':        approved_count,
                'total_hours':     float(total_hours_sub),
                'pending_hours':   float(pending_hours),
                'approved_hours':  float(approved_hours),
                'last_activity':   last['date'].isoformat() if last else None,
                'status':          status_label,
            })

        result.sort(key=lambda x: x['last_activity'] or '', reverse=True)
        result.sort(key=lambda x: x['pending'], reverse=True)
        return Response(result)


class ContributionBulkReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        ids    = request.data.get('ids', [])
        action = request.data.get('action')
        if action not in ('approve', 'reject'):
            return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)
        qs = Contribution.objects.filter(pk__in=ids, status='pending').select_related('member__user')
        updated = []
        for obj in qs:
            obj.status      = 'approved' if action == 'approve' else 'rejected'
            obj.approved_by = request.user
            obj.save(update_fields=['status', 'approved_by'])
            updated.append(obj.id)
            if obj.status == 'approved':
                _notify(
                    obj.member.user,
                    'contribution_approved',
                    title='Contribution Approved',
                    body=f'Your contribution "{obj.title}" has been approved.',
                    link='/org/contributions',
                )
        return Response({'updated': updated, 'count': len(updated)})


class ContributionAdminSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        from django.db.models import Sum

        today       = timezone.now().date()
        yesterday   = today - timedelta(days=1)
        week_start  = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)
        prev_month_end   = month_start - timedelta(days=1)
        prev_month_start = prev_month_end.replace(day=1)

        all_qs = Contribution.objects.all()

        pending_review  = all_qs.filter(status='pending').count()
        pending_delta   = all_qs.filter(status='pending', created_at__date=yesterday).count()

        active_now  = OrgMember.objects.filter(contributions__isnull=False).distinct().count()
        prev_week   = week_start - timedelta(days=7)
        active_prev = OrgMember.objects.filter(
            contributions__date__gte=prev_week, contributions__date__lt=week_start
        ).distinct().count()
        active_delta = max(active_now - active_prev, 0)

        total_hours = all_qs.filter(contribution_type='hours', status='approved').aggregate(s=Sum('hours'))['s'] or 0
        week_hours  = all_qs.filter(contribution_type='hours', status='approved', date__gte=week_start).aggregate(s=Sum('hours'))['s'] or 0

        month_total    = all_qs.filter(date__gte=month_start, contribution_type='hours').aggregate(s=Sum('hours'))['s'] or 0
        month_approved = all_qs.filter(date__gte=month_start, status='approved', contribution_type='hours').aggregate(s=Sum('hours'))['s'] or 0
        approval_rate  = int(float(month_approved) / float(month_total) * 100) if month_total else 0

        prev_total    = all_qs.filter(date__gte=prev_month_start, date__lt=month_start, contribution_type='hours').aggregate(s=Sum('hours'))['s'] or 0
        prev_approved = all_qs.filter(date__gte=prev_month_start, date__lt=month_start, status='approved', contribution_type='hours').aggregate(s=Sum('hours'))['s'] or 0
        prev_rate     = int(float(prev_approved) / float(prev_total) * 100) if prev_total else 0
        rate_delta    = approval_rate - prev_rate

        now    = timezone.now()
        recent = all_qs.select_related('member__user').order_by('-created_at')[:10]

        def _time_ago(dt):
            diff = now - dt
            total_secs = int(diff.total_seconds())
            if total_secs < 3600:
                return f'{max(total_secs // 60, 1)} min ago'
            if diff.days == 0:
                return f'{total_secs // 3600} hr ago'
            if diff.days == 1:
                return 'Yesterday'
            return f'{diff.days} days ago'

        activity = [{
            'member_name':    c.member.user.get_full_name() or c.member.user.username,
            'member_picture': _get_user_pic(c.member.user),
            'title':          c.title,
            'hours':          float(c.hours) if c.hours else None,
            'action':         'submitted',
            'time_ago':       _time_ago(c.created_at),
        } for c in recent]

        return Response({
            'pending_review':       pending_review,
            'pending_delta':        pending_delta,
            'active_contributors':  active_now,
            'active_delta':         active_delta,
            'total_hours':          float(total_hours),
            'hours_delta':          float(week_hours),
            'approval_rate':        approval_rate,
            'approval_rate_delta':  rate_delta,
            'recent_activity':      activity,
        })


class ContributionOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        from django.db.models import Sum

        period = request.query_params.get('period', 'month')
        today  = timezone.now().date()
        if period == 'week':
            start = today - timedelta(days=6)
            days  = 7
        elif period == 'year':
            start = today.replace(month=1, day=1)
            days  = (today - start).days + 1
        else:
            start = today.replace(day=1)
            days  = (today - start).days + 1

        all_qs = Contribution.objects.filter(date__gte=start, contribution_type='hours')

        daily_submitted = {(start + timedelta(days=i)).isoformat(): 0.0 for i in range(days)}
        daily_approved  = {(start + timedelta(days=i)).isoformat(): 0.0 for i in range(days)}

        for c in all_qs.only('date', 'hours', 'status'):
            k = c.date.isoformat()
            if k in daily_submitted:
                daily_submitted[k] = round(daily_submitted[k] + float(c.hours or 0), 2)
                if c.status == 'approved':
                    daily_approved[k] = round(daily_approved[k] + float(c.hours or 0), 2)

        daily = [{'date': d, 'submitted': daily_submitted[d], 'approved': daily_approved[d]}
                 for d in sorted(daily_submitted.keys())]

        total_submitted = all_qs.aggregate(s=Sum('hours'))['s'] or 0
        total_approved  = all_qs.filter(status='approved').aggregate(s=Sum('hours'))['s'] or 0
        pending_hrs     = all_qs.filter(status='pending').aggregate(s=Sum('hours'))['s'] or 0
        member_count    = OrgMember.objects.filter(contributions__isnull=False).distinct().count()
        avg_per_member  = round(float(total_approved) / member_count, 1) if member_count else 0.0

        return Response({
            'daily':           daily,
            'total_submitted': float(total_submitted),
            'total_approved':  float(total_approved),
            'pending_hours':   float(pending_hrs),
            'avg_per_member':  avg_per_member,
        })


class ContributionByDepartmentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        period = request.query_params.get('period', 'month')
        qs = Contribution.objects.filter(
            status='approved', contribution_type='hours'
        ).select_related('member__department')
        if period == 'month':
            today = timezone.now().date()
            qs = qs.filter(date__gte=today.replace(day=1))

        dept_totals: dict = {}
        for c in qs.only('hours', 'member_id'):
            dept = c.member.department.name if (c.member.department) else 'Other'
            dept_totals[dept] = round(dept_totals.get(dept, 0.0) + float(c.hours or 0), 2)

        grand_total = sum(dept_totals.values()) or 1
        result = sorted([
            {'department': dept, 'hours': hrs, 'pct': round(hrs / grand_total * 100)}
            for dept, hrs in dept_totals.items()
        ], key=lambda x: x['hours'], reverse=True)

        return Response(result)


class ContributionExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="contributions.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Member', 'Email', 'Department', 'Role', 'Date', 'Title',
            'Type', 'Category', 'Hours', 'Status', 'Approved By', 'Created At',
        ])

        qs = Contribution.objects.select_related(
            'member__user', 'member__department', 'member__role', 'approved_by'
        ).order_by('-date')

        for c in qs:
            writer.writerow([
                c.id,
                c.member.user.get_full_name() or c.member.user.username,
                c.member.user.email,
                c.member.department.name if c.member.department else '',
                c.member.role.name if c.member.role else '',
                c.date.isoformat(),
                c.title,
                c.contribution_type,
                c.category,
                float(c.hours) if c.hours else '',
                c.status,
                c.approved_by.get_full_name() if c.approved_by else '',
                c.created_at.isoformat(),
            ])

        return response


class ContributionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, pk, user):
        try:
            obj = Contribution.objects.select_related('member__user', 'approved_by').get(pk=pk)
        except Contribution.DoesNotExist:
            return None
        if not can_manage(user) and obj.member != getattr(user, 'org_member', None):
            return None
        return obj

    def get(self, request, pk):
        obj = self._get(pk, request.user)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ContributionSerializer(obj, context={'request': request}).data)


class ContributionReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            obj = Contribution.objects.select_related('member__user').get(pk=pk)
        except Contribution.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        action = request.data.get('action')
        if action not in ('approve', 'reject', 'reset'):
            return Response({'detail': 'action must be approve, reject, or reset.'}, status=status.HTTP_400_BAD_REQUEST)
        if action == 'reset':
            obj.status      = 'pending'
            obj.approved_by = None
            obj.save(update_fields=['status', 'approved_by'])
            return Response(ContributionSerializer(obj, context={'request': request}).data)
        obj.status      = 'approved' if action == 'approve' else 'rejected'
        obj.approved_by = request.user
        obj.save(update_fields=['status', 'approved_by'])
        if obj.status == 'approved':
            _notify(
                obj.member.user,
                'contribution_approved',
                title='Contribution Approved',
                body=f'Your contribution "{obj.title}" has been approved.',
                link='/org/contributions',
            )
        return Response(ContributionSerializer(obj, context={'request': request}).data)


# ── Check-ins ─────────────────────────────────────────────────────────────────

class CheckInListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if can_manage(request.user):
            qs = CheckIn.objects.select_related('member__user', 'reviewed_by').order_by('-submitted_at')
            if request.query_params.get('period_type'):
                qs = qs.filter(period_type=request.query_params['period_type'])
            reviewed = request.query_params.get('reviewed')
            if reviewed == 'true':
                qs = qs.exclude(reviewed_at=None)
            elif reviewed == 'false':
                qs = qs.filter(reviewed_at=None)
            member_id = request.query_params.get('member_id')
            if member_id:
                qs = qs.filter(member_id=member_id)
        else:
            if not hasattr(request.user, 'org_member'):
                return Response([])
            qs = CheckIn.objects.select_related('member__user', 'reviewed_by').filter(
                member=request.user.org_member
            ).order_by('-submitted_at')
        return Response(CheckInSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        if not hasattr(request.user, 'org_member'):
            return Response({'detail': 'No org member profile found.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = CheckInSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        checkin = serializer.save(member=request.user.org_member)
        member_name = request.user.get_full_name() or request.user.username
        period = 'weekly' if checkin.period_type == 'weekly' else 'monthly'
        _notify_admins(
            'checkin_submitted',
            f'{member_name} submitted a {period} check-in',
            link='/org/checkins',
            permission='checkins',
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CheckInDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, pk, user):
        try:
            obj = CheckIn.objects.select_related('member__user', 'reviewed_by').get(pk=pk)
        except CheckIn.DoesNotExist:
            return None
        if not can_manage(user) and obj.member != getattr(user, 'org_member', None):
            return None
        return obj

    def get(self, request, pk):
        obj = self._get(pk, request.user)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CheckInSerializer(obj, context={'request': request}).data)


class CheckInReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            obj = CheckIn.objects.select_related('member__user').get(pk=pk)
        except CheckIn.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        from django.utils import timezone
        obj.reviewed_by  = request.user
        obj.reviewed_at  = timezone.now()
        obj.save(update_fields=['reviewed_by', 'reviewed_at'])
        return Response(CheckInSerializer(obj, context={'request': request}).data)


# ── Phase 6: Dashboard ────────────────────────────────────────────────────────

class AdminDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.utils import timezone
        from django.db.models import Sum

        now = timezone.now()

        if can_manage(request.user):
            members_qs = OrgMember.objects.all()
            onboarding_qs = OnboardingInstance.objects.all()
            upcoming_qs = Event.objects.filter(start_dt__gte=now)
            upcoming = upcoming_qs.order_by('start_dt')[:3]
            data = {
                'members': {
                    'total':    members_qs.count(),
                    'active':   members_qs.filter(status='active').count(),
                    'inactive': members_qs.filter(status__in=['inactive', 'suspended']).count(),
                },
                'onboarding': {
                    'total':    onboarding_qs.count(),
                    'pending':  onboarding_qs.filter(status='pending').count(),
                    'active':   onboarding_qs.filter(status='active').count(),
                    'paused':   onboarding_qs.filter(status='paused').count(),
                    'completed': onboarding_qs.filter(status='completed').count(),
                    'archived': onboarding_qs.filter(status='archived').count(),
                },
                'pending_contributions': Contribution.objects.filter(status='pending').count(),
                'pending_documents':     MemberDocument.objects.filter(
                    status__in=['uploaded', 'pending_review']
                ).count(),
                'pending_checkins':      CheckIn.objects.filter(reviewed_at__isnull=True).count(),
                'upcoming_events_count': upcoming_qs.count(),
                'upcoming_events':       EventSerializer(
                    upcoming, many=True, context={'request': request}
                ).data,
            }
        else:
            member = getattr(request.user, 'org_member', None)
            onboarding_instance = None
            if member:
                onboarding_instance = OnboardingInstance.objects.prefetch_related(
                    'tasks'
                ).select_related('template').filter(
                    user=request.user, status__in=['pending', 'active', 'paused']
                ).order_by('-created_at').first()

            contribs = Contribution.objects.filter(member=member) if member else Contribution.objects.none()
            hours_agg = contribs.filter(status='approved').aggregate(h=Sum('hours'))['h'] or 0

            pending_docs = MemberDocument.objects.filter(
                user=request.user, status__in=['assigned', 'rejected']
            ).order_by('-uploaded_at')[:5]

            upcoming = Event.objects.filter(start_dt__gte=now).order_by('start_dt')[:3]

            data = {
                'onboarding': OnboardingInstanceSerializer(
                    onboarding_instance, context={'request': request}
                ).data if onboarding_instance else None,
                'contributions': {
                    'total_hours':         float(hours_agg),
                    'total_contributions': contribs.count(),
                    'pending':             contribs.filter(status='pending').count(),
                    'approved':            contribs.filter(status='approved').count(),
                },
                'upcoming_events':   EventSerializer(
                    upcoming, many=True, context={'request': request}
                ).data,
                'pending_documents': MemberDocumentSerializer(
                    pending_docs, many=True, context={'request': request}
                ).data,
            }

        return Response(data)


# ── Phase 6: Resources ────────────────────────────────────────────────────────

class ResourceListView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        if can_manage(request.user):
            qs = Resource.objects.select_related('created_by').all()
        else:
            qs = Resource.objects.select_related('created_by').filter(is_published=True)
        return Response(ResourceSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = ResourceSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ResourceDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def _get(self, pk, user):
        try:
            obj = Resource.objects.select_related('created_by').get(pk=pk)
        except Resource.DoesNotExist:
            return None
        if not can_manage(user) and not obj.is_published:
            return None
        return obj

    def get(self, request, pk):
        obj = self._get(pk, request.user)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ResourceSerializer(obj, context={'request': request}).data)

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            obj = Resource.objects.get(pk=pk)
        except Resource.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ResourceSerializer(obj, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            obj = Resource.objects.get(pk=pk)
        except Resource.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Phase 6: Audit Log ────────────────────────────────────────────────────────

class AuditLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        qs = AuditLog.objects.select_related('actor').all()

        module   = request.query_params.get('module')
        action   = request.query_params.get('action')
        actor_id = request.query_params.get('actor_id')
        try:
            limit = min(int(request.query_params.get('limit', 50)), 200)
        except (ValueError, TypeError):
            limit = 50

        if module:
            qs = qs.filter(module=module)
        if action:
            qs = qs.filter(action=action)
        if actor_id:
            qs = qs.filter(actor_id=actor_id)

        qs = qs[:limit]
        return Response(AuditLogSerializer(qs, many=True, context={'request': request}).data)



# ── Phase 7: Org Settings ─────────────────────────────────────────────────────

class OrgSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        obj, _ = OrgSettings.objects.get_or_create(pk=1)
        return Response(OrgSettingsSerializer(obj, context={'request': request}).data)

    def patch(self, request):
        if not can_manage(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        obj, _ = OrgSettings.objects.get_or_create(pk=1)
        ser = OrgSettingsSerializer(obj, data=request.data, partial=True, context={'request': request})
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response(ser.data)


# ── Phase 7: Analytics ────────────────────────────────────────────────────────

class AnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum, Count, F
        from django.db.models.functions import TruncMonth
        from django.utils import timezone
        import datetime

        if not can_manage(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

        # ── Contributions ──────────────────────────────────────────────────────
        contrib_qs = Contribution.objects.all()
        total_hours = (
            contrib_qs.filter(status='approved')
            .aggregate(s=Sum('hours'))['s'] or 0
        )

        # By member — top 20
        by_member_qs = (
            OrgMember.objects
            .select_related('user')
            .annotate(
                total_hours=Sum(
                    'contributions__hours',
                    filter=Q(contributions__status='approved'),
                ),
                count=Count('contributions'),
            )
            .order_by(F('total_hours').desc(nulls_last=True))[:20]
        )
        by_member = [
            {
                'member_name': (
                    m.user.get_full_name() or m.user.username
                ),
                'total_hours': float(m.total_hours or 0),
                'count':       m.count or 0,
            }
            for m in by_member_qs
        ]

        # Monthly hours — last 6 calendar months
        now = timezone.now()
        monthly_raw = (
            contrib_qs
            .filter(status='approved', contribution_type='hours')
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(hours=Sum('hours'))
        )
        monthly_map = {
            entry['month'].strftime('%Y-%m'): float(entry['hours'] or 0)
            for entry in monthly_raw
        }
        first = now.date().replace(day=1)
        base  = first.year * 12 + (first.month - 1)
        monthly_hours = []
        for i in range(5, -1, -1):
            m           = base - i
            month_date  = datetime.date(m // 12, m % 12 + 1, 1)
            key         = month_date.strftime('%Y-%m')
            monthly_hours.append({'month': key, 'hours': monthly_map.get(key, 0.0)})

        # ── Training ───────────────────────────────────────────────────────────
        enrollment_qs   = TrainingEnrollment.objects.all()
        total_enrolled  = enrollment_qs.count()
        total_completed = enrollment_qs.filter(status='completed').count()
        completion_rate = round(total_completed / total_enrolled * 100, 1) if total_enrolled else 0.0

        by_course = []
        for course in TrainingCourse.objects.prefetch_related('enrollments').all():
            enrolled  = course.enrollments.count()
            completed = course.enrollments.filter(status='completed').count()
            by_course.append({
                'course_title': course.title,
                'enrolled':     enrolled,
                'completed':    completed,
            })

        # ── Check-ins ──────────────────────────────────────────────────────────
        checkin_qs = CheckIn.objects.all()

        # ── Documents ──────────────────────────────────────────────────────────
        doc_qs = MemberDocument.objects.all()

        data = {
            'contributions': {
                'total_hours':         float(total_hours),
                'total_contributions': contrib_qs.count(),
                'approved':            contrib_qs.filter(status='approved').count(),
                'by_member':           by_member,
                'monthly_hours':       monthly_hours,
            },
            'training': {
                'total_enrollments': total_enrolled,
                'completed':         total_completed,
                'completion_rate':   completion_rate,
                'by_course':         by_course,
            },
            'checkins': {
                'total':    checkin_qs.count(),
                'reviewed': checkin_qs.filter(reviewed_at__isnull=False).count(),
                'by_type':  {
                    'weekly':  checkin_qs.filter(period_type='weekly').count(),
                    'monthly': checkin_qs.filter(period_type='monthly').count(),
                },
            },
            'documents': {
                'total':   doc_qs.count(),
                'approved': doc_qs.filter(status='approved').count(),
                'pending':  doc_qs.filter(status__in=['uploaded', 'pending_review']).count(),
            },
        }
        return Response(data)


# ── Phase 7: Member Performance ───────────────────────────────────────────────

class MemberPerformanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum
        from django.db.models.functions import TruncMonth
        from django.utils import timezone
        import datetime

        member = getattr(request.user, 'org_member', None)

        zero = {
            'contributions': {'total_hours': 0.0, 'approved': 0, 'monthly': []},
            'training':      {'enrolled': 0, 'completed': 0, 'completion_rate': 0.0},
            'checkins':      {'total': 0, 'streak': 0},
            'onboarding':    {'progress_pct': None, 'status': None},
        }
        if not member:
            return Response(zero)

        # ── Contributions ──────────────────────────────────────────────────────
        contrib_qs  = Contribution.objects.filter(member=member)
        total_hours = (
            contrib_qs.filter(status='approved')
            .aggregate(s=Sum('hours'))['s'] or 0
        )
        now = timezone.now()
        monthly_raw = (
            contrib_qs
            .filter(status='approved', contribution_type='hours')
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(hours=Sum('hours'))
        )
        monthly_map = {
            entry['month'].strftime('%Y-%m'): float(entry['hours'] or 0)
            for entry in monthly_raw
        }
        first = now.date().replace(day=1)
        base  = first.year * 12 + (first.month - 1)
        monthly = []
        for i in range(5, -1, -1):
            m          = base - i
            month_date = datetime.date(m // 12, m % 12 + 1, 1)
            key        = month_date.strftime('%Y-%m')
            monthly.append({'month': key, 'hours': monthly_map.get(key, 0.0)})

        # ── Training ───────────────────────────────────────────────────────────
        enroll_qs   = TrainingEnrollment.objects.filter(user=request.user)
        enrolled    = enroll_qs.count()
        completed   = enroll_qs.filter(status='completed').count()
        comp_rate   = round(completed / enrolled * 100, 1) if enrolled else 0.0

        # ── Check-in streak ────────────────────────────────────────────────────
        checkins     = list(
            CheckIn.objects.filter(member=member)
            .order_by('-period_start')
            .values_list('period_start', flat=True)
        )
        streak = 0
        if checkins:
            # Build set of YYYY-MM strings from all check-ins
            ci_months = set(d.strftime('%Y-%m') for d in checkins)
            check_date = now.date().replace(day=1)
            while check_date.strftime('%Y-%m') in ci_months:
                streak += 1
                # Go back one month
                check_date = (check_date - datetime.timedelta(days=1)).replace(day=1)

        # ── Onboarding ─────────────────────────────────────────────────────────
        onboarding_instance = (
            OnboardingInstance.objects
            .prefetch_related('tasks')
            .select_related('template')
            .filter(user=request.user, status__in=['pending', 'active', 'paused'])
            .order_by('-created_at')
            .first()
        )
        if onboarding_instance:
            tasks      = onboarding_instance.tasks.all()
            total      = tasks.count()
            done       = tasks.filter(status='completed').count()
            prog       = round(done / total * 100) if total else 0
            onboarding = {
                'progress_pct': prog,
                'status':       onboarding_instance.status,
            }
        else:
            onboarding = {'progress_pct': None, 'status': None}

        data = {
            'contributions': {
                'total_hours': float(total_hours),
                'approved':    contrib_qs.filter(status='approved').count(),
                'monthly':     monthly,
            },
            'training': {
                'enrolled':        enrolled,
                'completed':       completed,
                'completion_rate': comp_rate,
            },
            'checkins': {
                'total':  CheckIn.objects.filter(member=member).count(),
                'streak': streak,
            },
            'onboarding': onboarding,
        }
        return Response(data)


# ── Phase 8: Recruitment ──────────────────────────────────────────────────────

class RecruitmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if can_manage(request.user):
            qs = RecruitmentRequest.objects.select_related(
                'submitted_by__user', 'reviewed_by'
            ).all()
            status_filter = request.query_params.get('status')
            if status_filter:
                qs = qs.filter(status=status_filter)
        else:
            if not hasattr(request.user, 'org_member'):
                return Response([])
            qs = RecruitmentRequest.objects.select_related(
                'submitted_by__user', 'reviewed_by'
            ).filter(submitted_by=request.user.org_member)
        return Response(
            RecruitmentRequestSerializer(qs, many=True, context={'request': request}).data
        )

    def post(self, request):
        if not hasattr(request.user, 'org_member'):
            return Response(
                {'detail': 'No org member profile found.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ser = RecruitmentRequestSerializer(data=request.data, context={'request': request})
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        referral = ser.save(submitted_by=request.user.org_member)
        member_name = request.user.get_full_name() or request.user.username
        _notify_admins(
            'recruitment_request',
            f'{member_name} submitted a referral: {referral.candidate_name}',
            link='/org/recruitment',
        )
        return Response(ser.data, status=status.HTTP_201_CREATED)


class RecruitmentReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        try:
            obj = RecruitmentRequest.objects.select_related(
                'submitted_by__user'
            ).get(pk=pk)
        except RecruitmentRequest.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        if action not in ('approve', 'reject'):
            return Response(
                {'detail': 'action must be approve or reject.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone as tz
        obj.status        = 'approved' if action == 'approve' else 'rejected'
        obj.reviewed_by   = request.user
        obj.reviewer_note = request.data.get('note', '')
        obj.reviewed_at   = tz.now()
        obj.save()

        _notify(
            obj.submitted_by.user, 'application_reviewed',
            title='Your referral has been reviewed',
            body=f'Your referral for {obj.candidate_name} has been {obj.status}.',
            link='/org/recruitment',
        )
        return Response(
            RecruitmentRequestSerializer(obj, context={'request': request}).data
        )


# ── Form Builder Views ────────────────────────────────────────────────────────

class TemplateFormFieldListView(APIView):
    """GET + POST form fields on a TaskTemplateItem."""
    permission_classes = [IsAuthenticated]

    def _get_task(self, pk, user):
        if not can_manage(user):
            return None, Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            return TaskTemplateItem.objects.get(pk=pk), None
        except TaskTemplateItem.DoesNotExist:
            return None, Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    def get(self, request, task_pk):
        task, err = self._get_task(task_pk, request.user)
        if err:
            return err
        fields = task.form_fields.all()
        return Response(TemplateFormFieldSerializer(fields, many=True).data)

    def post(self, request, task_pk):
        task, err = self._get_task(task_pk, request.user)
        if err:
            return err
        ser = TemplateFormFieldSerializer(data=request.data)
        if ser.is_valid():
            ser.save(task=task)
            return Response(ser.data, status=status.HTTP_201_CREATED)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)


class TemplateFormFieldDetailView(APIView):
    """PATCH + DELETE a single TemplateFormField."""
    permission_classes = [IsAuthenticated]

    def _get(self, pk, user):
        if not can_manage(user):
            return None, Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            return TemplateFormField.objects.get(pk=pk), None
        except TemplateFormField.DoesNotExist:
            return None, Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        field, err = self._get(pk, request.user)
        if err:
            return err
        ser = TemplateFormFieldSerializer(field, data=request.data, partial=True)
        if ser.is_valid():
            ser.save()
            return Response(ser.data)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        field, err = self._get(pk, request.user)
        if err:
            return err
        field.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskFormFieldListView(APIView):
    """GET + POST form fields on a live TaskInstance (admin only)."""
    permission_classes = [IsAuthenticated]

    def _get_task(self, onboarding_pk, task_pk, user):
        if not can_manage(user):
            return None, Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            task = TaskInstance.objects.get(pk=task_pk, onboarding_id=onboarding_pk)
            return task, None
        except TaskInstance.DoesNotExist:
            return None, Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    def get(self, request, onboarding_pk, task_pk):
        task, err = self._get_task(onboarding_pk, task_pk, request.user)
        if err:
            return err
        return Response(TaskFormFieldSerializer(task.form_fields.all(), many=True).data)

    def post(self, request, onboarding_pk, task_pk):
        task, err = self._get_task(onboarding_pk, task_pk, request.user)
        if err:
            return err
        ser = TaskFormFieldSerializer(data=request.data)
        if ser.is_valid():
            ser.save(task=task)
            return Response(ser.data, status=status.HTTP_201_CREATED)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskFormFieldDetailView(APIView):
    """PATCH + DELETE a live TaskFormField (admin only)."""
    permission_classes = [IsAuthenticated]

    def _get(self, pk, user):
        if not can_manage(user):
            return None, Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            return TaskFormField.objects.get(pk=pk), None
        except TaskFormField.DoesNotExist:
            return None, Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        field, err = self._get(pk, request.user)
        if err:
            return err
        ser = TaskFormFieldSerializer(field, data=request.data, partial=True)
        if ser.is_valid():
            ser.save()
            return Response(ser.data)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        field, err = self._get(pk, request.user)
        if err:
            return err
        field.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskFormSubmitView(APIView):
    """POST: member submits form responses. GET: fetch current responses."""
    permission_classes = [IsAuthenticated]

    def _get_task(self, onboarding_pk, task_pk, user):
        try:
            task = TaskInstance.objects.prefetch_related(
                'form_fields', 'form_fields__response'
            ).get(pk=task_pk, onboarding_id=onboarding_pk)
            if not (can_manage(user) or task.onboarding.user == user):
                return None, Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
            return task, None
        except TaskInstance.DoesNotExist:
            return None, Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    def get(self, request, onboarding_pk, task_pk):
        task, err = self._get_task(onboarding_pk, task_pk, request.user)
        if err:
            return err
        data = [
            {'field_id': f.id, 'question': f.question, 'answer': f.response.answer if hasattr(f, 'response') else ''}
            for f in task.form_fields.all()
        ]
        return Response(data)

    def post(self, request, onboarding_pk, task_pk):
        task, err = self._get_task(onboarding_pk, task_pk, request.user)
        if err:
            return err

        if task.onboarding.user != request.user:
            return Response({'detail': 'Only the assignee can submit the form.'}, status=status.HTTP_403_FORBIDDEN)

        responses = request.data.get('responses', [])
        if not isinstance(responses, list):
            return Response({'detail': 'responses must be a list.'}, status=status.HTTP_400_BAD_REQUEST)

        field_ids = {f.id for f in task.form_fields.all()}
        for r in responses:
            fid = r.get('field_id')
            if fid not in field_ids:
                continue
            field = task.form_fields.get(pk=fid)
            TaskFormResponse.objects.update_or_create(
                field=field,
                defaults={'answer': r.get('answer', '')},
            )

        # Check if all required fields have non-empty answers — if so, mark complete
        all_required_answered = all(
            (hasattr(f, 'response') and f.response.answer.strip())
            for f in task.form_fields.all()
            if f.required
        )
        # Re-fetch to get fresh response state
        task.refresh_from_db()
        fresh_fields = task.form_fields.prefetch_related('response').all()
        all_required_answered = True
        for f in fresh_fields:
            if f.required:
                try:
                    if not f.response.answer.strip():
                        all_required_answered = False
                        break
                except TaskFormResponse.DoesNotExist:
                    all_required_answered = False
                    break

        if all_required_answered and task.status != 'completed':
            from django.utils import timezone as tz
            task.status = 'completed'
            task.completed_at = tz.now()
            task.save(update_fields=['status', 'completed_at'])

            # Auto-complete onboarding if all tasks are now done
            onboarding = task.onboarding
            if (
                onboarding.status not in ('completed', 'archived')
                and not onboarding.tasks.exclude(status='completed').exists()
                and onboarding.tasks.exists()
            ):
                onboarding.status = 'completed'
                onboarding.completed_at = tz.now()
                onboarding.save(update_fields=['status', 'completed_at'])

        from .serializers import TaskInstanceSerializer as TIS
        task = TaskInstance.objects.prefetch_related(
            'form_fields', 'form_fields__response'
        ).get(pk=task.pk)
        return Response(TIS(task, context={'request': request}).data)


# ── Member Stats ──────────────────────────────────────────────────────────────

class MemberStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        members = OrgMember.objects.select_related('role').all()
        total     = members.count()
        active    = members.filter(status='active').count()
        inactive  = members.filter(status='inactive').count()
        suspended = members.filter(status='suspended').count()
        admins    = members.filter(role__can_manage_members=True).count()
        total_roles = InternalRole.objects.count()
        return Response({
            'total':       total,
            'active':      active,
            'inactive':    inactive,
            'suspended':   suspended,
            'total_roles': total_roles,
            'admins':      admins,
        })


# ── Access Requests ───────────────────────────────────────────────────────────

class AccessRequestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        requests = AccessRequest.objects.filter(status='pending').select_related(
            'user', 'requested_role', 'department'
        )
        return Response(AccessRequestSerializer(requests, many=True, context={'request': request}).data)

    def post(self, request):
        if hasattr(request.user, 'org_member'):
            return Response({'detail': 'You already have internal access.'}, status=status.HTTP_400_BAD_REQUEST)
        if AccessRequest.objects.filter(user=request.user, status='pending').exists():
            return Response({'detail': 'You already have a pending request.'}, status=status.HTTP_400_BAD_REQUEST)
        role_id = request.data.get('requested_role')
        dept_id = request.data.get('department')
        AccessRequest.objects.create(
            user=request.user,
            requested_role_id=role_id if role_id else None,
            department_id=dept_id if dept_id else None,
            message=request.data.get('message', ''),
        )
        return Response({'detail': 'Request submitted.'}, status=status.HTTP_201_CREATED)


class AccessRequestReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not is_superadmin(request.user):
            return Response({'detail': 'Superadmin only.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            access_request = AccessRequest.objects.select_related(
                'user', 'requested_role', 'department'
            ).get(pk=pk, status='pending')
        except AccessRequest.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        if action == 'approve':
            role_id = request.data.get('role_id') or (
                access_request.requested_role_id
            )
            dept_id = request.data.get('department_id') or (
                access_request.department_id
            )
            if not role_id:
                return Response(
                    {'detail': 'A role is required to approve.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if hasattr(access_request.user, 'org_member'):
                return Response({'detail': 'User already has access.'}, status=status.HTTP_400_BAD_REQUEST)
            OrgMember.objects.create(
                user=access_request.user,
                role_id=role_id,
                department_id=dept_id,
                approved_by=request.user,
                notes='Approved from access request',
            )
            access_request.user.has_internal_access = True
            access_request.user.save(update_fields=['has_internal_access'])
            access_request.status = 'approved'
            access_request.reviewed_by = request.user
            access_request.save()
            return Response({'detail': 'Access granted.'})
        elif action == 'reject':
            access_request.status = 'rejected'
            access_request.reviewed_by = request.user
            access_request.save()
            return Response({'detail': 'Request rejected.'})
        else:
            return Response(
                {'detail': 'action must be "approve" or "reject".'},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ── Member Fingerprint Views ──────────────────────────────────────────────────

class MemberTrainingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from django.shortcuts import get_object_or_404
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        member = get_object_or_404(OrgMember, pk=pk)
        qs = (
            TrainingEnrollment.objects
            .filter(user=member.user)
            .select_related('course__department', 'course__created_by')
            .prefetch_related('course__modules__lessons', 'lesson_progress')
        )
        return Response(TrainingEnrollmentSerializer(qs, many=True, context={'request': request}).data)


# ── Standalone Forms / Surveys ────────────────────────────────────────────────

class StandaloneFormListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        forms = (StandaloneForm.objects
                 .prefetch_related('fields', 'submissions')
                 .order_by('-created_at'))
        return Response(StandaloneFormSerializer(forms, many=True, context={'request': request}).data)

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        s = StandaloneFormSerializer(data=request.data, context={'request': request})
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        form = s.save(created_by=request.user)
        return Response(StandaloneFormSerializer(form, context={'request': request}).data,
                        status=status.HTTP_201_CREATED)


class StandaloneFormDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_form(self, pk):
        from django.shortcuts import get_object_or_404
        return get_object_or_404(StandaloneForm.objects.prefetch_related('fields', 'submissions'), pk=pk)

    def get(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        form = self._get_form(pk)
        return Response(StandaloneFormSerializer(form, context={'request': request}).data)

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        form = self._get_form(pk)
        s = StandaloneFormSerializer(form, data=request.data, partial=True, context={'request': request})
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        s.save()
        return Response(StandaloneFormSerializer(form, context={'request': request}).data)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        form = self._get_form(pk)
        form.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StandaloneFormFieldListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        from django.shortcuts import get_object_or_404
        form = get_object_or_404(StandaloneForm, pk=pk)
        return Response(StandaloneFormFieldSerializer(form.fields.all(), many=True).data)

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        from django.shortcuts import get_object_or_404
        form = get_object_or_404(StandaloneForm, pk=pk)
        s = StandaloneFormFieldSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        field = s.save(form=form)
        return Response(StandaloneFormFieldSerializer(field).data, status=status.HTTP_201_CREATED)


class StandaloneFormFieldDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        from django.shortcuts import get_object_or_404
        field = get_object_or_404(StandaloneFormField, pk=pk)
        s = StandaloneFormFieldSerializer(field, data=request.data, partial=True)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        s.save()
        return Response(StandaloneFormFieldSerializer(field).data)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        from django.shortcuts import get_object_or_404
        field = get_object_or_404(StandaloneFormField, pk=pk)
        field.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FormDistributeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        from django.shortcuts import get_object_or_404
        form = get_object_or_404(StandaloneForm, pk=pk)
        target_type = request.data.get('target_type', 'org')
        dept_id     = request.data.get('department_id')
        member_ids  = request.data.get('member_ids', [])

        if target_type == 'org':
            recipients = list(OrgMember.objects.filter(status='active').select_related('user'))
        elif target_type == 'department':
            recipients = list(OrgMember.objects.filter(department_id=dept_id, status='active').select_related('user'))
        else:
            recipients = list(OrgMember.objects.filter(id__in=member_ids).select_related('user'))

        recipient_ids = [m.id for m in recipients]

        # Archive any active submissions so every recipient gets a fresh blank form.
        # Old answers are snapshotted into FormSubmission.response_snapshot for audit.
        from django.db import transaction
        with transaction.atomic():
            active_subs = list(FormSubmission.objects.filter(
                form=form, member_id__in=recipient_ids, is_archived=False
            ))
            if active_subs:
                from django.conf import settings as _settings
                sub_member_ids = [s.member_id for s in active_subs]
                raw_responses  = StandaloneFormResponse.objects.filter(
                    form=form, member_id__in=sub_member_ids
                ).values('member_id', 'field_id', 'answer', 'file')
                snapshots: dict = {}
                for r in raw_responses:
                    if r['file']:
                        value = f"{_settings.MEDIA_URL}{r['file']}"
                    else:
                        value = r['answer']
                    snapshots.setdefault(r['member_id'], {})[str(r['field_id'])] = value
                for sub in active_subs:
                    sub.is_archived       = True
                    sub.response_snapshot = snapshots.get(sub.member_id, {})
                FormSubmission.objects.bulk_update(active_subs, ['is_archived', 'response_snapshot'])
                StandaloneFormResponse.objects.filter(form=form, member_id__in=sub_member_ids).delete()

        dist = FormDistribution.objects.create(
            form=form, target_type=target_type,
            department_id=dept_id if dept_id else None,
        )
        if target_type == 'members':
            dist.members.set(recipients)

        form.status = 'published'
        form.save(update_fields=['status'])

        notifs = [
            OrgNotification(
                recipient=m.user,
                type='form_assigned',
                title=f'New form to fill out: {form.title}',
                body=form.description[:200] if form.description else '',
                link='/org/my-forms',
            )
            for m in recipients
        ]
        OrgNotification.objects.bulk_create(notifs, ignore_conflicts=True)
        return Response({'recipients_notified': len(notifs)}, status=status.HTTP_201_CREATED)


class FormSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        import json as _json
        from django.shortcuts import get_object_or_404
        form   = get_object_or_404(StandaloneForm, pk=pk)
        if not hasattr(request.user, 'org_member'):
            return Response({'detail': 'You must be an org member to submit forms.'}, status=status.HTTP_403_FORBIDDEN)
        member = request.user.org_member

        # Accept both JSON body and multipart/form-data (for file uploads).
        # When multipart, 'responses' arrives as a JSON string.
        raw = request.data.get('responses', [])
        if isinstance(raw, str):
            try:
                raw = _json.loads(raw)
            except _json.JSONDecodeError:
                raw = []
        responses_data = raw

        field_map = {f.id: f for f in form.fields.all()}

        for item in responses_data:
            fid = item.get('field_id')
            if fid not in field_map:
                return Response({'detail': f'Invalid field_id {fid}'}, status=status.HTTP_400_BAD_REQUEST)
            file = request.FILES.get(f'file_{fid}')
            if file:
                StandaloneFormResponse.objects.update_or_create(
                    form=form, member=member, field_id=fid,
                    defaults={'file': file, 'answer': file.name},
                )
            else:
                answer = item.get('answer', '')
                existing = StandaloneFormResponse.objects.filter(
                    form=form, member=member, field_id=fid
                ).first()
                if existing and existing.file and not answer:
                    pass  # keep existing file untouched
                else:
                    StandaloneFormResponse.objects.update_or_create(
                        form=form, member=member, field_id=fid,
                        defaults={'answer': answer},
                    )

        FormSubmission.objects.get_or_create(form=form, member=member, is_archived=False)
        data = MyFormSerializer(form, context={'member': member, 'request': request}).data

        if form.show_results_to_members:
            poll_results = {}
            for field in form.fields.all():
                if field.field_type in ('choice', 'multiselect', 'boolean', 'rating'):
                    from collections import Counter
                    answers = list(StandaloneFormResponse.objects
                                   .filter(form=form, field=field)
                                   .values_list('answer', flat=True))
                    poll_results[str(field.id)] = dict(Counter(answers))
            data = dict(data)
            data['poll_results'] = poll_results

        return Response(data)


class FormResponsesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from django.shortcuts import get_object_or_404
        from collections import Counter
        import csv
        from django.http import StreamingHttpResponse

        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        form    = get_object_or_404(StandaloneForm.objects.prefetch_related('fields', 'submissions__member__user'), pk=pk)
        fields  = list(form.fields.all())
        active_subs  = list(form.submissions.filter(is_archived=False).select_related('member__user'))
        archived_subs = list(form.submissions.filter(is_archived=True).select_related('member__user').order_by('member__user__first_name'))
        members = [s.member for s in active_subs]

        # Build per-member answer map (active responses only)
        responses = StandaloneFormResponse.objects.filter(form=form).select_related('member__user', 'field')
        member_answers: dict = {}
        for r in responses:
            value = r.file.url if r.file else r.answer
            member_answers.setdefault(r.member_id, {})[str(r.field_id)] = value

        # CSV export
        if request.query_params.get('format') == 'csv':
            def rows():
                header = ['Member'] + [f.question for f in fields]
                yield header
                for m in members:
                    ans = member_answers.get(m.id, {})
                    yield [m.user.get_full_name() or m.user.username] + [ans.get(str(f.id), '') for f in fields]

            class Echo:
                def write(self, value):
                    return value

            writer = csv.writer(Echo())
            streaming_rows = (writer.writerow(row) for row in rows())
            response = StreamingHttpResponse(streaming_rows, content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="form_{pk}_responses.csv"'
            return response

        # Per-question aggregation
        per_question = []
        for field in fields:
            answers = [member_answers.get(m.id, {}).get(str(field.id), '') for m in members]
            counts = {}
            if field.field_type in ('choice', 'multiselect', 'boolean', 'rating'):
                flat = []
                for a in answers:
                    if field.field_type == 'multiselect':
                        flat.extend([x.strip() for x in a.split(',') if x.strip()])
                    else:
                        if a:
                            flat.append(a)
                counts = dict(Counter(flat))
            per_question.append({
                'field_id':   field.id,
                'question':   field.question,
                'field_type': field.field_type,
                'options':    field.options,
                'counts':     counts,
                'answers':    [a for a in answers if a],
            })

        # Per-member list (active)
        per_member = []
        for s in active_subs:
            per_member.append({
                'member_id':    s.member_id,
                'name':         s.member.user.get_full_name() or s.member.user.username,
                'submitted_at': s.submitted_at.isoformat(),
                'answers':      member_answers.get(s.member_id, {}),
            })

        # Archived submissions (previous rounds)
        archived_members = []
        for s in archived_subs:
            archived_members.append({
                'member_id':    s.member_id,
                'name':         s.member.user.get_full_name() or s.member.user.username,
                'submitted_at': s.submitted_at.isoformat(),
                'answers':      s.response_snapshot,
            })

        # Compute total_recipients from distributions
        total_recipients = set()
        for dist in form.distributions.prefetch_related('members').all():
            if dist.target_type == 'org':
                total_recipients.update(OrgMember.objects.filter(status='active').values_list('id', flat=True))
            elif dist.target_type == 'department':
                total_recipients.update(OrgMember.objects.filter(department_id=dist.department_id, status='active').values_list('id', flat=True))
            else:
                total_recipients.update(dist.members.values_list('id', flat=True))

        return Response({
            'total_recipients':  len(total_recipients),
            'total_submitted':   len(active_subs),
            'per_question':      per_question,
            'per_member':        per_member,
            'archived_members':  archived_members,
        })


class MyFormsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'org_member'):
            return Response([])
        member = request.user.org_member

        # Collect form IDs via proper Django queries (avoids N+1 Python loop)
        org_ids    = FormDistribution.objects.filter(
            target_type='org'
        ).values_list('form_id', flat=True)

        dept_ids   = FormDistribution.objects.filter(
            target_type='department', department_id=member.department_id
        ).values_list('form_id', flat=True) if member.department_id else []

        member_ids = FormDistribution.objects.filter(
            target_type='members', members=member
        ).values_list('form_id', flat=True)

        form_ids = set(org_ids) | set(dept_ids) | set(member_ids)

        forms = list(StandaloneForm.objects
                     .filter(id__in=form_ids, status__in=['published', 'closed'])
                     .prefetch_related('fields')
                     .order_by('-created_at'))

        # Build per-form submission and answer dicts in 2 bulk queries (no N+1)
        form_id_set = [f.id for f in forms]
        submissions = FormSubmission.objects.filter(form_id__in=form_id_set, member=member, is_archived=False)
        submitted_map = {s.form_id: s.submitted_at for s in submissions}

        responses = StandaloneFormResponse.objects.filter(form_id__in=form_id_set, member=member)
        answers_map: dict = {}
        for r in responses:
            value = r.file.url if r.file else r.answer
            answers_map.setdefault(r.form_id, {})[str(r.field_id)] = value

        ctx = {
            'member': member,
            'request': request,
            'submitted_map': submitted_map,
            'answers_map': answers_map,
        }
        return Response(MyFormSerializer(forms, many=True, context=ctx).data)


class FormInsightsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        since = timezone.now() - timedelta(weeks=12)
        weekly = (
            FormSubmission.objects
            .filter(submitted_at__gte=since, is_archived=False)
            .annotate(week=TruncWeek('submitted_at'))
            .values('week')
            .annotate(count=Count('id'))
            .order_by('week')
        )
        return Response([
            {'week': w['week'].date().isoformat(), 'count': w['count']}
            for w in weekly
        ])


# ── Extension Requests ────────────────────────────────────────────────────────

class ExtensionRequestSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        enrollment_id  = request.data.get('enrollment_id')
        days_requested = request.data.get('days_requested')
        reason         = request.data.get('reason', '').strip()

        if not enrollment_id or not days_requested or not reason:
            return Response(
                {'detail': 'enrollment_id, days_requested, and reason are required.'},
                status=400,
            )

        try:
            enrollment = TrainingEnrollment.objects.select_related('course').get(
                id=enrollment_id, user=request.user,
            )
        except TrainingEnrollment.DoesNotExist:
            return Response({'detail': 'Enrollment not found.'}, status=404)

        if ExtensionRequest.objects.filter(
            user=request.user, enrollment=enrollment, status='pending',
        ).exists():
            return Response(
                {'detail': 'You already have a pending extension request for this course.'},
                status=400,
            )

        ext_req = ExtensionRequest.objects.create(
            user=request.user,
            course=enrollment.course,
            enrollment=enrollment,
            days_requested=int(days_requested),
            reason=reason,
        )
        return Response(ExtensionRequestSerializer(ext_req).data, status=201)


class ExtensionRequestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        status_filter = request.query_params.get('status')
        qs = ExtensionRequest.objects.select_related(
            'user', 'course', 'enrollment', 'reviewed_by'
        )
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(ExtensionRequestSerializer(qs, many=True).data)


class ExtensionRequestReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        try:
            ext_req = ExtensionRequest.objects.select_related(
                'user', 'course', 'enrollment', 'reviewed_by'
            ).get(pk=pk)
        except ExtensionRequest.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        action     = request.data.get('action')
        admin_note = request.data.get('admin_note', '').strip()

        if action not in ('approve', 'deny'):
            return Response({'detail': 'action must be approve or deny.'}, status=400)

        ext_req.status      = 'approved' if action == 'approve' else 'denied'
        ext_req.admin_note  = admin_note
        ext_req.reviewed_by = request.user
        ext_req.reviewed_at = timezone.now()
        ext_req.save()
        return Response(ExtensionRequestSerializer(ext_req).data)


# ═══════════════════════════════════════════════════════════════════════════════
# Org Chat — REST Views
# ═══════════════════════════════════════════════════════════════════════════════

class OrgChannelListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_org_member(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        if can_manage(request.user):
            channels = OrgChatChannel.objects.filter(is_archived=False).order_by('channel_type', 'name')
        else:
            memberships = OrgChatChannelMember.objects.filter(
                user=request.user
            ).values_list('channel_id', flat=True)
            channels = OrgChatChannel.objects.filter(
                id__in=memberships, is_archived=False
            ).order_by('channel_type', 'name')
        return Response(OrgChatChannelSerializer(channels, many=True).data)

    def post(self, request):
        if not can_manage(request.user):
            return Response({'detail': 'Only admins/managers can create channels.'}, status=403)
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'detail': 'name is required.'}, status=400)
        ch = OrgChatChannel.objects.create(
            name=name,
            description=request.data.get('description', ''),
            channel_type=request.data.get('channel_type', 'custom'),
            created_by=request.user,
        )
        for m in OrgMember.objects.filter(status='active').select_related('user'):
            OrgChatChannelMember.objects.get_or_create(channel=ch, user=m.user)
        OrgChatChannelMember.objects.get_or_create(channel=ch, user=request.user)
        return Response(OrgChatChannelSerializer(ch).data, status=201)


class OrgChannelDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_channel(self, request, pk):
        ch = get_object_or_404(OrgChatChannel, pk=pk)
        if not OrgChatChannelMember.objects.filter(channel=ch, user=request.user).exists():
            return None, Response({'detail': 'Not a member of this channel.'}, status=403)
        return ch, None

    def get(self, request, pk):
        ch, err = self._get_channel(request, pk)
        if err: return err
        return Response(OrgChatChannelSerializer(ch).data)

    def patch(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        ch = get_object_or_404(OrgChatChannel, pk=pk)
        for field in ('name', 'description', 'is_archived'):
            if field in request.data:
                setattr(ch, field, request.data[field])
        ch.save()
        return Response(OrgChatChannelSerializer(ch).data)

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        get_object_or_404(OrgChatChannel, pk=pk).delete()
        return Response(status=204)


class OrgChannelMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if not is_org_member(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        ch = get_object_or_404(OrgChatChannel, pk=pk)
        memberships = ch.memberships.select_related('user').all()
        data = [
            {
                'id':         m.user.id,
                'username':   m.user.username,
                'first_name': m.user.first_name,
                'last_name':  m.user.last_name,
                'is_admin':   m.is_admin,
                'joined_at':  m.joined_at.isoformat(),
            }
            for m in memberships
        ]
        return Response(data)

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        ch = get_object_or_404(OrgChatChannel, pk=pk)
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required.'}, status=400)
        from accounts.models import CustomUser
        user = get_object_or_404(CustomUser, pk=user_id)
        OrgChatChannelMember.objects.get_or_create(channel=ch, user=user)
        return Response({'detail': 'Member added.'})

    def delete(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        ch = get_object_or_404(OrgChatChannel, pk=pk)
        user_id = request.data.get('user_id')
        OrgChatChannelMember.objects.filter(channel=ch, user_id=user_id).delete()
        return Response(status=204)


class OrgChannelMessageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if not can_manage(request.user) and not OrgChatChannelMember.objects.filter(channel_id=pk, user=request.user).exists():
            return Response({'detail': 'Not a member of this channel.'}, status=403)
        qs = OrgChatMessage.objects.filter(
            channel_id=pk, is_deleted=False
        ).select_related(
            'sender__org_member', 'reply_to__sender',
        ).prefetch_related('reactions__user').order_by('-id')
        before = request.query_params.get('before')
        if before:
            qs = qs.filter(id__lt=before)
        messages = list(reversed(list(qs[:50])))
        return Response(OrgChatMessageSerializer(messages, many=True).data)

    def post(self, request, pk):
        if not can_manage(request.user) and not OrgChatChannelMember.objects.filter(channel_id=pk, user=request.user).exists():
            return Response({'detail': 'Not a member of this channel.'}, status=403)
        ch = get_object_or_404(OrgChatChannel, pk=pk)
        body = (request.data.get('body') or '').strip()
        if not body and 'attachment' not in request.FILES:
            return Response({'detail': 'body or attachment required.'}, status=400)
        reply_to_id = request.data.get('reply_to_id')
        msg = OrgChatMessage.objects.create(
            channel=ch,
            sender=request.user,
            body=body,
            message_type=request.data.get('message_type', 'message'),
            reply_to_id=reply_to_id if reply_to_id else None,
        )
        if 'attachment' in request.FILES:
            msg.attachment = request.FILES['attachment']
            msg.save()
        msg = OrgChatMessage.objects.select_related(
            'sender__org_member', 'reply_to__sender',
        ).prefetch_related('reactions__user').get(pk=msg.pk)
        return Response(OrgChatMessageSerializer(msg).data, status=201)


class OrgChannelMessageDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, mid):
        msg = get_object_or_404(OrgChatMessage, pk=mid, channel_id=pk)
        if msg.sender != request.user:
            return Response({'detail': 'Cannot edit another user\'s message.'}, status=403)
        body = (request.data.get('body') or '').strip()
        if body:
            msg.body = body
            msg.save()
        return Response(OrgChatMessageSerializer(msg).data)

    def delete(self, request, pk, mid):
        msg = get_object_or_404(OrgChatMessage, pk=mid, channel_id=pk)
        if msg.sender != request.user and not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        msg.is_deleted = True
        msg.body = ''
        msg.save()
        return Response(status=204)


class OrgChannelMessagePinView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, mid):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        msg = get_object_or_404(OrgChatMessage, pk=mid, channel_id=pk)
        msg.is_pinned = not msg.is_pinned
        msg.save()
        return Response({'is_pinned': msg.is_pinned})


class OrgChannelMessageReactView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, mid):
        if not can_manage(request.user) and not OrgChatChannelMember.objects.filter(channel_id=pk, user=request.user).exists():
            return Response({'detail': 'Not a member of this channel.'}, status=403)
        msg = get_object_or_404(OrgChatMessage, pk=mid, channel_id=pk)
        emoji = request.data.get('emoji')
        VALID = {c[0] for c in OrgChatReaction.EMOJI_CHOICES}
        if emoji not in VALID:
            return Response({'detail': 'Invalid emoji.'}, status=400)
        existing = OrgChatReaction.objects.filter(message=msg, user=request.user, emoji=emoji).first()
        if existing:
            existing.delete()
        else:
            OrgChatReaction.objects.create(message=msg, user=request.user, emoji=emoji)
        reactions = OrgChatReaction.objects.filter(message=msg).select_related('user')
        return Response(OrgChatReactionSerializer(reactions, many=True).data)


# ── DM views ──────────────────────────────────────────────────────────────────

class OrgDMConversationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_org_member(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        from django.db.models import Q, Max, OuterRef, Subquery, IntegerField
        user = request.user
        # Get distinct partner IDs
        sent_to = OrgDMMessage.objects.filter(sender=user).values_list('receiver_id', flat=True).distinct()
        recv_from = OrgDMMessage.objects.filter(receiver=user).values_list('sender_id', flat=True).distinct()
        partner_ids = set(sent_to) | set(recv_from)

        from accounts.models import CustomUser
        partners = CustomUser.objects.filter(id__in=partner_ids)

        result = []
        for partner in partners:
            msgs = OrgDMMessage.objects.filter(
                Q(sender=user, receiver=partner) | Q(sender=partner, receiver=user),
                is_deleted=False,
            ).order_by('-created_at')
            last_msg = msgs.first()
            unread = msgs.filter(receiver=user, is_read=False).count()
            result.append({
                'partner': {
                    'id':           partner.id,
                    'username':     partner.username,
                    'first_name':   partner.first_name,
                    'last_name':    partner.last_name,
                    'display_name': f"{partner.first_name} {partner.last_name}".strip() or partner.username,
                    'profile_picture': _get_user_pic(partner),
                },
                'unread':       unread,
                'last_message': re.sub(r'<[^>]+>', '', last_msg.body).replace('&nbsp;', ' ')[:100] if last_msg else '',
                'last_at':      last_msg.created_at.isoformat() if last_msg else None,
            })
        result.sort(key=lambda x: x['last_at'] or '', reverse=True)
        return Response(result)


class OrgDMMessageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        if not is_org_member(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        from django.db.models import Q
        msgs = OrgDMMessage.objects.filter(
            Q(sender=request.user, receiver_id=user_id) |
            Q(sender_id=user_id, receiver=request.user),
            is_deleted=False,
        ).select_related(
            'sender__org_member', 'receiver__org_member',
        ).order_by('-id')
        before = request.query_params.get('before')
        if before:
            msgs = msgs.filter(id__lt=before)
        messages = list(reversed(list(msgs[:50])))
        # Mark as read
        OrgDMMessage.objects.filter(sender_id=user_id, receiver=request.user, is_read=False).update(is_read=True)
        return Response(OrgDMMessageSerializer(messages, many=True).data)

    def post(self, request, user_id):
        if not is_org_member(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        from accounts.models import CustomUser
        receiver = get_object_or_404(CustomUser, pk=user_id)
        body = (request.data.get('body') or '').strip()
        if not body and 'attachment' not in request.FILES:
            return Response({'detail': 'body or attachment required.'}, status=400)
        msg = OrgDMMessage.objects.create(sender=request.user, receiver=receiver, body=body)
        if 'attachment' in request.FILES:
            msg.attachment = request.FILES['attachment']
            msg.save()
        msg = OrgDMMessage.objects.select_related(
            'sender__org_member', 'receiver__org_member',
        ).get(pk=msg.pk)
        return Response(OrgDMMessageSerializer(msg).data, status=201)


class OrgDMMessageDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id, mid):
        from django.db.models import Q
        msg = get_object_or_404(OrgDMMessage, pk=mid)
        if msg.sender != request.user:
            return Response({'detail': 'Cannot edit another user\'s message.'}, status=403)
        body = (request.data.get('body') or '').strip()
        if body:
            msg.body = body
            msg.save()
        return Response(OrgDMMessageSerializer(msg).data)

    def delete(self, request, user_id, mid):
        msg = get_object_or_404(OrgDMMessage, pk=mid)
        if msg.sender != request.user and not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        msg.is_deleted = True
        msg.body = ''
        msg.save()
        return Response(status=204)


# ── Poll views ─────────────────────────────────────────────────────────────────

class OrgChannelPollListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if not can_manage(request.user) and not OrgChatChannelMember.objects.filter(channel_id=pk, user=request.user).exists():
            return Response({'detail': 'Not a member of this channel.'}, status=403)
        polls = OrgChatPoll.objects.filter(channel_id=pk).prefetch_related(
            'options__voters'
        ).select_related('author').order_by('-created_at')
        return Response(OrgChatPollSerializer(polls, many=True, context={'request': request}).data)

    def post(self, request, pk):
        if not can_manage(request.user):
            return Response({'detail': 'Only admins/managers can create polls.'}, status=403)
        if not can_manage(request.user) and not OrgChatChannelMember.objects.filter(channel_id=pk, user=request.user).exists():
            return Response({'detail': 'Not a member of this channel.'}, status=403)
        ch = get_object_or_404(OrgChatChannel, pk=pk)
        question = (request.data.get('question') or '').strip()
        options  = request.data.get('options', [])
        if not question or len(options) < 2:
            return Response({'detail': 'question and at least 2 options required.'}, status=400)
        poll = OrgChatPoll.objects.create(
            channel=ch,
            author=request.user,
            question=question,
            allow_multiple=bool(request.data.get('allow_multiple', False)),
        )
        for opt_text in options:
            if isinstance(opt_text, dict):
                opt_text = opt_text.get('text', '')
            if str(opt_text).strip():
                OrgChatPollOption.objects.create(poll=poll, text=str(opt_text).strip())
        return Response(OrgChatPollSerializer(poll, context={'request': request}).data, status=201)


class OrgChannelPollDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, pid):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        poll = get_object_or_404(OrgChatPoll, pk=pid, channel_id=pk)
        if 'is_closed' in request.data:
            poll.is_closed = bool(request.data['is_closed'])
            poll.save()
        return Response(OrgChatPollSerializer(poll, context={'request': request}).data)

    def delete(self, request, pk, pid):
        if not can_manage(request.user):
            return Response({'detail': 'Permission denied.'}, status=403)
        get_object_or_404(OrgChatPoll, pk=pid, channel_id=pk).delete()
        return Response(status=204)


class OrgChannelPollVoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, pid):
        if not OrgChatChannelMember.objects.filter(channel_id=pk, user=request.user).exists():
            return Response({'detail': 'Not a member of this channel.'}, status=403)
        poll = get_object_or_404(OrgChatPoll, pk=pid, channel_id=pk)
        if poll.is_closed:
            return Response({'detail': 'Poll is closed.'}, status=400)
        option_ids = request.data.get('option_ids', [])
        if isinstance(option_ids, int):
            option_ids = [option_ids]
        if not option_ids:
            return Response({'detail': 'option_ids required.'}, status=400)
        if not poll.allow_multiple and len(option_ids) > 1:
            return Response({'detail': 'This poll only allows one vote.'}, status=400)
        options = OrgChatPollOption.objects.filter(pk__in=option_ids, poll=poll)
        if not options.exists():
            return Response({'detail': 'Invalid option(s).'}, status=400)
        # Remove prior votes for single-choice polls
        if not poll.allow_multiple:
            for opt in poll.options.all():
                opt.voters.remove(request.user)
        for opt in options:
            if request.user in opt.voters.all():
                opt.voters.remove(request.user)
            else:
                opt.voters.add(request.user)
        poll.refresh_from_db()
        return Response(OrgChatPollSerializer(poll, context={'request': request}).data)
