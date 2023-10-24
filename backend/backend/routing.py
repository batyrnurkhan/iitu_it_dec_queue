from channels.routing import ProtocolTypeRouter, URLRouter
import queue_qr.routing

application = ProtocolTypeRouter({
    'websocket': URLRouter(
        queue_qr.routing.websocket_urlpatterns
    ),
})
