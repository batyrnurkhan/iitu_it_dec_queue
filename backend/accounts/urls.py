from django.urls import path
from .views import profile_view, login_view, call_next_ticket

urlpatterns = [
    path('login/', login_view, name="login"),
    path('profile/', profile_view, name='profile_view'),
    path('call-next/', call_next_ticket, name='call-next-ticket'),

]
