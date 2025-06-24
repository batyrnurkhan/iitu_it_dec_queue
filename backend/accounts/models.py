from django.contrib.auth.models import AbstractUser
from django.db import models
from datetime import date


class Table(models.Model):
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


class WorkplaceType(models.Model):
    """Типы рабочих мест"""
    WORKPLACE_TYPES = [
        ('TABLE', 'Стол'),
        ('ROOM', 'Кабинет'),
    ]

    name = models.CharField(max_length=100)  # "Стол 1", "Кабинет 305"
    workplace_type = models.CharField(max_length=10, choices=WORKPLACE_TYPES)
    number = models.IntegerField()  # 1, 305, etc.
    location = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)

    # Разрешенные типы очередей для этого рабочего места
    allowed_queue_types = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.name

    def can_serve_queue_type(self, queue_type):
        """Проверяет, может ли это рабочее место обслуживать данный тип очереди"""
        return queue_type in self.allowed_queue_types

    class Meta:
        verbose_name = "Тип рабочего места"
        verbose_name_plural = "Типы рабочих мест"
        ordering = ['workplace_type', 'number']


class CustomUser(AbstractUser):
    ADMIN = 'ADMIN'
    TERMINAL = 'TERMINAL'
    MANAGER = 'MANAGER'

    ROLE_CHOICES = [
        (ADMIN, 'Admin'),
        (TERMINAL, 'Terminal'),
        (MANAGER, 'Manager'),
    ]

    # ОБНОВЛЕННЫЕ типы менеджеров
    BACHELOR_GRANT = 'BACHELOR_GRANT'
    BACHELOR_PAID = 'BACHELOR_PAID'
    MASTER = 'MASTER'
    PHD = 'PHD'
    PLATONUS = 'PLATONUS'

    # Для совместимости со старой системой
    BACHELOR = 'BACHELOR_GRANT'  # Алиас

    MANAGER_TYPE_CHOICES = [
        (BACHELOR_GRANT, 'Бакалавр грант'),
        (BACHELOR_PAID, 'Бакалавр платное'),
        (MASTER, 'Магистратура'),
        (PHD, 'PhD'),
        (PLATONUS, 'Platonus'),
    ]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=TERMINAL)
    manager_type = models.CharField(max_length=20, choices=MANAGER_TYPE_CHOICES, blank=True, null=True)

    # Новое поле для связи с рабочим местом
    workplace = models.ForeignKey(WorkplaceType, on_delete=models.SET_NULL, blank=True, null=True)

    # Дополнительные разрешения (JSON поле для гибкости)
    queue_permissions = models.JSONField(default=list, blank=True)

    def get_allowed_queue_types(self):
        """Получить разрешенные типы очередей для менеджера"""
        allowed_types = []

        # Из рабочего места
        if self.workplace:
            allowed_types.extend(self.workplace.allowed_queue_types)

        # Из персональных разрешений
        allowed_types.extend(self.queue_permissions)

        # Убираем дубликаты
        return list(set(allowed_types))

    def can_serve_queue_type(self, queue_type):
        """Проверяет, может ли менеджер обслуживать данный тип очереди"""
        return queue_type in self.get_allowed_queue_types()

    def called_tickets_count(self):
        """Подсчет вызванных талонов"""
        return ManagerActionLog.objects.filter(
            manager=self,
            action__startswith="Вызван талон"
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
        if self.workplace:
            return self.workplace.name

        # Fallback только если нет workplace
        username_lower = self.username.lower()
        if username_lower.startswith('stol'):
            stol_number = username_lower.replace('stol', '')
            return f"Стол {stol_number}"
        elif username_lower.startswith('auditoria'):
            room_number = username_lower.replace('auditoria', '')
            return f"Аудитория {room_number}"
        else:
            return f"Рабочее место {self.username}"

    def get_manager_type_display_new(self):
        """Получить отображаемое имя типа менеджера (новая система)"""
        type_names = {
            'BACHELOR_GRANT': 'Бакалавр грант',
            'BACHELOR_PAID': 'Бакалавр платное',
            'MASTER': 'Магистратура',
            'PHD': 'PhD',
            'PLATONUS': 'Platonus',
        }
        return type_names.get(self.manager_type, self.manager_type)


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
    queue_type = models.CharField(max_length=20, blank=True, null=True)  # Новое поле

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
    # Статистика по типам очередей
    queue_type_stats = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ('manager', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.manager.username} - {self.date} - {self.ticket_count} tickets"

    def add_ticket_for_queue_type(self, queue_type):
        """Добавить талон для определенного типа очереди"""
        if not self.queue_type_stats:
            self.queue_type_stats = {}

        self.queue_type_stats[queue_type] = self.queue_type_stats.get(queue_type, 0) + 1
        self.ticket_count += 1
        self.save()