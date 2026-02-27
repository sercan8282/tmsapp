"""
Licensing app models.
Stores license information and installation bindings.
"""
import uuid
import logging
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


class License(models.Model):
    """
    Represents a software license.
    
    The license key is a signed payload (base64) that contains:
    - license_id, customer, issued_at, expires_at, max_users, features
    
    The installation_id binds the license to a single installation,
    preventing the same key from being used on multiple servers.
    """
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'In afwachting'
        ACTIVE = 'active', 'Actief'
        EXPIRED = 'expired', 'Verlopen'
        REVOKED = 'revoked', 'Ingetrokken'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # License identification
    license_key = models.TextField(
        unique=True,
        help_text='De volledige gesigneerde licentiesleutel (payload.signature)'
    )
    
    # Decoded info (cached from the signed payload for quick access)
    customer_name = models.CharField(max_length=255, help_text='Klantnaam')
    issued_at = models.DateTimeField(help_text='Datum van uitgifte')
    expires_at = models.DateTimeField(help_text='Verloopdatum')
    max_users = models.PositiveIntegerField(default=0, help_text='Maximum aantal gebruikers (0 = onbeperkt)')
    features = models.JSONField(default=list, blank=True, help_text='Beschikbare modules/features')
    
    # Installation binding
    installation_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        unique=True,
        help_text='Unieke installatie-identifier (gegenereerd bij activatie)'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    
    # Metadata
    activated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Licentie'
        verbose_name_plural = 'Licenties'
    
    def __str__(self):
        return f'{self.customer_name} ({self.status})'
    
    @property
    def is_valid(self):
        """Check if the license is currently valid."""
        return (
            self.status == self.Status.ACTIVE
            and self.expires_at > timezone.now()
        )
    
    @property
    def days_remaining(self):
        """Days until expiration."""
        if self.expires_at:
            delta = self.expires_at - timezone.now()
            return max(0, delta.days)
        return 0
    
    @property
    def is_expiring_soon(self):
        """True if license expires within 30 days."""
        return 0 < self.days_remaining <= 30
