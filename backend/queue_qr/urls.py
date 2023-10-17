from django.urls import path
from . import views

urlpatterns = [
    path('join-queue/', views.join_queue, name='join-queue'),
    path('queues/', views.get_queues, name='queues'),
    path('generate-qr/', views.generate_qr, name='generate-qr')
]
