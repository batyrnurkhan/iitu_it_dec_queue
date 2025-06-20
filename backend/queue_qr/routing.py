from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Общие WebSocket соединения для всех очередей
    re_path(r'ws/queues/$', consumers.QueueConsumer.as_asgi()),

    # WebSocket для конкретной очереди
    re_path(r'ws/queues/(?P<queue_type>\w+)/$', consumers.QueueConsumer.as_asgi()),

    # WebSocket для менеджеров (требует аутентификации)
    re_path(r'ws/call-next/$', consumers.CallNextConsumer.as_asgi()),

    # WebSocket для дисплеев в зонах ожидания
    re_path(r'ws/displays/$', consumers.DisplayConsumer.as_asgi()),

    # WebSocket для конкретного дисплея очереди
    re_path(r'ws/displays/(?P<queue_type>\w+)/$', consumers.DisplayConsumer.as_asgi()),
]