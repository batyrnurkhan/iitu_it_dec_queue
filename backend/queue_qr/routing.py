from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/queues/$', consumers.QueueConsumer.as_asgi()),
    re_path(r'ws/call-next/$', consumers.CallNextConsumer.as_asgi()),
    re_path(r'ws/queues/(?P<queue_type>\w+)/$', consumers.QueueConsumer.as_asgi()),

]
