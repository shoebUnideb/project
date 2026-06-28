from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import Http404

from accounts.decorators import student_required, mentor_required, approved_required
from accounts.models import CustomUser
from .models import StudentProfile, MentorProfile, Assignment, Message
from .forms import (
    StudentProfileForm, MentorProfileForm, MessageForm,
)


# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────

def _get_mentor_profile(user):
    try:
        return user.mentor_profile
    except MentorProfile.DoesNotExist:
        return None


def _get_student_profile(user):
    try:
        return user.student_profile
    except StudentProfile.DoesNotExist:
        return None


# ─────────────────────────────────────────────
#  Step A — Profile Views
# ─────────────────────────────────────────────

@login_required
@approved_required
@student_required
def student_profile_view(request):
    profile = get_object_or_404(StudentProfile, user=request.user)

    if request.method == 'POST':
        form = StudentProfileForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, "Profile updated.")
            return redirect('core:student_profile')
    else:
        form = StudentProfileForm(instance=profile)

    assignment = getattr(profile, 'assignment', None)

    return render(request, 'core/student_profile.html', {
        'form': form,
        'profile': profile,
        'assignment': assignment,
    })


@login_required
@approved_required
@mentor_required
def mentor_profile_view(request):
    profile = get_object_or_404(MentorProfile, user=request.user)

    if request.method == 'POST':
        form = MentorProfileForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, "Profile updated.")
            return redirect('core:mentor_profile')
    else:
        form = MentorProfileForm(instance=profile)

    assigned_students = Assignment.objects.filter(
        mentor=profile, is_active=True
    ).select_related('student__user')

    return render(request, 'core/mentor_profile.html', {
        'form': form,
        'profile': profile,
        'assigned_students': assigned_students,
    })


@login_required
@approved_required
@mentor_required
def mentor_view_student(request, student_id):
    """Mentor views a single assigned student's full profile."""
    mentor_profile = _get_mentor_profile(request.user)
    student_profile = get_object_or_404(StudentProfile, pk=student_id)

    if not Assignment.objects.filter(mentor=mentor_profile, student=student_profile, is_active=True).exists():
        messages.error(request, "You can only view profiles of your assigned students.")
        return redirect('core:mentor_profile')

    return render(request, 'core/mentor_view_student.html', {
        'student_profile': student_profile,
    })


# ─────────────────────────────────────────────
#  Chat: Mentor ↔ Superadmin
# ─────────────────────────────────────────────

@login_required
def chat_with_admin(request):
    """Mentor-side: opens the thread with the superadmin."""
    if not request.user.role == 'mentor':
        raise Http404

    try:
        admin_user = CustomUser.objects.filter(role='superadmin').first()
    except CustomUser.DoesNotExist:
        admin_user = None

    messages_qs = Message.objects.none()
    if admin_user:
        messages_qs = Message.objects.filter(
            sender=request.user, receiver=admin_user
        ) | Message.objects.filter(
            sender=admin_user, receiver=request.user
        )
        messages_qs = messages_qs.order_by('timestamp')
        # mark admin's messages as read
        messages_qs.filter(receiver=request.user, is_read=False).update(is_read=True)

    form = MessageForm()
    if request.method == 'POST':
        form = MessageForm(request.POST)
        if form.is_valid() and admin_user:
            msg = form.save(commit=False)
            msg.sender   = request.user
            msg.receiver = admin_user
            msg.save()
            return redirect('core:chat_with_admin')

    return render(request, 'core/chat_thread.html', {
        'chat_messages': messages_qs,
        'form': form,
        'other_user': admin_user,
        'is_mentor_view': True,
    })


@login_required
def chat_inbox(request):
    """Superadmin-side: list of mentors who have messaged."""
    if not request.user.role == 'superadmin':
        raise Http404

    mentor_users = CustomUser.objects.filter(role='mentor')
    inbox = []
    for mentor in mentor_users:
        thread_exists = Message.objects.filter(
            sender=mentor, receiver=request.user
        ).exists() or Message.objects.filter(
            sender=request.user, receiver=mentor
        ).exists()
        if thread_exists:
            unread = Message.objects.filter(sender=mentor, receiver=request.user, is_read=False).count()
            last_msg = Message.objects.filter(
                sender=mentor, receiver=request.user
            ).union(
                Message.objects.filter(sender=request.user, receiver=mentor)
            ).order_by('-timestamp').first()
            inbox.append({'mentor': mentor, 'unread': unread, 'last_msg': last_msg})

    return render(request, 'core/chat_inbox.html', {'inbox': inbox})


@login_required
def chat_thread_admin(request, mentor_id):
    """Superadmin-side: view & reply in a thread with a specific mentor."""
    if not request.user.role == 'superadmin':
        raise Http404

    mentor_user = get_object_or_404(CustomUser, pk=mentor_id, role='mentor')
    messages_qs = (
        Message.objects.filter(sender=request.user, receiver=mentor_user) |
        Message.objects.filter(sender=mentor_user, receiver=request.user)
    ).order_by('timestamp')
    # mark mentor's messages as read
    messages_qs.filter(receiver=request.user, is_read=False).update(is_read=True)

    form = MessageForm()
    if request.method == 'POST':
        form = MessageForm(request.POST)
        if form.is_valid():
            msg = form.save(commit=False)
            msg.sender   = request.user
            msg.receiver = mentor_user
            msg.save()
            return redirect('core:chat_thread_admin', mentor_id=mentor_id)

    return render(request, 'core/chat_thread.html', {
        'chat_messages': messages_qs,
        'form': form,
        'other_user': mentor_user,
        'is_mentor_view': False,
        'mentor_id': mentor_id,
    })

