"""
Accounts app views.
"""
import pyotp
import qrcode
import qrcode.image.svg
from io import BytesIO
import base64

from django.contrib.auth import get_user_model
from django.db import models
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    UserSerializer,
    UserDetailSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    PasswordChangeSerializer,
    PasswordResetSerializer,
    CustomTokenObtainPairSerializer,
    MFASetupSerializer,
    MFAVerifySerializer,
    MFADisableSerializer,
    RegisterSerializer,
)

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom login view that handles 2FA."""
    serializer_class = CustomTokenObtainPairSerializer


class MFAVerifyView(APIView):
    """Verify 2FA code during login."""
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = MFAVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        user_id = serializer.validated_data.get('user_id')
        code = serializer.validated_data['code']
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'Gebruiker niet gevonden.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not user.mfa_enabled or not user.mfa_secret:
            return Response(
                {'error': '2FA is niet ingeschakeld voor deze gebruiker.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify TOTP code
        totp = pyotp.TOTP(user.mfa_secret)
        if not totp.verify(code):
            return Response(
                {'error': 'Ongeldige verificatiecode.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data,
        })


class RegisterView(APIView):
    """User self-registration."""
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': UserSerializer(user).data,
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProfileView(APIView):
    """Current user profile management."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)
    
    def patch(self, request):
        serializer = UserDetailSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordChangeView(APIView):
    """Change password for current user."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        if not request.user.check_password(serializer.validated_data['old_password']):
            return Response(
                {'old_password': 'Huidig wachtwoord is incorrect.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        
        return Response({'message': 'Wachtwoord succesvol gewijzigd.'})


class MFASetupView(APIView):
    """Setup 2FA for current user."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get QR code for 2FA setup."""
        user = request.user
        
        # Generate new secret if not exists
        if not user.mfa_secret:
            user.mfa_secret = pyotp.random_base32()
            user.save()
        
        # Generate TOTP URI
        from apps.core.models import AppSettings
        app_settings = AppSettings.get_settings()
        app_name = app_settings.app_name
        
        totp = pyotp.TOTP(user.mfa_secret)
        uri = totp.provisioning_uri(name=user.email, issuer_name=app_name)
        
        # Generate QR code as base64
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        qr_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return Response({
            'secret': user.mfa_secret,
            'qr_code': f'data:image/png;base64,{qr_base64}',
            'uri': uri,
        })
    
    def post(self, request):
        """Verify and enable 2FA."""
        serializer = MFAVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        code = serializer.validated_data['code']
        
        if not user.mfa_secret:
            return Response(
                {'error': 'Vraag eerst een QR code aan via GET.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        totp = pyotp.TOTP(user.mfa_secret)
        if not totp.verify(code):
            return Response(
                {'error': 'Ongeldige verificatiecode.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.mfa_enabled = True
        user.save()
        
        return Response({'message': '2FA succesvol ingeschakeld.'})


class MFADisableView(APIView):
    """Disable 2FA for current user."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = MFADisableSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        
        # Verify password
        if not user.check_password(serializer.validated_data['password']):
            return Response(
                {'password': 'Wachtwoord is incorrect.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify TOTP code
        if user.mfa_enabled and user.mfa_secret:
            totp = pyotp.TOTP(user.mfa_secret)
            if not totp.verify(serializer.validated_data['code']):
                return Response(
                    {'code': 'Ongeldige verificatiecode.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        user.mfa_enabled = False
        user.mfa_secret = ''
        user.save()
        
        return Response({'message': '2FA succesvol uitgeschakeld.'})


class UserViewSet(viewsets.ModelViewSet):
    """
    Admin viewset for user management.
    Full CRUD operations for admins only.
    """
    queryset = User.objects.all()
    permission_classes = [IsAdminUser]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer
    
    def get_queryset(self):
        queryset = User.objects.all()
        
        # Filter by role
        rol = self.request.query_params.get('rol')
        if rol:
            queryset = queryset.filter(rol=rol)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(email__icontains=search) |
                models.Q(username__icontains=search) |
                models.Q(voornaam__icontains=search) |
                models.Q(achternaam__icontains=search)
            )
        
        return queryset.order_by('achternaam', 'voornaam')
    
    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """Reset password for a user (admin only)."""
        user = self.get_object()
        serializer = PasswordResetSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        return Response({'message': f'Wachtwoord voor {user.full_name} succesvol gereset.'})
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle user active status (block/unblock)."""
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()
        
        status_text = 'geactiveerd' if user.is_active else 'geblokkeerd'
        return Response({
            'message': f'Gebruiker {user.full_name} is {status_text}.',
            'is_active': user.is_active,
        })
    
    @action(detail=True, methods=['post'])
    def disable_mfa(self, request, pk=None):
        """Disable 2FA for a user (admin only)."""
        user = self.get_object()
        user.mfa_enabled = False
        user.mfa_secret = ''
        user.save()
        
        return Response({'message': f'2FA voor {user.full_name} is uitgeschakeld.'})
