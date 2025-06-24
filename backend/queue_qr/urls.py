from django.urls import path
from . import views

urlpatterns = [
    path('join-queue/', views.join_queue, name='join_queue'),
    path('queues/', views.get_queues, name='get_queues'),
    path('queue-types/', views.get_queue_types, name='get_queue_types'),  # Новый endpoint
    path('generate-qr/', views.generate_qr, name='generate_qr'),
    path('current-serving/', views.current_serving, name='current_serving'),
    path('reset-queue/', views.reset_queue, name='reset_queue'),
    path('call-next/', views.call_next, name='call_next'),
    path('delete-audio/', views.delete_audio, name='delete_audio'),
]