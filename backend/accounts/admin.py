from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ['id', 'username', 'email', 'role', 'manager_type']
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Fields', {
            'fields': ('role', 'manager_type'),
        }),
    )

from .models import ManagerActionLog

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
