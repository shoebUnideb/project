import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


# ── DB helpers ─────────────────────────────────────────────────────────────

@database_sync_to_async
def _can_access_org_channel(user, channel_pk):
    from .models import OrgChatChannelMember
    return OrgChatChannelMember.objects.filter(channel_id=channel_pk, user=user).exists()


@database_sync_to_async
def _is_org_member(user):
    if user.is_superuser:
        return True
    from .models import OrgMember
    return OrgMember.objects.filter(user=user, status='active').exists()


@database_sync_to_async
def _can_access_org_channel_or_admin(user, channel_pk):
    if user.is_superuser:
        return True
    from .models import OrgChatChannelMember
    return OrgChatChannelMember.objects.filter(channel_id=channel_pk, user=user).exists()


@database_sync_to_async
def _save_org_message(user, channel_pk, body, message_type='message', reply_to_id=None):
    from .models import OrgChatChannel, OrgChatMessage
    try:
        ch = OrgChatChannel.objects.get(pk=channel_pk)
    except OrgChatChannel.DoesNotExist:
        return None
    reply_to = None
    if reply_to_id:
        try:
            reply_to = OrgChatMessage.objects.get(pk=reply_to_id)
        except OrgChatMessage.DoesNotExist:
            pass
    msg = OrgChatMessage.objects.create(
        channel=ch, sender=user, body=body,
        message_type=message_type, reply_to=reply_to,
    )
    msg = OrgChatMessage.objects.select_related(
        'sender__org_member', 'reply_to__sender',
    ).prefetch_related('reactions__user').get(pk=msg.pk)
    return _serialize_org_msg(msg)


@database_sync_to_async
def _toggle_org_reaction(user, message_pk, emoji):
    from .models import OrgChatMessage, OrgChatReaction
    VALID = {c[0] for c in OrgChatReaction.EMOJI_CHOICES}
    if emoji not in VALID:
        return None
    try:
        msg = OrgChatMessage.objects.get(pk=message_pk)
    except OrgChatMessage.DoesNotExist:
        return None
    existing = OrgChatReaction.objects.filter(message=msg, user=user, emoji=emoji).first()
    if existing:
        existing.delete()
    else:
        OrgChatReaction.objects.create(message=msg, user=user, emoji=emoji)
    reactions = list(OrgChatReaction.objects.filter(message=msg).select_related('user'))
    return {
        'message_id': message_pk,
        'reactions': [
            {'id': r.id, 'emoji': r.emoji, 'user': {
                'id': r.user.id, 'username': r.user.username,
                'first_name': r.user.first_name, 'last_name': r.user.last_name,
            }} for r in reactions
        ],
    }


def _get_org_user_pic(user):
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


def _serialize_org_msg(msg):
    sender = msg.sender
    reply_data = None
    if msg.reply_to_id:
        try:
            rt = msg.reply_to
            reply_data = {
                'id': rt.id,
                'body': rt.body[:80],
                'sender_name': (f"{rt.sender.first_name} {rt.sender.last_name}".strip()
                                or rt.sender.username),
            }
        except Exception:
            pass
    reactions = list(msg.reactions.select_related('user').all()) if msg.pk else []
    return {
        'id':           msg.id,
        'sender': {
            'id': sender.id, 'username': sender.username,
            'first_name': sender.first_name, 'last_name': sender.last_name,
            'profile_picture': _get_org_user_pic(sender),
        },
        'body':            msg.body,
        'attachment_url':  msg.attachment.url if msg.attachment else None,
        'attachment_name': msg.attachment.name.split('/')[-1] if msg.attachment else None,
        'message_type':    msg.message_type,
        'is_pinned':       msg.is_pinned,
        'is_deleted':      msg.is_deleted,
        'reply_to':        reply_data,
        'reactions': [
            {'id': r.id, 'emoji': r.emoji, 'user': {
                'id': r.user.id, 'username': r.user.username,
                'first_name': r.user.first_name, 'last_name': r.user.last_name,
            }} for r in reactions
        ],
        'created_at': msg.created_at.isoformat(),
        'updated_at': msg.updated_at.isoformat(),
    }


@database_sync_to_async
def _save_org_dm(sender, receiver_pk, body):
    from .models import OrgDMMessage
    from accounts.models import CustomUser
    try:
        receiver = CustomUser.objects.get(pk=receiver_pk)
    except CustomUser.DoesNotExist:
        return None
    msg = OrgDMMessage.objects.create(sender=sender, receiver=receiver, body=body)
    msg = OrgDMMessage.objects.select_related(
        'sender__org_member', 'receiver__org_member',
    ).get(pk=msg.pk)
    return _serialize_org_dm(msg)


def _serialize_org_dm(msg):
    def _user(u):
        return {
            'id': u.id, 'username': u.username,
            'first_name': u.first_name, 'last_name': u.last_name,
            'profile_picture': _get_org_user_pic(u),
            'display_name': f"{u.first_name} {u.last_name}".strip() or u.username,
        }
    return {
        'id':             msg.id,
        'sender':         _user(msg.sender),
        'receiver':       _user(msg.receiver),
        'body':           msg.body,
        'attachment_url': msg.attachment.url if msg.attachment else None,
        'created_at':     msg.created_at.isoformat(),
        'is_read':        msg.is_read,
        'is_deleted':     msg.is_deleted,
    }


# ── Consumers ──────────────────────────────────────────────────────────────

class OrgChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.cid   = self.scope['url_route']['kwargs']['cid']
        self.group = f'org_chat_{self.cid}'
        user = self.scope['user']
        if not user.is_authenticated or not await _can_access_org_channel_or_admin(user, self.cid):
            await self.close()
            return
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, 'group'):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return
        event_type = data.get('type')
        user = self.scope['user']

        if event_type == 'message':
            body = (data.get('body') or '').strip()
            if not body:
                return
            msg = await _save_org_message(
                user, self.cid, body,
                data.get('message_type', 'message'),
                data.get('reply_to_id'),
            )
            if not msg:
                return
            await self.channel_layer.group_send(
                self.group, {'type': 'chat.message', 'payload': msg}
            )

        elif event_type == 'react':
            result = await _toggle_org_reaction(user, data.get('mid'), data.get('emoji'))
            if result:
                await self.channel_layer.group_send(
                    self.group, {'type': 'chat.reaction', 'payload': result}
                )

        elif event_type == 'typing':
            name = f"{user.first_name} {user.last_name}".strip() or user.username
            await self.channel_layer.group_send(
                self.group, {'type': 'chat.typing',
                             'payload': {'user_id': user.id, 'user_name': name}}
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({'type': 'message', 'data': event['payload']}))

    async def chat_reaction(self, event):
        await self.send(text_data=json.dumps({'type': 'reaction', 'data': event['payload']}))

    async def chat_typing(self, event):
        await self.send(text_data=json.dumps({'type': 'typing', 'data': event['payload']}))

    async def chat_broadcast(self, event):
        await self.send(text_data=json.dumps(event['payload']))


class OrgDMConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.other_id = int(self.scope['url_route']['kwargs']['user_id'])
        user = self.scope['user']
        if not user.is_authenticated or not await _is_org_member(user):
            await self.close()
            return
        uid1, uid2 = sorted([user.id, self.other_id])
        self.group = f'org_dm_{uid1}_{uid2}'
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, 'group'):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return
        if data.get('type') != 'message':
            return
        body = (data.get('body') or '').strip()
        if not body:
            return
        msg = await _save_org_dm(self.scope['user'], self.other_id, body)
        if not msg:
            return
        await self.channel_layer.group_send(
            self.group, {'type': 'dm.message', 'payload': msg}
        )

    async def dm_message(self, event):
        await self.send(text_data=json.dumps({'type': 'message', 'data': event['payload']}))

    async def dm_broadcast(self, event):
        await self.send(text_data=json.dumps(event['payload']))
