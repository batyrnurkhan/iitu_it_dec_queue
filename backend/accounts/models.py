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


class ManagerActionLog(models.Model):
    manager = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    action = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    ticket_number = models.PositiveIntegerField(null=True, blank=True)  # Add this field
    def __str__(self):
        return f"{self.manager.username} ({self.manager.manager_type}) - {self.action} at {self.timestamp}"


from datetime import date

class DailyTicketReport(models.Model):
    manager = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    date = models.DateField(default=date.today)
    ticket_count = models.PositiveIntegerField()

    class Meta:
        unique_together = ('manager', 'date')

    def __str__(self):
        return f"{self.manager.username} - {self.date} - {self.ticket_count} tickets"