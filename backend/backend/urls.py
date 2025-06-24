from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from .views import log_error

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v2/', include('accounts.urls')),
    path('api/v2/queue/', include('queue_qr.urls')),
    path('api/v2/log-error/', log_error, name='log_error'),
]

urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
