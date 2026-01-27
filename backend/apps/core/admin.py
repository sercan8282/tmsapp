"""
Core app admin registration.
"""
from django.contrib import admin
from .models import AppSettings


@admin.register(AppSettings)
class AppSettingsAdmin(admin.ModelAdmin):
    list_display = ['app_name', 'company_name', 'updated_at']
    
    fieldsets = (
        ('Branding', {
            'fields': ('app_name', 'logo', 'favicon', 'primary_color')
        }),
        ('Bedrijfsgegevens', {
            'fields': (
                'company_name', 'company_address', 'company_phone',
                'company_email', 'company_kvk', 'company_btw', 'company_iban'
            )
        }),
        ('E-mail (SMTP)', {
            'fields': (
                'smtp_host', 'smtp_port', 'smtp_username', 
                'smtp_password', 'smtp_use_tls', 'smtp_from_email'
            ),
            'classes': ('collapse',)
        }),
        ('OAuth (Exchange Online)', {
            'fields': (
                'oauth_enabled', 'oauth_client_id', 
                'oauth_client_secret', 'oauth_tenant_id'
            ),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        # Only allow one instance
        return not AppSettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # Don't allow deletion
        return False
