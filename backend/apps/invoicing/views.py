import logging
from datetime import date
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from apps.core.permissions import IsAdminOrManager
from .models import InvoiceTemplate, Invoice, InvoiceLine, InvoiceStatus
from .serializers import (
    InvoiceTemplateSerializer,
    InvoiceSerializer,
    InvoiceCreateSerializer,
    InvoiceUpdateSerializer,
    InvoiceLineSerializer
)

logger = logging.getLogger('accounts.security')


class InvoiceTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet voor factuur templates.
    Alleen admins mogen templates beheren.
    """
    queryset = InvoiceTemplate.objects.all()
    serializer_class = InvoiceTemplateSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ['is_active']
    search_fields = ['naam', 'beschrijving']
    
    def perform_create(self, serializer):
        template = serializer.save()
        logger.info(
            f"InvoiceTemplate created: '{template.naam}' by user {self.request.user.email}"
        )
    
    def perform_update(self, serializer):
        template = serializer.save()
        logger.info(
            f"InvoiceTemplate updated: '{template.naam}' by user {self.request.user.email}"
        )
    
    def perform_destroy(self, instance):
        template_name = instance.naam
        instance.delete()
        logger.warning(
            f"InvoiceTemplate deleted: '{template_name}' by user {self.request.user.email}"
        )


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    ViewSet voor facturen.
    
    Chauffeurs: alleen lezen
    Gebruikers/Admins: volledige CRUD
    """
    queryset = Invoice.objects.select_related(
        'bedrijf', 'template', 'created_by'
    ).prefetch_related('lines').all()
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    filterset_fields = ['type', 'status', 'bedrijf']
    search_fields = ['factuurnummer', 'bedrijf__naam']
    ordering_fields = ['factuurdatum', 'factuurnummer', 'totaal']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return InvoiceCreateSerializer
        if self.action in ['update', 'partial_update']:
            return InvoiceUpdateSerializer
        return InvoiceSerializer
    
    def perform_create(self, serializer):
        # Generate invoice number
        today = date.today()
        prefix = f"INV-{today.year}{today.month:02d}"
        count = Invoice.objects.filter(factuurnummer__startswith=prefix).count() + 1
        factuurnummer = f"{prefix}-{count:04d}"
        
        invoice = serializer.save(
            created_by=self.request.user,
            factuurnummer=factuurnummer
        )
        
        logger.info(
            f"Invoice created: {factuurnummer} for {invoice.bedrijf.naam} "
            f"by user {self.request.user.email}"
        )
    
    def perform_update(self, serializer):
        old_status = self.get_object().status
        invoice = serializer.save()
        
        if invoice.status != old_status:
            logger.info(
                f"Invoice status changed: {invoice.factuurnummer} "
                f"'{old_status}' -> '{invoice.status}' by user {self.request.user.email}"
            )
        else:
            logger.info(
                f"Invoice updated: {invoice.factuurnummer} by user {self.request.user.email}"
            )
    
    def perform_destroy(self, instance):
        # Alleen concept facturen mogen verwijderd worden
        if instance.status != InvoiceStatus.CONCEPT:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Alleen concept facturen kunnen worden verwijderd")
        
        invoice_nr = instance.factuurnummer
        instance.delete()
        logger.warning(
            f"Invoice deleted: {invoice_nr} by user {self.request.user.email}"
        )
    
    @action(detail=True, methods=['post'])
    def recalculate(self, request, pk=None):
        """Recalculate invoice totals."""
        invoice = self.get_object()
        invoice.calculate_totals()
        logger.info(
            f"Invoice recalculated: {invoice.factuurnummer} by user {request.user.email}"
        )
        return Response(InvoiceSerializer(invoice).data)
    
    @action(detail=True, methods=['post'])
    def mark_definitief(self, request, pk=None):
        """Mark invoice as definitief (no more edits to lines)."""
        invoice = self.get_object()
        
        if invoice.status != InvoiceStatus.CONCEPT:
            return Response(
                {'error': 'Alleen concept facturen kunnen definitief worden gemaakt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not invoice.lines.exists():
            return Response(
                {'error': 'Factuur moet minimaal 1 regel bevatten'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        invoice.status = InvoiceStatus.DEFINITIEF
        invoice.save()
        
        logger.info(
            f"Invoice marked definitief: {invoice.factuurnummer} by user {request.user.email}"
        )
        return Response(InvoiceSerializer(invoice).data)
    
    @action(detail=True, methods=['post'])
    def mark_verzonden(self, request, pk=None):
        """Mark invoice as sent."""
        invoice = self.get_object()
        
        if invoice.status != InvoiceStatus.DEFINITIEF:
            return Response(
                {'error': 'Alleen definitieve facturen kunnen worden verzonden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        invoice.status = InvoiceStatus.VERZONDEN
        invoice.sent_at = timezone.now()
        invoice.save()
        
        logger.info(
            f"Invoice marked verzonden: {invoice.factuurnummer} by user {request.user.email}"
        )
        return Response(InvoiceSerializer(invoice).data)
    
    @action(detail=True, methods=['post'])
    def mark_betaald(self, request, pk=None):
        """Mark invoice as paid."""
        invoice = self.get_object()
        
        if invoice.status != InvoiceStatus.VERZONDEN:
            return Response(
                {'error': 'Alleen verzonden facturen kunnen als betaald worden gemarkeerd'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        invoice.status = InvoiceStatus.BETAALD
        invoice.save()
        
        logger.info(
            f"Invoice marked betaald: {invoice.factuurnummer} by user {request.user.email}"
        )
        return Response(InvoiceSerializer(invoice).data)
    
    @action(detail=True, methods=['post'])
    def generate_pdf(self, request, pk=None):
        """Generate PDF for invoice."""
        invoice = self.get_object()
        
        if invoice.status == InvoiceStatus.CONCEPT:
            return Response(
                {'error': 'PDF kan alleen voor definitieve facturen worden gegenereerd'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # TODO: Implement PDF generation with WeasyPrint in Fase 6
        return Response({'message': 'PDF generatie komt in Fase 6.'})
    
    @action(detail=True, methods=['post'])
    def send_email(self, request, pk=None):
        """Send invoice via email."""
        invoice = self.get_object()
        
        if invoice.status not in [InvoiceStatus.DEFINITIEF, InvoiceStatus.VERZONDEN]:
            return Response(
                {'error': 'E-mail kan alleen voor definitieve/verzonden facturen worden verstuurd'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # TODO: Implement email sending in Fase 6
        return Response({'message': 'E-mail verzending komt in Fase 6.'})


class InvoiceLineViewSet(viewsets.ModelViewSet):
    """
    ViewSet voor factuurregels.
    
    Chauffeurs: alleen lezen
    Gebruikers/Admins: volledige CRUD (alleen bij concept facturen)
    """
    queryset = InvoiceLine.objects.select_related('invoice', 'invoice__bedrijf').all()
    serializer_class = InvoiceLineSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    filterset_fields = ['invoice']
    
    def perform_create(self, serializer):
        line = serializer.save()
        line.invoice.calculate_totals()
        
        logger.info(
            f"InvoiceLine created: '{line.omschrijving}' for {line.invoice.factuurnummer} "
            f"by user {self.request.user.email}"
        )
    
    def perform_update(self, serializer):
        line = serializer.save()
        line.invoice.calculate_totals()
        
        logger.info(
            f"InvoiceLine updated: '{line.omschrijving}' for {line.invoice.factuurnummer} "
            f"by user {self.request.user.email}"
        )
    
    def perform_destroy(self, instance):
        # Check in serializer validate doet dit ook, maar dubbel check
        if instance.invoice.status != InvoiceStatus.CONCEPT:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                "Factuurregels kunnen alleen worden verwijderd bij concept facturen"
            )
        
        invoice = instance.invoice
        line_desc = instance.omschrijving
        instance.delete()
        invoice.calculate_totals()
        
        logger.warning(
            f"InvoiceLine deleted: '{line_desc}' from {invoice.factuurnummer} "
            f"by user {self.request.user.email}"
        )
