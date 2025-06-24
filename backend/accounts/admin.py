from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, ManagerActionLog, DailyTicketReport, Table, WorkplaceType
from import_export.admin import ExportActionMixin


@admin.register(CustomUser)
class CustomUserAdmin(ExportActionMixin, UserAdmin):
    model = CustomUser
    list_display = ['id', 'username', 'first_name', 'email', 'role', 'manager_type', 'workplace',
                    'allowed_queues_display', 'called_tickets_count']
    list_filter = ['role', 'manager_type', 'workplace__workplace_type', 'workplace']
    search_fields = ['username', 'first_name', 'last_name', 'email']

    fieldsets = UserAdmin.fieldsets + (
        ('Рабочая информация', {
            'fields': ('role', 'manager_type', 'workplace', 'queue_permissions'),
            'description': 'Назначьте пользователю рабочее место, которое определит доступные очереди'
        }),
    )

    def allowed_queues_display(self, obj):
        """Отображение разрешенных очередей"""
        queues = obj.get_allowed_queue_types()
        if not queues:
            return "❌ Нет доступа"

        emoji_map = {
            'BACHELOR_GRANT': '🎓',
            'BACHELOR_PAID': '💳',
            'MASTER': '📚',
            'PHD': '🔬',
            'PLATONUS': '💻'
        }

        result = []
        for queue in queues:
            emoji = emoji_map.get(queue, '📋')
            result.append(f"{emoji}")

        return " ".join(result) + f" ({len(queues)})"

    allowed_queues_display.short_description = 'Доступные очереди'

    def called_tickets_count(self, obj):
        return obj.manageractionlog_set.filter(action__startswith="Вызван талон").count()

    called_tickets_count.short_description = 'Вызвано талонов'


# Admin customization for WorkplaceType
@admin.register(WorkplaceType)
class WorkplaceTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'workplace_type', 'number', 'location', 'queue_types_display', 'is_active',
                    'assigned_users_count']
    list_filter = ['workplace_type', 'is_active']
    search_fields = ['name', 'location']
    ordering = ['workplace_type', 'number']

    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'workplace_type', 'number', 'location', 'is_active')
        }),
        ('Разрешения на очереди', {
            'fields': ('allowed_queue_types',),
            'description': 'Выберите типы очередей, которые может обслуживать это рабочее место'
        }),
    )

    def queue_types_display(self, obj):
        """Отображение разрешенных типов очередей"""
        if not obj.allowed_queue_types:
            return "—"

        # Эмодзи для каждого типа очереди
        emoji_map = {
            'BACHELOR_GRANT': '🎓',
            'BACHELOR_PAID': '💳',
            'MASTER': '📚',
            'PHD': '🔬',
            'PLATONUS': '💻'
        }

        display_names = {
            'BACHELOR_GRANT': 'Бакалавр грант',
            'BACHELOR_PAID': 'Бакалавр платное',
            'MASTER': 'Магистратура',
            'PHD': 'PhD',
            'PLATONUS': 'Platonus'
        }

        result = []
        for queue_type in obj.allowed_queue_types:
            emoji = emoji_map.get(queue_type, '📋')
            name = display_names.get(queue_type, queue_type)
            result.append(f"{emoji} {name}")

        return " | ".join(result)

    queue_types_display.short_description = 'Обслуживаемые очереди'

    def assigned_users_count(self, obj):
        """Количество назначенных пользователей"""
        count = obj.customuser_set.count()
        if count == 0:
            return "—"
        return f"{count} чел."

    assigned_users_count.short_description = 'Назначено пользователей'

    # Дополнительные действия
    actions = ['activate_workplaces', 'deactivate_workplaces']

    def activate_workplaces(self, request, queryset):
        """Активировать выбранные рабочие места"""
        updated = queryset.update(is_active=True)
        self.message_user(request, f'Активировано рабочих мест: {updated}')

    activate_workplaces.short_description = "Активировать выбранные рабочие места"

    def deactivate_workplaces(self, request, queryset):
        """Деактивировать выбранные рабочие места"""
        updated = queryset.update(is_active=False)
        self.message_user(request, f'Деактивировано рабочих мест: {updated}')

    deactivate_workplaces.short_description = "Деактивировать выбранные рабочие места"


# Admin customization for ManagerActionLog
@admin.register(ManagerActionLog)
class ManagerActionLogAdmin(ExportActionMixin, admin.ModelAdmin):
    list_display = ['manager', 'action', 'timestamp', 'ticket_number', 'queue_type', 'manager_type',
                    'manager_workplace']
    list_filter = ['manager__manager_type', 'queue_type', 'manager__workplace', 'timestamp']
    search_fields = ['manager__username', 'action', 'ticket_number']
    date_hierarchy = 'timestamp'
    ordering = ['-timestamp']

    def manager_type(self, obj):
        return obj.manager.manager_type if obj.manager.manager_type else "—"

    manager_type.short_description = 'Тип менеджера'

    def manager_workplace(self, obj):
        return obj.manager.workplace.name if obj.manager.workplace else "—"

    manager_workplace.short_description = 'Рабочее место'

    def has_change_permission(self, request, obj=None):
        return False  # Prevent editing logs

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(DailyTicketReport)
class DailyTicketReportAdmin(ExportActionMixin, admin.ModelAdmin):
    list_display = ['manager', 'date', 'ticket_count', 'manager_workplace', 'queue_stats_display']
    list_filter = ['manager', 'date', 'manager__workplace']
    search_fields = ['manager__username']
    date_hierarchy = 'date'
    ordering = ['-date']

    def manager_workplace(self, obj):
        return obj.manager.workplace.name if obj.manager.workplace else "—"

    manager_workplace.short_description = 'Рабочее место'

    def queue_stats_display(self, obj):
        """Отображение статистики по типам очередей"""
        if not obj.queue_type_stats:
            return "—"

        stats = []
        for queue_type, count in obj.queue_type_stats.items():
            stats.append(f"{queue_type}: {count}")

        return " | ".join(stats)

    queue_stats_display.short_description = 'Статистика по очередям'


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    search_fields = ['name', 'description']