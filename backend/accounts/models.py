from django.contrib.auth.models import AbstractUser
from django.db import models


class Table(models.Model):
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

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
    table = models.ForeignKey(Table, on_delete=models.SET_NULL, blank=True, null=True)

    def called_tickets_count(self):
        return ManagerActionLog.objects.filter(
            manager=self,
            action__startswith="Called next ticket"
        ).count()

class ManagerWorkplace(models.Model):
    manager = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    current_serving = models.IntegerField(default=0)
    last_ticket = models.IntegerField(default=0)


class ManagerActionLog(models.Model):
    manager = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    action = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    ticket_number = models.PositiveIntegerField(null=True, blank=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if "Called next ticket" in self.action:
            report, created = DailyTicketReport.objects.get_or_create(
                manager=self.manager,
                date=self.timestamp.date()
            )
            if not created:
                report.ticket_count += 1
                report.save()

from datetime import date

class DailyTicketReport(models.Model):
    manager = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    date = models.DateField(default=date.today)
    ticket_count = models.PositiveIntegerField()

    class Meta:
        unique_together = ('manager', 'date')

    def __str__(self):
        return f"{self.manager.username} - {self.date} - {self.ticket_count} tickets"
