from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SpreadsheetViewSet, SpreadsheetTemplateViewSet

router = DefaultRouter()
router.register(r'templates', SpreadsheetTemplateViewSet, basename='spreadsheet-templates')
router.register(r'', SpreadsheetViewSet, basename='spreadsheets')

urlpatterns = [
    path('', include(router.urls)),
]
