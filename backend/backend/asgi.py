import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import accounts.routing
import queue_qr.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

websocket_patterns = accounts.routing.websocket_urlpatterns + queue_qr.routing.websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            websocket_patterns
        )
    ),
})
