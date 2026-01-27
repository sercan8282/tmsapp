from datetime import date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from .models import InvoiceTemplate, Invoice, InvoiceLine
from .serializers import (
    InvoiceTemplateSerializer,
    InvoiceSerializer,
    InvoiceCreateSerializer,
    InvoiceLineSerializer
)


class InvoiceTemplateViewSet(viewsets.ModelViewSet):
    queryset = InvoiceTemplate.objects.all()
    serializer_class = InvoiceTemplateSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ['is_active']


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('bedrijf', 'template', 'created_by').prefetch_related('lines').all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['type', 'status', 'bedrijf']
    search_fields = ['factuurnummer', 'bedrijf__naam']
    ordering_fields = ['factuurdatum', 'factuurnummer', 'totaal']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return InvoiceCreateSerializer
        return InvoiceSerializer
    
    def perform_create(self, serializer):
        # Generate invoice number
        today = date.today()
        prefix = f"INV-{today.year}{today.month:02d}"
        count = Invoice.objects.filter(factuurnummer__startswith=prefix).count() + 1
        factuurnummer = f"{prefix}-{count:04d}"
        
        serializer.save(
            created_by=self.request.user,
            factuurnummer=factuurnummer
        )
    
    @action(detail=True, methods=['post'])
    def recalculate(self, request, pk=None):
        """Recalculate invoice totals."""
        invoice = self.get_object()
        invoice.calculate_totals()
        return Response(InvoiceSerializer(invoice).data)
    
    @action(detail=True, methods=['post'])
    def generate_pdf(self, request, pk=None):
        """Generate PDF for invoice."""
        # TODO: Implement PDF generation with WeasyPrint
        return Response({'message': 'PDF generatie komt in Fase 6.'})
    
    @action(detail=True, methods=['post'])
    def send_email(self, request, pk=None):
        """Send invoice via email."""
        # TODO: Implement email sending
        return Response({'message': 'E-mail verzending komt in Fase 6.'})


class InvoiceLineViewSet(viewsets.ModelViewSet):
    queryset = InvoiceLine.objects.select_related('invoice').all()
    serializer_class = InvoiceLineSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['invoice']
    
    def perform_create(self, serializer):
        line = serializer.save()
        line.invoice.calculate_totals()
    
    def perform_update(self, serializer):
        line = serializer.save()
        line.invoice.calculate_totals()
    
    def perform_destroy(self, instance):
        invoice = instance.invoice
        instance.delete()
        invoice.calculate_totals()
