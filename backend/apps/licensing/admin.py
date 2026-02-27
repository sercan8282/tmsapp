"""
Licensing app admin configuration.
"""
from django.contrib import admin
from .models import License


@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = [
        'customer_name',
        'status',
        'expires_at',
        'days_remaining',
        'max_users',
        'activated_at',
    ]
    list_filter = ['status']
    search_fields = ['customer_name']
    readonly_fields = [
        'id',
        'license_key',
        'installation_id',
        'activated_at',
        'created_at',
        'updated_at',
    ]
    
    def has_add_permission(self, request):
        """Licenses should be generated via management command only."""
        return False
