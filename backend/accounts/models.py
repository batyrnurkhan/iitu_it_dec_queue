from django.contrib.auth.models import AbstractUser
from django.db import models
from datetime import date


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
        """Подсчет вызванных талонов"""
        return ManagerActionLog.objects.filter(
            manager=self,
            action__startswith="Вызван талон"  # Обновленный текст
        ).count()

    def today_tickets_count(self):
        """Подсчет талонов за сегодня"""
        today_report = DailyTicketReport.objects.filter(
            manager=self,
            date=date.today()
        ).first()
        return today_report.ticket_count if today_report else 0

    def get_manager_location(self):
        """Получение местоположения менеджера"""
        username_lower = self.username.lower()

        if username_lower in ['auditoria111', 'aauditoria111']:
            return "Аудитория 111"
        elif username_lower in ['auditoria303', 'auditoria305', 'auditoria306']:
            return f"Аудитория {username_lower[-3:]}"
        else:
            stol_number = username_lower[-1] if username_lower else "1"
            return f"Стол {stol_number}"


class ManagerWorkplace(models.Model):
    manager = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    current_serving = models.IntegerField(default=0)
    last_ticket = models.IntegerField(default=0)

    def __str__(self):
        return f"Workplace for {self.manager.username}"


class ManagerActionLog(models.Model):
    manager = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    action = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    ticket_number = models.PositiveIntegerField(null=True, blank=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Обновляем счетчик при вызове талона
        if "Вызван талон" in self.action:
            report, created = DailyTicketReport.objects.get_or_create(
                manager=self.manager,
                date=self.timestamp.date(),
                defaults={'ticket_count': 0}
            )
            if created:
                report.ticket_count = 1
            else:
                report.ticket_count += 1
            report.save()

    def __str__(self):
        return f"{self.manager.username} - {self.action} - {self.timestamp}"

    class Meta:
        ordering = ['-timestamp']


class DailyTicketReport(models.Model):
    manager = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    date = models.DateField(default=date.today)
    ticket_count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('manager', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.manager.username} - {self.date} - {self.ticket_count} tickets"