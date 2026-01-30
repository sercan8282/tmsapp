"""
Core app views.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.mail import send_mail, EmailMessage, get_connection
from django.db.models import Sum
from django.db import connection
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta


def safe_str(value):
    """Convert value to safe ASCII string (handle Unicode characters)."""
    if value is None:
        return ''
    s = str(value)
    replacements = {
        '\u0130': 'I', '\u0131': 'i', '\u015e': 'S', '\u015f': 's',
        '\u011e': 'G', '\u011f': 'g', '\u00c7': 'C', '\u00e7': 'c',
        '\u00d6': 'O', '\u00f6': 'o', '\u00dc': 'U', '\u00fc': 'u',
    }
    for char, replacement in replacements.items():
        s = s.replace(char, replacement)
    return s.encode('ascii', 'replace').decode('ascii')

from .models import AppSettings, CustomFont
from .serializers import (
    AppSettingsSerializer, 
    AppSettingsAdminSerializer,
    EmailTestSerializer,
    CustomFontSerializer,
    FontFamilySerializer,
)


class HealthCheckView(APIView):
    """
    Health check endpoint for monitoring and deployment.
    No authentication required.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        health = {
            'status': 'healthy',
            'timestamp': timezone.now().isoformat(),
            'checks': {}
        }
        
        # Check database connection
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
            health['checks']['database'] = 'ok'
        except Exception as e:
            health['checks']['database'] = f'error: {str(e)}'
            health['status'] = 'unhealthy'
        
        # Check cache (Redis)
        try:
            cache.set('health_check', 'ok', 10)
            if cache.get('health_check') == 'ok':
                health['checks']['cache'] = 'ok'
            else:
                health['checks']['cache'] = 'error: cache read failed'
                health['status'] = 'degraded'
        except Exception as e:
            health['checks']['cache'] = f'error: {str(e)}'
            health['status'] = 'degraded'
        
        status_code = status.HTTP_200_OK if health['status'] == 'healthy' else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(health, status=status_code)


class PublicSettingsView(APIView):
    """
    Public endpoint for app branding settings.
    No authentication required.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        settings = AppSettings.get_settings()
        serializer = AppSettingsSerializer(settings, context={'request': request})
        return Response(serializer.data)


class AdminSettingsViewSet(ViewSet):
    """
    Admin endpoint for managing all app settings.
    Requires admin authentication.
    """
    permission_classes = [IsAdminUser]
    
    def list(self, request):
        """Get all settings."""
        settings = AppSettings.get_settings()
        serializer = AppSettingsAdminSerializer(settings, context={'request': request})
        return Response(serializer.data)
    
    def partial_update(self, request, pk=None):
        """Update settings."""
        settings = AppSettings.get_settings()
        serializer = AppSettingsAdminSerializer(
            settings, 
            data=request.data, 
            partial=True,
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def upload_logo(self, request):
        """Upload logo image."""
        settings = AppSettings.get_settings()
        if 'logo' not in request.FILES:
            return Response(
                {'error': 'Geen bestand geüpload'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file = request.FILES['logo']
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
        if uploaded_file.content_type not in allowed_types:
            return Response(
                {'error': 'Ongeldig bestandstype. Alleen JPEG, PNG, GIF, WEBP en SVG zijn toegestaan.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file size (max 2MB for logo)
        max_size = 2 * 1024 * 1024
        if uploaded_file.size > max_size:
            return Response(
                {'error': 'Bestand is te groot. Maximum grootte is 2MB.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate magic bytes (file header)
        uploaded_file.seek(0)
        header = uploaded_file.read(16)
        uploaded_file.seek(0)
        
        valid_signatures = [
            b'\xff\xd8\xff',  # JPEG
            b'\x89PNG\r\n\x1a\n',  # PNG
            b'GIF87a', b'GIF89a',  # GIF
            b'RIFF',  # WEBP (starts with RIFF)
            b'<?xml', b'<svg',  # SVG
        ]
        
        if not any(header.startswith(sig) for sig in valid_signatures):
            # Check for SVG (may start with whitespace or BOM)
            if b'<svg' not in header and b'<?xml' not in header:
                return Response(
                    {'error': 'Bestandsinhoud komt niet overeen met bestandstype.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        settings.logo = uploaded_file
        settings.save()
        serializer = AppSettingsAdminSerializer(settings, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def upload_favicon(self, request):
        """Upload favicon image."""
        settings = AppSettings.get_settings()
        if 'favicon' not in request.FILES:
            return Response(
                {'error': 'Geen bestand geüpload'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file = request.FILES['favicon']
        
        # Validate file type
        allowed_types = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/ico']
        if uploaded_file.content_type not in allowed_types:
            return Response(
                {'error': 'Ongeldig bestandstype. Alleen PNG en ICO zijn toegestaan.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file size (max 500KB for favicon)
        max_size = 500 * 1024
        if uploaded_file.size > max_size:
            return Response(
                {'error': 'Bestand is te groot. Maximum grootte is 500KB.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate magic bytes
        uploaded_file.seek(0)
        header = uploaded_file.read(8)
        uploaded_file.seek(0)
        
        valid_signatures = [
            b'\x89PNG\r\n\x1a\n',  # PNG
            b'\x00\x00\x01\x00',  # ICO
        ]
        
        if not any(header.startswith(sig) for sig in valid_signatures):
            return Response(
                {'error': 'Bestandsinhoud komt niet overeen met bestandstype.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        settings.favicon = uploaded_file
        settings.save()
        serializer = AppSettingsAdminSerializer(settings, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def delete_logo(self, request):
        """Delete logo image."""
        settings = AppSettings.get_settings()
        if settings.logo:
            settings.logo.delete(save=False)
            settings.logo = None
            settings.save()
        serializer = AppSettingsAdminSerializer(settings, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def delete_favicon(self, request):
        """Delete favicon image."""
        settings = AppSettings.get_settings()
        if settings.favicon:
            settings.favicon.delete(save=False)
            settings.favicon = None
            settings.save()
        serializer = AppSettingsAdminSerializer(settings, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def test_email(self, request):
        """Test email configuration using database SMTP settings."""
        serializer = EmailTestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        settings = AppSettings.get_settings()
        to_email = serializer.validated_data['to_email']
        
        # Validate SMTP settings are configured
        if not settings.smtp_host:
            return Response(
                {'error': 'SMTP host is niet geconfigureerd. Vul eerst de e-mail instellingen in.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Create custom connection with database settings
            connection = get_connection(
                backend='django.core.mail.backends.smtp.EmailBackend',
                host=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_username or '',
                password=settings.smtp_password or '',
                use_tls=settings.smtp_use_tls,
                fail_silently=False,
            )
            
            # Sanitize from_email for ASCII compatibility
            from_email = safe_str(settings.smtp_from_email or settings.smtp_username)
            
            # Create and send email
            email = EmailMessage(
                subject='TMS - Test E-mail',
                body='Dit is een test e-mail vanuit TMS om de e-mail configuratie te verifieren.\n\nAls je deze e-mail ontvangt, werken de e-mail instellingen correct!',
                from_email=from_email,
                to=[to_email],
                connection=connection,
            )
            email.send(fail_silently=False)
            
            return Response({
                'message': f'Test e-mail succesvol verzonden naar {to_email}!'
            })
        except smtplib.SMTPAuthenticationError as e:
            return Response(
                {'error': f'Authenticatie mislukt. Controleer gebruikersnaam en wachtwoord. ({str(e)})'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except smtplib.SMTPConnectError as e:
            return Response(
                {'error': f'Kan geen verbinding maken met {settings.smtp_host}:{settings.smtp_port}. ({str(e)})'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'E-mail verzenden mislukt: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ImageUploadView(APIView):
    """
    General image upload endpoint for templates and other purposes.
    Uploads images to media/uploads/ folder and returns the URL.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        import os
        import uuid
        from django.core.files.storage import default_storage
        from django.core.files.base import ContentFile
        
        if 'image' not in request.FILES:
            return Response(
                {'error': 'Geen bestand geüpload'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file = request.FILES['image']
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
        if uploaded_file.content_type not in allowed_types:
            return Response(
                {'error': 'Ongeldig bestandstype. Alleen JPEG, PNG, GIF, WEBP en SVG zijn toegestaan.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file size (max 5MB)
        max_size = 5 * 1024 * 1024  # 5MB
        if uploaded_file.size > max_size:
            return Response(
                {'error': 'Bestand is te groot. Maximum grootte is 5MB.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate unique filename
        ext = os.path.splitext(uploaded_file.name)[1].lower()
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = f"uploads/{filename}"
        
        # Save file
        path = default_storage.save(filepath, ContentFile(uploaded_file.read()))
        
        # Build full URL
        file_url = request.build_absolute_uri(f'/media/{path}')
        
        return Response({
            'url': file_url,
            'filename': filename,
            'size': uploaded_file.size,
        })


class DashboardStatsView(APIView):
    """
    Dashboard statistics endpoint.
    Returns counts for users, companies, vehicles, hours this week, and open invoices.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from apps.accounts.models import User
        from apps.companies.models import Company
        from apps.fleet.models import Vehicle
        from apps.timetracking.models import TimeEntry
        from apps.invoicing.models import Invoice
        
        # Get current week number
        today = timezone.now().date()
        week_number = today.isocalendar()[1]
        year = today.year
        
        # Count users (excluding inactive)
        user_count = User.objects.filter(is_active=True).count()
        
        # Count companies
        company_count = Company.objects.count()
        
        # Count vehicles (all vehicles)
        vehicle_count = Vehicle.objects.count()
        
        # Get hours this week
        week_entries = TimeEntry.objects.filter(
            weeknummer=week_number,
            datum__year=year
        )
        
        # Calculate total hours from totaal_uren (format: "HH:MM:SS")
        total_hours = 0
        for entry in week_entries:
            if entry.totaal_uren:
                try:
                    parts = str(entry.totaal_uren).split(':')
                    hours = int(parts[0])
                    minutes = int(parts[1]) if len(parts) > 1 else 0
                    total_hours += hours + (minutes / 60)
                except (ValueError, IndexError):
                    pass
        
        # Count open invoices (concept or definitief, not betaald)
        open_invoice_count = Invoice.objects.filter(
            status__in=['concept', 'definitief', 'verzonden']
        ).count()
        
        return Response({
            'users': user_count,
            'companies': company_count,
            'vehicles': vehicle_count,
            'hours_this_week': round(total_hours, 1),
            'open_invoices': open_invoice_count,
            'week_number': week_number,
            'year': year,
        })


class CustomFontViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing custom fonts.
    Admin only for create/update/delete.
    Authenticated users can list (for template selection).
    """
    queryset = CustomFont.objects.all()
    serializer_class = CustomFontSerializer
    parser_classes = [MultiPartParser, FormParser]
    
    def get_permissions(self):
        """
        Allow any authenticated user to list fonts.
        Require admin for modifications.
        """
        if self.action in ['list', 'retrieve', 'families', 'css']:
            return [IsAuthenticated()]
        return [IsAdminUser()]
    
    def get_queryset(self):
        """Filter by active fonts for non-admins."""
        qs = super().get_queryset()
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        return qs.order_by('family', 'weight', 'style')
    
    def perform_create(self, serializer):
        """Set uploaded_by on creation."""
        serializer.save(uploaded_by=self.request.user)
    
    def perform_destroy(self, instance):
        """Prevent deletion of system fonts."""
        if instance.is_system:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Systeemfonts kunnen niet worden verwijderd.')
        instance.delete()
    
    @action(detail=False, methods=['get'])
    def families(self, request):
        """
        Get all font families with their variants.
        Useful for font pickers/selectors.
        """
        data = FontFamilySerializer.get_families_with_fonts()
        serializer = FontFamilySerializer(data, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def css(self, request):
        """
        Generate @font-face CSS for all active fonts.
        Returns CSS that can be injected into the page.
        """
        fonts = CustomFont.objects.filter(is_active=True)
        css_rules = []
        
        for font in fonts:
            if font.font_file:
                url = request.build_absolute_uri(font.font_file.url)
                css_rule = f"""@font-face {{
  font-family: '{font.family}';
  font-style: {font.style};
  font-weight: {font.weight};
  font-display: swap;
  src: url('{url}') format('{font.css_format}');
}}"""
                css_rules.append(css_rule)
        
        css_content = '\n\n'.join(css_rules)
        
        from django.http import HttpResponse
        response = HttpResponse(css_content, content_type='text/css')
        response['Cache-Control'] = 'public, max-age=3600'  # Cache for 1 hour
        return response
