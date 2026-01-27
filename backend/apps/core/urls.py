"""
Core app URL configuration.
"""
from django.urls import path
from .views import PublicSettingsView, AdminSettingsViewSet

urlpatterns = [
    # Public settings (no auth required)
    path('settings/', PublicSettingsView.as_view(), name='public-settings'),
    
    # Admin settings management
    path('admin/settings/', AdminSettingsViewSet.as_view({
        'get': 'list',
        'patch': 'partial_update',
    }), name='admin-settings'),
    path('admin/settings/upload-logo/', AdminSettingsViewSet.as_view({
        'post': 'upload_logo',
    }), name='admin-settings-upload-logo'),
    path('admin/settings/upload-favicon/', AdminSettingsViewSet.as_view({
        'post': 'upload_favicon',
    }), name='admin-settings-upload-favicon'),
    path('admin/settings/test-email/', AdminSettingsViewSet.as_view({
        'post': 'test_email',
    }), name='admin-settings-test-email'),
]
