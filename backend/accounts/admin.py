from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, ManagerActionLog, DailyTicketReport, Table
from import_export.admin import ExportActionMixin

# UserAdmin customization for CustomUser
@admin.register(CustomUser)
class CustomUserAdmin(ExportActionMixin, UserAdmin):
    model = CustomUser
    list_display = ['id', 'username','first_name', 'email', 'role', 'manager_type', 'table', 'called_tickets_count']
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Fields', {
            'fields': ('role', 'manager_type', 'table'),
        }),
    )
    def called_tickets_count(self, obj):
        return obj.manageractionlog_set.filter(action__startswith="Called next ticket").count()
    called_tickets_count.short_description = 'Called Tickets Count'

# Admin customization for ManagerActionLog
@admin.register(ManagerActionLog)
class ManagerActionLogAdmin(ExportActionMixin, admin.ModelAdmin):
    list_display = ['manager', 'action', 'timestamp', 'manager_type']
    list_filter = ['manager__manager_type', 'timestamp']
    search_fields = ['manager__username', 'action']

    def manager_type(self, obj):
        return obj.manager.manager_type

    def has_change_permission(self, request, obj=None):
        return False  # Prevent editing logs

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(DailyTicketReport)
class DailyTicketReportAdmin(ExportActionMixin, admin.ModelAdmin):
    list_display = ['manager', 'date', 'ticket_count']
    list_filter = ['manager', 'date']
    search_fields = ['manager__username']

@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
