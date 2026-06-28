from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model


@database_sync_to_async
def _get_user_from_token(token_str):
    if not token_str:
        return AnonymousUser()
    User = get_user_model()
    try:
        from rest_framework_simplejwt.backends import TokenBackend
        from django.conf import settings
        backend = TokenBackend(
            algorithm=settings.SIMPLE_JWT['ALGORITHM'],
            signing_key=settings.SIMPLE_JWT['SIGNING_KEY'],
        )
        data = backend.decode(token_str, verify=True)
        return User.objects.get(id=data['user_id'])
    except Exception:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        qs = parse_qs(scope.get('query_string', b'').decode())
        token_str = (qs.get('token') or [''])[0]
        scope['user'] = await _get_user_from_token(token_str)
        return await super().__call__(scope, receive, send)
