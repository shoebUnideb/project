from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.utils.html import strip_tags

from .models import StudentProfile, MentorProfile, WorkspaceMembership, Message, Notification, Post, Workspace


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_or_update_profile(sender, instance, created, **kwargs):
    if instance.role == 'student':
        StudentProfile.objects.get_or_create(user=instance)
    elif instance.role == 'mentor':
        MentorProfile.objects.get_or_create(user=instance)


def _notif(recipient, notif_type, title, body='', link=''):
    Notification.objects.create(
        recipient=recipient,
        notif_type=notif_type,
        title=title,
        body=body,
        link=link,
    )


@receiver(post_save, sender=WorkspaceMembership)
def notify_workspace_membership(sender, instance, created, **kwargs):
    if created:
        # Only notify the mentor of student-initiated join requests, not mentor-initiated invites
        if instance.status == WorkspaceMembership.STATUS_PENDING:
            _notif(
                instance.workspace.mentor.user,
                Notification.TYPE_WS_REQUEST,
                f"{instance.student.user.first_name or instance.student.user.username} wants to join",
                instance.workspace.name,
                f"/workspaces/{instance.workspace_id}",
            )
    else:
        if instance.status == 'approved':
            # Skip notification when the student accepted their own invite
            if getattr(instance, '_accepted_by_student', False):
                return
            _notif(
                instance.student.user,
                Notification.TYPE_WS_APPROVED,
                f"You're now a member of {instance.workspace.name}",
                link=f"/w/{instance.workspace.slug}",
            )
        elif instance.status == 'rejected':
            _notif(
                instance.student.user,
                Notification.TYPE_WS_REJECTED,
                f"Your request to join {instance.workspace.name} was declined",
                link=f"/w/{instance.workspace.slug}",
            )


@receiver(post_save, sender=Message)
def notify_new_message(sender, instance, created, **kwargs):
    if created:
        sender_name = instance.sender.first_name or instance.sender.username
        _notif(
            instance.receiver,
            Notification.TYPE_MESSAGE,
            f"New message from {sender_name}",
            instance.body[:100],
            f"/messages/{instance.sender_id}",
        )


@receiver(post_save, sender=Post)
def notify_new_feed_post(sender, instance, created, **kwargs):
    if not created:
        return
    from accounts.models import CustomUser
    author_name = instance.author.first_name or instance.author.username

    if instance.workspace_id:
        # Workspace post — only notify approved members of that workspace
        memberships = WorkspaceMembership.objects.filter(
            workspace_id=instance.workspace_id,
            status=WorkspaceMembership.STATUS_APPROVED,
        ).select_related('student__user').exclude(student__user_id=instance.author_id)
        recipients = [m.student.user for m in memberships]
        link = f'/w/{instance.workspace.slug}'
    else:
        # Platform-wide feed post — notify all active users
        recipients = list(CustomUser.objects.exclude(pk=instance.author_id).filter(is_active=True))
        link = '/feed'

    if not recipients:
        return

    Notification.objects.bulk_create([
        Notification(
            recipient=u,
            notif_type=Notification.TYPE_FEED_POST,
            title=f"{author_name} posted: {instance.title[:60]}",
            body=strip_tags(instance.body)[:100],
            link=link,
        )
        for u in recipients
    ])


@receiver(post_save, sender=Workspace)
def create_default_channels(sender, instance, created, **kwargs):
    if not created:
        return
    from .models import WorkspaceChatChannel
    for cfg in [
        {'name': 'general',       'description': 'General workspace discussions', 'channel_type': 'general'},
        {'name': 'announcements', 'description': 'Workspace updates',             'channel_type': 'announcements'},
        {'name': 'random',        'description': 'Fun & discussions',             'channel_type': 'random'},
    ]:
        WorkspaceChatChannel.objects.create(workspace=instance, **cfg)
