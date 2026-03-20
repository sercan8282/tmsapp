from django.contrib import admin
from .models import TrackingSession, LocationPoint


@admin.register(TrackingSession)
class TrackingSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'vehicle', 'is_active', 'started_at', 'ended_at')
    list_filter = ('is_active', 'started_at')
    search_fields = ('user__username', 'user__first_name', 'vehicle__kenteken')
    readonly_fields = ('id', 'started_at', 'ip_address', 'user_agent')


@admin.register(LocationPoint)
class LocationPointAdmin(admin.ModelAdmin):
    list_display = ('id', 'session', 'latitude', 'longitude', 'speed', 'recorded_at')
    list_filter = ('recorded_at',)
    readonly_fields = ('received_at',)
