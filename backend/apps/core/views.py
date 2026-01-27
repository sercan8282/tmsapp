"""
Core app views.
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from django.core.mail import send_mail

from .models import AppSettings
from .serializers import (
    AppSettingsSerializer, 
    AppSettingsAdminSerializer,
    EmailTestSerializer
)


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
        settings.logo = request.FILES['logo']
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
        settings.favicon = request.FILES['favicon']
        settings.save()
        serializer = AppSettingsAdminSerializer(settings, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def test_email(self, request):
        """Test email configuration."""
        serializer = EmailTestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        settings = AppSettings.get_settings()
        
        try:
            send_mail(
                subject='TMS - Test E-mail',
                message='Dit is een test e-mail vanuit TMS om de e-mail configuratie te verifiëren.',
                from_email=settings.smtp_from_email or None,
                recipient_list=[serializer.validated_data['to_email']],
                fail_silently=False,
            )
            return Response({'message': 'Test e-mail succesvol verzonden!'})
        except Exception as e:
            return Response(
                {'error': f'E-mail verzenden mislukt: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
