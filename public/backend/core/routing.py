from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/workspaces/(?P<pk>\d+)/channels/(?P<cid>\d+)/$', consumers.ChatConsumer.as_asgi()),
    re_path(r'ws/workspaces/(?P<pk>\d+)/dms/(?P<user_id>\d+)/$',  consumers.DMConsumer.as_asgi()),
]
