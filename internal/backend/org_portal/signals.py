from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='org_portal.OrgMember')
def create_default_org_channels(sender, instance, created, **kwargs):
    if not created:
        return
    from .models import OrgChatChannel, OrgChatChannelMember, OrgMember
    if OrgChatChannel.objects.filter(channel_type__in=['general', 'announcements', 'random']).exists():
        # Default channels already exist — just add this new member to all of them
        for ch in OrgChatChannel.objects.filter(is_archived=False):
            OrgChatChannelMember.objects.get_or_create(channel=ch, user=instance.user)
        return
    # First member ever — create the three defaults and add all active members
    for name, ctype in [('general', 'general'), ('announcements', 'announcements'), ('random', 'random')]:
        ch = OrgChatChannel.objects.create(name=name, channel_type=ctype)
        for m in OrgMember.objects.filter(status='active').select_related('user'):
            OrgChatChannelMember.objects.get_or_create(channel=ch, user=m.user)


@receiver(post_save, sender='org_portal.Department')
def create_dept_org_channel(sender, instance, created, **kwargs):
    if not created:
        return
    from .models import OrgChatChannel, OrgChatChannelMember, OrgMember
    slug = instance.name.lower().replace(' ', '-')
    ch = OrgChatChannel.objects.create(
        name=slug,
        channel_type='department',
        description=f'Channel for {instance.name} department',
    )
    for m in OrgMember.objects.filter(department=instance, status='active').select_related('user'):
        OrgChatChannelMember.objects.get_or_create(channel=ch, user=m.user)
