from django.urls import path
from .views import profile_view, login_view, logout_view

urlpatterns = [
    path('login/', login_view, name="login"),
    path('profile/', profile_view, name='profile_view'),
    path('logout/', logout_view, name='logout'),
]
