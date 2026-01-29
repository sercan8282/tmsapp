from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    InvoiceTemplateViewSet, 
    InvoiceViewSet, 
    InvoiceLineViewSet,
    ExpenseViewSet,
    RevenueView,
    RevenueYearsView,
)

router = DefaultRouter()
router.register(r'templates', InvoiceTemplateViewSet, basename='invoice-templates')
router.register(r'invoices', InvoiceViewSet, basename='invoices')
router.register(r'lines', InvoiceLineViewSet, basename='invoice-lines')
router.register(r'expenses', ExpenseViewSet, basename='expenses')

urlpatterns = [
    path('', include(router.urls)),
    # Revenue endpoints
    path('revenue/', RevenueView.as_view(), name='revenue'),
    path('revenue/years/', RevenueYearsView.as_view(), name='revenue-years'),
    # OCR Import endpoints
    path('ocr/', include('apps.invoicing.ocr.urls')),
]
