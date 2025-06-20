# queue_qr/admin.py

from django.contrib import admin
from .models import Queue, QueueTicket, ApiStatus, QueueType


@admin.register(QueueType)
class QueueTypeAdmin(admin.ModelAdmin):
    list_display = ['name']
    search_fields = ['name']


@admin.register(Queue)
class QueueAdmin(admin.ModelAdmin):
    list_display = ['type', 'current_number', 'currently_serving', 'manager']
    list_filter = ['type']
    search_fields = ['type', 'manager__username']


@admin.register(QueueTicket)
class QueueTicketAdmin(admin.ModelAdmin):
    list_display = ['number', 'full_name', 'queue_type_name', 'served', 'serving_manager', 'created_at']
    list_filter = ['served', 'queue_type__name', 'created_at']  # ИСПРАВЛЕНО: queue_type__name вместо queue__type
    search_fields = ['number', 'full_name', 'serving_manager__username', 'queue_type__name']
    readonly_fields = ['token', 'created_at']

    def queue_type_name(self, obj):
        return obj.queue_type.name  # ИСПРАВЛЕНО: queue_type вместо queue

    queue_type_name.short_description = 'Тип очереди'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('queue_type', 'serving_manager')  # ИСПРАВЛЕНО


@admin.register(ApiStatus)
class ApiStatusAdmin(admin.ModelAdmin):
    list_display = ['name', 'status']