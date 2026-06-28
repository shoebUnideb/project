from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/org/channels/(?P<cid>\d+)/$',  consumers.OrgChatConsumer.as_asgi()),
    re_path(r'ws/org/dms/(?P<user_id>\d+)/$',   consumers.OrgDMConsumer.as_asgi()),
]
