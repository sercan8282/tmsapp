"""
Models for push notifications.
"""
import uuid
from django.db import models
from django.conf import settings
from cryptography.fernet import Fernet
from django.core.exceptions import ValidationError


class PushProvider(models.TextChoices):
    """Available push notification providers."""
    NONE = 'none', 'Uitgeschakeld'
    WEBPUSH = 'webpush', 'Web Push (VAPID) - Gratis'
    FIREBASE = 'firebase', 'Firebase Cloud Messaging (FCM)'


class PushSettings(models.Model):
    """
    Singleton model for push notification settings.
    Stores provider configuration with encrypted secrets.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Provider selection
    provider = models.CharField(
        max_length=20,
        choices=PushProvider.choices,
        default=PushProvider.NONE,
        verbose_name='Push Provider'
    )
    
    # Web Push (VAPID) settings
    vapid_public_key = models.TextField(blank=True, null=True, verbose_name='VAPID Public Key')
    vapid_private_key_encrypted = models.TextField(blank=True, null=True, verbose_name='VAPID Private Key (encrypted)')
    vapid_admin_email = models.EmailField(blank=True, null=True, verbose_name='VAPID Admin Email')
    
    # Firebase settings
    firebase_project_id = models.CharField(max_length=255, blank=True, null=True, verbose_name='Firebase Project ID')
    firebase_api_key_encrypted = models.TextField(blank=True, null=True, verbose_name='Firebase API Key (encrypted)')
    firebase_sender_id = models.CharField(max_length=255, blank=True, null=True, verbose_name='Firebase Sender ID')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Push Settings'
        verbose_name_plural = 'Push Settings'
    
    def __str__(self):
        return f"Push Settings ({self.get_provider_display()})"
    
    @classmethod
    def get_encryption_key(cls):
        """Get or generate encryption key from settings."""
        from django.conf import settings
        key = getattr(settings, 'PUSH_ENCRYPTION_KEY', None)
        if not key:
            # Fallback to SECRET_KEY derived key
            import hashlib
            import base64
            hash_key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
            key = base64.urlsafe_b64encode(hash_key)
        return key
    
    @classmethod
    def encrypt_value(cls, value):
        """Encrypt a sensitive value."""
        if not value:
            return None
        f = Fernet(cls.get_encryption_key())
        return f.encrypt(value.encode()).decode()
    
    @classmethod
    def decrypt_value(cls, encrypted_value):
        """Decrypt a sensitive value."""
        if not encrypted_value:
            return None
        try:
            f = Fernet(cls.get_encryption_key())
            return f.decrypt(encrypted_value.encode()).decode()
        except Exception:
            return None
    
    def set_vapid_private_key(self, key):
        """Set and encrypt VAPID private key."""
        self.vapid_private_key_encrypted = self.encrypt_value(key)
    
    def get_vapid_private_key(self):
        """Get decrypted VAPID private key."""
        return self.decrypt_value(self.vapid_private_key_encrypted)
    
    def set_firebase_api_key(self, key):
        """Set and encrypt Firebase API key."""
        self.firebase_api_key_encrypted = self.encrypt_value(key)
    
    def get_firebase_api_key(self):
        """Get decrypted Firebase API key."""
        return self.decrypt_value(self.firebase_api_key_encrypted)
    
    @classmethod
    def get_settings(cls):
        """Get or create singleton settings object."""
        obj, created = cls.objects.get_or_create(
            pk='00000000-0000-0000-0000-000000000001'
        )
        return obj
    
    @classmethod
    def generate_vapid_keys(cls):
        """Generate new VAPID key pair."""
        try:
            from py_vapid import Vapid
            vapid = Vapid()
            vapid.generate_keys()
            return {
                'public_key': vapid.public_key.public_bytes_raw().hex() if hasattr(vapid.public_key, 'public_bytes_raw') else str(vapid.public_key),
                'private_key': vapid.private_key.private_bytes_raw().hex() if hasattr(vapid.private_key, 'private_bytes_raw') else str(vapid.private_key),
            }
        except ImportError:
            # Fallback: generate using cryptography directly
            from cryptography.hazmat.primitives.asymmetric import ec
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.backends import default_backend
            import base64
            
            private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
            public_key = private_key.public_key()
            
            # Get raw bytes
            private_bytes = private_key.private_numbers().private_value.to_bytes(32, 'big')
            public_bytes = public_key.public_bytes(
                encoding=serialization.Encoding.X962,
                format=serialization.PublicFormat.UncompressedPoint
            )
            
            return {
                'public_key': base64.urlsafe_b64encode(public_bytes).decode().rstrip('='),
                'private_key': base64.urlsafe_b64encode(private_bytes).decode().rstrip('='),
            }
    
    def is_configured(self):
        """Check if push notifications are properly configured."""
        if self.provider == PushProvider.NONE:
            return False
        
        if self.provider == PushProvider.WEBPUSH:
            return bool(self.vapid_public_key and self.vapid_private_key_encrypted and self.vapid_admin_email)
        
        if self.provider == PushProvider.FIREBASE:
            return bool(self.firebase_project_id and self.firebase_api_key_encrypted and self.firebase_sender_id)
        
        return False


class PushSubscription(models.Model):
    """
    Stores push notification subscriptions for users.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_subscriptions'
    )
    
    # Subscription data (JSON from browser)
    endpoint = models.TextField(verbose_name='Push Endpoint')
    p256dh_key = models.TextField(verbose_name='P256DH Key')
    auth_key = models.TextField(verbose_name='Auth Key')
    
    # Device info
    user_agent = models.TextField(blank=True, null=True, verbose_name='User Agent')
    device_name = models.CharField(max_length=255, blank=True, null=True, verbose_name='Device Name')
    
    # Status
    is_active = models.BooleanField(default=True, verbose_name='Active')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(blank=True, null=True, verbose_name='Last Used')
    
    class Meta:
        verbose_name = 'Push Subscription'
        verbose_name_plural = 'Push Subscriptions'
        unique_together = ['user', 'endpoint']
    
    def __str__(self):
        return f"{self.user.email} - {self.device_name or 'Unknown device'}"


class PushNotification(models.Model):
    """
    Log of sent push notifications.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Target
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_notifications',
        blank=True,
        null=True,
        verbose_name='Recipient'
    )
    send_to_all = models.BooleanField(default=False, verbose_name='Send to All')
    
    # Content
    title = models.CharField(max_length=255, verbose_name='Title')
    body = models.TextField(verbose_name='Body')
    icon = models.URLField(blank=True, null=True, verbose_name='Icon URL')
    url = models.URLField(blank=True, null=True, verbose_name='Click URL')
    data = models.JSONField(blank=True, null=True, verbose_name='Extra Data')
    
    # Status
    sent_at = models.DateTimeField(auto_now_add=True, verbose_name='Sent At')
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_notifications',
        verbose_name='Sent By'
    )
    success_count = models.IntegerField(default=0, verbose_name='Success Count')
    failure_count = models.IntegerField(default=0, verbose_name='Failure Count')
    
    class Meta:
        verbose_name = 'Push Notification'
        verbose_name_plural = 'Push Notifications'
        ordering = ['-sent_at']
    
    def __str__(self):
        return f"{self.title} - {self.sent_at}"
