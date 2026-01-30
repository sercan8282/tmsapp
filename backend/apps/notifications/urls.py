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
)

router = DefaultRouter()
router.register(r'subscriptions', PushSubscriptionViewSet, basename='push-subscription')
router.register(r'logs', PushNotificationLogViewSet, basename='push-log')

urlpatterns = [
    # Admin settings
    path('settings/', PushSettingsView.as_view(), name='push-settings'),
    path('settings/generate-vapid-keys/', GenerateVapidKeysView.as_view(), name='generate-vapid-keys'),
    
    # Public config (for frontend)
    path('config/', PublicPushConfigView.as_view(), name='push-config'),
    
    # Send notifications
    path('send/', SendPushNotificationView.as_view(), name='send-push'),
    
    # Router URLs
    path('', include(router.urls)),
]
