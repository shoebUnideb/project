import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


# ── DB helpers ─────────────────────────────────────────────────────────────

@database_sync_to_async
def _can_access_workspace(user, workspace_pk):
    from .models import Workspace, WorkspaceMembership
    try:
        ws = Workspace.objects.select_related('mentor__user').get(pk=workspace_pk)
    except Workspace.DoesNotExist:
        return False
    if user.role in ('superadmin',):
        return True
    if ws.mentor.user_id == user.id:
        return True
    return WorkspaceMembership.objects.filter(
        workspace=ws, student__user=user, status='approved'
    ).exists()


@database_sync_to_async
def _save_channel_message(user, workspace_pk, channel_pk, body, message_type='message', reply_to_id=None):
    from .models import WorkspaceChatMessage, WorkspaceChatChannel, Workspace
    try:
        ws = Workspace.objects.get(pk=workspace_pk)
        ch = WorkspaceChatChannel.objects.get(pk=channel_pk, workspace=ws)
    except (Workspace.DoesNotExist, WorkspaceChatChannel.DoesNotExist):
        return None
    reply_to = None
    if reply_to_id:
        try:
            reply_to = WorkspaceChatMessage.objects.get(pk=reply_to_id)
        except WorkspaceChatMessage.DoesNotExist:
            pass
    msg = WorkspaceChatMessage.objects.create(
        workspace=ws,
        channel=ch,
        sender=user,
        body=body,
        message_type=message_type,
        reply_to=reply_to,
    )
    msg = WorkspaceChatMessage.objects.select_related(
        'sender__mentor_profile', 'sender__student_profile',
    ).get(pk=msg.pk)
    return _serialize_channel_msg(msg)


@database_sync_to_async
def _toggle_reaction(user, message_pk, emoji):
    from .models import WorkspaceChatMessage, WorkspaceChatReaction
    VALID = {c[0] for c in WorkspaceChatReaction.EMOJI_CHOICES}
    if emoji not in VALID:
        return None
    try:
        msg = WorkspaceChatMessage.objects.get(pk=message_pk)
    except WorkspaceChatMessage.DoesNotExist:
        return None
    existing = WorkspaceChatReaction.objects.filter(message=msg, user=user, emoji=emoji).first()
    if existing:
        existing.delete()
    else:
        WorkspaceChatReaction.objects.create(message=msg, user=user, emoji=emoji)
    reactions = list(
        WorkspaceChatReaction.objects.filter(message=msg).select_related('user')
    )
    return {
        'message_id': message_pk,
        'reactions': [
            {'id': r.id, 'emoji': r.emoji, 'user': {'id': r.user.id, 'username': r.user.username,
             'first_name': r.user.first_name, 'last_name': r.user.last_name}}
            for r in reactions
        ],
    }


def _get_user_pic(user):
    """Return relative profile picture URL for a user, or None."""
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


def _serialize_channel_msg(msg):
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
            'role': sender.role,
            'profile_picture': _get_user_pic(sender),
        },
        'body':         msg.body,
        'attachment_url':  None,
        'attachment_name': None,
        'message_type': msg.message_type,
        'is_pinned':    msg.is_pinned,
        'reply_to':     reply_data,
        'reactions':    [
            {'id': r.id, 'emoji': r.emoji, 'user': {
                'id': r.user.id, 'username': r.user.username,
                'first_name': r.user.first_name, 'last_name': r.user.last_name,
            }} for r in reactions
        ],
        'created_at':   msg.created_at.isoformat(),
    }


@database_sync_to_async
def _save_dm_message(sender, workspace_pk, receiver_pk, body):
    from .models import WorkspaceDMMessage, Workspace
    from accounts.models import CustomUser
    try:
        ws = Workspace.objects.get(pk=workspace_pk)
        receiver = CustomUser.objects.select_related(
            'mentor_profile', 'student_profile'
        ).get(pk=receiver_pk)
    except (Workspace.DoesNotExist, CustomUser.DoesNotExist):
        return None
    # Re-fetch sender with profiles so _get_user_pic works
    sender_with_pic = CustomUser.objects.select_related(
        'mentor_profile', 'student_profile'
    ).get(pk=sender.pk)
    msg = WorkspaceDMMessage.objects.create(
        workspace=ws, sender=sender_with_pic, receiver=receiver, body=body,
    )
    return _serialize_dm_msg(msg)


def _serialize_dm_msg(msg):
    sender, receiver = msg.sender, msg.receiver
    return {
        'id': msg.id,
        'sender': {'id': sender.id, 'username': sender.username,
                   'first_name': sender.first_name, 'last_name': sender.last_name,
                   'profile_picture': _get_user_pic(sender)},
        'receiver': {'id': receiver.id, 'username': receiver.username,
                     'first_name': receiver.first_name, 'last_name': receiver.last_name,
                     'profile_picture': _get_user_pic(receiver)},
        'body': msg.body,
        'attachment_url': None,
        'created_at': msg.created_at.isoformat(),
        'is_read': msg.is_read,
    }


# ── Consumers ──────────────────────────────────────────────────────────────

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.pk    = self.scope['url_route']['kwargs']['pk']
        self.cid   = self.scope['url_route']['kwargs']['cid']
        self.group = f'ws_wsch_{self.pk}_{self.cid}'
        user = self.scope['user']
        if not user.is_authenticated or not await _can_access_workspace(user, self.pk):
            await self.close()
            return
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
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
            msg = await _save_channel_message(
                user, self.pk, self.cid, body,
                data.get('message_type', 'message'),
                data.get('reply_to_id'),
            )
            if not msg:
                return
            await self.channel_layer.group_send(
                self.group, {'type': 'chat.message', 'payload': msg}
            )

        elif event_type == 'react':
            result = await _toggle_reaction(user, data.get('mid'), data.get('emoji'))
            if result:
                await self.channel_layer.group_send(
                    self.group, {'type': 'chat.reaction', 'payload': result}
                )

        elif event_type == 'typing':
            name = (f"{user.first_name} {user.last_name}".strip() or user.username)
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


class DMConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.pk       = self.scope['url_route']['kwargs']['pk']
        self.other_id = int(self.scope['url_route']['kwargs']['user_id'])
        user = self.scope['user']
        if not user.is_authenticated or not await _can_access_workspace(user, self.pk):
            await self.close()
            return
        uid1, uid2 = sorted([user.id, self.other_id])
        self.group = f'ws_wsdm_{self.pk}_{uid1}_{uid2}'
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
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
        msg = await _save_dm_message(self.scope['user'], self.pk, self.other_id, body)
        if not msg:
            return
        await self.channel_layer.group_send(
            self.group, {'type': 'dm.message', 'payload': msg}
        )

    async def dm_message(self, event):
        await self.send(text_data=json.dumps({'type': 'message', 'data': event['payload']}))

    async def dm_broadcast(self, event):
        await self.send(text_data=json.dumps(event['payload']))
