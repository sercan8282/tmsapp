from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SpreadsheetViewSet

router = DefaultRouter()
router.register(r'', SpreadsheetViewSet, basename='spreadsheets')

urlpatterns = [
    path('', include(router.urls)),
]
