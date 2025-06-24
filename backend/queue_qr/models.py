from django.db import models
from accounts.models import ManagerWorkplace, Table, CustomUser
import uuid

from backend import settings


class QueueType(models.Model):
    # Добавляем новые константы
    BACHELOR_GRANT = 'BACHELOR_GRANT'
    BACHELOR_PAID = 'BACHELOR_PAID'
    MASTER = 'MASTER'
    PHD = 'PHD'
    PLATONUS = 'PLATONUS'

    QUEUE_TYPE_CHOICES = [
        (BACHELOR_GRANT, 'Бакалавр грант'),
        (BACHELOR_PAID, 'Бакалавр платное'),
        (MASTER, 'Магистратура'),
        (PHD, 'PhD'),
        (PLATONUS, 'Platonus'),
    ]

    name = models.CharField(max_length=255, choices=QUEUE_TYPE_CHOICES, unique=True)

    # Диапазоны номеров для каждого типа
    min_ticket_number = models.IntegerField()
    max_ticket_number = models.IntegerField()

    def __str__(self):
        return self.get_name_display()

    def get_next_ticket_number(self):
        """Получить следующий номер талона для этого типа очереди"""
        last_ticket = QueueTicket.objects.filter(queue_type=self).order_by('-number').first()

        if last_ticket:
            next_number = last_ticket.number + 1
            # Если превысили максимум, начинаем сначала
            if next_number > self.max_ticket_number:
                return self.min_ticket_number
            return next_number
        else:
            # Первый талон
            return self.min_ticket_number

    class Meta:
        verbose_name = "Тип очереди"
        verbose_name_plural = "Типы очередей"


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
    queue_type = models.ForeignKey(QueueType, on_delete=models.CASCADE, related_name='tickets')
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    number = models.PositiveIntegerField()
    full_name = models.CharField(max_length=255, verbose_name="ФИО")
    served = models.BooleanField(default=False)
    serving_manager = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name='serving_tickets')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Ticket {self.number} ({self.full_name}) - {self.queue_type.name} - Served: {"Yes" if self.served else "No"}'

    class Meta:
        ordering = ['created_at']
        verbose_name = "Талон"
        verbose_name_plural = "Талоны"


class ApiStatus(models.Model):
    status = models.BooleanField(default=True)
    name = models.CharField(max_length=200, default='API_STATUS')

    def __str__(self):
        return "Enabled" if self.status else "Disabled"