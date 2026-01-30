"""
URL configuration for push notifications.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    PushSettingsView,
    GenerateVapidKeysView,
    PublicPushConfigView,
    PushSubscriptionViewSet,
    SendPushNotificationView,
    PushNotificationLogViewSet,
    NotificationGroupViewSet,
    NotificationScheduleViewSet,
    AvailableUsersView,
    NotificationInboxViewSet,
    SentNotificationsViewSet,
)

router = DefaultRouter()
router.register(r'subscriptions', PushSubscriptionViewSet, basename='push-subscription')
router.register(r'logs', PushNotificationLogViewSet, basename='push-log')
router.register(r'groups', NotificationGroupViewSet, basename='notification-group')
router.register(r'schedules', NotificationScheduleViewSet, basename='notification-schedule')
router.register(r'inbox', NotificationInboxViewSet, basename='notification-inbox')
router.register(r'sent', SentNotificationsViewSet, basename='sent-notifications')

urlpatterns = [
    # Admin settings
    path('settings/', PushSettingsView.as_view(), name='push-settings'),
    path('settings/generate-vapid-keys/', GenerateVapidKeysView.as_view(), name='generate-vapid-keys'),
    
    # Public config (for frontend)
    path('config/', PublicPushConfigView.as_view(), name='push-config'),
    
    # Send notifications
    path('send/', SendPushNotificationView.as_view(), name='send-push'),
    
    # Available users for group assignment
    path('available-users/', AvailableUsersView.as_view(), name='available-users'),
    
    # Router URLs
    path('', include(router.urls)),
]