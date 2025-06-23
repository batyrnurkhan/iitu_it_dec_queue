import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

# Импортируйте routing модули
websocket_patterns = []

try:
    from accounts.routing import websocket_urlpatterns as accounts_patterns
    websocket_patterns.extend(accounts_patterns)
except (ImportError, AttributeError):
    print("accounts.routing not found or no websocket_urlpatterns")

try:
    from queue_qr.routing import websocket_urlpatterns as queue_patterns
    websocket_patterns.extend(queue_patterns)
except (ImportError, AttributeError):
    print("queue_qr.routing not found or no websocket_urlpatterns")

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_patterns)
    ),
})