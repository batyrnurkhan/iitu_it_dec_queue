from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/live_updates/$', consumers.LiveUpdatesConsumer.as_asgi()),
    re_path(r'^ws/queue/$', consumers.YourQueueConsumer.as_asgi()),
]
