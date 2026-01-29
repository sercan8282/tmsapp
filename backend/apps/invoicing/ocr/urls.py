"""
Invoice OCR URL configuration
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import InvoiceImportViewSet, InvoicePatternViewSet

router = DefaultRouter()
router.register(r'imports', InvoiceImportViewSet, basename='invoice-import')
router.register(r'patterns', InvoicePatternViewSet, basename='invoice-pattern')

urlpatterns = [
    path('', include(router.urls)),
]
