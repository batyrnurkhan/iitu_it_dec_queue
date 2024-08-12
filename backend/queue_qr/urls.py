from django.urls import path
from . import views

urlpatterns = [
    path('queue/join-queue/', views.join_queue, name='join-queue'),
    path('queue/queues/', views.get_queues, name='queues'),
    path('queue/generate-qr/', views.generate_qr, name='generate-qr'),
    path('queue/current-serving/', views.current_serving, name='current-serving'),
    path('queue/reset-queue/', views.reset_queue, name='reset_queue'),
    path('queue/call-next/', views.call_next, name='call_next'),
]
