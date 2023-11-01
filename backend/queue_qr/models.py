from django.db import models
from accounts.models import ManagerWorkplace, Table, CustomUser
import uuid

from backend import settings


class QueueType(models.Model):
    name = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.name
class Queue(models.Model):
    BACHELOR = 'BACHELOR'
    MASTER = 'MASTER'
    PHD = 'PHD'

    QUEUE_CHOICES = [
        (BACHELOR, 'Bachelor'),
        (MASTER, 'Master'),
        (PHD, 'PhD'),
    ]

    type = models.CharField(max_length=10, choices=QUEUE_CHOICES)
    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name='queues', default="1")
    current_number = models.IntegerField(default=0)
    currently_serving = models.IntegerField(default=0)
    workplace = models.ForeignKey(ManagerWorkplace, on_delete=models.CASCADE, null=True, blank=True)
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='managed_queues',
        null=True,
        blank=True
    )

    def reset_tickets(self):
        self.queueticket_set.all().delete()  # Delete all associated tickets
        self.current_number = 0
        self.currently_serving = 0
        self.save()

    def __str__(self):
        return self.type


class QueueTicket(models.Model):
    queue = models.ForeignKey(Queue, on_delete=models.CASCADE)
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    number = models.PositiveIntegerField()
    served = models.BooleanField(default=False)
    serving_manager = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name='serving_tickets')

class ApiStatus(models.Model):
    status = models.BooleanField(default=True)
    name = models.CharField(max_length=200, default='API_STATUS')  # Just a name to identify

    def __str__(self):
        return "Enabled" if self.status else "Disabled"
