"""
Views for push notifications.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from .models import PushSettings, PushSubscription, PushNotification
from .serializers import (
    PushSettingsSerializer,
    PushSubscriptionSerializer,
    PushSubscriptionCreateSerializer,
    SendPushNotificationSerializer,
    PushNotificationSerializer,
    GenerateVapidKeysSerializer,
    PublicVapidKeySerializer,
)
from .services import get_push_service, send_push_notification
from apps.accounts.models import User


class PushSettingsView(APIView):
    """
    API view for managing push notification settings.
    Admin only.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        """Get current push settings."""
        settings = PushSettings.get_settings()
        serializer = PushSettingsSerializer(settings)
        return Response(serializer.data)
    
    def put(self, request):
        """Update push settings."""
        settings = PushSettings.get_settings()
        serializer = PushSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    
    def patch(self, request):
        """Partial update push settings."""
        return self.put(request)


class GenerateVapidKeysView(APIView):
    """
    Generate new VAPID key pair.
    Admin only.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def post(self, request):
        """Generate new VAPID keys."""
        try:
            # Generate keys using cryptography
            from cryptography.hazmat.primitives.asymmetric import ec
            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives import serialization
            import base64
            
            # Generate ECDSA key pair using P-256 curve (required for Web Push)
            private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
            public_key = private_key.public_key()
            
            # Get raw bytes for private key
            private_numbers = private_key.private_numbers()
            private_bytes = private_numbers.private_value.to_bytes(32, 'big')
            
            # Get uncompressed point format for public key
            public_bytes = public_key.public_bytes(
                encoding=serialization.Encoding.X962,
                format=serialization.PublicFormat.UncompressedPoint
            )
            
            # Base64url encode (without padding, as per Web Push spec)
            public_key_b64 = base64.urlsafe_b64encode(public_bytes).decode().rstrip('=')
            private_key_b64 = base64.urlsafe_b64encode(private_bytes).decode().rstrip('=')
            
            return Response({
                'public_key': public_key_b64,
                'private_key': private_key_b64,
            })
            
        except Exception as e:
            return Response(
                {'error': f'Failed to generate VAPID keys: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PublicPushConfigView(APIView):
    """
    Get public push configuration (for frontend).
    Available to all authenticated users.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get public VAPID key and configuration."""
        settings = PushSettings.get_settings()
        
        if not settings.is_configured():
            return Response({
                'is_configured': False,
                'provider': settings.provider,
                'public_key': None,
            })
        
        response_data = {
            'is_configured': True,
            'provider': settings.provider,
        }
        
        if settings.provider == 'webpush':
            response_data['public_key'] = settings.vapid_public_key
        elif settings.provider == 'firebase':
            response_data['firebase_config'] = {
                'projectId': settings.firebase_project_id,
                'messagingSenderId': settings.firebase_sender_id,
            }
        
        return Response(response_data)


class PushSubscriptionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing push subscriptions.
    Users can manage their own subscriptions.
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return subscriptions for current user."""
        return PushSubscription.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return PushSubscriptionCreateSerializer
        return PushSubscriptionSerializer
    
    def create(self, request, *args, **kwargs):
        """Subscribe to push notifications."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subscription = serializer.save()
        
        return Response(
            PushSubscriptionSerializer(subscription).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=False, methods=['post'])
    def unsubscribe(self, request):
        """Unsubscribe from push notifications."""
        endpoint = request.data.get('endpoint')
        if not endpoint:
            return Response(
                {'error': 'Endpoint is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        deleted, _ = PushSubscription.objects.filter(
            user=request.user,
            endpoint=endpoint
        ).delete()
        
        if deleted:
            return Response({'status': 'unsubscribed'})
        return Response(
            {'error': 'Subscription not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    @action(detail=False, methods=['get'])
    def status(self, request):
        """Get subscription status for current user."""
        subscriptions = self.get_queryset().filter(is_active=True)
        settings = PushSettings.get_settings()
        
        return Response({
            'is_subscribed': subscriptions.exists(),
            'subscription_count': subscriptions.count(),
            'push_enabled': settings.is_configured(),
        })


class SendPushNotificationView(APIView):
    """
    Send push notifications.
    Admin only.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def post(self, request):
        """Send a push notification."""
        serializer = SendPushNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        # Determine target
        user = None
        users = None
        send_to_all = data.get('send_to_all', False)
        
        if data.get('user_id'):
            user = get_object_or_404(User, pk=data['user_id'])
        elif data.get('user_ids'):
            users = list(User.objects.filter(pk__in=data['user_ids']))
        
        # Send notification
        result = send_push_notification(
            user=user,
            users=users,
            send_to_all=send_to_all,
            title=data['title'],
            body=data['body'],
            icon=data.get('icon'),
            url=data.get('url'),
            data=data.get('data'),
            sent_by=request.user,
        )
        
        return Response(result)


class PushNotificationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing push notification logs.
    Admin only.
    """
    queryset = PushNotification.objects.all()
    serializer_class = PushNotificationSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by recipient
        recipient_id = self.request.query_params.get('recipient')
        if recipient_id:
            queryset = queryset.filter(recipient_id=recipient_id)
        
        return queryset
