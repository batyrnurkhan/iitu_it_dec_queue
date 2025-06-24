# accounts/urls.py

from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile_view, name='profile'),
    path('manager/stats/', views.manager_stats, name='manager_stats'),
    path('workplaces/', views.get_workplaces, name='get_workplaces'),
]