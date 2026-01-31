"""
Invoice OCR Views - API endpoints for invoice import and OCR processing
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import InvoiceImport, InvoicePattern, FieldMapping, ImportedInvoiceLine
from .serializers import (
    InvoiceImportListSerializer,
    InvoiceImportDetailSerializer,
    InvoiceImportUploadSerializer,
    CorrectionsSerializer,
    InvoicePatternSerializer,
    FieldMappingSerializer,
    CreatePatternSerializer,
    ExtractRegionSerializer,
    ConvertToInvoiceSerializer,
    ImportedInvoiceLineSerializer,
)
from .services import InvoiceImportService, BoundingBox


class InvoiceImportViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing invoice imports.
    """
    queryset = InvoiceImport.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return InvoiceImportListSerializer
        elif self.action == 'upload':
            return InvoiceImportUploadSerializer
        return InvoiceImportDetailSerializer
    
    def get_queryset(self):
        """Filter imports by user (unless staff)."""
        queryset = InvoiceImport.objects.select_related(
            'uploaded_by', 'matched_pattern'
        ).prefetch_related('lines')
        
        if not self.request.user.is_staff:
            queryset = queryset.filter(uploaded_by=self.request.user)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.order_by('-created_at')
    
    @action(detail=False, methods=['post'])
    def upload(self, request):
        """
        Upload a new invoice file for OCR processing.
        """
        serializer = InvoiceImportUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        file = serializer.validated_data['file']
        
        try:
            # Process the upload
            service = InvoiceImportService()
            invoice_import = service.process_upload(file, request.user)
            
            # Return the result
            detail_serializer = InvoiceImportDetailSerializer(
                invoice_import,
                context={'request': request}
            )
            
            return Response(detail_serializer.data, status=status.HTTP_201_CREATED)
        except RuntimeError as e:
            # OCR not available
            return Response(
                {'error': str(e), 'detail': 'Tesseract OCR is niet geïnstalleerd. Installeer Tesseract op het systeem.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def corrections(self, request, pk=None):
        """
        Submit corrections for extracted data.
        This updates the self-learning patterns.
        """
        invoice_import = self.get_object()
        
        serializer = CorrectionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        service = InvoiceImportService()
        
        # Apply corrections
        service.apply_corrections(
            invoice_import,
            serializer.validated_data['corrections']
        )
        
        # Optionally create new pattern
        if serializer.validated_data.get('create_pattern'):
            from apps.companies.models import Company
            company = get_object_or_404(
                Company,
                id=serializer.validated_data.get('company_id')
            )
            service.create_pattern_from_import(
                invoice_import,
                company,
                serializer.validated_data.get('pattern_name', f'Patroon {company.naam}'),
                serializer.validated_data.get('pattern_keywords', [])
            )
        
        # Update status
        invoice_import.status = InvoiceImport.Status.REVIEW
        invoice_import.save(update_fields=['status'])
        
        return Response(
            InvoiceImportDetailSerializer(
                invoice_import,
                context={'request': request}
            ).data
        )
    
    @action(detail=True, methods=['post'])
    def extract_region(self, request, pk=None):
        """
        Extract text from a specific region of the document.
        Used for interactive training.
        """
        invoice_import = self.get_object()
        
        serializer = ExtractRegionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Get the image path for the page
        ocr_data = invoice_import.extracted_data.get('ocr_pages', [])
        page_num = serializer.validated_data['page']
        
        if page_num >= len(ocr_data):
            return Response(
                {'error': 'Pagina niet gevonden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        image_path = ocr_data[page_num].get('image_path')
        if not image_path:
            return Response(
                {'error': 'Afbeelding niet beschikbaar'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract from region
        from .services import OCREngine
        from django.conf import settings
        import os
        
        engine = OCREngine()
        
        # Convert relative path to absolute path for processing
        if not os.path.isabs(image_path):
            image_path = os.path.join(settings.MEDIA_ROOT, image_path)
        
        bbox = BoundingBox(
            x=serializer.validated_data['x'],
            y=serializer.validated_data['y'],
            width=serializer.validated_data['width'],
            height=serializer.validated_data['height'],
            page=page_num
        )
        
        text = engine.extract_text_from_region(image_path, bbox)
        
        return Response({
            'text': text,
            'region': bbox.to_dict()
        })
    
    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        """
        Convert the import to an actual invoice.
        Supports: inkoop, verkoop, credit
        """
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Convert request data: {request.data}")
        
        invoice_import = self.get_object()
        
        serializer = ConvertToInvoiceSerializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"Serializer errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        invoice_type = data['invoice_type']
        
        from apps.invoicing.models import Invoice, InvoiceLine, InvoiceType, InvoiceStatus, InvoiceTemplate
        from apps.companies.models import Company
        from datetime import date, timedelta
        
        # Get or create a default template
        template, _ = InvoiceTemplate.objects.get_or_create(
            naam='Standaard',
            defaults={'beschrijving': 'Standaard factuur template', 'layout': {}, 'variables': {}}
        )
        
        # Try to find or create the company (leverancier/klant)
        leverancier_naam = data.get('leverancier', 'Onbekend')
        company, _ = Company.objects.get_or_create(
            naam=leverancier_naam
        )
        
        # Parse dates
        factuurdatum = data.get('factuurdatum')
        if isinstance(factuurdatum, str):
            try:
                # Try common date formats
                for fmt in ['%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y']:
                    try:
                        factuurdatum = date.fromisoformat(factuurdatum) if fmt == '%Y-%m-%d' else None
                        if factuurdatum:
                            break
                    except:
                        pass
            except:
                factuurdatum = None
        if not factuurdatum:
            factuurdatum = date.today()
        
        vervaldatum = data.get('vervaldatum')
        if not vervaldatum:
            vervaldatum = factuurdatum + timedelta(days=30)
        
        # Generate invoice number if not provided
        factuurnummer = data.get('factuurnummer', '')
        if not factuurnummer:
            # Generate unique number
            prefix = 'INK' if invoice_type == 'inkoop' else 'VRK' if invoice_type == 'verkoop' else 'CRD'
            count = Invoice.objects.filter(type=invoice_type).count() + 1
            factuurnummer = f"{prefix}-{date.today().year}-{count:04d}"
        
        # Ensure unique factuurnummer
        base_nummer = factuurnummer
        counter = 1
        while Invoice.objects.filter(factuurnummer=factuurnummer).exists():
            factuurnummer = f"{base_nummer}-{counter}"
            counter += 1
        
        # Map invoice type
        type_mapping = {
            'inkoop': InvoiceType.INKOOP,
            'verkoop': InvoiceType.VERKOOP,
            'credit': InvoiceType.CREDIT,
        }
        
        # Create the invoice
        invoice = Invoice.objects.create(
            factuurnummer=factuurnummer,
            type=type_mapping.get(invoice_type, InvoiceType.INKOOP),
            status=InvoiceStatus.CONCEPT,
            template=template,
            bedrijf=company,
            factuurdatum=factuurdatum,
            vervaldatum=vervaldatum,
            subtotaal=data.get('subtotaal', 0) or data.get('totaal', 0),
            btw_percentage=data.get('btw_percentage', 21),
            btw_bedrag=data.get('btw_bedrag', 0),
            totaal=data.get('totaal', 0),
            opmerkingen=data.get('omschrijving', invoice_import.file_name),
            pdf_file=invoice_import.original_file,
            created_by=request.user,
        )
        
        # Create invoice lines from user-edited line_items (if provided) or imported lines
        line_items = data.get('line_items', [])
        
        if line_items:
            # Use user-edited line items from frontend
            for i, item in enumerate(line_items):
                # Convert string values to proper types
                aantal = item.get('aantal', 1)
                if isinstance(aantal, str):
                    try:
                        aantal = float(aantal.replace(',', '.'))
                    except:
                        aantal = 1
                
                prijs = item.get('prijs_per_eenheid', 0)
                if isinstance(prijs, str):
                    try:
                        prijs = float(prijs.replace(',', '.'))
                    except:
                        prijs = 0
                
                InvoiceLine.objects.create(
                    invoice=invoice,
                    omschrijving=item.get('omschrijving', 'Regel'),
                    aantal=aantal or 1,
                    eenheid=item.get('eenheid', 'stuk') or 'stuk',
                    prijs_per_eenheid=prijs or 0,
                    volgorde=i,
                )
        else:
            # Fall back to imported lines from OCR
            for imported_line in invoice_import.lines.all():
                InvoiceLine.objects.create(
                    invoice=invoice,
                    omschrijving=imported_line.omschrijving or imported_line.raw_text or 'Regel',
                    aantal=imported_line.aantal or 1,
                    eenheid=imported_line.eenheid or 'stuk',
                    prijs_per_eenheid=imported_line.prijs_per_eenheid or imported_line.totaal or 0,
                    volgorde=imported_line.volgorde,
                )
        
        # Mark import as completed
        invoice_import.status = InvoiceImport.Status.COMPLETED
        invoice_import.completed_at = timezone.now()
        invoice_import.save(update_fields=['status', 'completed_at'])
        
        type_labels = {
            'inkoop': 'Inkoopfactuur',
            'verkoop': 'Verkoopfactuur', 
            'credit': 'Creditnota',
        }
        
        return Response({
            'success': True,
            'type': invoice_type,
            'id': str(invoice.id),
            'factuurnummer': invoice.factuurnummer,
            'message': f'{type_labels.get(invoice_type, "Factuur")} {invoice.factuurnummer} aangemaakt'
        })
    
    @action(detail=True, methods=['get'])
    def page_image(self, request, pk=None):
        """
        Get the image URL for a specific page.
        """
        invoice_import = self.get_object()
        page_num = int(request.query_params.get('page', 0))
        
        ocr_data = invoice_import.extracted_data.get('ocr_pages', [])
        
        if page_num >= len(ocr_data):
            return Response(
                {'error': 'Pagina niet gevonden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        page = ocr_data[page_num]
        
        return Response({
            'page': page_num,
            'width': page.get('width'),
            'height': page.get('height'),
            'image_path': page.get('image_path'),
            # Convert to URL if needed
        })
    
    @action(detail=True, methods=['patch'])
    def update_lines(self, request, pk=None):
        """
        Update the extracted line items.
        """
        invoice_import = self.get_object()
        lines_data = request.data.get('lines', [])
        
        for line_data in lines_data:
            line_id = line_data.get('id')
            if line_id:
                line = get_object_or_404(
                    ImportedInvoiceLine, 
                    id=line_id,
                    invoice_import=invoice_import
                )
                serializer = ImportedInvoiceLineSerializer(
                    line, 
                    data=line_data, 
                    partial=True
                )
                serializer.is_valid(raise_exception=True)
                serializer.save()
        
        return Response(
            InvoiceImportDetailSerializer(
                invoice_import,
                context={'request': request}
            ).data
        )

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """
        Delete multiple invoice imports at once.
        """
        ids = request.data.get('ids', [])
        if not ids:
            return Response(
                {'error': 'Geen IDs opgegeven'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Only delete imports the user has access to
        queryset = self.get_queryset().filter(id__in=ids)
        deleted_count = queryset.count()
        queryset.delete()
        
        return Response({
            'success': True,
            'deleted_count': deleted_count,
            'message': f'{deleted_count} imports verwijderd'
        })

    @action(detail=False, methods=['post'])
    def bulk_convert(self, request):
        """
        Convert multiple imports to invoices at once.
        """
        import logging
        logger = logging.getLogger(__name__)
        
        ids = request.data.get('ids', [])
        invoice_type = request.data.get('invoice_type', 'inkoop')
        
        if not ids:
            return Response(
                {'error': 'Geen IDs opgegeven'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from apps.invoicing.models import Invoice, InvoiceLine, InvoiceType, InvoiceStatus, InvoiceTemplate
        from apps.companies.models import Company
        from datetime import date, timedelta
        
        # Get default template
        template, _ = InvoiceTemplate.objects.get_or_create(
            naam='Standaard',
            defaults={'beschrijving': 'Standaard factuur template', 'layout': {}, 'variables': {}}
        )
        
        # Map invoice type
        type_mapping = {
            'inkoop': InvoiceType.INKOOP,
            'verkoop': InvoiceType.VERKOOP,
            'credit': InvoiceType.CREDIT,
        }
        
        type_labels = {
            'inkoop': 'Inkoopfactuur',
            'verkoop': 'Verkoopfactuur', 
            'credit': 'Creditnota',
        }
        
        queryset = self.get_queryset().filter(id__in=ids)
        results = []
        
        for invoice_import in queryset:
            try:
                # Extract data from import
                extracted = invoice_import.extracted_data or {}
                fields = extracted.get('fields', {})
                
                logger.info(f"Processing import {invoice_import.id}, fields: {fields}")
                
                # Helper function to get field value (handles both dict with 'value' key and direct values)
                def get_field(field_name, default=None):
                    val = fields.get(field_name)
                    if val is None:
                        return default
                    if isinstance(val, dict):
                        return val.get('value', default)
                    return val
                
                # Get company - try multiple field names
                leverancier_naam = (
                    get_field('supplier_name') or 
                    get_field('leverancier') or 
                    get_field('company_name') or
                    get_field('vendor_name') or
                    'Onbekend'
                )
                company, _ = Company.objects.get_or_create(naam=leverancier_naam)
                
                # Parse date - try multiple field names
                factuurdatum_str = (
                    get_field('invoice_date') or 
                    get_field('factuurdatum') or
                    get_field('date')
                )
                factuurdatum = date.today()
                if factuurdatum_str:
                    try:
                        from datetime import datetime
                        for fmt in ['%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y']:
                            try:
                                factuurdatum = datetime.strptime(str(factuurdatum_str), fmt).date()
                                break
                            except:
                                pass
                    except:
                        pass
                
                # Get invoice number - try multiple field names
                factuurnummer_str = (
                    get_field('invoice_number') or 
                    get_field('factuurnummer') or
                    get_field('number')
                )
                if not factuurnummer_str:
                    prefix = 'INK' if invoice_type == 'inkoop' else 'VRK' if invoice_type == 'verkoop' else 'CRD'
                    count = Invoice.objects.filter(type=invoice_type).count() + 1
                    factuurnummer_str = f"{prefix}-{date.today().year}-{count:04d}"
                
                # Ensure unique factuurnummer
                base_nummer = str(factuurnummer_str)
                counter = 1
                while Invoice.objects.filter(factuurnummer=factuurnummer_str).exists():
                    factuurnummer_str = f"{base_nummer}-{counter}"
                    counter += 1
                
                # Get totals - try multiple field names
                totaal = get_field('total') or get_field('totaal') or get_field('amount') or 0
                if isinstance(totaal, str):
                    try:
                        totaal = float(totaal.replace(',', '.').replace('€', '').strip())
                    except:
                        totaal = 0
                
                subtotaal = get_field('subtotal') or get_field('subtotaal') or totaal
                if isinstance(subtotaal, str):
                    try:
                        subtotaal = float(subtotaal.replace(',', '.').replace('€', '').strip())
                    except:
                        subtotaal = totaal
                
                btw_bedrag = get_field('vat_amount') or get_field('btw_bedrag') or 0
                if isinstance(btw_bedrag, str):
                    try:
                        btw_bedrag = float(btw_bedrag.replace(',', '.').replace('€', '').strip())
                    except:
                        btw_bedrag = 0
                
                btw_percentage = get_field('vat_percentage') or get_field('btw_percentage') or 21
                if isinstance(btw_percentage, str):
                    try:
                        btw_percentage = float(btw_percentage.replace('%', '').strip())
                    except:
                        btw_percentage = 21
                
                logger.info(f"Creating invoice: {factuurnummer_str}, company: {leverancier_naam}, total: {totaal}")
                
                # Create invoice
                invoice = Invoice.objects.create(
                    factuurnummer=factuurnummer_str,
                    type=type_mapping.get(invoice_type, InvoiceType.INKOOP),
                    status=InvoiceStatus.CONCEPT,
                    template=template,
                    bedrijf=company,
                    factuurdatum=factuurdatum,
                    vervaldatum=factuurdatum + timedelta(days=30),
                    subtotaal=subtotaal or totaal,
                    btw_percentage=btw_percentage,
                    btw_bedrag=btw_bedrag,
                    totaal=totaal,
                    opmerkingen=invoice_import.file_name,
                    pdf_file=invoice_import.original_file,
                    created_by=request.user,
                )
                
                # Create lines
                for imported_line in invoice_import.lines.all():
                    InvoiceLine.objects.create(
                        invoice=invoice,
                        omschrijving=imported_line.omschrijving or imported_line.raw_text or 'Regel',
                        aantal=imported_line.aantal or 1,
                        eenheid=imported_line.eenheid or 'stuk',
                        prijs_per_eenheid=imported_line.prijs_per_eenheid or imported_line.totaal or 0,
                        volgorde=imported_line.volgorde,
                    )
                
                # Mark as completed
                invoice_import.status = InvoiceImport.Status.COMPLETED
                invoice_import.completed_at = timezone.now()
                invoice_import.save(update_fields=['status', 'completed_at'])
                
                results.append({
                    'import_id': str(invoice_import.id),
                    'success': True,
                    'invoice_id': str(invoice.id),
                    'factuurnummer': invoice.factuurnummer,
                })
            except Exception as e:
                logger.error(f"Error converting import {invoice_import.id}: {e}")
                results.append({
                    'import_id': str(invoice_import.id),
                    'success': False,
                    'error': str(e),
                })
        
        successful = sum(1 for r in results if r.get('success'))
        
        return Response({
            'success': True,
            'converted_count': successful,
            'total_count': len(results),
            'results': results,
            'message': f'{successful} van {len(results)} imports omgezet naar {type_labels.get(invoice_type, "factuur")}'
        })


class InvoicePatternViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing invoice patterns (self-learning templates).
    """
    queryset = InvoicePattern.objects.all()
    serializer_class = InvoicePatternSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = InvoicePattern.objects.select_related('company').prefetch_related(
            'field_mappings'
        )
        
        # Filter by company
        company_id = self.request.query_params.get('company')
        if company_id:
            queryset = queryset.filter(company_id=company_id)
        
        # Filter by active status
        active = self.request.query_params.get('active')
        if active is not None:
            queryset = queryset.filter(is_active=active.lower() == 'true')
        
        return queryset.order_by('-accuracy_score', '-times_used')
    
    @action(detail=True, methods=['post'])
    def add_field_mapping(self, request, pk=None):
        """
        Add a field mapping to a pattern.
        """
        pattern = self.get_object()
        
        serializer = FieldMappingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        mapping = FieldMapping.objects.create(
            pattern=pattern,
            **serializer.validated_data
        )
        
        return Response(
            FieldMappingSerializer(mapping).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['delete'], url_path='field-mapping/(?P<mapping_id>[^/.]+)')
    def remove_field_mapping(self, request, pk=None, mapping_id=None):
        """
        Remove a field mapping from a pattern.
        """
        pattern = self.get_object()
        mapping = get_object_or_404(FieldMapping, id=mapping_id, pattern=pattern)
        mapping.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """
        Test a pattern against an uploaded file.
        """
        pattern = self.get_object()
        
        if 'file' not in request.data:
            return Response(
                {'error': 'Geen bestand geüpload'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.data['file']
        
        # Save temp file
        from django.core.files.storage import default_storage
        from django.core.files.base import ContentFile
        import tempfile
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            for chunk in file.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name
        
        try:
            # Run OCR
            from .services import OCREngine, PatternMatcher
            engine = OCREngine()
            matcher = PatternMatcher()
            
            ocr_result = engine.process_file(tmp_path)
            
            # Extract with pattern
            image_paths = [p.image_path for p in ocr_result.pages if p.image_path]
            extracted = matcher.extract_with_pattern(ocr_result, pattern, image_paths)
            
            return Response({
                'success': True,
                'extracted': extracted,
                'confidence': ocr_result.avg_confidence
            })
            
        finally:
            # Cleanup
            import os
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
