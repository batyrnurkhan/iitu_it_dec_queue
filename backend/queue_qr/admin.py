# queue_qr/admin.py

from django.contrib import admin
from .models import Queue, QueueTicket, ApiStatus, QueueType


@admin.register(QueueType)
class QueueTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'get_name_display', 'min_ticket_number', 'max_ticket_number', 'active_tickets_count']
    search_fields = ['name']
    list_filter = ['name']

    def get_name_display(self, obj):
        """Отображение человекочитаемого названия"""
        return obj.get_name_display()

    get_name_display.short_description = 'Название'

    def active_tickets_count(self, obj):
        """Количество активных талонов"""
        count = obj.tickets.filter(served=False).count()
        return f"{count} талонов" if count > 0 else "—"

    active_tickets_count.short_description = 'Активных талонов'


@admin.register(Queue)
class QueueAdmin(admin.ModelAdmin):
    list_display = ['type', 'current_number', 'currently_serving', 'manager', 'queue_status']
    list_filter = ['type']
    search_fields = ['type', 'manager__username']

    def queue_status(self, obj):
        """Статус очереди"""
        if obj.current_number == obj.currently_serving:
            return "✅ Актуальная"
        elif obj.currently_serving < obj.current_number:
            waiting = obj.current_number - obj.currently_serving
            return f"⏳ В ожидании: {waiting}"
        else:
            return "⚠️ Требует внимания"

    queue_status.short_description = 'Статус'


@admin.register(QueueTicket)
class QueueTicketAdmin(admin.ModelAdmin):
    list_display = ['number', 'full_name', 'queue_type_name', 'served_status', 'serving_manager', 'created_at']
    list_filter = ['served', 'queue_type__name', 'created_at']
    search_fields = ['number', 'full_name', 'serving_manager__username', 'queue_type__name']
    readonly_fields = ['token', 'created_at']
    date_hierarchy = 'created_at'

    def queue_type_name(self, obj):
        """Отображение типа очереди"""
        emoji_map = {
            'BACHELOR_GRANT': '🎓',
            'BACHELOR_PAID': '💳',
            'MASTER': '📚',
            'PHD': '🔬',
            'PLATONUS': '💻',
            'COLLEGE_GRANT': '🏫'  # Новый эмодзи для колледжа
        }
        emoji = emoji_map.get(obj.queue_type.name, '📋')
        return f"{emoji} {obj.queue_type.get_name_display()}"

    queue_type_name.short_description = 'Тип очереди'

    def served_status(self, obj):
        """Статус обслуживания"""
        if obj.served:
            return "✅ Обслужен"
        else:
            return "⏳ В ожидании"

    served_status.short_description = 'Статус'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('queue_type', 'serving_manager')

    # Дополнительные действия
    actions = ['mark_as_served', 'mark_as_unserved']

    def mark_as_served(self, request, queryset):
        """Отметить как обслуженные"""
        updated = queryset.update(served=True)
        self.message_user(request, f'Отмечено как обслуженные: {updated} талонов')

    mark_as_served.short_description = "Отметить как обслуженные"

    def mark_as_unserved(self, request, queryset):
        """Отметить как необслуженные"""
        updated = queryset.update(served=False)
        self.message_user(request, f'Отмечено как необслуженные: {updated} талонов')

    mark_as_unserved.short_description = "Отметить как необслуженные"


@admin.register(ApiStatus)
class ApiStatusAdmin(admin.ModelAdmin):
    list_display = ['name', 'status', 'status_display']

    def status_display(self, obj):
        """Графическое отображение статуса"""
        if obj.status:
            return "🟢 Включено"
        else:
            return "🔴 Отключено"

    status_display.short_description = 'Статус API'