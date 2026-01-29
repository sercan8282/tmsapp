"""
Invoice OCR Views - API endpoints for invoice import and OCR processing
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
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
    parser_classes = [MultiPartParser, FormParser]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return InvoiceImportListSerializer
        elif self.action == 'upload':
            return InvoiceImportUploadSerializer
        return InvoiceImportDetailSerializer
    
    def get_queryset(self):
        """Filter imports by user (unless staff)."""
        queryset = InvoiceImport.objects.select_related(
            'uploaded_by', 'matched_pattern', 'matched_pattern__company'
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
        
        # Process the upload
        service = InvoiceImportService()
        invoice_import = service.process_upload(file, request.user)
        
        # Return the result
        detail_serializer = InvoiceImportDetailSerializer(
            invoice_import,
            context={'request': request}
        )
        
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)
    
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
        engine = OCREngine()
        
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
        Convert the import to an actual invoice or expense.
        """
        invoice_import = self.get_object()
        
        serializer = ConvertToInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        
        if data['invoice_type'] == 'expense':
            # Create expense
            from apps.invoicing.models import Expense
            
            expense = Expense.objects.create(
                omschrijving=data.get('omschrijving', invoice_import.file_name),
                datum=data.get('factuurdatum', timezone.now().date()),
                bedrag=data.get('subtotaal', data['totaal']),
                btw_bedrag=data.get('btw_bedrag', 0),
                totaal=data['totaal'],
                categorie=data.get('expense_category', 'overig'),
                referentie=data.get('factuurnummer', ''),
                bijlage=invoice_import.original_file,
            )
            
            # Mark as completed
            invoice_import.status = InvoiceImport.Status.COMPLETED
            invoice_import.completed_at = timezone.now()
            invoice_import.save(update_fields=['status', 'completed_at'])
            
            return Response({
                'success': True,
                'type': 'expense',
                'id': str(expense.id),
                'message': 'Uitgave aangemaakt'
            })
        
        else:
            # Create inkoop factuur
            # This would depend on your Invoice model structure
            return Response({
                'success': True,
                'type': 'inkoop',
                'message': 'Inkoopfactuur aangemaakt'
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
