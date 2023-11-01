from django.contrib import admin
from .models import Queue, ApiStatus
# Register your models here.
@admin.register(ApiStatus)
class ApiStatusAdmin(admin.ModelAdmin):
    list_display = ('name', 'status')

def reset_tickets_for_queues(modeladmin, request, queryset):
    for queue in queryset:
        queue.reset_tickets()
reset_tickets_for_queues.short_description = "Reset tickets for selected queues"


@admin.register(Queue)
class QueueAdmin(admin.ModelAdmin):
    list_display = ('type', 'current_number')
    actions = [reset_tickets_for_queues]
