from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    ADMIN = 'ADMIN'
    TERMINAL = 'TERMINAL'
    MANAGER = 'MANAGER'

    ROLE_CHOICES = [
        (ADMIN, 'Admin'),
        (TERMINAL, 'Terminal'),
        (MANAGER, 'Manager'),
    ]

    BACHELOR = 'BACHELOR'
    MASTER = 'MASTER'
    PHD = 'PHD'

    MANAGER_TYPE_CHOICES = [
        (BACHELOR, 'Bachelor'),
        (MASTER, 'Master'),
        (PHD, 'PhD'),
    ]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=TERMINAL)
    manager_type = models.CharField(max_length=10, choices=MANAGER_TYPE_CHOICES, blank=True, null=True)

class ManagerWorkplace(models.Model):
    manager = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    current_serving = models.IntegerField(default=0)
    last_ticket = models.IntegerField(default=0)
