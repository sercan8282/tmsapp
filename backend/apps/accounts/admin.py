"""
Accounts app admin registration.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'username', 'voornaam', 'achternaam', 'rol', 'is_active', 'mfa_enabled']
    list_filter = ['rol', 'is_active', 'mfa_enabled', 'is_staff']
    search_fields = ['email', 'username', 'voornaam', 'achternaam']
    ordering = ['achternaam', 'voornaam']
    
    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Persoonlijke info', {'fields': ('voornaam', 'achternaam', 'telefoon', 'bedrijf')}),
        ('Rol & Rechten', {'fields': ('rol', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('2FA', {'fields': ('mfa_enabled', 'mfa_secret')}),
        ('Tijdstempels', {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'voornaam', 'achternaam', 'password1', 'password2', 'rol'),
        }),
    )
    
    readonly_fields = ['date_joined', 'last_login']
