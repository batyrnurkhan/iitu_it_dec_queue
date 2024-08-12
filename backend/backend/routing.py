from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.core.asgi import get_asgi_application

# Import the websocket_urlpatterns from the queue_qr app
from queue_qr.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "https": get_asgi_application(),  # Django's ASGI application for traditional HTTP requests
    "websocket": AuthMiddlewareStack(  # Add authentication support for WebSockets
        URLRouter(
            websocket_urlpatterns  # Use the WebSocket URL routing from the queue_qr app
        )
    ),
})
