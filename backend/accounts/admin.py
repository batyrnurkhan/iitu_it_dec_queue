from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, ManagerActionLog

# UserAdmin customization for CustomUser
@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ['id', 'username', 'email', 'role', 'manager_type', 'called_tickets_count']
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Fields', {
            'fields': ('role', 'manager_type'),
        }),
    )

    def called_tickets_count(self, obj):
        return obj.manageractionlog_set.filter(action__startswith="Called next ticket").count()
    called_tickets_count.short_description = 'Called Tickets Count'

# Admin customization for ManagerActionLog
@admin.register(ManagerActionLog)
class ManagerActionLogAdmin(admin.ModelAdmin):
    list_display = ['manager', 'action', 'timestamp', 'manager_type']
    list_filter = ['manager__manager_type', 'timestamp']
    search_fields = ['manager__username', 'action']

    def manager_type(self, obj):
        return obj.manager.manager_type

    def has_change_permission(self, request, obj=None):
        return False  # Prevent editing logs

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
