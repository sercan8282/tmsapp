from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InvoiceTemplateViewSet, InvoiceViewSet, InvoiceLineViewSet

router = DefaultRouter()
router.register(r'templates', InvoiceTemplateViewSet, basename='invoice-templates')
router.register(r'invoices', InvoiceViewSet, basename='invoices')
router.register(r'lines', InvoiceLineViewSet, basename='invoice-lines')

urlpatterns = [
    path('', include(router.urls)),
]
