"""
Admin configuration for push notifications.
"""
from django.contrib import admin
from .models import (
    PushSettings, 
    PushSubscription, 
    PushNotification,
    NotificationGroup,
    NotificationSchedule,
)


@admin.register(PushSettings)
class PushSettingsAdmin(admin.ModelAdmin):
    list_display = ['provider', 'is_configured', 'updated_at']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = (
        (None, {
            'fields': ('provider',)
        }),
        ('Web Push (VAPID)', {
            'fields': ('vapid_public_key', 'vapid_admin_email'),
            'classes': ('collapse',),
            'description': 'Settings for Web Push API with VAPID authentication.'
        }),
        ('Firebase', {
            'fields': ('firebase_project_id', 'firebase_sender_id'),
            'classes': ('collapse',),
            'description': 'Settings for Firebase Cloud Messaging.'
        }),
        ('Info', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    def is_configured(self, obj):
        return obj.is_configured()
    is_configured.boolean = True
    is_configured.short_description = 'Configured'
    
    def has_add_permission(self, request):
        # Only allow one settings object
        return not PushSettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'device_name', 'is_active', 'created_at', 'last_used_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'device_name']
    readonly_fields = ['id', 'endpoint', 'p256dh_key', 'auth_key', 'user_agent', 'created_at', 'updated_at', 'last_used_at']
    
    fieldsets = (
        (None, {
            'fields': ('user', 'device_name', 'is_active')
        }),
        ('Subscription Data', {
            'fields': ('endpoint', 'p256dh_key', 'auth_key'),
            'classes': ('collapse',),
        }),
        ('Device Info', {
            'fields': ('user_agent',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'last_used_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(PushNotification)
class PushNotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'recipient', 'group', 'send_to_all', 'success_count', 'failure_count', 'sent_at', 'sent_by']
    list_filter = ['send_to_all', 'sent_at', 'group']
    search_fields = ['title', 'body', 'recipient__email', 'group__name']
    readonly_fields = ['id', 'sent_at', 'success_count', 'failure_count']
    
    fieldsets = (
        (None, {
            'fields': ('title', 'body', 'icon', 'url')
        }),
        ('Target', {
            'fields': ('recipient', 'group', 'send_to_all'),
        }),
        ('Results', {
            'fields': ('success_count', 'failure_count', 'sent_at', 'sent_by'),
        }),
        ('Extra Data', {
            'fields': ('data',),
            'classes': ('collapse',),
        }),
    )


@admin.register(NotificationGroup)
class NotificationGroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'company', 'is_active', 'member_count', 'schedule_count', 'created_at']
    list_filter = ['is_active', 'company', 'created_at']
    search_fields = ['name', 'description', 'company__name']
    filter_horizontal = ['members']
    readonly_fields = ['id', 'created_at', 'updated_at', 'member_count', 'schedule_count']
    
    fieldsets = (
        (None, {
            'fields': ('name', 'description', 'is_active')
        }),
        ('Company', {
            'fields': ('company',),
            'description': 'Optional: Link this group to a specific company.'
        }),
        ('Members', {
            'fields': ('members',),
        }),
        ('Statistics', {
            'fields': ('member_count', 'schedule_count'),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = 'Members'
    
    def schedule_count(self, obj):
        return obj.schedules.count()
    schedule_count.short_description = 'Schedules'


@admin.register(NotificationSchedule)
class NotificationScheduleAdmin(admin.ModelAdmin):
    list_display = ['title', 'group', 'frequency', 'send_time', 'is_active', 'next_send_at', 'last_sent_at']
    list_filter = ['is_active', 'frequency', 'group', 'created_at']
    search_fields = ['title', 'body', 'group__name']
    readonly_fields = ['id', 'created_at', 'updated_at', 'last_sent_at', 'next_send_at']
    
    fieldsets = (
        (None, {
            'fields': ('group', 'is_active')
        }),
        ('Schedule', {
            'fields': ('frequency', 'weekly_day', 'custom_days', 'send_time'),
            'description': 'Configure when notifications should be sent.'
        }),
        ('Notification Content', {
            'fields': ('title', 'body', 'icon', 'url'),
        }),
        ('Timing Info', {
            'fields': ('next_send_at', 'last_sent_at'),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
