import json
import logging
from datetime import date
from django.utils import timezone
from django.http import JsonResponse
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
    
    @action(detail=True, methods=['post'])
    def copy(self, request, pk=None):
        """Copy a template with all its content to a new template."""
        original = self.get_object()
        
        # Get new name from request or generate one
        new_name = request.data.get('naam', f"{original.naam} (kopie)")
        
        # Create copy with same layout and variables
        new_template = InvoiceTemplate.objects.create(
            naam=new_name,
            beschrijving=request.data.get('beschrijving', original.beschrijving),
            layout=original.layout,  # JSONField is deep copied
            variables=original.variables,  # JSONField is deep copied
            is_active=True,
        )
        
        logger.info(
            f"InvoiceTemplate copied: '{original.naam}' -> '{new_template.naam}' "
            f"by user {request.user.email}"
        )
        
        return Response(InvoiceTemplateSerializer(new_template).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """Export a template as JSON file (without images)."""
        template = self.get_object()
        
        # Create export data - strip image URLs from layout
        layout_copy = json.loads(json.dumps(template.layout))  # Deep copy
        
        # Remove image URLs from header, subheader, footer
        for section in ['header', 'subheader', 'footer']:
            if section in layout_copy:
                for pos in ['left', 'center', 'right']:
                    field = layout_copy[section].get(pos)
                    if field and field.get('type') == 'image':
                        field['imageUrl'] = None  # Remove image URL
        
        export_data = {
            'version': '1.0',
            'type': 'invoice_template',
            'naam': template.naam,
            'beschrijving': template.beschrijving,
            'layout': layout_copy,
            'variables': template.variables,
        }
        
        response = JsonResponse(export_data, json_dumps_params={'indent': 2, 'ensure_ascii': False})
        response['Content-Disposition'] = f'attachment; filename="{template.naam}.json"'
        
        logger.info(
            f"InvoiceTemplate exported: '{template.naam}' by user {request.user.email}"
        )
        
        return response
    
    @action(detail=False, methods=['post'])
    def import_template(self, request):
        """Import a template from JSON data."""
        try:
            # Get JSON data from request
            if request.content_type == 'application/json':
                data = request.data
            else:
                # Handle file upload
                file = request.FILES.get('file')
                if not file:
                    return Response({'error': 'Geen bestand geüpload'}, status=status.HTTP_400_BAD_REQUEST)
                data = json.load(file)
            
            # Validate structure
            if data.get('type') != 'invoice_template':
                return Response({'error': 'Ongeldig template bestand'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Create new template from import
            new_name = request.query_params.get('naam') or data.get('naam', 'Geïmporteerde template')
            
            # Check if name already exists
            if InvoiceTemplate.objects.filter(naam=new_name).exists():
                new_name = f"{new_name} (import)"
            
            template = InvoiceTemplate.objects.create(
                naam=new_name,
                beschrijving=data.get('beschrijving', ''),
                layout=data.get('layout', {}),
                variables=data.get('variables', {}),
                is_active=True,
            )
            
            logger.info(
                f"InvoiceTemplate imported: '{template.naam}' by user {request.user.email}"
            )
            
            return Response(InvoiceTemplateSerializer(template).data, status=status.HTTP_201_CREATED)
            
        except json.JSONDecodeError:
            return Response({'error': 'Ongeldig JSON bestand'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


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
    ordering_fields = ['factuurdatum', 'factuurnummer', 'totaal', 'bedrijf__naam']
    
    @action(detail=False, methods=['get'])
    def next_number(self, request):
        """Get next invoice number for a given type."""
        invoice_type = request.query_params.get('type', 'verkoop')
        today = date.today()
        
        type_prefixes = {
            'verkoop': 'F',
            'credit': 'C',
            'inkoop': 'I',
        }
        prefix_char = type_prefixes.get(invoice_type, 'F')
        prefix = f"{prefix_char}-{today.year}"
        
        last_invoice = Invoice.objects.filter(
            factuurnummer__startswith=prefix
        ).order_by('-factuurnummer').first()
        
        if last_invoice:
            try:
                last_num = int(last_invoice.factuurnummer.split('-')[-1])
                next_num = last_num + 1
            except (ValueError, IndexError):
                next_num = 1
        else:
            next_num = 1
        
        factuurnummer = f"{prefix}-{next_num:04d}"
        
        return Response({
            'factuurnummer': factuurnummer,
            'type': invoice_type,
            'jaar': today.year,
        })
    
    def get_serializer_class(self):
        if self.action == 'create':
            return InvoiceCreateSerializer
        if self.action in ['update', 'partial_update']:
            return InvoiceUpdateSerializer
        return InvoiceSerializer
    
    def perform_create(self, serializer):
        # Generate invoice number based on type
        today = date.today()
        invoice_type = serializer.validated_data.get('type', 'verkoop')
        
        # Prefix based on type: F=Factuur(verkoop), C=Credit, I=Inkoop
        type_prefixes = {
            'verkoop': 'F',
            'credit': 'C',
            'inkoop': 'I',
        }
        prefix_char = type_prefixes.get(invoice_type, 'F')
        prefix = f"{prefix_char}-{today.year}"
        
        # Get next number for this type and year
        last_invoice = Invoice.objects.filter(
            factuurnummer__startswith=prefix
        ).order_by('-factuurnummer').first()
        
        if last_invoice:
            try:
                last_num = int(last_invoice.factuurnummer.split('-')[-1])
                next_num = last_num + 1
            except (ValueError, IndexError):
                next_num = 1
        else:
            next_num = 1
        
        factuurnummer = f"{prefix}-{next_num:04d}"
        
        invoice = serializer.save(
            created_by=self.request.user,
            factuurnummer=factuurnummer
        )
        
        logger.info(
            f"Invoice created: {factuurnummer} for {invoice.bedrijf.naam} "
            f"by user {self.request.user.email}"
        )
        
        # Store invoice instance for create response
        self._created_invoice = invoice
    
    def create(self, request, *args, **kwargs):
        """Override create to return full invoice data with id."""
        from rest_framework import status as drf_status
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Return full invoice data using InvoiceSerializer
        response_serializer = InvoiceSerializer(self._created_invoice)
        headers = self.get_success_headers(response_serializer.data)
        return Response(response_serializer.data, status=drf_status.HTTP_201_CREATED, headers=headers)
    
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
        # Log warning for non-concept invoices
        if instance.status != InvoiceStatus.CONCEPT:
            logger.warning(
                f"Non-concept invoice being deleted: {instance.factuurnummer} "
                f"(status: {instance.status}) by user {self.request.user.email}"
            )
        
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
    def change_status(self, request, pk=None):
        """Change invoice status to any status (admin override)."""
        invoice = self.get_object()
        new_status = request.data.get('status')
        
        valid_statuses = [s[0] for s in InvoiceStatus.choices]
        if new_status not in valid_statuses:
            return Response(
                {'error': f'Ongeldige status. Kies uit: {", ".join(valid_statuses)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_status = invoice.status
        invoice.status = new_status
        
        # Clear sent_at if going back to concept/definitief
        if new_status in [InvoiceStatus.CONCEPT, InvoiceStatus.DEFINITIEF]:
            invoice.sent_at = None
        
        invoice.save()
        
        logger.info(
            f"Invoice status changed: {invoice.factuurnummer} "
            f"'{old_status}' -> '{new_status}' by user {request.user.email}"
        )
        return Response(InvoiceSerializer(invoice).data)
    
    @action(detail=True, methods=['post'])
    def mark_verzonden(self, request, pk=None):
        """Mark invoice as sent."""
        invoice = self.get_object()
        
        # Removed restriction - allow from any status
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
        
        # Removed restriction - allow from any status
        invoice.status = InvoiceStatus.BETAALD
        invoice.save()
        
        logger.info(
            f"Invoice marked betaald: {invoice.factuurnummer} by user {request.user.email}"
        )
        return Response(InvoiceSerializer(invoice).data)
    
    @action(detail=True, methods=['get', 'post'])
    def generate_pdf(self, request, pk=None):
        """Generate PDF for invoice (works for any status)."""
        from django.http import HttpResponse
        from .pdf_generator import generate_invoice_pdf
        
        invoice = self.get_object()
        
        # Generate PDF
        pdf_content = generate_invoice_pdf(invoice)
        
        # Create response with PDF
        response = HttpResponse(pdf_content, content_type='application/pdf')
        
        # Set filename based on invoice number
        filename = f"factuur_{invoice.factuurnummer.replace('/', '-')}.pdf"
        
        # Check if download or view in browser
        if request.query_params.get('download', 'false').lower() == 'true':
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
        else:
            response['Content-Disposition'] = f'inline; filename="{filename}"'
        
        logger.info(
            f"PDF generated for invoice: {invoice.factuurnummer} by user {request.user.email}"
        )
        
        return response
    
    @action(detail=True, methods=['post'])
    def send_email(self, request, pk=None):
        """Send invoice via email."""
        from django.core.mail import EmailMessage
        from apps.core.models import AppSettings
        
        invoice = self.get_object()
        
        if invoice.status not in [InvoiceStatus.DEFINITIEF, InvoiceStatus.VERZONDEN]:
            return Response(
                {'error': 'E-mail kan alleen voor definitieve/verzonden facturen worden verstuurd'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get recipient email from request or use company email
        recipient_email = request.data.get('email')
        if not recipient_email:
            # Try to get from company
            if hasattr(invoice.bedrijf, 'email') and invoice.bedrijf.email:
                recipient_email = invoice.bedrijf.email
            else:
                return Response(
                    {'error': 'Geen e-mailadres opgegeven en bedrijf heeft geen e-mailadres'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Get app settings for SMTP and company info
        settings = AppSettings.get_settings()
        
        if not settings.smtp_host:
            return Response(
                {'error': 'SMTP instellingen zijn niet geconfigureerd. Ga naar Instellingen om e-mail te configureren.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Build email - only show factuurnummer in subject, no company name
        subject = f"Factuur {invoice.factuurnummer}"
        
        # Build email body with optional signature
        signature = settings.email_signature or ''
        signature_block = f"\n\n{signature}" if signature else ''
        
        body = f"""Geachte,

Hierbij ontvangt u factuur {invoice.factuurnummer}.

Factuurdatum: {invoice.factuurdatum.strftime('%d-%m-%Y')}
Vervaldatum: {invoice.vervaldatum.strftime('%d-%m-%Y')}
Bedrag: € {invoice.totaal:.2f}

{f"Opmerkingen: {invoice.opmerkingen}" if invoice.opmerkingen else ""}

Met vriendelijke groet,
{settings.company_name or ''}
{settings.company_email or ''}{signature_block}
"""
        
        try:
            # Create custom SMTP connection using database settings
            from django.core.mail import get_connection
            
            connection = get_connection(
                backend='django.core.mail.backends.smtp.EmailBackend',
                host=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_username,
                password=settings.smtp_password,
                use_tls=settings.smtp_use_tls,
                fail_silently=False,
            )
            
            email = EmailMessage(
                subject=subject,
                body=body,
                from_email=settings.smtp_from_email or settings.smtp_username,
                to=[recipient_email],
                connection=connection,
            )
            
            # Generate and attach PDF
            from .pdf_generator import generate_invoice_pdf
            pdf_content = generate_invoice_pdf(invoice)
            filename = f"factuur_{invoice.factuurnummer.replace('/', '-')}.pdf"
            email.attach(filename, pdf_content, 'application/pdf')
            
            email.send()
            
            # Update invoice status to verzonden if definitief
            if invoice.status == InvoiceStatus.DEFINITIEF:
                invoice.status = InvoiceStatus.VERZONDEN
                invoice.sent_at = timezone.now()
                invoice.save()
            
            logger.info(
                f"Invoice email sent: {invoice.factuurnummer} to {recipient_email} "
                f"by user {request.user.email}"
            )
            
            return Response({
                'message': f'Factuur succesvol verzonden naar {recipient_email}',
                'invoice': InvoiceSerializer(invoice).data
            })
            
        except Exception as e:
            logger.error(f"Email send failed for invoice {invoice.factuurnummer}: {str(e)}")
            return Response(
                {'error': f'E-mail verzenden mislukt: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


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
        # Log warning for non-concept invoice line deletion
        if instance.invoice.status != InvoiceStatus.CONCEPT:
            logger.warning(
                f"InvoiceLine being deleted from non-concept invoice: {instance.invoice.factuurnummer} "
                f"(status: {instance.invoice.status}) by user {self.request.user.email}"
            )
        
        invoice = instance.invoice
        line_desc = instance.omschrijving
        instance.delete()
        invoice.calculate_totals()
        
        logger.warning(
            f"InvoiceLine deleted: '{line_desc}' from {invoice.factuurnummer} "
            f"by user {self.request.user.email}"
        )
