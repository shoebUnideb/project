from django.db.models import Q, Count, Sum
from django.db.models.functions import TruncDate, TruncWeek
from django.shortcuts import get_object_or_404
from django.utils.crypto import get_random_string
from django.utils.text import slugify
from datetime import datetime, timedelta
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from accounts.models import CustomUser
from .models import (
    StudentProfile, MentorProfile, Assignment, Message, Workspace, WorkspaceMembership, WorkspaceResource,
    Notification, ContactRequest, Block, Post, PostReaction, PostComment,
    MentorAvailabilitySlot, Session, MentorRating, PostBookmark, ProfileView,
    WorkspaceChatMessage, PersonalTask, WorkspaceEvent,
    WorkspaceChatChannel, WorkspaceChatReaction, WorkspaceDMMessage,
    WorkspacePoll, WorkspacePollOption, WorkspaceTaskSubmission, WorkspaceTask,
    WorkspaceMentor, WorkspaceOnboardingQuestion, WorkspaceOnboardingAnswer,
)
from .serializers import (
    StudentProfileSerializer, MentorProfileSerializer,
    AssignmentSerializer, MessageSerializer,
    WorkspaceSerializer, WorkspaceMembershipSerializer, WorkspaceResourceSerializer,
    PersonalTaskSerializer, WorkspaceEventSerializer,
    WorkspaceOnboardingQuestionSerializer, WorkspaceOnboardingAnswerSerializer,
    WorkspaceOnboardingSubmissionSerializer,
)


# ── Helpers ────────────────────────────────────

def _student_profile(user):
    return StudentProfile.objects.filter(user=user).first()

def _mentor_profile(user):
    return MentorProfile.objects.filter(user=user).first()


# ── Profiles ───────────────────────────────────

@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def student_profile_me(request):
    profile = get_object_or_404(StudentProfile, user=request.user)
    if request.method == 'GET':
        return Response(StudentProfileSerializer(profile, context={'request': request}).data)
    serializer = StudentProfileSerializer(profile, data=request.data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def mentor_profile_me(request):
    profile = get_object_or_404(MentorProfile, user=request.user)
    if request.method == 'GET':
        return Response(MentorProfileSerializer(profile, context={'request': request}).data)
    serializer = MentorProfileSerializer(profile, data=request.data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_my_mentor(request):
    if request.user.role != 'student':
        return Response({'detail': 'Forbidden.'}, status=403)
    sp = _student_profile(request.user)
    if not sp:
        return Response(None)
    try:
        assignment = Assignment.objects.select_related('mentor__user').get(student=sp, is_active=True)
        return Response(MentorProfileSerializer(assignment.mentor, context={'request': request}).data)
    except Assignment.DoesNotExist:
        return Response(None)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mentor_pending_feed(request):
    """Return pending workspace join requests for the logged-in mentor."""
    if request.user.role != 'mentor':
        return Response({'detail': 'Forbidden.'}, status=403)
    mp = _mentor_profile(request.user)
    if not mp:
        return Response({'steps': [], 'workspace_requests': []})

    workspace_requests = (
        WorkspaceMembership.objects
        .filter(workspace__mentor=mp, status='pending')
        .select_related('student__user', 'workspace')
        .order_by('requested_at')[:20]
    )
    requests_data = [
        {
            'id': m.id,
            'workspace_id': m.workspace_id,
            'workspace_name': m.workspace.name,
            'student_name': (
                f"{m.student.user.first_name} {m.student.user.last_name}".strip()
                or m.student.user.username
            ),
            'requested_at': m.requested_at,
        }
        for m in workspace_requests
    ]

    return Response({'steps': [], 'workspace_requests': requests_data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mentor_students(request):
    """Return all students assigned to the logged-in mentor."""
    if request.user.role != 'mentor':
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
    mentor_profile = _mentor_profile(request.user)
    if not mentor_profile:
        return Response({'detail': 'Mentor profile not found.'}, status=status.HTTP_404_NOT_FOUND)
    assignments = Assignment.objects.filter(mentor=mentor_profile, is_active=True).select_related('student__user')
    students = [a.student for a in assignments]
    return Response(StudentProfileSerializer(students, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mentor_student_detail(request, student_id):
    """Mentor views a specific assigned student."""
    if request.user.role != 'mentor':
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
    mentor_profile = _mentor_profile(request.user)
    if not mentor_profile:
        return Response({'detail': 'Mentor profile not found.'}, status=status.HTTP_404_NOT_FOUND)
    student_profile = get_object_or_404(StudentProfile, pk=student_id)
    if not Assignment.objects.filter(mentor=mentor_profile, student=student_profile, is_active=True).exists():
        return Response({'detail': 'Not your assigned student.'}, status=status.HTTP_403_FORBIDDEN)
    return Response(StudentProfileSerializer(student_profile, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def public_profile(request, user_id):
    """View any user's full profile."""
    viewer = request.user
    target_user = get_object_or_404(CustomUser, pk=user_id)

    if target_user == viewer:
        # Viewing your own profile — redirect to the profile_me endpoint logic
        if viewer.role == 'student':
            sp = _student_profile(viewer)
            return Response(StudentProfileSerializer(sp, context={'request': request}).data) if sp else Response({'detail': 'Profile not found.'}, status=404)
        if viewer.role == 'mentor':
            mp = _mentor_profile(viewer)
            return Response(MentorProfileSerializer(mp, context={'request': request}).data) if mp else Response({'detail': 'Profile not found.'}, status=404)

    # Return the appropriate serializer
    if target_user.role == 'student':
        sp = _student_profile(target_user)
        if not sp:
            return Response({'detail': 'Student profile not found.'}, status=404)
        return Response(StudentProfileSerializer(sp, context={'request': request}).data)
    elif target_user.role == 'mentor':
        mp = _mentor_profile(target_user)
        if not mp:
            return Response({'detail': 'Mentor profile not found.'}, status=404)
        return Response(MentorProfileSerializer(mp, context={'request': request}).data)
    else:
        return Response({'detail': 'No profile available for this user.'}, status=404)


# ── Assignments ────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def assignment_list(request):
    if request.user.role != 'superadmin':
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
    if request.method == 'GET':
        qs = Assignment.objects.select_related(
            'student__user', 'mentor__user', 'assigned_by'
        ).all()
        return Response(AssignmentSerializer(qs, many=True, context={'request': request}).data)
    # POST: create new assignment — frontend sends User IDs, not Profile PKs
    data = request.data
    try:
        student_profile = StudentProfile.objects.get(user_id=data.get('student_id'))
    except StudentProfile.DoesNotExist:
        return Response({'detail': 'Student profile not found for that user.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        mentor_profile = MentorProfile.objects.get(user_id=data.get('mentor_id'))
    except MentorProfile.DoesNotExist:
        return Response({'detail': 'Mentor profile not found for that user.'}, status=status.HTTP_400_BAD_REQUEST)
    assignment = Assignment.objects.create(
        student=student_profile,
        mentor=mentor_profile,
        assigned_by=request.user,
        notes=data.get('notes', ''),
    )
    return Response(AssignmentSerializer(assignment, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def assignment_detail(request, pk):
    if request.user.role != 'superadmin':
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
    assignment = get_object_or_404(Assignment, pk=pk)
    if request.method == 'PATCH':
        serializer = AssignmentSerializer(assignment, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    # DELETE → deactivate
    assignment.is_active = False
    assignment.save()
    return Response({'detail': 'Deactivated.'})


# ── Marketplace ────────────────────────────────

def _split_tags(value):
    """Split a comma-separated string into a clean list of non-empty strings."""
    if not value:
        return []
    return [t.strip() for t in value.split(',') if t.strip()]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def marketplace_users(request):
    """Return all approved mentors and students for the marketplace (excludes current user)."""
    user = request.user

    # Collect IDs of users assigned to (or from) the current user
    assigned_ids = set()
    if user.role == 'student':
        sp = StudentProfile.objects.filter(user=user).first()
        if sp:
            assigned_ids = set(
                Assignment.objects.filter(student=sp, is_active=True)
                .values_list('mentor__user_id', flat=True)
            )
    elif user.role == 'mentor':
        mp = MentorProfile.objects.filter(user=user).first()
        if mp:
            assigned_ids = set(
                Assignment.objects.filter(mentor=mp, is_active=True)
                .values_list('student__user_id', flat=True)
            )

    # Pre-fetch contact requests involving the current user
    crs = ContactRequest.objects.filter(
        Q(sender=user) | Q(receiver=user)
    ).values('id', 'sender_id', 'receiver_id', 'status')
    cr_map = {}
    for cr in crs:
        other_id = cr['receiver_id'] if cr['sender_id'] == user.id else cr['sender_id']
        cr_map[other_id] = cr

    # Pre-fetch blocks
    i_blocked_ids = set(Block.objects.filter(blocker=user).values_list('blocked_id', flat=True))

    def messaging_status(target_user):
        if target_user.id in i_blocked_ids:
            return 'blocked'
        return 'open'

    result = []

    mentors = CustomUser.objects.filter(role='mentor', is_approved=True).exclude(pk=user.pk)
    for u in mentors:
        p = MentorProfile.objects.filter(user=u).first()
        pic = p.profile_picture.url if p and p.profile_picture else None
        expertise_tags = _split_tags(p.expertise if p else '')
        filled = sum(bool(f) for f in [
            p.bio if p else '', p.expertise if p else '',
            p.phone if p else '', p.linkedin_url if p else '',
            pic,
        ])
        result.append({
            'id': u.id,
            'username': u.username,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'role': 'mentor',
            'date_joined': u.date_joined.isoformat(),
            'bio': p.bio if p else '',
            'headline': p.expertise if p else '',
            'expertise': p.expertise if p else '',
            'phone': p.phone if p else '',
            'linkedin_url': p.linkedin_url if p else '',
            'profile_picture': pic,
            'tags': expertise_tags,
            'skills': [],
            'university': '',
            'field_of_study': '',
            'career_stage': '',
            'is_assigned': u.id in assigned_ids,
            'profile_completeness': round(filled / 5 * 100),
            'messaging_status': messaging_status(u),
            'domain': p.domain if p else '',
            'preferred_student_level': p.preferred_student_level if p else '',
            'timezone': p.timezone if p else '',
        })

    students = CustomUser.objects.filter(role='student').exclude(pk=user.pk)
    for u in students:
        p = StudentProfile.objects.filter(user=u).first()
        pic = p.profile_picture.url if p and p.profile_picture else None
        skills = _split_tags(p.skills if p else '')
        fos_tags = _split_tags(p.field_of_study if p else '')
        filled = sum(bool(f) for f in [
            p.bio if p else '', p.headline if p else '',
            p.field_of_study if p else '', p.university if p else '',
            p.mentorship_goals if p else '', pic,
        ])
        result.append({
            'id': u.id,
            'username': u.username,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'role': 'student',
            'date_joined': u.date_joined.isoformat(),
            'bio': p.bio if p else '',
            'headline': p.headline if p else '',
            'expertise': '',
            'phone': p.phone if p else '',
            'linkedin_url': p.linkedin_url if p else '',
            'university': p.university if p else '',
            'field_of_study': p.field_of_study if p else '',
            'career_stage': p.career_stage if p else '',
            'profile_picture': pic,
            'tags': fos_tags,
            'skills': skills,
            'is_assigned': u.id in assigned_ids,
            'profile_completeness': round(filled / 6 * 100),
            'messaging_status': messaging_status(u),
        })

    return Response(result)


# ── Messages ───────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def message_thread(request):
    """
    Returns conversation thread between current user and another user.
    Accepts ?user_id= for any pair, or ?mentor_id= (legacy superadmin usage).
    Mentor with no param defaults to superadmin thread.
    """
    user = request.user
    user_id = request.query_params.get('user_id')

    if user_id:
        other = get_object_or_404(CustomUser, pk=user_id)
    elif user.role == 'mentor':
        other = CustomUser.objects.filter(role='superadmin').first()
    elif user.role == 'superadmin':
        mentor_id = request.query_params.get('mentor_id')
        if not mentor_id:
            return Response({'detail': 'user_id or mentor_id query param required.'}, status=status.HTTP_400_BAD_REQUEST)
        other = get_object_or_404(CustomUser, pk=mentor_id)
    else:
        return Response({'detail': 'user_id query param required.'}, status=status.HTTP_400_BAD_REQUEST)

    if not other:
        return Response([], status=status.HTTP_200_OK)

    msgs = (
        Message.objects.filter(sender=user, receiver=other) |
        Message.objects.filter(sender=other, receiver=user)
    ).order_by('timestamp')
    msgs.filter(receiver=user, is_read=False).update(is_read=True)
    return Response(MessageSerializer(msgs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def message_inbox(request):
    """Superadmin: returns list of mentors with message threads."""
    if request.user.role != 'superadmin':
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
    mentors = CustomUser.objects.filter(role='mentor')
    inbox = []
    for mentor in mentors:
        has_thread = (
            Message.objects.filter(sender=mentor, receiver=request.user).exists() or
            Message.objects.filter(sender=request.user, receiver=mentor).exists()
        )
        if has_thread:
            unread = Message.objects.filter(sender=mentor, receiver=request.user, is_read=False).count()
            from accounts.serializers import UserSerializer
            inbox.append({
                'mentor': UserSerializer(mentor).data,
                'unread': unread,
            })
    return Response(inbox)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def message_conversations(request):
    """Return all conversations (users talked with) for the current user, sorted by latest message."""
    from accounts.serializers import UserSerializer
    user = request.user
    sent_to = Message.objects.filter(sender=user).values_list('receiver_id', flat=True).distinct()
    received_from = Message.objects.filter(receiver=user).values_list('sender_id', flat=True).distinct()
    other_ids = set(sent_to) | set(received_from)

    result = []
    for uid in other_ids:
        other = CustomUser.objects.filter(pk=uid).first()
        if not other:
            continue
        last_msg = (
            Message.objects.filter(sender=user, receiver=other) |
            Message.objects.filter(sender=other, receiver=user)
        ).order_by('-timestamp').first()
        unread = Message.objects.filter(sender=other, receiver=user, is_read=False).count()
        result.append({
            'user': UserSerializer(other).data,
            'last_message': MessageSerializer(last_msg).data if last_msg else None,
            'unread': unread,
        })

    result.sort(key=lambda x: x['last_message']['timestamp'] if x['last_message'] else '', reverse=True)
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def message_send(request):
    """
    Body: { "body": "...", "receiver_id": <int> }
    Any authenticated user can message any other user.
    Mentors omitting receiver_id default to superadmin.
    """
    user = request.user
    receiver_id = request.data.get('receiver_id')
    body = request.data.get('body', '').strip()
    attachment = request.FILES.get('attachment')
    if not body and not attachment:
        return Response({'detail': 'body or attachment is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if not receiver_id:
        if user.role == 'mentor':
            receiver = CustomUser.objects.filter(role='superadmin').first()
            if not receiver:
                return Response({'detail': 'No administrator found.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'detail': 'receiver_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        receiver = get_object_or_404(CustomUser, pk=receiver_id)

    if receiver.pk == user.pk:
        return Response({'detail': "You can't message yourself."}, status=status.HTTP_400_BAD_REQUEST)

    # Check blocks (either direction)
    if Block.objects.filter(
        Q(blocker=user, blocked=receiver) | Q(blocker=receiver, blocked=user)
    ).exists():
        return Response({'detail': 'Messaging not available.'}, status=status.HTTP_403_FORBIDDEN)

    msg = Message.objects.create(sender=user, receiver=receiver, body=body, attachment=attachment)
    return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def message_clear_thread(request, user_id):
    """Delete all messages between current user and user_id."""
    other = get_object_or_404(CustomUser, pk=user_id)
    Message.objects.filter(
        Q(sender=request.user, receiver=other) | Q(sender=other, receiver=request.user)
    ).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

# ── Workspaces ─────────────────────────────────

def _is_workspace_member(workspace, user):
    """True if user is an approved member, the workspace mentor, or an active workspace mentor."""
    if user.role == 'mentor':
        mp = _mentor_profile(user)
        if not mp:
            return False
        if workspace.mentor == mp:
            return True
        return WorkspaceMentor.objects.filter(workspace=workspace, mentor=mp, status=WorkspaceMentor.STATUS_ACTIVE).exists()
    sp = _student_profile(user)
    return sp and WorkspaceMembership.objects.filter(
        workspace=workspace, student=sp, status='approved'
    ).exists()


def _is_workspace_write_mentor(workspace, user):
    """True if user is the coordinator, an active workspace mentor, or a superadmin."""
    if user.role == 'superadmin':
        return True
    if user.role != 'mentor':
        return False
    mp = _mentor_profile(user)
    if not mp:
        return False
    if workspace.mentor == mp:
        return True
    return WorkspaceMentor.objects.filter(
        workspace=workspace, mentor=mp, status=WorkspaceMentor.STATUS_ACTIVE
    ).exists()


def _make_workspace_slug(name):
    base = slugify(name)[:100] or 'workspace'
    slug = base
    while Workspace.objects.filter(slug=slug).exists():
        slug = f"{base}-{get_random_string(4)}"
    return slug


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def workspace_list(request):
    """GET: all visible workspaces with caller's membership status.
       POST: mentor creates a new workspace."""
    user = request.user

    if request.method == 'GET':
        qs = Workspace.objects.filter(is_active=True).select_related('mentor__user').order_by('-created_at')
        # Private + secret workspaces only visible to owner/approved members/invited members
        if user.role != 'superadmin':
            mp = _mentor_profile(user) if user.role == 'mentor' else None
            sp = _student_profile(user) if user.role == 'student' else None
            approved_ids = WorkspaceMembership.objects.filter(
                student=sp, status=WorkspaceMembership.STATUS_APPROVED
            ).values_list('workspace_id', flat=True) if sp else []
            invited_ids = WorkspaceMembership.objects.filter(
                student=sp, status=WorkspaceMembership.STATUS_INVITED
            ).values_list('workspace_id', flat=True) if sp else []
            visible_ids = set(list(approved_ids) + list(invited_ids))
            # For mentors: also include workspaces they're observing as guests
            if mp:
                guest_ids = set(WorkspaceMentor.objects.filter(mentor=mp).values_list('workspace_id', flat=True))
                visible_ids = visible_ids | guest_ids
            qs = qs.exclude(
                privacy__in=['private', 'secret']
            ) | Workspace.objects.filter(
                is_active=True,
                privacy__in=['private', 'secret'],
            ).filter(
                Q(mentor=mp) if mp else Q(pk__in=[]) | Q(pk__in=visible_ids)
            )
        return Response(WorkspaceSerializer(qs.distinct(), many=True, context={'request': request}).data)

    # POST
    if user.role != 'mentor':
        return Response({'detail': 'Only mentors can create workspaces.'}, status=status.HTTP_403_FORBIDDEN)
    mp = _mentor_profile(user)
    if not mp:
        return Response({'detail': 'Mentor profile not found.'}, status=status.HTTP_404_NOT_FOUND)
    name = request.data.get('name', '').strip()
    if not name:
        return Response({'detail': 'name is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Parse max_members
    max_members = request.data.get('max_members') or None
    if max_members:
        try:
            max_members = int(max_members)
        except (ValueError, TypeError):
            max_members = None

    # Parse target_deadline
    target_deadline = request.data.get('target_deadline') or None

    # Related workspace
    related_id = request.data.get('related_workspace') or None
    related_workspace = None
    if related_id:
        try:
            related_workspace = Workspace.objects.get(pk=int(related_id))
        except (Workspace.DoesNotExist, ValueError):
            pass

    try:
        workspace = Workspace.objects.create(
        mentor=mp,
        name=name,
        slug=_make_workspace_slug(name),
        accent_color=request.data.get('accent_color', 'blue'),
        logo=request.FILES.get('logo') or None,
        description=request.data.get('description', ''),
        cover_image=request.FILES.get('cover_image') or None,
        icon_emoji=request.data.get('icon_emoji', ''),
        tags=request.data.get('tags', ''),
        category=request.data.get('category', ''),
        level=request.data.get('level', ''),
        language=request.data.get('language', ''),
        target_country=request.data.get('target_country', ''),
        target_degree=request.data.get('target_degree', ''),
        target_deadline=target_deadline,
        estimated_duration=request.data.get('estimated_duration', ''),
        office_hours=request.data.get('office_hours', ''),
        privacy=request.data.get('privacy', 'public'),
        max_members=max_members,
        auto_accept=str(request.data.get('auto_accept', 'false')).lower() == 'true',
        invite_token=get_random_string(32),
        goal=request.data.get('goal', ''),
        welcome_message=request.data.get('welcome_message', ''),
        pinned_url=request.data.get('pinned_url', '') or '',
        pinned_url_title=request.data.get('pinned_url_title', ''),
        syllabus_url=request.data.get('syllabus_url', '') or '',
        workspace_status=request.data.get('workspace_status', 'active'),
        related_workspace=related_workspace,
    )
    except Exception as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(WorkspaceSerializer(workspace, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def workspace_detail(request, pk):
    """Return workspace info. Mentor owner can PATCH or DELETE."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    mp = _mentor_profile(request.user)
    is_owner = mp and workspace.mentor == mp

    if request.method == 'DELETE':
        if not is_owner:
            return Response({'detail': 'Forbidden.'}, status=403)
        workspace.is_active = False
        workspace.save(update_fields=['is_active'])
        return Response(status=204)

    if request.method == 'PATCH':
        if not is_owner:
            return Response({'detail': 'Forbidden.'}, status=403)
        updatable = [
            'announcement', 'name', 'description', 'icon_emoji', 'tags',
            'category', 'level', 'language', 'target_country', 'target_degree', 'target_deadline',
            'estimated_duration', 'course_start_date', 'course_end_date', 'enrollment_deadline',
            'office_hours', 'privacy', 'auto_accept', 'goal', 'welcome_message',
            'pinned_url', 'pinned_url_title', 'syllabus_url', 'workspace_status', 'accent_color',
            'grade_display', 'min_completion_pct',
            'event_title', 'event_description', 'event_link',
        ]
        # Date/time event fields require None instead of '' for null=True fields
        nullable_fields = ['event_date', 'event_start_time', 'event_end_time']
        for field in nullable_fields:
            if field in request.data:
                val = request.data[field]
                setattr(workspace, field, val if val else None)
        for field in updatable:
            val = request.data.get(field, None)
            if val is not None:
                setattr(workspace, field, val)
        # Boolean fields (must handle 'false' string from FormData)
        bool_fields = [
            'auto_accept', 'allow_self_unenroll',
            'enable_chat', 'enable_resources', 'enable_tasks', 'enable_progress',
            'completion_certificate',
        ]
        for field in bool_fields:
            if field in request.data:
                val = request.data[field]
                setattr(workspace, field, val in (True, 'true', 'True', '1', 1))
        # Handle slug update (with uniqueness check)
        new_slug = request.data.get('slug', None)
        if new_slug:
            new_slug = slugify(new_slug)[:120]
            if new_slug and not Workspace.objects.filter(slug=new_slug).exclude(pk=workspace.pk).exists():
                workspace.slug = new_slug
        max_members = request.data.get('max_members', None)
        if max_members is not None:
            workspace.max_members = int(max_members) if max_members else None
        if 'cover_image' in request.FILES:
            workspace.cover_image = request.FILES['cover_image']
        if 'logo' in request.FILES:
            workspace.logo = request.FILES['logo']
        related_id = request.data.get('related_workspace', None)
        if related_id is not None:
            workspace.related_workspace = Workspace.objects.filter(pk=related_id).first() if related_id else None
        workspace.save()
    return Response(WorkspaceSerializer(workspace, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def workspace_by_slug(request, slug):
    ws = get_object_or_404(Workspace, slug=slug, is_active=True)
    # Private workspaces: 404 for non-members
    if ws.privacy == 'private' and request.user.role != 'superadmin':
        mp = _mentor_profile(request.user)
        sp = _student_profile(request.user)
        is_owner = mp and ws.mentor == mp
        is_member = sp and WorkspaceMembership.objects.filter(
            workspace=ws, student=sp, status__in=[WorkspaceMembership.STATUS_APPROVED, WorkspaceMembership.STATUS_INVITED]
        ).exists()
        is_mentor = mp and WorkspaceMentor.objects.filter(workspace=ws, mentor=mp).exists()
        if not is_owner and not is_member and not is_mentor:
            return Response(status=404)
    return Response(WorkspaceSerializer(ws, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def workspace_join_invite(request):
    """Join a workspace via invite token. Body: {token: '...'}"""
    user = request.user
    if user.role != 'student':
        return Response({'detail': 'Only students can join workspaces.'}, status=403)
    token = request.data.get('token', '').strip()
    if not token:
        return Response({'detail': 'token is required.'}, status=400)
    workspace = get_object_or_404(Workspace, invite_token=token, is_active=True)
    sp = _student_profile(user)
    if not sp:
        return Response({'detail': 'Student profile not found.'}, status=404)
    if workspace.max_members:
        current = workspace.memberships.filter(status='approved').count()
        if current >= workspace.max_members:
            return Response({'detail': 'Workspace is full.'}, status=400)
    join_status = WorkspaceMembership.STATUS_APPROVED if workspace.auto_accept else WorkspaceMembership.STATUS_PENDING
    membership, created = WorkspaceMembership.objects.get_or_create(
        workspace=workspace, student=sp,
        defaults={'status': join_status}
    )
    if not created:
        return Response({'detail': f'Already {membership.status}.'}, status=400)
    return Response(WorkspaceSerializer(workspace, context={'request': request}).data, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def workspace_join(request, pk):
    """Student requests to join a workspace."""
    user = request.user
    if user.role != 'student':
        return Response({'detail': 'Only students can request to join.'}, status=status.HTTP_403_FORBIDDEN)
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    if workspace.privacy == 'private' or workspace.privacy == 'secret':
        return Response({'detail': 'This workspace requires an invite link to join.'}, status=403)
    sp = _student_profile(user)
    if not sp:
        return Response({'detail': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)
    if workspace.max_members:
        current = workspace.memberships.filter(status='approved').count()
        if current >= workspace.max_members:
            return Response({'detail': 'Workspace is full.'}, status=400)
    join_status = WorkspaceMembership.STATUS_APPROVED if workspace.auto_accept else WorkspaceMembership.STATUS_PENDING
    membership, created = WorkspaceMembership.objects.get_or_create(
        workspace=workspace, student=sp,
        defaults={'status': join_status}
    )
    if not created:
        if membership.status == WorkspaceMembership.STATUS_REJECTED:
            # Allow re-requesting after rejection
            membership.status = join_status
            membership.save()
            msg = 'Joined workspace.' if workspace.auto_accept else 'Join request sent.'
            return Response({'detail': msg}, status=status.HTTP_200_OK)
        return Response({'detail': f'Already {membership.status}.'}, status=status.HTTP_400_BAD_REQUEST)
    msg = 'Joined workspace.' if workspace.auto_accept else 'Join request sent.'
    return Response({'detail': msg}, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def workspace_join_cancel(request, pk):
    """Student cancels their own pending join request."""
    user = request.user
    if user.role != 'student':
        return Response({'detail': 'Only students can cancel requests.'}, status=status.HTTP_403_FORBIDDEN)
    workspace = get_object_or_404(Workspace, pk=pk)
    sp = _student_profile(user)
    if not sp:
        return Response({'detail': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)
    deleted, _ = WorkspaceMembership.objects.filter(
        workspace=workspace, student=sp, status=WorkspaceMembership.STATUS_PENDING
    ).delete()
    if not deleted:
        return Response({'detail': 'No pending request found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def workspace_leave(request, pk):
    """Student leaves a workspace they are an approved member of."""
    user = request.user
    if user.role != 'student':
        return Response({'detail': 'Only students can leave workspaces.'}, status=status.HTTP_403_FORBIDDEN)
    workspace = get_object_or_404(Workspace, pk=pk)
    sp = _student_profile(user)
    if not sp:
        return Response({'detail': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)
    deleted, _ = WorkspaceMembership.objects.filter(
        workspace=workspace, student=sp, status=WorkspaceMembership.STATUS_APPROVED
    ).delete()
    if not deleted:
        return Response({'detail': 'Not a member of this workspace.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def workspace_members(request, pk):
    """Return approved members + pending requests + invited (pending/invited only shown to the mentor owner)."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    if not _is_workspace_member(workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    approved = workspace.memberships.filter(status='approved').select_related('student__user')
    pending  = []
    invited  = []
    if request.user.role == 'mentor':
        mp = _mentor_profile(request.user)
        if mp and workspace.mentor == mp:
            pending = workspace.memberships.filter(status='pending').select_related('student__user')
            invited = workspace.memberships.filter(status='invited').select_related('student__user')

    return Response({
        'approved': WorkspaceMembershipSerializer(approved, many=True, context={'request': request}).data,
        'pending':  WorkspaceMembershipSerializer(pending,  many=True, context={'request': request}).data,
        'invited':  WorkspaceMembershipSerializer(invited,  many=True, context={'request': request}).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def workspace_membership_action(request, pk, mid):
    """Mentor approves, rejects, or removes a membership. Body: {action: 'approve'|'reject'|'remove'}"""
    workspace = get_object_or_404(Workspace, pk=pk)
    mp = _mentor_profile(request.user)
    if not mp or workspace.mentor != mp:
        return Response({'detail': 'Only the workspace mentor can do this.'}, status=status.HTTP_403_FORBIDDEN)
    membership = get_object_or_404(WorkspaceMembership, pk=mid, workspace=workspace)
    action = request.data.get('action')
    if action == 'approve':
        from django.utils import timezone
        membership.status = WorkspaceMembership.STATUS_APPROVED
        membership.approved_at = timezone.now()
        membership.save()
        # Backfill submissions for all published tasks the new member is eligible for
        sp = membership.student
        eligible_tasks = WorkspaceTask.objects.filter(
            workspace=workspace, status=WorkspaceTask.STATUS_PUBLISHED, is_template=False,
        ).filter(Q(assigned_members__isnull=True) | Q(assigned_members=sp))
        existing_ids = set(
            WorkspaceTaskSubmission.objects.filter(task__in=eligible_tasks, student=sp).values_list('task_id', flat=True)
        )
        backfill = [
            WorkspaceTaskSubmission(task=t, student=sp)
            for t in eligible_tasks if t.id not in existing_ids
        ]
        if backfill:
            WorkspaceTaskSubmission.objects.bulk_create(backfill, ignore_conflicts=True)
    elif action == 'reject':
        membership.status = WorkspaceMembership.STATUS_REJECTED
        membership.save()
    elif action == 'remove':
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    else:
        return Response({'detail': 'action must be "approve", "reject", or "remove".'}, status=status.HTTP_400_BAD_REQUEST)
    return Response(WorkspaceMembershipSerializer(membership, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def workspace_members_bulk(request, pk):
    """Bulk approve or reject pending memberships. Body: {action: 'approve'|'reject', ids: [...]}"""
    workspace = get_object_or_404(Workspace, pk=pk)
    mp = _mentor_profile(request.user)
    if not mp or workspace.mentor != mp:
        return Response({'detail': 'Only the workspace mentor can do this.'}, status=status.HTTP_403_FORBIDDEN)
    action = request.data.get('action')
    ids = request.data.get('ids', [])
    if action not in ('approve', 'reject'):
        return Response({'detail': 'action must be "approve" or "reject".'}, status=status.HTTP_400_BAD_REQUEST)
    memberships = WorkspaceMembership.objects.filter(pk__in=ids, workspace=workspace, status=WorkspaceMembership.STATUS_PENDING)
    count = memberships.count()
    if action == 'approve':
        from django.utils import timezone
        now = timezone.now()
        # Capture student profiles before update so we can backfill
        students_to_backfill = list(memberships.select_related('student').values_list('student', flat=True))
        memberships.update(status=WorkspaceMembership.STATUS_APPROVED, approved_at=now)
        # Backfill submissions for each newly approved member
        published_tasks = list(WorkspaceTask.objects.filter(
            workspace=workspace, status=WorkspaceTask.STATUS_PUBLISHED, is_template=False,
        ).prefetch_related('assigned_members'))
        from .models import StudentProfile
        for student_id in students_to_backfill:
            sp = StudentProfile.objects.get(pk=student_id)
            eligible = [
                t for t in published_tasks
                if not t.assigned_members.exists() or t.assigned_members.filter(pk=sp.pk).exists()
            ]
            existing_ids = set(
                WorkspaceTaskSubmission.objects.filter(task__in=eligible, student=sp).values_list('task_id', flat=True)
            )
            backfill = [WorkspaceTaskSubmission(task=t, student=sp) for t in eligible if t.id not in existing_ids]
            if backfill:
                WorkspaceTaskSubmission.objects.bulk_create(backfill, ignore_conflicts=True)
    else:
        memberships.update(status=WorkspaceMembership.STATUS_REJECTED)
    return Response({'updated': count})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def workspace_resources(request, pk):
    """GET: list resources (all members). POST: mentor adds a resource."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    if not _is_workspace_member(workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        qs = workspace.resources.all()
        if request.user.role == 'student':
            qs = qs.filter(is_hidden=False)
        return Response(WorkspaceResourceSerializer(qs, many=True, context={'request': request}).data)

    # POST — coordinator or active mentor
    if not _is_workspace_write_mentor(workspace, request.user):
        return Response({'detail': 'Only workspace mentors can add resources.'}, status=status.HTTP_403_FORBIDDEN)

    rtype = request.data.get('resource_type', '')
    title = request.data.get('title', '').strip()
    if not title:
        return Response({'detail': 'title is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if rtype not in (WorkspaceResource.TYPE_FILE, WorkspaceResource.TYPE_LINK, WorkspaceResource.TYPE_NOTE):
        return Response({'detail': 'resource_type must be file, link, or note.'}, status=status.HTTP_400_BAD_REQUEST)

    resource = WorkspaceResource(
        workspace=workspace,
        title=title,
        description=request.data.get('description', ''),
        resource_type=rtype,
        category=request.data.get('category', 'other'),
        url=request.data.get('url', ''),
        body=request.data.get('body', ''),
        posted_by=request.user,
        is_featured=str(request.data.get('is_featured', 'false')).lower() in ('true', '1'),
    )
    if rtype == WorkspaceResource.TYPE_FILE:
        f = request.FILES.get('file')
        if not f:
            return Response({'detail': 'file is required for type "file".'}, status=status.HTTP_400_BAD_REQUEST)
        if f.size > 52_428_800:
            return Response({'detail': 'File size must not exceed 50 MB.'}, status=status.HTTP_400_BAD_REQUEST)
        resource.file = f
    resource.save()
    return Response(WorkspaceResourceSerializer(resource, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def workspace_resource_delete(request, pk, rid):
    """Coordinator or active mentor edits (PATCH) or deletes (DELETE) a resource."""
    workspace = get_object_or_404(Workspace, pk=pk)
    if not _is_workspace_write_mentor(workspace, request.user):
        return Response({'detail': 'Only workspace mentors can modify resources.'}, status=status.HTTP_403_FORBIDDEN)
    resource = get_object_or_404(WorkspaceResource, pk=rid, workspace=workspace)

    is_coordinator = (workspace.mentor == _mentor_profile(request.user))
    if not is_coordinator and resource.posted_by != request.user:
        return Response({'detail': 'You can only modify your own resources.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        if resource.file and resource.file.storage.exists(resource.file.name):
            resource.file.delete(save=False)
        resource.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH — update editable fields
    for field in ('title', 'description', 'url', 'body', 'category'):
        if field in request.data:
            setattr(resource, field, request.data[field])
    if 'is_hidden' in request.data:
        val = request.data['is_hidden']
        resource.is_hidden = val in (True, 'true', 'True', '1', 1)
    if 'is_template' in request.data:
        val = request.data['is_template']
        resource.is_template = val in (True, 'true', 'True', '1', 1)
    if 'is_featured' in request.data:
        val = request.data['is_featured']
        resource.is_featured = val in (True, 'true', 'True', '1', 1)
    resource.save()
    return Response(WorkspaceResourceSerializer(resource, context={'request': request}).data)




# ═══════════════════════════════════════════════════════════════════════════════
# Workspace Task System (new)
# ═══════════════════════════════════════════════════════════════════════════════

from .models import (
    WorkspaceTask, WorkspaceTaskDeliverable, WorkspaceTaskSubmission,
    WorkspaceTaskDeliverableCheck, WorkspaceTaskComment, WorkspaceTaskDocument,
    WorkspaceTaskPrerequisite, WorkspaceTaskMentorNote, WorkspaceTaskStatusEvent,
    WorkspaceTaskSection, WorkspaceTaskRubricCriteria, WorkspaceTaskRubricScore,
    WorkspaceTaskPeerReview, WorkspaceTaskPeerReviewScore,
    DocumentInlineComment,
    WorkspaceTaskSelfAssessQuestion, WorkspaceTaskSelfAssessResponse,
)
from .serializers import (
    WorkspaceTaskSerializer, WorkspaceTaskSubmissionSerializer,
    WorkspaceTaskSubmissionSummarySerializer, WorkspaceTaskCommentSerializer,
    WorkspaceTaskDocumentSerializer, WorkspaceTaskMentorNoteSerializer,
    WorkspaceTaskSectionSerializer, WorkspaceTaskRubricCriteriaSerializer,
    WorkspaceTaskRubricScoreSerializer,
    WorkspaceTaskPeerReviewSerializer, WorkspaceTaskPeerReviewScoreSerializer,
    DocumentInlineCommentSerializer,
    WorkspaceTaskSelfAssessQuestionSerializer, WorkspaceTaskSelfAssessResponseSerializer,
)
import csv
from django.http import HttpResponse
from django.utils import timezone
import random
import re


def _ws_task_guard(workspace, user):
    """Return (is_mentor, student_profile_or_None). 403 if not a member."""
    if user.role == 'mentor':
        mp = _mentor_profile(user)
        if mp and workspace.mentor == mp:
            return True, None
        # Observer mentors get mentor-level read access
        if mp and WorkspaceMentor.objects.filter(workspace=workspace, mentor=mp, status=WorkspaceMentor.STATUS_ACTIVE).exists():
            return True, None
        return None, None  # mentor of a different workspace
    sp = _student_profile(user)
    if sp and WorkspaceMembership.objects.filter(workspace=workspace, student=sp, status='approved').exists():
        return False, sp
    return None, None  # not a member


def _mentor_can_access_task(task, workspace, user):
    """True if user is the workspace coordinator OR created this task."""
    mp = _mentor_profile(user)
    if mp and workspace.mentor == mp:
        return True
    return task.created_by_id is not None and task.created_by_id == user.id


def _is_task_locked(task, student_profile):
    """Returns True if the student has not yet completed all prerequisite tasks."""
    prereq_ids = list(task.prerequisites.values_list('required_task_id', flat=True))
    if not prereq_ids:
        return False
    completed_ids = set(WorkspaceTaskSubmission.objects.filter(
        task_id__in=prereq_ids,
        student=student_profile,
        status=WorkspaceTaskSubmission.STATUS_COMPLETED,
    ).values_list('task_id', flat=True))
    return set(prereq_ids) != completed_ids


def _create_submission_checks(submission):
    """Auto-create a check row for every deliverable on the task."""
    deliverables = submission.task.deliverables.all()
    WorkspaceTaskDeliverableCheck.objects.bulk_create([
        WorkspaceTaskDeliverableCheck(submission=submission, deliverable=d)
        for d in deliverables
    ], ignore_conflicts=True)


def _notify_task_assigned(task, student_profile):
    Notification.objects.create(
        recipient=student_profile.user,
        notif_type='task_reminder',
        title=f'New task assigned: {task.title}',
        body=f'You have been assigned a new {task.task_type} in {task.workspace.name}.',
        link=f'/w/{task.workspace.slug}/tasks/{task.id}',
    )


def _notify_task_submitted(task, submission):
    Notification.objects.create(
        recipient=task.workspace.mentor.user,
        notif_type='step_submitted',
        title=f'{submission.student.user.username} submitted "{task.title}"',
        body=f'A submission is ready for your review in {task.workspace.name}.',
        link=f'/w/{task.workspace.slug}/tasks/{task.id}',
    )


def _notify_task_reviewed(task, submission):
    label = 'Completed' if submission.status == 'completed' else 'Needs Revision'
    Notification.objects.create(
        recipient=submission.student.user,
        notif_type='step_reviewed',
        title=f'Your submission for "{task.title}" was reviewed',
        body=f'Status: {label}',
        link=f'/w/{task.workspace.slug}/tasks/{task.id}',
    )


def _record_status_event(submission, from_status, to_status, actor, note=''):
    WorkspaceTaskStatusEvent.objects.create(
        submission=submission,
        from_status=from_status,
        to_status=to_status,
        actor=actor,
        note=note,
    )


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def ws_tasks_list(request, pk):
    """
    GET  — list tasks in workspace.
           Mentor: all tasks (draft + published + archived).
           Student: published tasks assigned to them only.
    POST — mentor creates a new task (starts as draft).
           Body: title, description, task_type, due_date, peer_visible,
                 deliverables: [{title, description, order}],
                 assign_to: 'all' | list of student profile IDs
    """
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        if is_mentor:
            is_coordinator = (workspace.mentor == _mentor_profile(request.user))
            qs = WorkspaceTask.objects.filter(workspace=workspace, is_template=False).prefetch_related('deliverables', 'submissions', 'prerequisites', 'assigned_members', 'rubric_criteria')
            if not is_coordinator:
                qs = qs.filter(created_by=request.user)
        else:
            now = timezone.now()
            # Tasks visible to this student: published + (assigned to all OR assigned to them)
            qs = WorkspaceTask.objects.filter(
                workspace=workspace, status='published', is_template=False,
            ).filter(
                Q(assigned_members__isnull=True) | Q(assigned_members=sp)
            ).filter(
                Q(available_from__isnull=True) | Q(available_from__lte=now)
            ).filter(
                Q(available_until__isnull=True) | Q(available_until__gte=now)
            ).prefetch_related('deliverables', 'submissions', 'prerequisites', 'assigned_members', 'rubric_criteria').distinct()
            # Auto-create missing submission records so new members can work on existing tasks
            existing_task_ids = set(
                WorkspaceTaskSubmission.objects.filter(task__in=qs, student=sp).values_list('task_id', flat=True)
            )
            new_subs = [
                WorkspaceTaskSubmission(task=task, student=sp)
                for task in qs if task.id not in existing_task_ids
            ]
            if new_subs:
                WorkspaceTaskSubmission.objects.bulk_create(new_subs, ignore_conflicts=True)
        tasks_data = WorkspaceTaskSerializer(qs, many=True, context={'request': request}).data
        # Annotate is_locked + my_submission_status for students
        if not is_mentor:
            task_map = {t.id: t for t in qs}
            # Fetch all submissions for this student in one query
            sub_map = {
                s.task_id: s
                for s in WorkspaceTaskSubmission.objects.filter(task__in=qs, student=sp)
            }
            for td in tasks_data:
                task_obj = task_map.get(td['id'])
                td['is_locked'] = _is_task_locked(task_obj, sp) if task_obj else False
                sub = sub_map.get(td['id'])
                td['my_submission_status'] = sub.status if sub else None
        return Response(tasks_data)

    # POST — mentor only
    if not is_mentor:
        return Response({'detail': 'Only the workspace mentor can create tasks.'}, status=status.HTTP_403_FORBIDDEN)

    title = request.data.get('title', '').strip()
    if not title:
        return Response({'detail': 'title is required.'}, status=status.HTTP_400_BAD_REQUEST)

    section_id = request.data.get('section')
    section = WorkspaceTaskSection.objects.filter(pk=section_id, workspace=workspace).first() if section_id else None

    task = WorkspaceTask.objects.create(
        workspace=workspace,
        title=title,
        description=request.data.get('description', ''),
        task_type=request.data.get('task_type', WorkspaceTask.TYPE_ASSIGNMENT),
        due_date=request.data.get('due_date') or None,
        available_from=request.data.get('available_from') or None,
        available_until=request.data.get('available_until') or None,
        peer_visible=request.data.get('peer_visible', False),
        peer_review_enabled=request.data.get('peer_review_enabled', False),
        peer_review_count=max(1, min(2, int(request.data.get('peer_review_count', 1)))),
        late_policy=request.data.get('late_policy', WorkspaceTask.LATE_ACCEPT),
        grace_period_hours=max(0, int(request.data.get('grace_period_hours', 0))),
        section=section,
        created_by=request.user,
    )

    for d in request.data.get('deliverables', []):
        WorkspaceTaskDeliverable.objects.create(
            task=task,
            title=d.get('title', '').strip(),
            description=d.get('description', ''),
            order=d.get('order', 0),
        )

    for c in request.data.get('rubric_criteria', []):
        WorkspaceTaskRubricCriteria.objects.create(
            task=task,
            title=c.get('title', '').strip(),
            description=c.get('description', ''),
            max_points=c.get('max_points', 10),
            order=c.get('order', 0),
        )

    # Feature 20: self-assessment questions (max 3)
    questions_data = request.data.get('self_assess_questions', [])[:3]
    for q in questions_data:
        if q.get('text', '').strip():
            WorkspaceTaskSelfAssessQuestion.objects.create(
                task=task, text=q['text'].strip(), order=q.get('order', 0)
            )

    # Pre-select assigned members (stored for publish-time use)
    member_ids = request.data.get('assigned_member_ids', [])
    if member_ids and member_ids != 'all':
        members = StudentProfile.objects.filter(
            id__in=member_ids,
            workspace_memberships__workspace=workspace,
            workspace_memberships__status='approved',
        )
        task.assigned_members.set(members)

    return Response(WorkspaceTaskSerializer(task, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def ws_task_detail(request, pk, tid):
    """
    GET    — task detail (mentor: any status; student: published only if assigned).
    PATCH  — mentor edits title/description/type/due_date/peer_visible + deliverables.
    DELETE — mentor deletes the task and all submissions.
    """
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if is_mentor:
        task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    else:
        task = get_object_or_404(
            WorkspaceTask, pk=tid, workspace=workspace, status='published',
            submissions__student=sp,
        )

    if request.method == 'GET':
        if is_mentor and not _mentor_can_access_task(task, workspace, request.user):
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(WorkspaceTaskSerializer(task, context={'request': request}).data)

    if not is_mentor:
        return Response({'detail': 'Only the workspace mentor can modify tasks.'}, status=status.HTTP_403_FORBIDDEN)

    # Non-coordinator mentors can only edit/delete their own tasks
    is_coordinator = (workspace.mentor == _mentor_profile(request.user))
    if not is_coordinator and (task.created_by is None or task.created_by != request.user):
        return Response({'detail': 'You can only edit your own tasks.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH
    # Status transitions (archive / unarchive / revert to draft)
    if 'status' in request.data:
        new_status = request.data['status']
        allowed = ('draft', 'archived')
        if new_status not in allowed:
            return Response(
                {'detail': f'Status must be one of {allowed}. To publish use the /publish/ endpoint.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        task.status = new_status

    for field in ('title', 'description', 'task_type', 'due_date', 'available_from', 'available_until', 'peer_visible'):
        if field in request.data:
            setattr(task, field, request.data[field] or None if field in ('due_date', 'available_from', 'available_until') else request.data[field])

    # Section
    if 'section' in request.data:
        sid = request.data['section']
        task.section = WorkspaceTaskSection.objects.filter(pk=sid, workspace=workspace).first() if sid else None

    # Assigned members
    if 'assigned_member_ids' in request.data:
        raw = request.data['assigned_member_ids']
        if raw == 'all' or raw == []:
            task.assigned_members.clear()
        else:
            try:
                ids = [int(i) for i in raw]
            except (TypeError, ValueError):
                return Response({'detail': 'assigned_member_ids must be a list of IDs or empty.'}, status=status.HTTP_400_BAD_REQUEST)
            members = StudentProfile.objects.filter(
                id__in=ids,
                workspace_memberships__workspace=workspace,
                workspace_memberships__status='approved',
            )
            task.assigned_members.set(members)

    # Replace deliverables if provided
    if 'deliverables' in request.data:
        task.deliverables.all().delete()
        for d in request.data['deliverables']:
            WorkspaceTaskDeliverable.objects.create(
                task=task,
                title=d.get('title', '').strip(),
                description=d.get('description', ''),
                order=d.get('order', 0),
            )
        # Sync checks for existing submissions: add checks for new deliverables
        new_deliverables = task.deliverables.all()
        for sub in task.submissions.all():
            for d in new_deliverables:
                WorkspaceTaskDeliverableCheck.objects.get_or_create(submission=sub, deliverable=d)

    # Replace rubric criteria if provided
    if 'rubric_criteria' in request.data:
        task.rubric_criteria.all().delete()
        for c in request.data['rubric_criteria']:
            WorkspaceTaskRubricCriteria.objects.create(
                task=task,
                title=c.get('title', '').strip(),
                description=c.get('description', ''),
                max_points=c.get('max_points', 10),
                order=c.get('order', 0),
            )

    # Feature 16 & 17: update new task fields
    for field in ('peer_review_enabled', 'peer_review_count', 'late_policy', 'grace_period_hours'):
        if field in request.data:
            setattr(task, field, request.data[field])

    # Feature 20: replace self-assessment questions if provided
    if 'self_assess_questions' in request.data:
        task.self_assess_questions.all().delete()
        for q in request.data['self_assess_questions'][:3]:
            if q.get('text', '').strip():
                WorkspaceTaskSelfAssessQuestion.objects.create(
                    task=task, text=q['text'].strip(), order=q.get('order', 0)
                )

    # Replace prerequisites if provided
    if 'prerequisite_ids' in request.data:
        raw = request.data['prerequisite_ids']
        try:
            ids = [int(i) for i in raw]
        except (TypeError, ValueError):
            return Response({'detail': 'prerequisite_ids must be a list of task IDs.'}, status=status.HTTP_400_BAD_REQUEST)
        task.prerequisites.all().delete()
        for pid in ids:
            prereq_task = WorkspaceTask.objects.filter(pk=pid, workspace=workspace).first()
            if prereq_task and prereq_task.pk != task.pk:
                WorkspaceTaskPrerequisite.objects.get_or_create(task=task, required_task=prereq_task)

    task.save()
    return Response(WorkspaceTaskSerializer(task, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_publish(request, pk, tid):
    """Mentor publishes a draft task and assigns it to members."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Only the workspace mentor can publish tasks.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    if not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'You can only publish your own tasks.'}, status=status.HTTP_403_FORBIDDEN)
    if task.status == 'published':
        return Response({'detail': 'Task is already published.'}, status=status.HTTP_400_BAD_REQUEST)

    assign_to = request.data.get('assign_to', 'all')

    # Use pre-selected assigned_members if no explicit assign_to provided and M2M is set
    if assign_to == 'all' and task.assigned_members.exists():
        students = list(task.assigned_members.all())
    elif assign_to == 'all':
        members = workspace.memberships.filter(status='approved').select_related('student')
        students = [m.student for m in members]
    else:
        try:
            ids = [int(i) for i in assign_to]
        except (TypeError, ValueError):
            return Response({'detail': 'assign_to must be "all" or a list of student profile IDs.'}, status=status.HTTP_400_BAD_REQUEST)
        students = list(
            StudentProfile.objects.filter(
                id__in=ids,
                workspace_memberships__workspace=workspace,
                workspace_memberships__status='approved',
            )
        )
        task.assigned_members.set(students)

    if not students:
        return Response({'detail': 'No valid approved members to assign.'}, status=status.HTTP_400_BAD_REQUEST)

    task.status = WorkspaceTask.STATUS_PUBLISHED
    task.save()

    for student in students:
        sub, created = WorkspaceTaskSubmission.objects.get_or_create(task=task, student=student)
        if created:
            _create_submission_checks(sub)
            _notify_task_assigned(task, student)

    return Response(WorkspaceTaskSerializer(task, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_assign(request, pk, tid):
    """Mentor assigns an already-published task to additional members."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Only the workspace mentor can assign tasks.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace, status='published')
    if not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'You can only assign your own tasks.'}, status=status.HTTP_403_FORBIDDEN)

    assign_to = request.data.get('assign_to', [])
    if assign_to == 'all':
        members = workspace.memberships.filter(status='approved').select_related('student')
        students = [m.student for m in members]
    else:
        try:
            ids = [int(i) for i in assign_to]
        except (TypeError, ValueError):
            return Response({'detail': 'assign_to must be "all" or a list of student profile IDs.'}, status=status.HTTP_400_BAD_REQUEST)
        students = list(
            StudentProfile.objects.filter(
                id__in=ids,
                workspace_memberships__workspace=workspace,
                workspace_memberships__status='approved',
            )
        )

    added = 0
    for student in students:
        sub, created = WorkspaceTaskSubmission.objects.get_or_create(task=task, student=student)
        if created:
            _create_submission_checks(sub)
            _notify_task_assigned(task, student)
            added += 1

    return Response({'assigned': added}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ws_task_submissions(request, pk, tid):
    """
    Mentor-only: list all submissions for a task with summary stats.
    Query params: status=<status> for filtering.
    """
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    if not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    qs = task.submissions.select_related('student__user').prefetch_related('checks')

    filter_status = request.query_params.get('status')
    if filter_status:
        qs = qs.filter(status=filter_status)

    serializer = WorkspaceTaskSubmissionSummarySerializer(qs, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def ws_task_submission_detail(request, pk, tid, sid):
    """
    GET  — full submission detail (mentor sees any; student sees own if peer_visible or it's theirs).
    PATCH — mentor sets status to 'completed' or 'needs_revision'.
    """
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    submission = get_object_or_404(WorkspaceTaskSubmission, pk=sid, task=task)

    if is_mentor and not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if not is_mentor:
        # Student can only see their own submission unless peer_visible is on
        is_own = submission.student == sp
        peer_ok = task.peer_visible and submission.status == 'completed'
        if not is_own and not peer_ok:
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        if is_mentor:
            request._is_mentor_context = True
        return Response(WorkspaceTaskSubmissionSerializer(submission, context={'request': request}).data)

    if not is_mentor:
        return Response({'detail': 'Only the mentor can review submissions.'}, status=status.HTTP_403_FORBIDDEN)

    # Handle due_date_override separately from status review
    if 'due_date_override' in request.data:
        raw = request.data['due_date_override']
        submission.due_date_override = raw or None
        submission.save(update_fields=['due_date_override'])
        if 'status' not in request.data:
            request._is_mentor_context = True
            return Response(WorkspaceTaskSubmissionSerializer(submission, context={'request': request}).data)

    if 'status' in request.data:
        new_status = request.data.get('status')
        allowed = (WorkspaceTaskSubmission.STATUS_COMPLETED, WorkspaceTaskSubmission.STATUS_NEEDS_REVISION)
        if new_status not in allowed:
            return Response({'detail': f'status must be one of {allowed}.'}, status=status.HTTP_400_BAD_REQUEST)

        prev_status = submission.status
        submission.status = new_status
        if new_status == WorkspaceTaskSubmission.STATUS_COMPLETED:
            submission.completed_at = timezone.now()
        submission.save()
        _record_status_event(submission, prev_status, new_status, request.user)
        _notify_task_reviewed(task, submission)

    request._is_mentor_context = True
    return Response(WorkspaceTaskSubmissionSerializer(submission, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ws_task_my_submission(request, pk, tid):
    """Student fetches their own submission (full detail)."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None or is_mentor:
        return Response({'detail': 'Only students have submissions.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace, status='published')
    submission = get_object_or_404(WorkspaceTaskSubmission, task=task, student=sp)
    return Response(WorkspaceTaskSubmissionSerializer(submission, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_my_submit(request, pk, tid):
    """Student hands in their submission (not_started/in_progress/needs_revision → submitted)."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None or is_mentor:
        return Response({'detail': 'Only students can submit.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace, status='published')
    submission = get_object_or_404(WorkspaceTaskSubmission, task=task, student=sp)

    if _is_task_locked(task, sp):
        return Response({'detail': 'This task is locked until prerequisites are completed.'}, status=status.HTTP_403_FORBIDDEN)

    submittable = (
        WorkspaceTaskSubmission.STATUS_NOT_STARTED,
        WorkspaceTaskSubmission.STATUS_IN_PROGRESS,
        WorkspaceTaskSubmission.STATUS_NEEDS_REVISION,
    )
    if submission.status not in submittable:
        return Response({'detail': 'Cannot submit from current status.'}, status=status.HTTP_400_BAD_REQUEST)

    prev_status = submission.status
    note = request.data.get('note', '').strip() if isinstance(request.data, dict) else ''

    # Feature 17: late policy check
    effective_due = submission.effective_due_date
    is_late = False
    if effective_due:
        from datetime import datetime as _dt
        grace = timedelta(hours=task.grace_period_hours)
        deadline = _dt.combine(effective_due, _dt.max.time()).replace(tzinfo=timezone.now().tzinfo) + grace
        is_late = timezone.now() > deadline
    if is_late and task.late_policy == WorkspaceTask.LATE_REJECT:
        return Response({'detail': 'Late submissions are not accepted for this task.'}, status=status.HTTP_403_FORBIDDEN)

    # Feature 20: self-assessment requirement
    questions = list(task.self_assess_questions.all())
    if questions:
        responses = request.data.get('self_assess_responses', []) if isinstance(request.data, dict) else []
        if not responses:
            return Response({'detail': 'self_assess_responses required before submitting.'}, status=status.HTTP_400_BAD_REQUEST)
        q_ids = {q.id for q in questions}
        answered = {r.get('question_id') for r in responses if isinstance(r, dict)}
        if not q_ids.issubset(answered):
            return Response({'detail': 'All self-assessment questions must be answered.'}, status=status.HTTP_400_BAD_REQUEST)

    submission.status = WorkspaceTaskSubmission.STATUS_SUBMITTED
    submission.submitted_at = timezone.now()
    submission.is_late = is_late
    submission.save()
    _record_status_event(submission, prev_status, WorkspaceTaskSubmission.STATUS_SUBMITTED, request.user, note)
    _notify_task_submitted(task, submission)

    # Save self-assessment responses
    if questions and isinstance(request.data, dict):
        for r in request.data.get('self_assess_responses', []):
            qid = r.get('question_id')
            rating = r.get('rating')
            if qid and rating and 1 <= int(rating) <= 5:
                q_obj = next((q for q in questions if q.id == int(qid)), None)
                if q_obj:
                    WorkspaceTaskSelfAssessResponse.objects.update_or_create(
                        submission=submission, question=q_obj,
                        defaults={'rating': int(rating)},
                    )

    return Response(WorkspaceTaskSubmissionSerializer(submission, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_my_resubmit(request, pk, tid):
    """Student resubmits after needs_revision."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None or is_mentor:
        return Response({'detail': 'Only students can resubmit.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace, status='published')
    submission = get_object_or_404(WorkspaceTaskSubmission, task=task, student=sp)

    if _is_task_locked(task, sp):
        return Response({'detail': 'This task is locked until prerequisites are completed.'}, status=status.HTTP_403_FORBIDDEN)

    if submission.status != WorkspaceTaskSubmission.STATUS_NEEDS_REVISION:
        return Response({'detail': 'Resubmit only allowed when status is needs_revision.'}, status=status.HTTP_400_BAD_REQUEST)

    note = request.data.get('note', '').strip() if isinstance(request.data, dict) else ''

    # Feature 17: late check on resubmit
    effective_due = submission.effective_due_date
    is_late = False
    if effective_due:
        from datetime import datetime as _dt
        grace = timedelta(hours=task.grace_period_hours)
        deadline = _dt.combine(effective_due, _dt.max.time()).replace(tzinfo=timezone.now().tzinfo) + grace
        is_late = timezone.now() > deadline

    # Feature 20: update self-assessment if answers provided
    if isinstance(request.data, dict) and request.data.get('self_assess_responses'):
        questions = list(task.self_assess_questions.all())
        for r in request.data['self_assess_responses']:
            qid = r.get('question_id')
            rating = r.get('rating')
            if qid and rating and 1 <= int(rating) <= 5:
                q_obj = next((q for q in questions if q.id == int(qid)), None)
                if q_obj:
                    WorkspaceTaskSelfAssessResponse.objects.update_or_create(
                        submission=submission, question=q_obj,
                        defaults={'rating': int(rating)},
                    )

    submission.status = WorkspaceTaskSubmission.STATUS_RESUBMITTED
    submission.submitted_at = timezone.now()
    submission.is_late = is_late
    submission.save()
    _record_status_event(submission, WorkspaceTaskSubmission.STATUS_NEEDS_REVISION, WorkspaceTaskSubmission.STATUS_RESUBMITTED, request.user, note)
    _notify_task_submitted(task, submission)
    return Response(WorkspaceTaskSubmissionSerializer(submission, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_start(request, pk, tid):
    """Student marks their submission as in_progress."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None or is_mentor:
        return Response({'detail': 'Only students can update submission status.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace, status='published')
    submission = get_object_or_404(WorkspaceTaskSubmission, task=task, student=sp)

    if _is_task_locked(task, sp):
        return Response({'detail': 'This task is locked until prerequisites are completed.'}, status=status.HTTP_403_FORBIDDEN)

    if submission.status != WorkspaceTaskSubmission.STATUS_NOT_STARTED:
        return Response({'detail': 'Already started.'}, status=status.HTTP_400_BAD_REQUEST)

    submission.status = WorkspaceTaskSubmission.STATUS_IN_PROGRESS
    submission.save()
    return Response(WorkspaceTaskSubmissionSerializer(submission, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_my_recall(request, pk, tid):
    """Student recalls a submitted/resubmitted submission back to in_progress."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None or is_mentor:
        return Response({'detail': 'Only students can recall submissions.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace, status='published')
    submission = get_object_or_404(WorkspaceTaskSubmission, task=task, student=sp)

    recallable = (
        WorkspaceTaskSubmission.STATUS_SUBMITTED,
        WorkspaceTaskSubmission.STATUS_RESUBMITTED,
    )
    if submission.status not in recallable:
        return Response({'detail': 'Only submitted or resubmitted work can be recalled.'}, status=status.HTTP_400_BAD_REQUEST)

    prev_status = submission.status
    submission.status = WorkspaceTaskSubmission.STATUS_IN_PROGRESS
    submission.submitted_at = None
    submission.save()
    _record_status_event(submission, prev_status, WorkspaceTaskSubmission.STATUS_IN_PROGRESS, request.user, 'Recalled by student')
    return Response(WorkspaceTaskSubmissionSerializer(submission, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_submission_reopen(request, pk, tid, sid):
    """Mentor reopens any submission back to in_progress so the student can rework it."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None or not is_mentor:
        return Response({'detail': 'Only the mentor can reopen submissions.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    submission = get_object_or_404(WorkspaceTaskSubmission, pk=sid, task=task)

    if not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if submission.status in (
        WorkspaceTaskSubmission.STATUS_NOT_STARTED,
        WorkspaceTaskSubmission.STATUS_IN_PROGRESS,
    ):
        return Response({'detail': 'Submission is already open.'}, status=status.HTTP_400_BAD_REQUEST)

    prev_status = submission.status
    submission.status = WorkspaceTaskSubmission.STATUS_IN_PROGRESS
    submission.completed_at = None
    submission.submitted_at = None
    submission.save()
    _record_status_event(submission, prev_status, WorkspaceTaskSubmission.STATUS_IN_PROGRESS, request.user, 'Reopened by mentor')
    return Response(WorkspaceTaskSubmissionSerializer(submission, context={'request': request, '_is_mentor_context': True}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_submission_undo_review(request, pk, tid, sid):
    """Mentor undoes their last review decision (completed/needs_revision → submitted)."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None or not is_mentor:
        return Response({'detail': 'Only the mentor can undo a review.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    submission = get_object_or_404(WorkspaceTaskSubmission, pk=sid, task=task)

    if not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    undoable = (
        WorkspaceTaskSubmission.STATUS_COMPLETED,
        WorkspaceTaskSubmission.STATUS_NEEDS_REVISION,
    )
    if submission.status not in undoable:
        return Response({'detail': 'Only completed or needs_revision submissions can have their review undone.'}, status=status.HTTP_400_BAD_REQUEST)

    prev_status = submission.status
    # Resubmitted → submitted when undoing needs_revision; completed → resubmitted/submitted
    last_event = submission.status_events.filter(
        to_status__in=['submitted', 'resubmitted']
    ).order_by('-created_at').first()
    restore_to = last_event.to_status if last_event else WorkspaceTaskSubmission.STATUS_SUBMITTED

    submission.status = restore_to
    if prev_status == WorkspaceTaskSubmission.STATUS_COMPLETED:
        submission.completed_at = None
    submission.save()
    _record_status_event(submission, prev_status, restore_to, request.user, 'Review undone by mentor')
    request._is_mentor_context = True
    return Response(WorkspaceTaskSubmissionSerializer(submission, context={'request': request}).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def ws_task_deliverable_check(request, pk, tid, did):
    """Student toggles a deliverable check on their submission."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None or is_mentor:
        return Response({'detail': 'Only students can check deliverables.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace, status='published')
    submission = get_object_or_404(WorkspaceTaskSubmission, task=task, student=sp)

    if _is_task_locked(task, sp):
        return Response({'detail': 'This task is locked until prerequisites are completed.'}, status=status.HTTP_403_FORBIDDEN)

    check = get_object_or_404(WorkspaceTaskDeliverableCheck, pk=did, submission=submission)

    check.is_done = not check.is_done
    check.done_at = timezone.now() if check.is_done else None
    check.save()

    # Auto-advance to in_progress when first check is ticked
    if check.is_done and submission.status == WorkspaceTaskSubmission.STATUS_NOT_STARTED:
        submission.status = WorkspaceTaskSubmission.STATUS_IN_PROGRESS
        submission.save()

    from .serializers import WorkspaceTaskDeliverableCheckSerializer
    return Response(WorkspaceTaskDeliverableCheckSerializer(check).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_submission_comments(request, pk, tid, sid):
    """Add a comment to a submission. Both mentor and student of that submission can comment."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    submission = get_object_or_404(WorkspaceTaskSubmission, pk=sid, task=task)

    if is_mentor and not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if not is_mentor and submission.student != sp:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    text = request.data.get('text', '').strip()
    if not text:
        return Response({'detail': 'text is required.'}, status=status.HTTP_400_BAD_REQUEST)

    comment = WorkspaceTaskComment.objects.create(submission=submission, author=request.user, text=text)

    # Feature 19: fire @mention notifications
    _process_task_mentions(text, request.user, workspace, f'/w/{workspace.slug}/tasks/{task.id}')

    return Response(WorkspaceTaskCommentSerializer(comment, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def ws_task_submission_documents(request, pk, tid, sid):
    """Upload a document to a submission. Both mentor and student can attach files."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    submission = get_object_or_404(WorkspaceTaskSubmission, pk=sid, task=task)

    if is_mentor and not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if not is_mentor and submission.student != sp:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    f = request.FILES.get('file')
    if not f:
        return Response({'detail': 'file is required.'}, status=status.HTTP_400_BAD_REQUEST)

    title = request.data.get('title', f.name).strip() or f.name
    doc = WorkspaceTaskDocument.objects.create(submission=submission, uploaded_by=request.user, title=title, file=f)
    return Response(WorkspaceTaskDocumentSerializer(doc, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def ws_task_submission_document_delete(request, pk, tid, sid, docid):
    """Delete a document from a submission. Uploader or mentor can delete."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    submission = get_object_or_404(WorkspaceTaskSubmission, pk=sid, task=task)
    doc = get_object_or_404(WorkspaceTaskDocument, pk=docid, submission=submission)

    if is_mentor and not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if not is_mentor and doc.uploaded_by != request.user:
        return Response({'detail': 'Only the uploader or mentor can delete this document.'}, status=status.HTTP_403_FORBIDDEN)

    doc.file.delete(save=False)
    doc.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ws_task_report(request, pk, tid):
    """Full report for a task: counts + per-student breakdown. Mentor only."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)

    mp = _mentor_profile(request.user)
    is_coordinator = (workspace.mentor == mp)
    if not is_coordinator and (task.created_by is None or task.created_by != request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    submissions = task.submissions.select_related('student__user').prefetch_related('checks')
    today = timezone.now().date()
    overdue_ids = set()
    if task.due_date:
        overdue_ids = {
            s.id for s in submissions
            if s.status not in ('completed',) and task.due_date < today
        }

    counts = {
        'total':         submissions.count(),
        'not_started':   submissions.filter(status='not_started').count(),
        'in_progress':   submissions.filter(status='in_progress').count(),
        'submitted':     submissions.filter(status__in=['submitted', 'resubmitted']).count(),
        'needs_revision':submissions.filter(status='needs_revision').count(),
        'completed':     submissions.filter(status='completed').count(),
        'overdue':       len(overdue_ids),
    }
    counts['completion_pct'] = round(counts['completed'] / counts['total'] * 100) if counts['total'] else 0

    rows = []
    for sub in submissions:
        checks_done  = sub.checks.filter(is_done=True).count()
        checks_total = sub.checks.count()
        u = sub.student.user
        rows.append({
            'submission_id': sub.id,
            'student_id':   sub.student.id,
            'student_name': f"{u.first_name} {u.last_name}".strip() or u.username,
            'status':       sub.status,
            'is_overdue':   sub.id in overdue_ids,
            'checks_done':  checks_done,
            'checks_total': checks_total,
            'submitted_at': sub.submitted_at,
            'completed_at': sub.completed_at,
        })

    return Response({'task_id': task.id, 'title': task.title, 'due_date': task.due_date, 'counts': counts, 'rows': rows})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ws_task_report_export(request, pk, tid):
    """Export the task report as CSV. Mentor only."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    if not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    submissions = task.submissions.select_related('student__user').prefetch_related('checks')
    today = timezone.now().date()

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="task_{task.id}_report.csv"'
    writer = csv.writer(response)
    writer.writerow(['Student', 'Status', 'Overdue', 'Deliverables Done', 'Total Deliverables', 'Submitted At', 'Completed At'])

    for sub in submissions:
        u = sub.student.user
        checks_done  = sub.checks.filter(is_done=True).count()
        checks_total = sub.checks.count()
        is_overdue   = task.due_date and sub.status != 'completed' and task.due_date < today
        writer.writerow([
            f"{u.first_name} {u.last_name}".strip() or u.username,
            sub.status,
            'Yes' if is_overdue else 'No',
            checks_done,
            checks_total,
            sub.submitted_at or '',
            sub.completed_at or '',
        ])

    return response


# ── Feature 1: Task Templates ─────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ws_task_templates_list(request, pk):
    """GET — list task templates in this workspace. Mentor only."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    qs = WorkspaceTask.objects.filter(workspace=workspace, is_template=True).prefetch_related('deliverables', 'prerequisites')
    return Response(WorkspaceTaskSerializer(qs, many=True, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_save_as_template(request, pk, tid):
    """
    POST — clone an existing task as a reusable template (is_template=True).
    The clone keeps title/description/type/deliverables/peer_visible.
    """
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Only the workspace mentor can save templates.'}, status=status.HTTP_403_FORBIDDEN)

    source = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)

    template = WorkspaceTask.objects.create(
        workspace=workspace,
        title=request.data.get('title', source.title),
        description=source.description,
        task_type=source.task_type,
        peer_visible=source.peer_visible,
        is_template=True,
        created_by=request.user,
    )
    for d in source.deliverables.all():
        WorkspaceTaskDeliverable.objects.create(
            task=template, title=d.title, description=d.description, order=d.order,
        )
    return Response(WorkspaceTaskSerializer(template, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_from_template(request, pk, tid):
    """
    POST — create a new draft task from a template.
    The new task can optionally override title/due_date via request body.
    """
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Only the workspace mentor can use templates.'}, status=status.HTTP_403_FORBIDDEN)

    template = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace, is_template=True)

    new_task = WorkspaceTask.objects.create(
        workspace=workspace,
        title=request.data.get('title', template.title),
        description=template.description,
        task_type=template.task_type,
        due_date=request.data.get('due_date') or None,
        peer_visible=template.peer_visible,
        is_template=False,
        created_by=request.user,
    )
    for d in template.deliverables.all():
        WorkspaceTaskDeliverable.objects.create(
            task=new_task, title=d.title, description=d.description, order=d.order,
        )
    return Response(WorkspaceTaskSerializer(new_task, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def ws_task_template_delete(request, pk, tid):
    """DELETE — remove a template permanently."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    template = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace, is_template=True)
    template.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Feature 9: Task Duplication ───────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_duplicate(request, pk, tid):
    """POST — clone an existing task as a new draft (no submissions, no template flag)."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Only the workspace mentor can duplicate tasks.'}, status=status.HTTP_403_FORBIDDEN)

    source = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    new_title = request.data.get('title', f"{source.title} (Copy)")

    new_task = WorkspaceTask.objects.create(
        workspace=workspace,
        title=new_title,
        description=source.description,
        task_type=source.task_type,
        due_date=source.due_date,
        peer_visible=source.peer_visible,
        is_template=False,
        status=WorkspaceTask.STATUS_DRAFT,
        created_by=request.user,
    )
    for d in source.deliverables.all():
        WorkspaceTaskDeliverable.objects.create(
            task=new_task, title=d.title, description=d.description, order=d.order,
        )
    return Response(WorkspaceTaskSerializer(new_task, context={'request': request}).data, status=status.HTTP_201_CREATED)


# ── Feature 10: Bulk Review ───────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_submissions_bulk_review(request, pk, tid):
    """
    POST — mentor marks multiple submissions as completed or needs_revision.
    Body: { submission_ids: [...], status: 'completed' | 'needs_revision' }
    Only processes submissions that are currently submitted/resubmitted.
    """
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    if not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    ids = request.data.get('submission_ids', [])
    new_status = request.data.get('status')

    if new_status not in (WorkspaceTaskSubmission.STATUS_COMPLETED, WorkspaceTaskSubmission.STATUS_NEEDS_REVISION):
        return Response({'detail': 'status must be completed or needs_revision.'}, status=status.HTTP_400_BAD_REQUEST)

    reviewable = (WorkspaceTaskSubmission.STATUS_SUBMITTED, WorkspaceTaskSubmission.STATUS_RESUBMITTED)
    subs = WorkspaceTaskSubmission.objects.filter(pk__in=ids, task=task, status__in=reviewable)
    updated = 0
    for sub in subs:
        prev_status = sub.status
        sub.status = new_status
        if new_status == WorkspaceTaskSubmission.STATUS_COMPLETED:
            sub.completed_at = timezone.now()
        sub.save()
        _record_status_event(sub, prev_status, new_status, request.user)
        _notify_task_reviewed(task, sub)
        updated += 1

    return Response({'updated': updated})


# ── Feature 5: Private Mentor Notes ──────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def ws_task_submission_notes(request, pk, tid, sid):
    """
    GET  — list private mentor notes on a submission (mentor only).
    POST — add a new private note (mentor only).
    """
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    submission = get_object_or_404(WorkspaceTaskSubmission, pk=sid, task=task)

    if not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        notes = submission.mentor_notes.all()
        return Response(WorkspaceTaskMentorNoteSerializer(notes, many=True, context={'request': request}).data)

    text = request.data.get('text', '').strip()
    if not text:
        return Response({'detail': 'text is required.'}, status=status.HTTP_400_BAD_REQUEST)

    note = WorkspaceTaskMentorNote.objects.create(submission=submission, author=request.user, text=text)
    return Response(WorkspaceTaskMentorNoteSerializer(note, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def ws_task_submission_note_detail(request, pk, tid, sid, nid):
    """PATCH — edit a note. DELETE — remove a note. Author only."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    submission = get_object_or_404(WorkspaceTaskSubmission, pk=sid, task=task)
    note = get_object_or_404(WorkspaceTaskMentorNote, pk=nid, submission=submission)

    if not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if note.author != request.user:
        return Response({'detail': 'You can only edit your own notes.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    text = request.data.get('text', '').strip()
    if not text:
        return Response({'detail': 'text is required.'}, status=status.HTTP_400_BAD_REQUEST)
    note.text = text
    note.save()
    return Response(WorkspaceTaskMentorNoteSerializer(note, context={'request': request}).data)


# ── Feature 12: Task Sections ─────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def ws_task_sections(request, pk):
    """
    GET  — list sections for a workspace.
    POST — mentor creates a section. Body: title, description, color, order.
    """
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        sections = WorkspaceTaskSection.objects.filter(workspace=workspace)
        return Response(WorkspaceTaskSectionSerializer(sections, many=True, context={'request': request}).data)

    if not is_mentor:
        return Response({'detail': 'Only the workspace mentor can create sections.'}, status=status.HTTP_403_FORBIDDEN)

    title = request.data.get('title', '').strip()
    if not title:
        return Response({'detail': 'title is required.'}, status=status.HTTP_400_BAD_REQUEST)

    section = WorkspaceTaskSection.objects.create(
        workspace=workspace,
        title=title,
        description=request.data.get('description', ''),
        color=request.data.get('color', 'gray'),
        order=request.data.get('order', 0),
    )
    return Response(WorkspaceTaskSectionSerializer(section, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def ws_task_section_detail(request, pk, sid):
    """PATCH — edit a section. DELETE — remove (tasks become section-less)."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    section = get_object_or_404(WorkspaceTaskSection, pk=sid, workspace=workspace)

    if request.method == 'DELETE':
        section.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    for field in ('title', 'description', 'color', 'order'):
        if field in request.data:
            setattr(section, field, request.data[field])
    section.save()
    return Response(WorkspaceTaskSectionSerializer(section, context={'request': request}).data)


# ── Feature 13: Rubric Scores ─────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def ws_task_rubric_scores(request, pk, tid, sid):
    """
    GET  — list rubric scores for a submission (mentor sees all; student sees their own).
    POST — mentor sets/updates scores. Body: [{criteria_id, points, feedback}].
    """
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    submission = get_object_or_404(WorkspaceTaskSubmission, pk=sid, task=task)

    if not is_mentor and submission.student != sp:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        scores = submission.rubric_scores.select_related('criteria')
        return Response(WorkspaceTaskRubricScoreSerializer(scores, many=True).data)

    if not is_mentor:
        return Response({'detail': 'Only the mentor can set rubric scores.'}, status=status.HTTP_403_FORBIDDEN)

    rows = request.data if isinstance(request.data, list) else request.data.get('scores', [])
    saved = []
    for row in rows:
        criteria = WorkspaceTaskRubricCriteria.objects.filter(pk=row.get('criteria_id'), task=task).first()
        if not criteria:
            continue
        score, _ = WorkspaceTaskRubricScore.objects.update_or_create(
            submission=submission, criteria=criteria,
            defaults={'points': max(0, min(row.get('points', 0), criteria.max_points)), 'feedback': row.get('feedback', '')},
        )
        saved.append(score)

    return Response(WorkspaceTaskRubricScoreSerializer(saved, many=True).data)


# ── Feature 19: @mention helper ──────────────────────────────────────────────

def _process_task_mentions(text, author_user, workspace, link):
    """Parse @username patterns, create Notification for each mentioned workspace member."""
    from .models import Notification
    usernames = re.findall(r'@(\w+)', text)
    if not usernames:
        return
    member_user_ids = set(
        workspace.memberships.filter(status='approved').values_list('student__user_id', flat=True)
    )
    # Include mentor
    member_user_ids.add(workspace.mentor.user_id)
    from accounts.models import CustomUser
    for user in CustomUser.objects.filter(username__in=usernames).exclude(pk=author_user.pk):
        if user.pk in member_user_ids:
            Notification.objects.create(
                recipient=user,
                notif_type=Notification.TYPE_MENTION,
                title=f'{author_user.username} mentioned you',
                body=text[:120],
                link=link,
            )


# ── Feature 16: Peer Review ───────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_peer_review_trigger(request, pk, tid):
    """Mentor triggers peer review assignment for a task."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Mentor only.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    if not task.peer_review_enabled:
        return Response({'detail': 'Peer review is not enabled for this task.'}, status=status.HTTP_400_BAD_REQUEST)

    # Collect submitted/completed submissions
    eligible = list(WorkspaceTaskSubmission.objects.filter(
        task=task, status__in=['submitted', 'resubmitted', 'completed']
    ).select_related('student'))

    if len(eligible) < 2:
        return Response({'detail': 'Need at least 2 submissions to assign peer reviews.'}, status=status.HTTP_400_BAD_REQUEST)

    count = min(task.peer_review_count, len(eligible) - 1)
    created = 0
    from .models import Notification

    for sub in eligible:
        others = [s for s in eligible if s.student_id != sub.student_id]
        targets = random.sample(others, min(count, len(others)))
        for target_sub in targets:
            _, was_created = WorkspaceTaskPeerReview.objects.get_or_create(
                task=task, reviewer=sub.student, reviewee_submission=target_sub
            )
            if was_created:
                created += 1
                Notification.objects.create(
                    recipient=sub.student.user,
                    notif_type=Notification.TYPE_PEER_REVIEW,
                    title='Peer review assigned',
                    body=f'You have been assigned to review a peer\'s work for "{task.title}".',
                    link=f'/w/{workspace.slug}/tasks/{task.id}',
                )

    return Response({'assigned': created})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ws_task_my_peer_reviews(request, pk, tid):
    """Return peer review assignments for the current student on a task."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None or is_mentor:
        return Response({'detail': 'Students only.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    reviews = WorkspaceTaskPeerReview.objects.filter(task=task, reviewer=sp).prefetch_related('scores__criteria')
    return Response(WorkspaceTaskPeerReviewSerializer(reviews, many=True, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_task_peer_review_submit(request, pk, tid, prid):
    """Student submits peer review scores."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None or is_mentor:
        return Response({'detail': 'Students only.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    review = get_object_or_404(WorkspaceTaskPeerReview, pk=prid, task=task, reviewer=sp)

    rows = request.data if isinstance(request.data, list) else request.data.get('scores', [])
    for row in rows:
        criteria = WorkspaceTaskRubricCriteria.objects.filter(pk=row.get('criteria_id'), task=task).first()
        if not criteria:
            continue
        WorkspaceTaskPeerReviewScore.objects.update_or_create(
            peer_review=review, criteria=criteria,
            defaults={'points': max(0, min(int(row.get('points', 0)), criteria.max_points)), 'feedback': row.get('feedback', '')},
        )

    review.status = WorkspaceTaskPeerReview.STATUS_SUBMITTED
    review.submitted_at = timezone.now()
    review.save()
    return Response(WorkspaceTaskPeerReviewSerializer(review, context={'request': request}).data)


# ── Feature 17: Late override ─────────────────────────────────────────────────

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def ws_task_submission_late_override(request, pk, tid, sid):
    """Mentor sets/clears the late override flag on a submission."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Mentor only.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    submission = get_object_or_404(WorkspaceTaskSubmission, pk=sid, task=task)

    if not _mentor_can_access_task(task, workspace, request.user):
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    val = request.data.get('late_override')
    submission.late_override = None if val is None else bool(val)
    submission.save()
    return Response(WorkspaceTaskSubmissionSummarySerializer(submission, context={'request': request}).data)


# ── Feature 18: Inline document comments ─────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def ws_task_doc_inline_comments(request, pk, tid, sid, docid):
    """GET/POST inline comments on a document."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    submission = get_object_or_404(WorkspaceTaskSubmission, pk=sid, task=task)
    doc = get_object_or_404(WorkspaceTaskDocument, pk=docid, submission=submission)

    if not is_mentor and submission.student != sp:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        top_level = doc.inline_comments.filter(parent__isnull=True).prefetch_related('replies')
        return Response(DocumentInlineCommentSerializer(top_level, many=True, context={'request': request}).data)

    body = request.data.get('body', '').strip()
    if not body:
        return Response({'detail': 'body is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        x = float(request.data.get('x_pct', 50))
        y = float(request.data.get('y_pct', 50))
        page_number = int(request.data.get('page_number', 1))
    except (ValueError, TypeError):
        return Response({'detail': 'x_pct, y_pct, and page_number must be numeric.'}, status=status.HTTP_400_BAD_REQUEST)

    parent_id = request.data.get('parent')
    parent_obj = DocumentInlineComment.objects.filter(pk=parent_id, document=doc).first() if parent_id else None

    comment = DocumentInlineComment.objects.create(
        document=doc,
        author=request.user,
        page_number=page_number,
        x_pct=max(0, min(100, x)),
        y_pct=max(0, min(100, y)),
        body=body,
        parent=parent_obj,
    )
    # Feature 19: @mentions in inline comments
    _process_task_mentions(body, request.user, workspace, f'/w/{workspace.slug}/tasks/{task.id}')
    return Response(DocumentInlineCommentSerializer(comment, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def ws_task_doc_inline_comment_detail(request, pk, tid, sid, docid, cid):
    """PATCH (resolve/edit) or DELETE an inline comment."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, sp = _ws_task_guard(workspace, request.user)
    if is_mentor is None:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    task = get_object_or_404(WorkspaceTask, pk=tid, workspace=workspace)
    submission = get_object_or_404(WorkspaceTaskSubmission, pk=sid, task=task)
    doc = get_object_or_404(WorkspaceTaskDocument, pk=docid, submission=submission)
    comment = get_object_or_404(DocumentInlineComment, pk=cid, document=doc)

    is_author = comment.author == request.user

    if request.method == 'DELETE':
        if not is_mentor and not is_author:
            return Response({'detail': 'Only the author or mentor can delete.'}, status=status.HTTP_403_FORBIDDEN)
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if 'body' in request.data:
        if not is_author:
            return Response({'detail': 'Only the author can edit.'}, status=status.HTTP_403_FORBIDDEN)
        comment.body = request.data['body'].strip() or comment.body
    if 'is_resolved' in request.data:
        if not is_mentor and not is_author:
            return Response({'detail': 'Only the author or mentor can resolve.'}, status=status.HTTP_403_FORBIDDEN)
        comment.is_resolved = bool(request.data['is_resolved'])
    comment.save()
    return Response(DocumentInlineCommentSerializer(comment, context={'request': request}).data)


# ── Feature 19: Mention autocomplete ─────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ws_task_mention_autocomplete(request, pk):
    """Return workspace members matching q= for @mention autocomplete."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if is_mentor is None:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    q = request.query_params.get('q', '').strip()
    memberships = workspace.memberships.filter(status='approved').select_related('student__user')
    results = []
    for m in memberships:
        u = m.student.user
        if not q or q.lower() in u.username.lower() or q.lower() in f'{u.first_name} {u.last_name}'.lower():
            pic = None
            if m.student.profile_picture:
                pic = m.student.profile_picture.url
            results.append({
                'id': u.id,
                'username': u.username,
                'display_name': f'{u.first_name} {u.last_name}'.strip() or u.username,
                'profile_picture_url': pic,
            })
    # Also include mentor
    mu = workspace.mentor.user
    if not q or q.lower() in mu.username.lower() or q.lower() in f'{mu.first_name} {mu.last_name}'.lower():
        mp = workspace.mentor
        pic = None
        if mp.profile_picture:
            pic = mp.profile_picture.url
        results.append({
            'id': mu.id,
            'username': mu.username,
            'display_name': f'{mu.first_name} {mu.last_name}'.strip() or mu.username,
            'profile_picture_url': pic,
        })
    return Response(results[:10])


# ── Feature 14: Gradebook ─────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ws_gradebook(request, pk):
    """
    Returns a gradebook matrix: tasks × students with status + rubric score per cell.
    Mentor only.
    """
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    is_mentor, _ = _ws_task_guard(workspace, request.user)
    if not is_mentor:
        return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    mp = _mentor_profile(request.user)
    is_coordinator = (workspace.mentor == mp)

    tasks = WorkspaceTask.objects.filter(workspace=workspace, is_template=False, status='published').prefetch_related('rubric_criteria')
    if not is_coordinator:
        tasks = tasks.filter(created_by=request.user)
    memberships = workspace.memberships.filter(status='approved').select_related('student__user')

    task_list = []
    for t in tasks:
        max_score = sum(c.max_points for c in t.rubric_criteria.all())
        task_list.append({'id': t.id, 'title': t.title, 'due_date': str(t.due_date) if t.due_date else None, 'max_score': max_score})

    rows = []
    for m in memberships:
        student = m.student
        scores = {}
        subs = WorkspaceTaskSubmission.objects.filter(
            task__workspace=workspace, student=student
        ).prefetch_related('rubric_scores')
        sub_map = {s.task_id: s for s in subs}

        for t in tasks:
            sub = sub_map.get(t.id)
            if sub:
                total = sum(rs.points for rs in sub.rubric_scores.all())
                scores[t.id] = {'status': sub.status, 'score': total, 'submitted_at': sub.submitted_at.isoformat() if sub.submitted_at else None}
            else:
                scores[t.id] = None

        rows.append({
            'student_id': student.id,
            'student_name': f"{student.user.first_name} {student.user.last_name}".strip() or student.user.username,
            'student_picture': student.profile_picture.url if student.profile_picture else None,
            'scores': scores,
        })

    return Response({'tasks': task_list, 'rows': rows})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications_list(request):
    page  = max(1, int(request.GET.get('page', 1)))
    limit = min(int(request.GET.get('limit', 20)), 50)
    offset = (page - 1) * limit

    qs = Notification.objects.filter(recipient=request.user).order_by('-created_at')
    total        = qs.count()
    unread_count = qs.filter(is_read=False).count()
    items        = qs[offset:offset + limit]

    data = [
        {
            'id': n.id,
            'type': n.notif_type,
            'title': n.title,
            'body': n.body,
            'link': n.link,
            'is_read': n.is_read,
            'created_at': n.created_at,
        }
        for n in items
    ]
    return Response({
        'results': data,
        'unread': unread_count,
        'total': total,
        'page': page,
        'has_more': (offset + limit) < total,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notifications_mark_read(request):
    ids = request.data.get('ids', [])
    if ids:
        Notification.objects.filter(recipient=request.user, id__in=ids).update(is_read=True)
    else:
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response({'ok': True})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def notification_delete(request, pk):
    deleted, _ = Notification.objects.filter(recipient=request.user, id=pk).delete()
    if not deleted:
        return Response(status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def notifications_clear(request):
    """Delete all read notifications for the current user."""
    Notification.objects.filter(recipient=request.user, is_read=True).delete()
    return Response({'ok': True})


# ── Contact Requests ────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def contact_requests(request):
    """
    GET: list pending incoming + all outgoing contact requests.
    POST: send a contact request. Body: { receiver_id }
    """
    from accounts.serializers import UserSerializer
    user = request.user

    if request.method == 'GET':
        incoming = ContactRequest.objects.filter(receiver=user, status='pending').select_related('sender')
        outgoing = ContactRequest.objects.filter(sender=user).select_related('receiver')
        return Response({
            'incoming': [
                {'id': cr.id, 'user': UserSerializer(cr.sender).data, 'status': cr.status, 'created_at': cr.created_at}
                for cr in incoming
            ],
            'outgoing': [
                {'id': cr.id, 'user': UserSerializer(cr.receiver).data, 'status': cr.status, 'created_at': cr.created_at}
                for cr in outgoing
            ],
        })

    # POST — send a request
    receiver_id = request.data.get('receiver_id')
    if not receiver_id:
        return Response({'detail': 'receiver_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
    receiver = get_object_or_404(CustomUser, pk=receiver_id)
    if receiver.pk == user.pk:
        return Response({'detail': "You can't send a request to yourself."}, status=status.HTTP_400_BAD_REQUEST)
    if receiver.message_permission == CustomUser.MSG_OPEN:
        return Response({'detail': 'User accepts messages from anyone; no request needed.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if receiver already sent a request to us (mutual resolution)
    reverse_cr = ContactRequest.objects.filter(sender=receiver, receiver=user, status='pending').first()
    if reverse_cr:
        reverse_cr.status = 'accepted'
        reverse_cr.save()
        return Response({'id': reverse_cr.id, 'status': 'accepted', 'detail': 'Mutual — request accepted.'}, status=status.HTTP_200_OK)

    cr, created = ContactRequest.objects.get_or_create(
        sender=user,
        receiver=receiver,
        defaults={'status': 'pending'},
    )
    if not created:
        return Response({'id': cr.id, 'status': cr.status, 'detail': f'Request already {cr.status}.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'id': cr.id, 'status': cr.status}, status=status.HTTP_201_CREATED)


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def contact_request_detail(request, pk):
    """
    POST: receiver responds. Body: { action: 'accept' | 'decline' }
    DELETE: sender cancels a pending request.
    """
    cr = get_object_or_404(ContactRequest, pk=pk)

    if request.method == 'DELETE':
        if cr.sender != request.user and cr.receiver != request.user:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        cr.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if cr.receiver != request.user:
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
    action = request.data.get('action')
    if action == 'accept':
        cr.status = 'accepted'
    elif action == 'decline':
        cr.status = 'declined'
    else:
        return Response({'detail': 'action must be "accept" or "decline".'}, status=status.HTTP_400_BAD_REQUEST)
    cr.save()
    return Response({'id': cr.id, 'status': cr.status})


# ── Blocks ──────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def blocks(request):
    """
    GET: { blocked_ids: [...], blocked_me_ids: [...] }
    POST: { blocked_id } — block a user; cancels any ContactRequest between them.
    """
    from accounts.serializers import UserSerializer
    user = request.user

    if request.method == 'GET':
        blocked_ids = list(Block.objects.filter(blocker=user).values_list('blocked_id', flat=True))
        blocked_me_ids = list(Block.objects.filter(blocked=user).values_list('blocker_id', flat=True))
        return Response({'blocked_ids': blocked_ids, 'blocked_me_ids': blocked_me_ids})

    # POST — block a user
    blocked_id = request.data.get('blocked_id')
    if not blocked_id:
        return Response({'detail': 'blocked_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
    receiver = get_object_or_404(CustomUser, pk=blocked_id)
    if receiver.pk == user.pk:
        return Response({'detail': "You can't block yourself."}, status=status.HTTP_400_BAD_REQUEST)

    block, created = Block.objects.get_or_create(blocker=user, blocked=receiver)

    # Cancel any ContactRequest in either direction
    ContactRequest.objects.filter(
        Q(sender=user, receiver=receiver) | Q(sender=receiver, receiver=user)
    ).delete()

    return Response({'id': block.id, 'blocked_id': receiver.id}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def block_detail(request, pk):
    """Unblock a user. pk = the blocked user's user ID."""
    block = get_object_or_404(Block, blocker=request.user, blocked_id=pk)
    block.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Feed ───────────────────────────────────────

def _serialize_post(post, user):
    from accounts.serializers import UserSerializer
    reaction_counts = {emoji: 0 for emoji, _ in PostReaction.EMOJI_CHOICES}
    for r in post.reactions.all():
        reaction_counts[r.emoji] = reaction_counts.get(r.emoji, 0) + 1
    my_reaction_obj = next((r for r in post.reactions.all() if r.user_id == user.id), None)
    author_data = UserSerializer(post.author).data
    # Attach profile_picture from the role-specific profile
    pic = None
    if post.author.role == 'mentor':
        mp = MentorProfile.objects.filter(user=post.author).first()
        if mp and mp.profile_picture:
            pic = mp.profile_picture.url
    else:
        sp = StudentProfile.objects.filter(user=post.author).first()
        if sp and sp.profile_picture:
            pic = sp.profile_picture.url
    author_data['profile_picture'] = pic
    return {
        'id':              post.id,
        'author':          author_data,
        'post_type':       post.post_type,
        'title':           post.title,
        'body':            post.body,
        'image':           post.image.url if post.image else None,
        'link_url':        post.link_url,
        'link_title':      post.link_title,
        'event_date':      post.event_date.isoformat() if post.event_date else None,
        'event_location':  post.event_location,
        'tags':            post.tags,
        'tags_list':       [t.strip() for t in post.tags.split(',') if t.strip()],
        'allow_comments':  post.allow_comments,
        'allow_reactions': post.allow_reactions,
        'is_pinned':       post.is_pinned,
        'is_hidden':       post.is_hidden,
        'created_at':      post.created_at.isoformat(),
        'updated_at':      post.updated_at.isoformat(),
        'reaction_counts': reaction_counts,
        'my_reaction':     my_reaction_obj.emoji if my_reaction_obj else None,
        'comment_count':   post.comments.count(),
        'is_bookmarked':   PostBookmark.objects.filter(user=user, post=post).exists(),
    }


def _serialize_comment(comment):
    from accounts.serializers import UserSerializer
    author_data = UserSerializer(comment.author).data
    pic = None
    if comment.author.role == 'mentor':
        mp = MentorProfile.objects.filter(user=comment.author).first()
        if mp and mp.profile_picture:
            pic = mp.profile_picture.url
    else:
        sp = StudentProfile.objects.filter(user=comment.author).first()
        if sp and sp.profile_picture:
            pic = sp.profile_picture.url
    author_data['profile_picture'] = pic
    return {
        'id':         comment.id,
        'author':     author_data,
        'body':       comment.body,
        'created_at': comment.created_at.isoformat(),
    }


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def feed_list(request):
    user = request.user

    if request.method == 'GET':
        qs = Post.objects.prefetch_related('reactions', 'comments').select_related('author').filter(workspace__isnull=True)
        if user.role != 'superadmin':
            qs = qs.filter(is_hidden=False)
        tag = request.query_params.get('tag', '').strip()
        if tag:
            qs = qs.filter(tags__icontains=tag)
        return Response([_serialize_post(p, user) for p in qs])

    # POST — create post
    if user.role not in ('mentor', 'superadmin'):
        return Response({'detail': 'Only mentors and admins can create posts.'}, status=status.HTTP_403_FORBIDDEN)

    title = request.data.get('title', '').strip()
    if not title:
        return Response({'detail': 'title is required.'}, status=status.HTTP_400_BAD_REQUEST)

    post = Post.objects.create(
        author          = user,
        post_type       = request.data.get('post_type', Post.TYPE_GENERAL),
        title           = title,
        body            = request.data.get('body', ''),
        image           = request.FILES.get('image') or None,
        link_url        = request.data.get('link_url', ''),
        link_title      = request.data.get('link_title', ''),
        event_date      = request.data.get('event_date') or None,
        event_location  = request.data.get('event_location', ''),
        tags            = request.data.get('tags', ''),
        allow_comments  = request.data.get('allow_comments', 'true') not in ('false', False, '0'),
        allow_reactions = request.data.get('allow_reactions', 'true') not in ('false', False, '0'),
    )
    post.refresh_from_db()
    return Response(_serialize_post(post, user), status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def feed_detail(request, pk):
    user = request.user
    post = get_object_or_404(Post, pk=pk)

    if request.method == 'GET':
        data = _serialize_post(post, user)
        data['comments'] = [_serialize_comment(c) for c in post.comments.select_related('author')]
        return Response(data)

    if user != post.author and user.role != 'superadmin':
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH
    for field in ('post_type', 'title', 'body', 'link_url', 'link_title', 'event_location', 'tags'):
        if field in request.data:
            setattr(post, field, request.data[field])
    if 'event_date' in request.data:
        post.event_date = request.data['event_date'] or None
    if 'image' in request.FILES:
        post.image = request.FILES['image']
    if 'allow_comments' in request.data:
        post.allow_comments = request.data['allow_comments'] not in ('false', False, '0')
    if 'allow_reactions' in request.data:
        post.allow_reactions = request.data['allow_reactions'] not in ('false', False, '0')
    post.save()
    post.refresh_from_db()
    return Response(_serialize_post(post, user))


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def post_react(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if not post.allow_reactions:
        return Response({'detail': 'Reactions are disabled for this post.'}, status=status.HTTP_403_FORBIDDEN)
    user = request.user

    if request.method == 'DELETE':
        PostReaction.objects.filter(post=post, user=user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    emoji = request.data.get('emoji', '')
    valid_emojis = [e for e, _ in PostReaction.EMOJI_CHOICES]
    if emoji not in valid_emojis:
        return Response({'detail': f'emoji must be one of: {valid_emojis}'}, status=status.HTTP_400_BAD_REQUEST)

    PostReaction.objects.update_or_create(post=post, user=user, defaults={'emoji': emoji})
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def post_comments_list(request, pk):
    post = get_object_or_404(Post, pk=pk)
    user = request.user

    if request.method == 'GET':
        comments = post.comments.select_related('author')
        return Response([_serialize_comment(c) for c in comments])

    if not post.allow_comments:
        return Response({'detail': 'Comments are disabled for this post.'}, status=status.HTTP_403_FORBIDDEN)

    body = request.data.get('body', '').strip()
    if not body:
        return Response({'detail': 'body is required.'}, status=status.HTTP_400_BAD_REQUEST)

    comment = PostComment.objects.create(post=post, author=user, body=body)
    return Response(_serialize_comment(comment), status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def post_comment_detail(request, pk, cid):
    comment = get_object_or_404(PostComment, pk=cid, post_id=pk)
    if request.user != comment.author and request.user.role != 'superadmin':
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
    comment.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def post_pin(request, pk):
    if request.user.role != 'superadmin':
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
    post = get_object_or_404(Post, pk=pk)
    post.is_pinned = not post.is_pinned
    post.save(update_fields=['is_pinned'])
    return Response(_serialize_post(post, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def post_hide(request, pk):
    if request.user.role != 'superadmin':
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
    post = get_object_or_404(Post, pk=pk)
    post.is_hidden = not post.is_hidden
    post.save(update_fields=['is_hidden'])
    return Response(_serialize_post(post, request.user))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def feed_activity(request):
    """Return recent feed events: new posts + new comments, merged by time."""
    limit = 10

    recent_posts = (
        Post.objects
        .filter(is_hidden=False)
        .select_related('author')
        .order_by('-created_at')[:limit]
    )
    recent_comments = (
        PostComment.objects
        .select_related('author', 'post')
        .order_by('-created_at')[:limit]
    )

    def actor_name(u):
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username

    events = []
    for p in recent_posts:
        events.append({
            'type':       'post',
            'actor':      actor_name(p.author),
            'action':     'created a post',
            'target':     p.title[:60],
            'link':       '/feed',
            'created_at': p.created_at.isoformat(),
        })
    for c in recent_comments:
        events.append({
            'type':       'comment',
            'actor':      actor_name(c.author),
            'action':     'commented on',
            'target':     c.post.title[:60],
            'link':       '/feed',
            'created_at': c.created_at.isoformat(),
        })

    events.sort(key=lambda x: x['created_at'], reverse=True)
    return Response(events[:limit])


# ── Sessions / Availability ─────────────────────

def _serialize_slot(slot):
    return {
        'id':          slot.id,
        'day_of_week': slot.day_of_week,
        'start_time':  slot.start_time.strftime('%H:%M'),
        'end_time':    slot.end_time.strftime('%H:%M'),
    }


def _serialize_session(sess):
    from accounts.serializers import UserSerializer
    return {
        'id':           sess.id,
        'mentor':       UserSerializer(sess.mentor.user).data,
        'student':      UserSerializer(sess.student.user).data,
        'date':         sess.date.isoformat(),
        'start_time':   sess.start_time.strftime('%H:%M'),
        'end_time':     sess.end_time.strftime('%H:%M'),
        'title':        sess.title,
        'meeting_link': sess.meeting_link,
        'status':       sess.status,
        'notes':        sess.notes,
        'created_at':   sess.created_at.isoformat(),
    }


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def availability_slots(request):
    """
    GET  — returns slots for the given mentor_id (public) or own slots (mentor)
    POST — mentor adds a slot { day_of_week, start_time, end_time }
    DELETE — not used at list level
    """
    user = request.user

    if request.method == 'GET':
        mentor_id = request.query_params.get('mentor_id')
        if mentor_id:
            mentor_profile = get_object_or_404(MentorProfile, pk=mentor_id)
        else:
            mentor_profile = get_object_or_404(MentorProfile, user=user)
        slots = mentor_profile.availability_slots.all()
        return Response([_serialize_slot(s) for s in slots])

    # POST — mentor only
    mentor_profile = get_object_or_404(MentorProfile, user=user)
    day  = request.data.get('day_of_week')
    st   = request.data.get('start_time')
    et   = request.data.get('end_time')
    if day is None or not st or not et:
        return Response({'detail': 'day_of_week, start_time, end_time required.'}, status=400)
    slot = MentorAvailabilitySlot.objects.create(
        mentor=mentor_profile, day_of_week=int(day), start_time=st, end_time=et
    )
    return Response(_serialize_slot(slot), status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def availability_slot_detail(request, pk):
    mentor_profile = get_object_or_404(MentorProfile, user=request.user)
    slot = get_object_or_404(MentorAvailabilitySlot, pk=pk, mentor=mentor_profile)
    slot.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def sessions_list(request):
    user = request.user

    if request.method == 'GET':
        if user.role == 'mentor':
            mentor_profile = get_object_or_404(MentorProfile, user=user)
            qs = Session.objects.filter(mentor=mentor_profile).select_related('student__user', 'mentor__user')
        elif user.role == 'student':
            student_profile = get_object_or_404(StudentProfile, user=user)
            qs = Session.objects.filter(student=student_profile).select_related('student__user', 'mentor__user')
        else:
            qs = Session.objects.all().select_related('student__user', 'mentor__user')
        return Response([_serialize_session(s) for s in qs])

    # POST — student books a session
    if user.role not in ('student', 'superadmin'):
        return Response({'detail': 'Only students can book sessions.'}, status=403)

    student_profile = get_object_or_404(StudentProfile, user=user)
    mentor_id   = request.data.get('mentor_id')
    date_str    = request.data.get('date')
    start_time  = request.data.get('start_time')
    end_time    = request.data.get('end_time')
    title       = request.data.get('title', 'Mentorship session')

    if not all([mentor_id, date_str, start_time, end_time]):
        return Response({'detail': 'mentor_id, date, start_time, end_time required.'}, status=400)

    mentor_profile = get_object_or_404(MentorProfile, pk=mentor_id)

    import uuid
    meeting_link = f"https://meet.jit.si/mentor-{uuid.uuid4().hex[:10]}"

    sess = Session.objects.create(
        mentor=mentor_profile,
        student=student_profile,
        date=date_str,
        start_time=start_time,
        end_time=end_time,
        title=title,
        meeting_link=meeting_link,
        status=Session.STATUS_PENDING,
    )

    # Notify mentor
    _notif_session(mentor_profile.user, sess, booked_by=user)
    return Response(_serialize_session(sess), status=status.HTTP_201_CREATED)


def _notif_session(recipient, sess, booked_by):
    from .models import Notification
    name = booked_by.first_name or booked_by.username
    Notification.objects.create(
        recipient=recipient,
        notif_type='session',
        title=f"{name} booked a session",
        body=f"{sess.date} {sess.start_time}–{sess.end_time}",
        link='/sessions',
    )


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def session_detail(request, pk):
    user = request.user
    sess = get_object_or_404(Session, pk=pk)

    # Only participants can act
    mentor_profile  = MentorProfile.objects.filter(user=user).first()
    student_profile = StudentProfile.objects.filter(user=user).first()
    is_participant  = (mentor_profile and sess.mentor == mentor_profile) or \
                      (student_profile and sess.student == student_profile) or \
                      user.role == 'superadmin'
    if not is_participant:
        return Response({'detail': 'Forbidden.'}, status=403)

    if request.method == 'DELETE':
        sess.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH — update status or notes
    new_status = request.data.get('status')
    if new_status in (Session.STATUS_CONFIRMED, Session.STATUS_CANCELLED):
        sess.status = new_status
    if 'notes' in request.data:
        sess.notes = request.data['notes']
    sess.save()
    return Response(_serialize_session(sess))


# ---------------------------------------------------------------------------
# Mentor Ratings
# ---------------------------------------------------------------------------

def _serialize_rating(r):
    return {
        'id': r.id,
        'rating': r.rating,
        'review': r.review,
        'student_name': r.student.user.get_full_name() or r.student.user.username,
        'student_picture': r.student.profile_picture.url if r.student.profile_picture else None,
        'created_at': r.created_at.isoformat(),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mentor_ratings(request, mentor_id):
    """GET /api/ratings/<mentor_id>/ — public average + list of reviews."""
    mentor = get_object_or_404(MentorProfile, pk=mentor_id)
    ratings = MentorRating.objects.filter(mentor=mentor).select_related('student__user')
    total = ratings.count()
    avg = round(sum(r.rating for r in ratings) / total, 1) if total else None

    my_rating = None
    if hasattr(request.user, 'student_profile'):
        mine = ratings.filter(student=request.user.student_profile).first()
        if mine:
            my_rating = _serialize_rating(mine)

    return Response({
        'average': avg,
        'count': total,
        'my_rating': my_rating,
        'reviews': [_serialize_rating(r) for r in ratings],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mentor_rate(request, mentor_id):
    """POST /api/ratings/<mentor_id>/rate/ — student creates/updates their rating."""
    if request.user.role != 'student':
        return Response({'detail': 'Only students can rate mentors.'}, status=403)
    mentor = get_object_or_404(MentorProfile, pk=mentor_id)
    student = get_object_or_404(StudentProfile, user=request.user)

    rating_val = request.data.get('rating')
    if not rating_val or not (1 <= int(rating_val) <= 5):
        return Response({'detail': 'Rating must be 1–5.'}, status=400)

    obj, _ = MentorRating.objects.update_or_create(
        mentor=mentor, student=student,
        defaults={'rating': int(rating_val), 'review': request.data.get('review', '').strip()},
    )
    return Response(_serialize_rating(obj), status=201)


# ---------------------------------------------------------------------------
# Bookmarks
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bookmark_list(request):
    """GET /api/bookmarks/ — return all posts bookmarked by the current user."""
    user = request.user
    post_ids = PostBookmark.objects.filter(user=user).values_list('post_id', flat=True)
    posts = Post.objects.filter(pk__in=post_ids).prefetch_related('reactions', 'comments')
    return Response([_serialize_post(p, user) for p in posts])


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def post_bookmark(request, pk):
    """POST /api/feed/<pk>/bookmark/ — toggle bookmark."""
    post = get_object_or_404(Post, pk=pk)
    user = request.user
    if request.method == 'POST':
        PostBookmark.objects.get_or_create(user=user, post=post)
        return Response({'is_bookmarked': True})
    else:
        PostBookmark.objects.filter(user=user, post=post).delete()
        return Response({'is_bookmarked': False})


# ---------------------------------------------------------------------------
# Profile Views
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def record_profile_view(request, user_id):
    """POST /api/profile-views/<user_id>/ — record that the current user viewed a profile."""
    from accounts.models import CustomUser
    viewed = get_object_or_404(CustomUser, pk=user_id)
    if viewed.pk != request.user.pk:
        ProfileView.objects.update_or_create(
            viewed_user=viewed, viewer=request.user,
        )
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_profile_views(request):
    """GET /api/profile-views/me/ — return recent viewers of the current user's profile."""
    views = ProfileView.objects.filter(viewed_user=request.user).select_related('viewer')[:30]
    return Response([
        {
            'id': v.viewer.id,
            'username': v.viewer.username,
            'first_name': v.viewer.first_name,
            'last_name': v.viewer.last_name,
            'role': v.viewer.role,
            'viewed_at': v.viewed_at.isoformat(),
        }
        for v in views
    ])


# ---------------------------------------------------------------------------
# Global Search
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_search(request):
    """GET /api/search/?q=... — search users, workspaces, feed posts."""
    from accounts.models import CustomUser
    from accounts.serializers import UserSerializer
    q = request.GET.get('q', '').strip()
    if len(q) < 2:
        return Response({'users': [], 'workspaces': [], 'posts': []})

    user = request.user

    # Users (mentors & students visible to all; filter out superadmins)
    users = CustomUser.objects.filter(
        Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q)
    ).exclude(role='superadmin').exclude(pk=user.pk)[:8]

    # Workspaces
    workspaces = Workspace.objects.filter(
        Q(name__icontains=q) | Q(description__icontains=q) | Q(tags__icontains=q)
    ).filter(is_active=True)[:6] if hasattr(Workspace, 'is_active') else \
        Workspace.objects.filter(Q(name__icontains=q) | Q(description__icontains=q))[:6]

    # Feed posts (non-hidden)
    posts = Post.objects.filter(
        Q(title__icontains=q) | Q(body__icontains=q) | Q(tags__icontains=q),
        is_hidden=False,
    )[:6]

    return Response({
        'users': [{'id': u.id, 'username': u.username, 'first_name': u.first_name, 'last_name': u.last_name, 'role': u.role} for u in users],
        'workspaces': [{'id': w.id, 'name': w.name, 'description': w.description[:80]} for w in workspaces],
        'posts': [{'id': p.id, 'title': p.title, 'body': p.body[:80]} for p in posts],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_task_submissions(request):
    """GET /api/my-task-submissions/ — return all published tasks for the student."""
    sp = _student_profile(request.user)
    if not sp:
        return Response([])

    # Workspaces where this student is approved
    approved_workspace_ids = WorkspaceMembership.objects.filter(
        student=sp, status=WorkspaceMembership.STATUS_APPROVED
    ).values_list('workspace_id', flat=True)

    # All published tasks in those workspaces that apply to this student:
    # - assigned_members is empty  → assigned to all workspace members
    # - OR student is explicitly in assigned_members
    published_tasks = (
        WorkspaceTask.objects
        .filter(workspace_id__in=approved_workspace_ids, status=WorkspaceTask.STATUS_PUBLISHED)
        .filter(Q(assigned_members__isnull=True) | Q(assigned_members=sp))
        .select_related('workspace')
        .distinct()
        .order_by('due_date', 'created_at')
    )

    # Existing submission records keyed by task_id
    existing = {
        s.task_id: s
        for s in WorkspaceTaskSubmission.objects.filter(student=sp, task__in=published_tasks)
    }

    data = []
    for task in published_tasks:
        sub = existing.get(task.id)
        data.append({
            'id':             sub.id if sub else None,
            'task_id':        task.id,
            'task_title':     task.title,
            'workspace_name': task.workspace.name,
            'workspace_slug': task.workspace.slug,
            'status':         sub.status if sub else 'not_started',
            'submitted_at':   sub.submitted_at if sub else None,
            'due_date':       (sub.effective_due_date if sub else task.due_date),
        })

    return Response(data)


# ---------------------------------------------------------------------------
def _user_pic(user):
    """Return profile picture URL for a user (mentor or student), or None."""
    try:
        mp = getattr(user, 'mentor_profile', None)
        if mp and mp.profile_picture:
            return mp.profile_picture.url
    except Exception:
        pass
    try:
        sp = getattr(user, 'student_profile', None)
        if sp and sp.profile_picture:
            return sp.profile_picture.url
    except Exception:
        pass
    return None


# Workspace Chat
# ---------------------------------------------------------------------------

def _serialize_chat_msg(msg):
    from accounts.serializers import UserSerializer
    return {
        'id': msg.id,
        'sender': UserSerializer(msg.sender).data,
        'body': msg.body,
        'created_at': msg.created_at.isoformat(),
    }


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def workspace_chat(request, pk):
    """GET /api/workspaces/<pk>/chat/ — list messages.
       POST — send a message (workspace members + owner + mentors only)."""
    workspace = get_object_or_404(Workspace, pk=pk)
    user = request.user

    # Allow: approved students, workspace coordinator, active mentors
    is_member = WorkspaceMembership.objects.filter(
        workspace=workspace, student__user=user, status='approved'
    ).exists()
    is_mentor = hasattr(workspace, 'mentor') and workspace.mentor.user == user
    mp_check = _mentor_profile(user)
    is_ws_mentor = mp_check and WorkspaceMentor.objects.filter(
        workspace=workspace, mentor=mp_check, status=WorkspaceMentor.STATUS_ACTIVE
    ).exists()
    if not (is_member or is_mentor or is_ws_mentor or user.role == 'superadmin'):
        return Response({'detail': 'Not a member of this workspace.'}, status=403)

    if request.method == 'GET':
        msgs = WorkspaceChatMessage.objects.filter(workspace=workspace).select_related('sender')
        return Response([_serialize_chat_msg(m) for m in msgs])

    body = request.data.get('body', '').strip()
    if not body:
        return Response({'detail': 'Message body is required.'}, status=400)
    msg = WorkspaceChatMessage.objects.create(workspace=workspace, sender=user, body=body)
    return Response(_serialize_chat_msg(msg), status=201)


# ---------------------------------------------------------------------------
# Workspace Mentor Guest (Observer) endpoints
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def workspace_search_mentors(request, pk):
    """Owner searches for mentors to invite as observers."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    mp = _mentor_profile(request.user)
    if not mp or workspace.mentor != mp:
        return Response({'detail': 'Only the workspace owner can search mentors.'}, status=403)
    q = request.query_params.get('q', '').strip()
    if len(q) < 2:
        return Response([])
    existing_guest_user_ids = WorkspaceMentor.objects.filter(
        workspace=workspace
    ).values_list('mentor__user_id', flat=True)
    mentors = CustomUser.objects.filter(
        Q(username__icontains=q) | Q(email__icontains=q) |
        Q(first_name__icontains=q) | Q(last_name__icontains=q),
        role='mentor',
    ).exclude(id=request.user.id).exclude(id__in=existing_guest_user_ids)[:10]
    results = []
    for u in mentors:
        mp_target = MentorProfile.objects.filter(user=u).first()
        results.append({
            'user_id': u.id,
            'username': u.username,
            'email': u.email,
            'display_name': f"{u.first_name} {u.last_name}".strip() or u.username,
            'avatar_url': mp_target.profile_picture.url if mp_target and mp_target.profile_picture else None,
            'role': u.role,
        })
    return Response(results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def workspace_list_mentors(request, pk):
    """List workspace mentors. Coordinator/superadmin see all; other workspace members see active only."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    mp = _mentor_profile(request.user)
    is_owner = mp and workspace.mentor == mp
    is_superadmin = request.user.role == 'superadmin'

    if not is_owner and not is_superadmin:
        is_workspace_mentor = mp and WorkspaceMentor.objects.filter(
            workspace=workspace, mentor=mp, status=WorkspaceMentor.STATUS_ACTIVE
        ).exists()
        is_approved_student = WorkspaceMembership.objects.filter(
            workspace=workspace, student__user=request.user, status='approved'
        ).exists()
        if not is_workspace_mentor and not is_approved_student:
            return Response({'detail': 'Not authorized.'}, status=403)

    if is_owner or is_superadmin:
        guests = WorkspaceMentor.objects.filter(workspace=workspace).select_related('mentor__user')
    else:
        guests = WorkspaceMentor.objects.filter(
            workspace=workspace, status=WorkspaceMentor.STATUS_ACTIVE
        ).select_related('mentor__user')
    data = []
    for g in guests:
        u = g.mentor.user
        data.append({
            'id': g.id,
            'mentor_id': u.id,
            'mentor_name': f"{u.first_name} {u.last_name}".strip() or u.username,
            'mentor_picture': g.mentor.profile_picture.url if g.mentor.profile_picture else None,
            'status': g.status,
            'invited_at': g.invited_at.isoformat(),
            'joined_at': g.joined_at.isoformat() if g.joined_at else None,
        })
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def workspace_invite_mentor(request, pk):
    """Coordinator invites another mentor to the workspace."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    mp = _mentor_profile(request.user)
    if not mp or workspace.mentor != mp:
        return Response({'detail': 'Only the workspace coordinator can invite mentors.'}, status=403)
    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'detail': 'user_id is required.'}, status=400)
    target_user = get_object_or_404(CustomUser, pk=user_id, role='mentor')
    target_mp = MentorProfile.objects.filter(user=target_user).first()
    if not target_mp:
        return Response({'detail': 'Mentor profile not found.'}, status=404)
    if WorkspaceMentor.objects.filter(workspace=workspace, mentor=target_mp).exists():
        return Response({'detail': 'This mentor is already invited or active.'}, status=400)
    WorkspaceMentor.objects.create(
        workspace=workspace, mentor=target_mp,
        status=WorkspaceMentor.STATUS_INVITED, invited_by=request.user,
    )
    Notification.objects.create(
        recipient=target_user,
        notif_type=Notification.TYPE_MENTOR_INVITE,
        title=f"You've been invited to mentor in \"{workspace.name}\"",
        body=f"{request.user.get_full_name() or request.user.username} invited you to be a mentor in their workspace.",
        link=f'/w/{workspace.slug}',
    )
    return Response({'detail': 'Mentor invitation sent.'}, status=201)


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def workspace_accept_mentor(request, pk):
    """POST: invited mentor accepts. DELETE: decline invite or leave workspace."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    mp = _mentor_profile(request.user)
    if not mp:
        return Response({'detail': 'Mentor profile not found.'}, status=404)
    guest = WorkspaceMentor.objects.filter(workspace=workspace, mentor=mp).first()
    if not guest:
        return Response({'detail': 'No pending invitation found.'}, status=404)
    if request.method == 'POST':
        if guest.status != WorkspaceMentor.STATUS_INVITED:
            return Response({'detail': 'Already accepted.'}, status=400)
        guest.status = WorkspaceMentor.STATUS_ACTIVE
        guest.joined_at = timezone.now()
        guest.save()
        return Response(WorkspaceSerializer(workspace, context={'request': request}).data)
    # DELETE — decline or leave
    guest.delete()
    return Response(status=204)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def workspace_remove_mentor(request, pk, gid):
    """Coordinator removes a mentor from the workspace."""
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    mp = _mentor_profile(request.user)
    if not mp or workspace.mentor != mp:
        return Response({'detail': 'Only the workspace coordinator can remove mentors.'}, status=403)
    guest = get_object_or_404(WorkspaceMentor, pk=gid, workspace=workspace)
    guest.delete()
    return Response(status=204)





# ── Personal Tasks ─────────────────────────────────────────────────────────

def _fire_due_reminders(student):
    now = datetime.now()
    pending = PersonalTask.objects.filter(
        student=student, reminder_sent=False, reminder_offset__isnull=False,
        start_time__isnull=False,
    )
    for task in pending:
        event_dt  = datetime.combine(task.date, task.start_time)
        remind_at = event_dt - timedelta(minutes=task.reminder_offset)
        if remind_at <= now <= event_dt + timedelta(minutes=30):
            Notification.objects.create(
                recipient=student.user,
                notif_type='task_reminder',
                title=f"Reminder: {task.title}",
                body=task.description[:100] if task.description else '',
                link='/student/dashboard',
            )
            task.reminder_sent = True
            task.save(update_fields=['reminder_sent'])


# ── Workspace Events ──────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def workspace_events(request, pk):
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    if request.method == 'GET':
        events = WorkspaceEvent.objects.filter(workspace=workspace)
        return Response(WorkspaceEventSerializer(events, many=True).data)
    if not _is_workspace_write_mentor(workspace, request.user):
        return Response({'detail': 'Forbidden.'}, status=403)
    serializer = WorkspaceEventSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(workspace=workspace)
    return Response(serializer.data, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def workspace_event_detail(request, pk, eid):
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    event = get_object_or_404(WorkspaceEvent, pk=eid, workspace=workspace)
    if not _is_workspace_write_mentor(workspace, request.user):
        return Response({'detail': 'Forbidden.'}, status=403)
    if request.method == 'DELETE':
        event.delete()
        return Response(status=204)
    serializer = WorkspaceEventSerializer(event, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def personal_tasks_list(request):
    student = StudentProfile.objects.filter(user=request.user).first()
    if not student:
        return Response({'detail': 'Student profile not found.'}, status=403)

    if request.method == 'GET':
        _fire_due_reminders(student)
        tasks = PersonalTask.objects.filter(student=student)
        return Response(PersonalTaskSerializer(tasks, many=True).data)

    serializer = PersonalTaskSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(student=student)
    return Response(serializer.data, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def personal_task_detail(request, pk):
    student = StudentProfile.objects.filter(user=request.user).first()
    if not student:
        return Response({'detail': 'Student profile not found.'}, status=403)

    task = get_object_or_404(PersonalTask, pk=pk, student=student)

    if request.method == 'DELETE':
        task.delete()
        return Response(status=204)

    serializer = PersonalTaskSerializer(task, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


# ---------------------------------------------------------------------------
# Workspace Feed
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def workspace_feed_list(request, pk):
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)

    if request.method == 'GET':
        posts = (
            Post.objects.filter(workspace=workspace)
            .prefetch_related('reactions', 'comments')
            .select_related('author')
            .order_by('-created_at')
        )
        return Response([_serialize_post(p, request.user) for p in posts])

    if not _is_workspace_write_mentor(workspace, request.user):
        return Response({'detail': 'Only mentors can post.'}, status=403)

    post = Post.objects.create(
        author          = request.user,
        workspace       = workspace,
        post_type       = Post.TYPE_GENERAL,
        title           = '',
        body            = request.data.get('body', ''),
        image           = request.FILES.get('image') or None,
        allow_comments  = False,
        allow_reactions = False,
    )
    return Response(_serialize_post(post, request.user), status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def workspace_feed_detail(request, pk, post_pk):
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    post = get_object_or_404(Post, pk=post_pk, workspace=workspace)

    if not _is_workspace_write_mentor(workspace, request.user):
        return Response({'detail': 'Only mentors can edit posts.'}, status=403)

    is_coordinator = (workspace.mentor == _mentor_profile(request.user))
    if not is_coordinator and post.author != request.user:
        return Response({'detail': 'You can only edit your own posts.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        post.delete()
        return Response(status=204)

    post.body = request.data.get('body', post.body)
    if 'is_pinned' in request.data:
        post.is_pinned = str(request.data['is_pinned']).lower() in ('true', '1')
    if 'image' in request.FILES:
        post.image = request.FILES['image']
    elif request.data.get('remove_image') == 'true':
        post.image = None
    post.save(update_fields=['body', 'image', 'is_pinned', 'updated_at'])
    return Response(_serialize_post(post, request.user))


# ── Workspace Chat Channels & Messages ────────────────────────────────────

def _ws_chat_access(user, workspace):
    if user.role == 'superadmin':
        return True
    is_coordinator = hasattr(workspace, 'mentor') and workspace.mentor.user_id == user.id
    if is_coordinator:
        return True
    mp = _mentor_profile(user)
    if mp and WorkspaceMentor.objects.filter(
        workspace=workspace, mentor=mp, status=WorkspaceMentor.STATUS_ACTIVE
    ).exists():
        return True
    return WorkspaceMembership.objects.filter(
        workspace=workspace, student__user=user, status='approved'
    ).exists()


def _serialize_channel(ch):
    return {
        'id':           ch.id,
        'name':         ch.name,
        'description':  ch.description,
        'channel_type': ch.channel_type,
        'is_archived':  ch.is_archived,
        'created_at':   ch.created_at.isoformat(),
    }


def _serialize_chat_msg_full(msg, request=None):
    sender = msg.sender
    reply_data = None
    if msg.reply_to_id:
        try:
            rt = WorkspaceChatMessage.objects.select_related('sender').get(pk=msg.reply_to_id)
            reply_data = {
                'id':          rt.id,
                'body':        rt.body[:80],
                'sender_name': (f"{rt.sender.first_name} {rt.sender.last_name}".strip()
                                or rt.sender.username),
            }
        except WorkspaceChatMessage.DoesNotExist:
            pass
    reactions = list(msg.reactions.select_related('user').all())
    attachment_url = None
    attachment_name = None
    if msg.attachment:
        attachment_name = msg.attachment.name.split('/')[-1]
        attachment_url = msg.attachment.url
    return {
        'id':              msg.id,
        'sender': {
            'id': sender.id, 'username': sender.username,
            'first_name': sender.first_name or '', 'last_name': sender.last_name or '',
            'role': sender.role,
            'profile_picture': _user_pic(sender),
        },
        'body':            msg.body,
        'attachment_url':  attachment_url,
        'attachment_name': attachment_name,
        'message_type':    msg.message_type,
        'is_pinned':       msg.is_pinned,
        'reply_to':        reply_data,
        'reactions': [
            {'id': r.id, 'emoji': r.emoji, 'user': {
                'id': r.user.id, 'username': r.user.username,
                'first_name': r.user.first_name or '', 'last_name': r.user.last_name or '',
            }} for r in reactions
        ],
        'created_at':      msg.created_at.isoformat(),
    }


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def workspace_channels(request, pk):
    workspace = get_object_or_404(Workspace, pk=pk)
    if not _ws_chat_access(request.user, workspace):
        return Response({'detail': 'Not a member.'}, status=403)

    if request.method == 'GET':
        channels = workspace.channels.filter(is_archived=False)
        return Response([_serialize_channel(ch) for ch in channels])

    mp = _mentor_profile(request.user)
    if not (mp and workspace.mentor == mp) and request.user.role != 'superadmin':
        return Response({'detail': 'Only the owner can create channels.'}, status=403)
    name = request.data.get('name', '').strip()
    if not name:
        return Response({'detail': 'Channel name is required.'}, status=400)
    ch = WorkspaceChatChannel.objects.create(
        workspace=workspace,
        name=name,
        description=request.data.get('description', ''),
        channel_type='custom',
        created_by=request.user,
    )
    return Response(_serialize_channel(ch), status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def workspace_channel_detail(request, pk, cid):
    workspace = get_object_or_404(Workspace, pk=pk)
    ch = get_object_or_404(WorkspaceChatChannel, pk=cid, workspace=workspace)
    if not _ws_chat_access(request.user, workspace):
        return Response({'detail': 'Not a member.'}, status=403)

    if request.method == 'GET':
        return Response(_serialize_channel(ch))

    mp = _mentor_profile(request.user)
    is_owner = (mp and workspace.mentor == mp) or request.user.role == 'superadmin'
    if not is_owner:
        return Response({'detail': 'Only the owner can modify channels.'}, status=403)

    if request.method == 'DELETE':
        ch.delete()
        return Response(status=204)

    if 'name' in request.data:
        ch.name = request.data['name'].strip() or ch.name
    if 'description' in request.data:
        ch.description = request.data['description']
    if 'is_archived' in request.data:
        ch.is_archived = str(request.data['is_archived']).lower() in ('true', '1')
    ch.save()
    return Response(_serialize_channel(ch))


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def workspace_channel_messages(request, pk, cid):
    workspace = get_object_or_404(Workspace, pk=pk)
    ch = get_object_or_404(WorkspaceChatChannel, pk=cid, workspace=workspace)
    if not _ws_chat_access(request.user, workspace):
        return Response({'detail': 'Not a member.'}, status=403)

    if request.method == 'GET':
        msgs = (WorkspaceChatMessage.objects
                .filter(channel=ch)
                .select_related(
                    'sender', 'sender__mentor_profile', 'sender__student_profile',
                    'reply_to__sender',
                )
                .prefetch_related('reactions__user')
                .order_by('created_at')[:200])
        return Response([_serialize_chat_msg_full(m, request) for m in msgs])

    body = request.data.get('body', '').strip()
    attachment = request.FILES.get('attachment')
    if not body and not attachment:
        return Response({'detail': 'Message body or attachment is required.'}, status=400)
    reply_to = None
    if request.data.get('reply_to_id'):
        try:
            reply_to = WorkspaceChatMessage.objects.get(pk=request.data['reply_to_id'])
        except WorkspaceChatMessage.DoesNotExist:
            pass
    msg = WorkspaceChatMessage.objects.create(
        workspace=workspace,
        channel=ch,
        sender=request.user,
        body=body,
        attachment=attachment,
        message_type=request.data.get('message_type', 'message'),
        reply_to=reply_to,
    )
    serialized = _serialize_chat_msg_full(msg, request)
    # Broadcast via WebSocket
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'ws_wsch_{pk}_{cid}',
            {'type': 'chat.broadcast', 'payload': {'type': 'message', 'data': serialized}},
        )
    except Exception:
        pass
    return Response(serialized, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def workspace_channel_message_detail(request, pk, cid, mid):
    workspace = get_object_or_404(Workspace, pk=pk)
    ch = get_object_or_404(WorkspaceChatChannel, pk=cid, workspace=workspace)
    msg = get_object_or_404(WorkspaceChatMessage, pk=mid, channel=ch)
    if not _ws_chat_access(request.user, workspace):
        return Response({'detail': 'Not a member.'}, status=403)

    mp = _mentor_profile(request.user)
    is_owner = (mp and workspace.mentor == mp) or request.user.role == 'superadmin'

    if request.method == 'DELETE':
        if not (is_owner or msg.sender_id == request.user.id):
            return Response({'detail': 'Cannot delete this message.'}, status=403)
        msg.delete()
        return Response(status=204)

    if 'body' in request.data:
        if msg.sender_id != request.user.id:
            return Response({'detail': 'Cannot edit this message.'}, status=403)
        body = str(request.data['body']).strip()
        if not body:
            return Response({'detail': 'Body cannot be empty.'}, status=400)
        msg.body = body
        msg.save(update_fields=['body'])

    if 'is_pinned' in request.data and is_owner:
        msg.is_pinned = str(request.data['is_pinned']).lower() in ('true', '1')
        msg.save(update_fields=['is_pinned'])
    return Response(_serialize_chat_msg_full(msg, request))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def workspace_channel_message_react(request, pk, cid, mid):
    workspace = get_object_or_404(Workspace, pk=pk)
    ch = get_object_or_404(WorkspaceChatChannel, pk=cid, workspace=workspace)
    msg = get_object_or_404(WorkspaceChatMessage, pk=mid, channel=ch)
    if not _ws_chat_access(request.user, workspace):
        return Response({'detail': 'Not a member.'}, status=403)

    emoji = request.data.get('emoji', '')
    valid = {c[0] for c in WorkspaceChatReaction.EMOJI_CHOICES}
    if emoji not in valid:
        return Response({'detail': 'Invalid emoji.'}, status=400)

    existing = WorkspaceChatReaction.objects.filter(message=msg, user=request.user, emoji=emoji).first()
    if existing:
        existing.delete()
    else:
        WorkspaceChatReaction.objects.create(message=msg, user=request.user, emoji=emoji)

    reactions = list(WorkspaceChatReaction.objects.filter(message=msg).select_related('user'))
    result = {
        'message_id': mid,
        'reactions': [
            {'id': r.id, 'emoji': r.emoji, 'user': {
                'id': r.user.id, 'username': r.user.username,
                'first_name': r.user.first_name or '', 'last_name': r.user.last_name or '',
            }} for r in reactions
        ],
    }
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'ws_wsch_{pk}_{cid}',
            {'type': 'chat.broadcast', 'payload': {'type': 'reaction', 'data': result}},
        )
    except Exception:
        pass
    return Response(result)


# ── Workspace DMs ─────────────────────────────────────────────────────────

def _serialize_dm_msg(msg, request=None):
    s, r = msg.sender, msg.receiver
    attachment_url = None
    if msg.attachment:
        attachment_url = msg.attachment.url
    return {
        'id': msg.id,
        'sender':   {'id': s.id, 'username': s.username, 'first_name': s.first_name or '', 'last_name': s.last_name or '',
                     'profile_picture': _user_pic(s)},
        'receiver': {'id': r.id, 'username': r.username, 'first_name': r.first_name or '', 'last_name': r.last_name or '',
                     'profile_picture': _user_pic(r)},
        'body': msg.body,
        'attachment_url': attachment_url,
        'created_at': msg.created_at.isoformat(),
        'is_read': msg.is_read,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def workspace_dms(request, pk):
    workspace = get_object_or_404(Workspace, pk=pk)
    if not _ws_chat_access(request.user, workspace):
        return Response({'detail': 'Not a member.'}, status=403)

    user = request.user
    sent_ids    = WorkspaceDMMessage.objects.filter(workspace=workspace, sender=user).values_list('receiver_id', flat=True).distinct()
    recv_ids    = WorkspaceDMMessage.objects.filter(workspace=workspace, receiver=user).values_list('sender_id', flat=True).distinct()
    other_ids   = set(sent_ids) | set(recv_ids)

    # Fetch all relevant users with profiles in one query
    other_users = {u.id: u for u in CustomUser.objects.filter(pk__in=other_ids)
                   .select_related('mentor_profile', 'student_profile')}

    # Fetch last message per partner in a single pass using subquery approach
    from django.db.models import OuterRef, Subquery
    last_msg_qs = (WorkspaceDMMessage.objects
                   .filter(workspace=workspace)
                   .filter(
                       Q(sender_id=OuterRef('pk'), receiver=user) |
                       Q(sender=user, receiver_id=OuterRef('pk'))
                   )
                   .order_by('-created_at')
                   .values('id')[:1])
    last_msg_ids = CustomUser.objects.filter(pk__in=other_ids).annotate(
        last_msg_id=Subquery(last_msg_qs)
    ).values_list('pk', 'last_msg_id')
    last_msgs = {m.id: m for m in WorkspaceDMMessage.objects.filter(
        pk__in=[mid for _, mid in last_msg_ids if mid]
    ).select_related('sender', 'receiver')}
    uid_to_last_id = {uid: mid for uid, mid in last_msg_ids if mid}

    # Fetch unread counts in a single aggregation
    from django.db.models import Count
    unread_counts = dict(
        WorkspaceDMMessage.objects
        .filter(workspace=workspace, receiver=user, is_read=False, sender_id__in=other_ids)
        .values('sender_id')
        .annotate(cnt=Count('id'))
        .values_list('sender_id', 'cnt')
    )

    convs = []
    for uid, other in other_users.items():
        last_id = uid_to_last_id.get(uid)
        if not last_id:
            continue
        last = last_msgs.get(last_id)
        if not last:
            continue
        convs.append({
            'user': {'id': other.id, 'username': other.username,
                     'first_name': other.first_name or '', 'last_name': other.last_name or '',
                     'role': other.role, 'profile_picture': _user_pic(other)},
            'last_message': (last.body or '(attachment)')[:80],
            'last_at': last.created_at.isoformat(),
            'unread': unread_counts.get(uid, 0),
        })
    convs.sort(key=lambda c: c['last_at'], reverse=True)
    return Response(convs)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def workspace_dm_messages(request, pk, user_id):
    workspace = get_object_or_404(Workspace, pk=pk)
    if not _ws_chat_access(request.user, workspace):
        return Response({'detail': 'Not a member.'}, status=403)
    other = get_object_or_404(CustomUser, pk=user_id)
    user = request.user

    if request.method == 'GET':
        WorkspaceDMMessage.objects.filter(workspace=workspace, sender=other, receiver=user, is_read=False).update(is_read=True)
        msgs = (WorkspaceDMMessage.objects
                .filter(workspace=workspace)
                .filter(Q(sender=user, receiver=other) | Q(sender=other, receiver=user))
                .order_by('created_at')[:200])
        return Response([_serialize_dm_msg(m, request) for m in msgs])

    body = request.data.get('body', '').strip()
    attachment = request.FILES.get('attachment')
    if not body and not attachment:
        return Response({'detail': 'Body or attachment required.'}, status=400)
    msg = WorkspaceDMMessage.objects.create(
        workspace=workspace, sender=user, receiver=other, body=body, attachment=attachment,
    )
    serialized = _serialize_dm_msg(msg, request)
    uid1, uid2 = sorted([user.id, other.id])
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'ws_wsdm_{pk}_{uid1}_{uid2}',
            {'type': 'dm.broadcast', 'payload': {'type': 'message', 'data': serialized}},
        )
    except Exception:
        pass
    return Response(serialized, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def workspace_dm_message_detail(request, pk, user_id, mid):
    workspace = get_object_or_404(Workspace, pk=pk)
    if not _ws_chat_access(request.user, workspace):
        return Response({'detail': 'Not a member.'}, status=403)
    msg = get_object_or_404(WorkspaceDMMessage, pk=mid, workspace=workspace)
    if msg.sender_id != request.user.id:
        return Response({'detail': 'Cannot modify this message.'}, status=403)

    if request.method == 'DELETE':
        msg.delete()
        other_id = msg.receiver_id if msg.sender_id == request.user.id else msg.sender_id
        uid1, uid2 = sorted([request.user.id, other_id])
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'ws_wsdm_{pk}_{uid1}_{uid2}',
                {'type': 'dm.broadcast', 'payload': {'type': 'dm_delete', 'data': {'id': mid}}},
            )
        except Exception:
            pass
        return Response(status=204)

    body = str(request.data.get('body', '')).strip()
    if not body:
        return Response({'detail': 'Body cannot be empty.'}, status=400)
    msg.body = body
    msg.save(update_fields=['body'])
    serialized = _serialize_dm_msg(msg, request)
    other_id = msg.receiver_id
    uid1, uid2 = sorted([request.user.id, other_id])
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'ws_wsdm_{pk}_{uid1}_{uid2}',
            {'type': 'dm.broadcast', 'payload': {'type': 'dm_edit', 'data': serialized}},
        )
    except Exception:
        pass
    return Response(serialized)


# ── Workspace Polls ───────────────────────────────────────────────────────

def _serialize_poll(poll, user):
    options = list(poll.options.prefetch_related('voters').all())
    total = sum(o.voters.count() for o in options)
    return {
        'id':            poll.id,
        'author': {'id': poll.author.id, 'username': poll.author.username,
                   'first_name': poll.author.first_name or '', 'last_name': poll.author.last_name or ''},
        'question':      poll.question,
        'allow_multiple': poll.allow_multiple,
        'is_closed':     poll.is_closed,
        'total_votes':   total,
        'created_at':    poll.created_at.isoformat(),
        'options': [
            {
                'id':         o.id,
                'text':       o.text,
                'vote_count': o.voters.count(),
                'my_vote':    o.voters.filter(pk=user.id).exists(),
            }
            for o in options
        ],
    }


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def workspace_polls(request, pk):
    workspace = get_object_or_404(Workspace, pk=pk)
    if not _ws_chat_access(request.user, workspace):
        return Response({'detail': 'Not a member.'}, status=403)

    if request.method == 'GET':
        polls = workspace.polls.prefetch_related('options__voters').select_related('author')
        return Response([_serialize_poll(p, request.user) for p in polls])

    question = request.data.get('question', '').strip()
    if not question:
        return Response({'detail': 'Question is required.'}, status=400)
    options_texts = request.data.get('options', [])
    if len(options_texts) < 2:
        return Response({'detail': 'At least 2 options are required.'}, status=400)
    poll = WorkspacePoll.objects.create(
        workspace=workspace,
        author=request.user,
        question=question,
        allow_multiple=str(request.data.get('allow_multiple', 'false')).lower() in ('true', '1'),
    )
    for text in options_texts[:6]:
        if str(text).strip():
            WorkspacePollOption.objects.create(poll=poll, text=str(text).strip())
    return Response(_serialize_poll(poll, request.user), status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def workspace_poll_detail(request, pk, pid):
    workspace = get_object_or_404(Workspace, pk=pk)
    poll = get_object_or_404(WorkspacePoll, pk=pid, workspace=workspace)
    if not _ws_chat_access(request.user, workspace):
        return Response({'detail': 'Not a member.'}, status=403)

    mp = _mentor_profile(request.user)
    is_owner = (mp and workspace.mentor == mp) or request.user.role == 'superadmin'
    is_author = poll.author_id == request.user.id

    if request.method == 'DELETE':
        if not (is_owner or is_author):
            return Response({'detail': 'Cannot delete this poll.'}, status=403)
        poll.delete()
        return Response(status=204)

    if not (is_owner or is_author):
        return Response({'detail': 'Cannot modify this poll.'}, status=403)
    if 'is_closed' in request.data:
        poll.is_closed = str(request.data['is_closed']).lower() in ('true', '1')
        poll.save(update_fields=['is_closed'])
    return Response(_serialize_poll(poll, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def workspace_poll_vote(request, pk, pid):
    workspace = get_object_or_404(Workspace, pk=pk)
    poll = get_object_or_404(WorkspacePoll, pk=pid, workspace=workspace)
    if not _ws_chat_access(request.user, workspace):
        return Response({'detail': 'Not a member.'}, status=403)
    if poll.is_closed:
        return Response({'detail': 'Poll is closed.'}, status=400)

    option_id = request.data.get('option_id')
    option = get_object_or_404(WorkspacePollOption, pk=option_id, poll=poll)

    if not poll.allow_multiple:
        for opt in poll.options.all():
            opt.voters.remove(request.user)

    if option.voters.filter(pk=request.user.id).exists():
        option.voters.remove(request.user)
    else:
        option.voters.add(request.user)

    return Response(_serialize_poll(poll, request.user))


# ── Mentor Analytics ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mentor_analytics(request):
    from django.utils import timezone
    if not request.user.is_mentor:
        return Response({'error': 'Mentor only'}, status=403)

    mentor = request.user.mentor_profile
    workspace_id = request.query_params.get('workspace')
    workspaces = Workspace.objects.filter(mentor=mentor, is_active=True)
    if workspace_id:
        try:
            workspaces = workspaces.filter(id=int(workspace_id))
        except (ValueError, TypeError):
            pass

    ws_list = list(workspaces)

    memberships = WorkspaceMembership.objects.filter(
        workspace__in=ws_list, status='approved'
    ).select_related('student', 'student__user')

    submissions = WorkspaceTaskSubmission.objects.filter(
        task__workspace__in=ws_list,
        task__status='published',
        task__is_template=False,
    ).select_related('task', 'task__workspace', 'student', 'student__user')

    # ── summary ──────────────────────────────────────────────────────────────
    student_ids = set(memberships.values_list('student_id', flat=True))
    total_tasks = WorkspaceTask.objects.filter(
        workspace__in=ws_list, status='published', is_template=False
    ).count()
    total_subs = submissions.count()
    completed_count = submissions.filter(status='completed').count()
    overall_pct = round(completed_count / total_subs * 100, 1) if total_subs else 0.0

    one_week_ago = timezone.now() - timedelta(days=7)
    active_this_week = submissions.filter(
        submitted_at__isnull=False,
        submitted_at__gte=one_week_ago,
    ).values('student_id').distinct().count()

    # ── status distribution ───────────────────────────────────────────────────
    status_dist = [
        {'status': r['status'], 'count': r['count']}
        for r in submissions.values('status').annotate(count=Count('id'))
    ]

    # ── workspace completion ──────────────────────────────────────────────────
    ws_completion = []
    for ws in ws_list:
        ws_subs = submissions.filter(task__workspace=ws)
        total = ws_subs.count()
        done = ws_subs.filter(status='completed').count()
        ws_completion.append({
            'workspace_id': ws.id,
            'workspace_name': ws.name,
            'workspace_slug': ws.slug,
            'total': total,
            'completed': done,
            'completion_pct': round(done / total * 100, 1) if total else 0.0,
        })

    # ── helpers ───────────────────────────────────────────────────────────────
    def _student_name(sp):
        name = f"{sp.user.first_name} {sp.user.last_name}".strip()
        return name or sp.user.username

    def _student_pic(sp):
        return sp.profile_picture.url if sp.profile_picture else None

    # ── student bars ─────────────────────────────────────────────────────────
    student_bars = []
    for sid in student_ids:
        st_subs = submissions.filter(student_id=sid)
        if not st_subs.exists():
            continue
        sp = st_subs.first().student
        counts = {s: 0 for s in ['not_started', 'in_progress', 'submitted', 'needs_revision', 'resubmitted', 'completed']}
        for row in st_subs.values('status').annotate(c=Count('id')):
            counts[row['status']] = row['c']
        student_bars.append({
            'student_id': sp.id,
            'student_name': _student_name(sp),
            'student_picture': _student_pic(sp),
            **counts,
            'total': sum(counts.values()),
        })
    student_bars.sort(key=lambda x: -x['completed'])

    # ── student × workspace matrix ────────────────────────────────────────────
    student_matrix = []
    for sid in student_ids:
        st_subs = submissions.filter(student_id=sid)
        if not st_subs.exists():
            continue
        sp = st_subs.first().student
        ws_map = {}
        for ws in ws_list:
            ws_subs = st_subs.filter(task__workspace=ws)
            total = ws_subs.count()
            done = ws_subs.filter(status='completed').count()
            ws_map[ws.slug] = {
                'pct': round(done / total * 100) if total else 0,
                'completed': done,
                'total': total,
            }
        student_matrix.append({
            'student_id': sp.id,
            'student_name': _student_name(sp),
            'student_picture': _student_pic(sp),
            'workspaces': ws_map,
        })

    # ── leaderboard ───────────────────────────────────────────────────────────
    leaderboard = []
    for sid in student_ids:
        st_subs = submissions.filter(student_id=sid)
        if not st_subs.exists():
            continue
        sp = st_subs.first().student
        total_score = WorkspaceTaskRubricScore.objects.filter(
            submission__in=st_subs
        ).aggregate(total=Sum('points'))['total'] or 0
        max_score = WorkspaceTaskRubricCriteria.objects.filter(
            task__in=st_subs.values('task')
        ).aggregate(total=Sum('max_points'))['total'] or 0
        leaderboard.append({
            'student_id': sp.id,
            'student_name': _student_name(sp),
            'student_picture': _student_pic(sp),
            'total_score': total_score,
            'max_score': max_score,
            'completed_count': st_subs.filter(status='completed').count(),
            'total_tasks': st_subs.count(),
        })
    leaderboard.sort(key=lambda x: (-x['completed_count'], -x['total_score']))
    for i, row in enumerate(leaderboard):
        row['rank'] = i + 1

    # ── at-risk (in_progress/needs_revision, no activity in 7+ days) ─────────
    threshold = timezone.now() - timedelta(days=7)
    at_risk_subs = submissions.filter(
        status__in=['in_progress', 'needs_revision'],
    ).filter(
        Q(submitted_at__lt=threshold) | Q(submitted_at__isnull=True, assigned_at__lt=threshold)
    )
    at_risk_map = {}
    for sub in at_risk_subs.select_related('student', 'student__user', 'task__workspace'):
        sid = sub.student_id
        last_time = sub.submitted_at or sub.assigned_at
        days = (timezone.now() - last_time).days if last_time else 0
        if sid not in at_risk_map or at_risk_map[sid]['days_since_last_activity'] < days:
            sp = sub.student
            at_risk_map[sid] = {
                'student_id': sp.id,
                'student_name': _student_name(sp),
                'student_picture': _student_pic(sp),
                'days_since_last_activity': days,
                'in_progress_count': 0,
                'workspace_name': sub.task.workspace.name,
            }
        at_risk_map[sid]['in_progress_count'] += 1
    at_risk = sorted(at_risk_map.values(), key=lambda x: -x['days_since_last_activity'])

    # ── task breakdown ────────────────────────────────────────────────────────
    tasks = WorkspaceTask.objects.filter(
        workspace__in=ws_list, status='published', is_template=False
    ).select_related('workspace')
    task_breakdown = []
    for task in tasks:
        t_subs = submissions.filter(task=task)
        counts = {s: 0 for s in ['not_started', 'in_progress', 'submitted', 'needs_revision', 'resubmitted', 'completed']}
        for row in t_subs.values('status').annotate(c=Count('id')):
            counts[row['status']] = row['c']
        task_breakdown.append({
            'task_id': task.id,
            'task_title': task.title,
            'workspace_name': task.workspace.name,
            **counts,
            'total': sum(counts.values()),
        })

    # ── problem tasks ─────────────────────────────────────────────────────────
    problem_tasks = []
    for t in task_breakdown:
        if t['needs_revision'] > 0:
            problem_tasks.append({
                'task_id': t['task_id'],
                'task_title': t['task_title'],
                'workspace_name': t['workspace_name'],
                'needs_revision_count': t['needs_revision'],
                'total': t['total'],
                'revision_pct': round(t['needs_revision'] / t['total'] * 100, 1) if t['total'] else 0,
            })
    problem_tasks.sort(key=lambda x: -x['revision_pct'])

    # ── low engagement ────────────────────────────────────────────────────────
    low_engagement = []
    for task in tasks:
        ws_member_count = memberships.filter(workspace=task.workspace).count()
        started = submissions.filter(task=task).exclude(status='not_started').count()
        eng_pct = round(started / ws_member_count * 100, 1) if ws_member_count else 0.0
        if eng_pct < 50:
            low_engagement.append({
                'task_id': task.id,
                'task_title': task.title,
                'workspace_name': task.workspace.name,
                'started_count': started,
                'total_members': ws_member_count,
                'engagement_pct': eng_pct,
            })
    low_engagement.sort(key=lambda x: x['engagement_pct'])

    # ── submission log ────────────────────────────────────────────────────────
    log_subs = list(
        submissions.exclude(status='not_started').order_by('-submitted_at', '-assigned_at')[:100]
    )
    submission_log = []
    for sub in log_subs:
        score_agg = WorkspaceTaskRubricScore.objects.filter(
            submission=sub
        ).aggregate(total=Sum('points'))
        last_time = sub.submitted_at or sub.assigned_at
        submission_log.append({
            'student_name': _student_name(sub.student),
            'student_picture': _student_pic(sub.student),
            'task_title': sub.task.title,
            'workspace_name': sub.task.workspace.name,
            'status': sub.status,
            'score': score_agg['total'],
            'updated_at': last_time.isoformat() if last_time else '',
        })

    return Response({
        'summary': {
            'total_students': len(student_ids),
            'total_tasks': total_tasks,
            'overall_completion_pct': overall_pct,
            'active_this_week': active_this_week,
            'workspaces': [{'id': ws.id, 'name': ws.name, 'slug': ws.slug} for ws in ws_list],
        },
        'status_distribution': status_dist,
        'workspace_completion': ws_completion,
        'student_bars': student_bars,
        'student_matrix': student_matrix,
        'leaderboard': leaderboard,
        'at_risk': at_risk,
        'task_breakdown': task_breakdown,
        'problem_tasks': problem_tasks,
        'low_engagement': low_engagement,
        'submission_log': submission_log,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mentor_analytics_trend(request):
    from django.utils import timezone
    if not request.user.is_mentor:
        return Response({'error': 'Mentor only'}, status=403)

    mentor = request.user.mentor_profile
    workspace_id = request.query_params.get('workspace')
    range_param = request.query_params.get('range', '30d')

    workspaces = Workspace.objects.filter(mentor=mentor, is_active=True)
    if workspace_id:
        try:
            workspaces = workspaces.filter(id=int(workspace_id))
        except (ValueError, TypeError):
            pass

    since = None
    if range_param == '7d':
        since = timezone.now() - timedelta(days=7)
    elif range_param == '30d':
        since = timezone.now() - timedelta(days=30)
    elif range_param == '90d':
        since = timezone.now() - timedelta(days=90)

    subs_qs = WorkspaceTaskSubmission.objects.filter(
        task__workspace__in=workspaces,
        task__status='published',
        submitted_at__isnull=False,
    )
    if since:
        subs_qs = subs_qs.filter(submitted_at__gte=since)

    trend_rows = list(
        subs_qs
        .annotate(date=TruncDate('submitted_at'))
        .values('date')
        .annotate(count=Count('id'))
        .order_by('date')
    )
    submission_trend = [
        {'date': r['date'].isoformat(), 'count': r['count']}
        for r in trend_rows
    ]

    workspace_activity = []
    for ws in workspaces:
        ws_subs = subs_qs.filter(task__workspace=ws)
        weekly = list(
            ws_subs
            .annotate(week=TruncWeek('submitted_at'))
            .values('week')
            .annotate(count=Count('id'))
            .order_by('week')
        )
        workspace_activity.append({
            'workspace_name': ws.name,
            'workspace_slug': ws.slug,
            'data': [
                {'date': r['week'].strftime('%Y-W%V'), 'count': r['count']}
                for r in weekly
            ],
        })

    return Response({
        'submission_trend': submission_trend,
        'workspace_activity': workspace_activity,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mentor_review_queue(request):
    if not request.user.is_mentor:
        return Response({'error': 'Mentor only'}, status=403)

    mentor = request.user.mentor_profile
    workspaces = Workspace.objects.filter(mentor=mentor, is_active=True)

    submissions = WorkspaceTaskSubmission.objects.filter(
        task__workspace__in=workspaces,
        task__status='published',
        task__is_template=False,
        status='submitted',
    ).select_related(
        'task', 'task__workspace', 'student', 'student__user'
    ).order_by('submitted_at')

    def _name(sp):
        n = f"{sp.user.first_name} {sp.user.last_name}".strip()
        return n or sp.user.username

    def _pic(sp):
        return sp.profile_picture.url if sp.profile_picture else None

    return Response([
        {
            'submission_id': sub.id,
            'student_id': sub.student.id,
            'student_name': _name(sub.student),
            'student_picture': _pic(sub.student),
            'task_id': sub.task.id,
            'task_title': sub.task.title,
            'workspace_id': sub.task.workspace.id,
            'workspace_name': sub.task.workspace.name,
            'workspace_slug': sub.task.workspace.slug,
            'submitted_at': sub.submitted_at.isoformat() if sub.submitted_at else None,
        }
        for sub in submissions
    ])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mentor_upcoming_deadlines(request):
    from django.utils import timezone
    if not request.user.is_mentor:
        return Response({'error': 'Mentor only'}, status=403)

    mentor = request.user.mentor_profile
    today = timezone.now().date()
    in_seven_days = today + timedelta(days=7)

    tasks = WorkspaceTask.objects.filter(
        workspace__mentor=mentor,
        workspace__is_active=True,
        status='published',
        is_template=False,
        due_date__gte=today,
        due_date__lte=in_seven_days,
    ).select_related('workspace').order_by('due_date')

    result = []
    for task in tasks:
        counts = {s: 0 for s in ['not_started', 'in_progress', 'submitted', 'needs_revision', 'resubmitted', 'completed']}
        for row in WorkspaceTaskSubmission.objects.filter(task=task).values('status').annotate(c=Count('id')):
            counts[row['status']] = row['c']
        days_until = (task.due_date - today).days
        result.append({
            'task_id': task.id,
            'task_title': task.title,
            'workspace_id': task.workspace.id,
            'workspace_name': task.workspace.name,
            'workspace_slug': task.workspace.slug,
            'due_date': task.due_date.isoformat(),
            'days_until_due': days_until,
            'total': sum(counts.values()),
            **counts,
        })

    return Response(result)


# ── Private workspace: search users to invite ──────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def workspace_search_users(request, pk):
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    mp = _mentor_profile(request.user)
    if not mp or workspace.mentor != mp:
        return Response({'detail': 'Only the workspace owner can search users.'}, status=403)

    q = request.query_params.get('q', '').strip()
    if len(q) < 2:
        return Response([])

    existing_member_user_ids = WorkspaceMembership.objects.filter(
        workspace=workspace
    ).values_list('student__user_id', flat=True)

    users = CustomUser.objects.filter(
        Q(username__icontains=q) | Q(email__icontains=q) |
        Q(first_name__icontains=q) | Q(last_name__icontains=q),
        role='student',
    ).exclude(id__in=existing_member_user_ids).select_related()[:10]

    results = []
    for u in users:
        sp = StudentProfile.objects.filter(user=u).first()
        results.append({
            'user_id': u.id,
            'username': u.username,
            'email': u.email,
            'display_name': f"{u.first_name} {u.last_name}".strip() or u.username,
            'avatar_url': sp.profile_picture.url if sp and sp.profile_picture else None,
            'role': u.role,
        })
    return Response(results)


# ── Private workspace: direct invite ───────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def workspace_direct_invite(request, pk):
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    mp = _mentor_profile(request.user)
    if not mp or workspace.mentor != mp:
        return Response({'detail': 'Only the workspace owner can invite members.'}, status=403)
    if workspace.privacy != 'private':
        return Response({'detail': 'Direct invite is only available for private workspaces.'}, status=400)

    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'detail': 'user_id is required.'}, status=400)

    target_user = get_object_or_404(CustomUser, pk=user_id, role='student')
    sp = StudentProfile.objects.filter(user=target_user).first()
    if not sp:
        return Response({'detail': 'Student profile not found.'}, status=404)

    if WorkspaceMembership.objects.filter(workspace=workspace, student=sp).exists():
        return Response({'detail': 'User is already a member or has a pending invite.'}, status=400)

    WorkspaceMembership.objects.create(
        workspace=workspace,
        student=sp,
        status=WorkspaceMembership.STATUS_INVITED,
    )
    Notification.objects.create(
        recipient=target_user,
        notif_type=Notification.TYPE_WS_INVITE,
        title=f"You've been invited to join {workspace.name}",
        body=f"{mp.user.get_full_name() or mp.user.username} invited you to join their private workspace.",
        link=f'/w/{workspace.slug}',
    )
    return Response({'detail': 'Invitation sent.'}, status=201)


# ── Accept or decline a workspace invitation ───────────────────────────────

@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def workspace_accept_invite(request, pk):
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    sp = _student_profile(request.user)
    if not sp:
        return Response({'detail': 'Student profile not found.'}, status=404)

    membership = WorkspaceMembership.objects.filter(
        workspace=workspace, student=sp, status=WorkspaceMembership.STATUS_INVITED
    ).first()
    if not membership:
        return Response({'detail': 'No pending invitation found.'}, status=404)

    if request.method == 'DELETE':
        membership.delete()
        return Response(status=204)

    # POST — accept
    from django.utils import timezone
    membership.status = WorkspaceMembership.STATUS_APPROVED
    membership.approved_at = timezone.now()
    membership._accepted_by_student = True  # suppress redundant ws_approved notification
    membership.save()

    # Backfill submissions for published tasks
    eligible_tasks = WorkspaceTask.objects.filter(
        workspace=workspace, status=WorkspaceTask.STATUS_PUBLISHED, is_template=False,
    ).filter(Q(assigned_members__isnull=True) | Q(assigned_members=sp))
    existing_ids = set(
        WorkspaceTaskSubmission.objects.filter(task__in=eligible_tasks, student=sp).values_list('task_id', flat=True)
    )
    backfill = [WorkspaceTaskSubmission(task=t, student=sp) for t in eligible_tasks if t.id not in existing_ids]
    if backfill:
        WorkspaceTaskSubmission.objects.bulk_create(backfill, ignore_conflicts=True)

    return Response(WorkspaceSerializer(workspace, context={'request': request}).data)


# ── Onboarding ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def student_complete_onboarding(request):
    if request.user.role != 'student':
        return Response({'detail': 'Students only.'}, status=403)
    request.user.onboarding_complete = True
    request.user.save(update_fields=['onboarding_complete'])
    return Response({'status': 'ok'})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def workspace_onboarding_questions(request, pk):
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    mp = _mentor_profile(request.user)
    sp = _student_profile(request.user)
    is_owner = mp and workspace.mentor == mp
    is_superadmin = request.user.role == 'superadmin'

    if request.method == 'GET':
        is_approved = WorkspaceMembership.objects.filter(
            workspace=workspace, student=sp, status='approved'
        ).exists() if sp else False
        is_ws_mentor = WorkspaceMentor.objects.filter(
            workspace=workspace, mentor=mp, status=WorkspaceMentor.STATUS_ACTIVE
        ).exists() if mp else False
        if not (is_owner or is_superadmin or is_approved or is_ws_mentor):
            return Response({'detail': 'Not a member.'}, status=403)
        qs = WorkspaceOnboardingQuestion.objects.filter(workspace=workspace)
        return Response(WorkspaceOnboardingQuestionSerializer(qs, many=True).data)

    if not (is_owner or is_superadmin):
        return Response({'detail': 'Coordinators only.'}, status=403)
    last = WorkspaceOnboardingQuestion.objects.filter(workspace=workspace).order_by('-order').first()
    order = request.data.get('order', (last.order + 1) if last else 0)
    q = WorkspaceOnboardingQuestion.objects.create(
        workspace=workspace,
        question_text=request.data.get('question_text', ''),
        order=order,
        required=request.data.get('required', False),
    )
    return Response(WorkspaceOnboardingQuestionSerializer(q).data, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def workspace_onboarding_question_detail(request, pk, qid):
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    question  = get_object_or_404(WorkspaceOnboardingQuestion, pk=qid, workspace=workspace)
    mp = _mentor_profile(request.user)
    is_owner = mp and workspace.mentor == mp
    is_superadmin = request.user.role == 'superadmin'
    if not (is_owner or is_superadmin):
        return Response({'detail': 'Coordinators only.'}, status=403)

    if request.method == 'DELETE':
        question.delete()
        return Response(status=204)

    ser = WorkspaceOnboardingQuestionSerializer(question, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ser.data)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def workspace_onboarding_my_response(request, pk):
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    sp = _student_profile(request.user)
    if not sp:
        return Response({'detail': 'Students only.'}, status=403)
    membership = WorkspaceMembership.objects.filter(
        workspace=workspace, student=sp, status='approved'
    ).first()
    if not membership:
        return Response({'detail': 'Not an approved member.'}, status=403)

    questions = WorkspaceOnboardingQuestion.objects.filter(workspace=workspace)

    if request.method == 'GET':
        answers = WorkspaceOnboardingAnswer.objects.filter(
            question__workspace=workspace, student=sp
        )
        return Response(WorkspaceOnboardingAnswerSerializer(answers, many=True).data)

    answers_data = request.data if isinstance(request.data, list) else request.data.get('answers', [])
    q_ids = {q.id for q in questions}
    saved = []
    for item in answers_data:
        q_id = item.get('question')
        if q_id not in q_ids:
            continue
        obj, _ = WorkspaceOnboardingAnswer.objects.update_or_create(
            question_id=q_id, student=sp,
            defaults={'answer_text': item.get('answer_text', '')},
        )
        saved.append(obj)
    return Response(WorkspaceOnboardingAnswerSerializer(saved, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def workspace_onboarding_submissions(request, pk):
    workspace = get_object_or_404(Workspace, pk=pk, is_active=True)
    mp = _mentor_profile(request.user)
    is_owner = mp and workspace.mentor == mp
    is_superadmin = request.user.role == 'superadmin'
    if not (is_owner or is_superadmin):
        return Response({'detail': 'Coordinators only.'}, status=403)

    memberships = WorkspaceMembership.objects.filter(
        workspace=workspace, status='approved'
    ).select_related('student__user')

    result = []
    for m in memberships:
        student = m.student
        answers = WorkspaceOnboardingAnswer.objects.filter(
            question__workspace=workspace, student=student
        )
        pic = None
        if student.profile_picture:
            pic = student.profile_picture.url
        first_answer = answers.order_by('submitted_at').first()
        result.append({
            'student_id':      student.user.id,
            'student_name':    f"{student.user.first_name} {student.user.last_name}".strip() or student.user.username,
            'student_picture': pic,
            'submitted_at':    first_answer.submitted_at.isoformat() if first_answer else None,
            'answers':         WorkspaceOnboardingAnswerSerializer(answers, many=True).data,
        })

    return Response(result)


