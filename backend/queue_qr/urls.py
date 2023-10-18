from django.urls import path
from . import views

urlpatterns = [
    path('join-queue/', views.join_queue, name='join-queue'),
    path('queues/', views.get_queues, name='queues'),
    path('generate-qr/', views.generate_qr, name='generate-qr'),
    path('current-serving/', views.current_serving, name='current-serving'),
    path('reset-queue/', views.reset_queue, name='reset_queue'),
    path('call-next/', views.call_next, name='call_next'),
]
