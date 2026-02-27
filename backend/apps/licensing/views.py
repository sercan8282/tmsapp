"""
Licensing app views.

Endpoints:
- POST /api/licensing/activate/  - Activate a license key (no auth required)
- GET  /api/licensing/status/    - Get current license status (no auth required)
"""
import logging
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdminOnly
from .serializers import LicenseActivateSerializer, LicenseStatusSerializer
from .services import activate_license, get_active_license

logger = logging.getLogger(__name__)


class LicenseActivateView(APIView):
    """
    Activate a license key.
    
    POST /api/licensing/activate/
    Body: { "license_key": "..." }
    
    No authentication required - the license must be activatable
    before any users can log in.
    """
    permission_classes = [AllowAny]
    
    # Rate limit: prevent brute-force license guessing
    throttle_scope = 'login'
    
    def post(self, request):
        serializer = LicenseActivateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        license_key = serializer.validated_data['license_key']
        result = activate_license(license_key)
        
        if result['success']:
            logger.info(f'License activated: {result["license"]["customer"]}')
            return Response(result, status=status.HTTP_200_OK)
        else:
            logger.warning(f'License activation failed: {result["error"]}')
            return Response(result, status=status.HTTP_400_BAD_REQUEST)


class LicenseStatusView(APIView):
    """
    Get the current license status.
    
    GET /api/licensing/status/
    
    Returns license info if active, or a "no license" response.
    No authentication required so the frontend can determine whether
    to show the activation screen.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        license_obj = get_active_license()
        
        if license_obj is None:
            return Response(
                {
                    'licensed': False,
                    'message': 'Geen actieve licentie gevonden.',
                },
                status=status.HTTP_200_OK,
            )
        
        serializer = LicenseStatusSerializer(license_obj)
        
        return Response(
            {
                'licensed': True,
                'license': serializer.data,
            },
            status=status.HTTP_200_OK,
        )
