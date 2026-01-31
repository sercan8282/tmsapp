"""
Views voor documenten en handtekeningen.
"""
import logging
from datetime import datetime

from django.http import HttpResponse, FileResponse
from django.core.files.base import ContentFile
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import SignedDocument, SavedSignature
from .serializers import (
    SignedDocumentListSerializer,
    SignedDocumentDetailSerializer,
    DocumentUploadSerializer,
    SignDocumentSerializer,
    SavedSignatureSerializer
)
from .services import (
    decode_base64_image,
    create_signature_image,
    add_signature_to_pdf,
    get_pdf_info,
    pdf_page_to_image
)

logger = logging.getLogger(__name__)


class SignedDocumentViewSet(viewsets.ModelViewSet):
    """
    ViewSet voor documenten die ondertekend moeten worden.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_queryset(self):
        return SignedDocument.objects.select_related(
            'uploaded_by', 'signed_by'
        ).all()
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SignedDocumentListSerializer
        return SignedDocumentDetailSerializer
    
    def create(self, request, *args, **kwargs):
        """Upload een nieuw document."""
        try:
            serializer = DocumentUploadSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            uploaded_file = serializer.validated_data['file']
            
            document = SignedDocument.objects.create(
                title=serializer.validated_data['title'],
                description=serializer.validated_data.get('description', ''),
                original_file=uploaded_file,
                original_filename=uploaded_file.name,
                uploaded_by=request.user,
                status='pending'
            )
            
            return Response(
                SignedDocumentDetailSerializer(document, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            logger.exception(f"Error uploading document: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def info(self, request, pk=None):
        """Haal PDF informatie op (aantal pagina's, afmetingen)."""
        document = self.get_object()
        
        if not document.is_pdf:
            return Response(
                {'error': 'Document is geen PDF'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        pdf_bytes = document.original_file.read()
        document.original_file.seek(0)
        
        info = get_pdf_info(pdf_bytes)
        if not info:
            return Response(
                {'error': 'Kon PDF informatie niet lezen'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response(info)
    
    @action(detail=True, methods=['get'], url_path='page/(?P<page_number>[0-9]+)')
    def page_image(self, request, pk=None, page_number=None):
        """
        Render een PDF pagina als PNG afbeelding voor preview.
        """
        document = self.get_object()
        
        if not document.is_pdf:
            return Response(
                {'error': 'Document is geen PDF'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            page_num = int(page_number)
        except (TypeError, ValueError):
            return Response(
                {'error': 'Ongeldig paginanummer'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # DPI uit query parameter (default 150)
        dpi = int(request.query_params.get('dpi', 150))
        dpi = min(max(dpi, 72), 300)  # Tussen 72 en 300
        
        pdf_bytes = document.original_file.read()
        document.original_file.seek(0)
        
        image_bytes = pdf_page_to_image(pdf_bytes, page_num, dpi)
        
        if not image_bytes:
            return Response(
                {'error': 'Kon pagina niet renderen'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return HttpResponse(image_bytes, content_type='image/png')
    
    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """
        Onderteken een document.
        """
        document = self.get_object()
        
        if document.status == 'signed':
            return Response(
                {'error': 'Document is al ondertekend'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not document.is_pdf:
            return Response(
                {'error': 'Alleen PDF documenten kunnen ondertekend worden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = SignDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        # Decode handtekening afbeelding
        signature_bytes = decode_base64_image(data['signature_image'])
        if not signature_bytes:
            return Response(
                {'error': 'Ongeldige handtekening afbeelding'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Maak nette PNG van handtekening
        signature_png = create_signature_image(signature_bytes, target_width=300)
        if not signature_png:
            signature_png = signature_bytes
        
        # Lees originele PDF
        pdf_bytes = document.original_file.read()
        document.original_file.seek(0)
        
        # Voeg handtekening toe
        signed_pdf, error = add_signature_to_pdf(
            pdf_bytes=pdf_bytes,
            signature_bytes=signature_png,
            page_number=data['page'],
            x_percent=data['x'],
            y_percent=data['y'],
            width_percent=data.get('width', 20)
        )
        
        if error:
            return Response(
                {'error': error},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Sla ondertekende PDF op
        signed_filename = f"signed_{document.original_filename}"
        document.signed_file.save(
            signed_filename,
            ContentFile(signed_pdf),
            save=False
        )
        
        # Update document
        document.status = 'signed'
        document.signed_by = request.user
        document.signed_at = datetime.now()
        document.signature_data = {
            'page': data['page'],
            'x': data['x'],
            'y': data['y'],
            'width': data.get('width', 20),
            'signed_at': document.signed_at.isoformat(),
            'signed_by': request.user.full_name or request.user.email
        }
        document.save()
        
        # Optioneel: sla handtekening op voor hergebruik
        if data.get('save_signature'):
            SavedSignature.objects.create(
                user=request.user,
                name=data.get('signature_name', 'Mijn handtekening'),
                signature_image=ContentFile(
                    signature_png, 
                    name=f"signature_{request.user.id}.png"
                )
            )
        
        return Response(
            SignedDocumentDetailSerializer(document, context={'request': request}).data
        )
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """
        Download de ondertekende PDF.
        """
        document = self.get_object()
        
        if document.status != 'signed' or not document.signed_file:
            return Response(
                {'error': 'Document is nog niet ondertekend'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        response = FileResponse(
            document.signed_file.open('rb'),
            content_type='application/pdf'
        )
        response['Content-Disposition'] = f'attachment; filename="{document.original_filename}"'
        return response
    
    @action(detail=True, methods=['get'])
    def download_original(self, request, pk=None):
        """
        Download het originele PDF bestand.
        """
        document = self.get_object()
        
        response = FileResponse(
            document.original_file.open('rb'),
            content_type='application/pdf'
        )
        response['Content-Disposition'] = f'attachment; filename="{document.original_filename}"'
        return response


class SavedSignatureViewSet(viewsets.ModelViewSet):
    """
    ViewSet voor opgeslagen handtekeningen.
    """
    serializer_class = SavedSignatureSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_queryset(self):
        return SavedSignature.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Stel deze handtekening in als standaard."""
        signature = self.get_object()
        signature.is_default = True
        signature.save()
        return Response(SavedSignatureSerializer(signature).data)
