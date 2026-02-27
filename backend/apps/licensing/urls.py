"""
Licensing app URL configuration.
"""
from django.urls import path
from .views import LicenseActivateView, LicenseStatusView

urlpatterns = [
    path('activate/', LicenseActivateView.as_view(), name='license-activate'),
    path('status/', LicenseStatusView.as_view(), name='license-status'),
]
