import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'public_platform.settings')

django_asgi_app = get_asgi_application()

import core.routing  # noqa: E402 — must be after Django setup
from public_platform.jwt_middleware import JWTAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': JWTAuthMiddleware(
        URLRouter(core.routing.websocket_urlpatterns)
    ),
})
