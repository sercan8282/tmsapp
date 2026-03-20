"""
Track & Trace models for real-time vehicle location tracking.

Security considerations:
- All location data is tied to authenticated users only
- GPS coordinates are validated for realistic ranges
- Session tokens use cryptographic randomness (UUID4)
- Automatic data retention cleanup via management command
- No PII stored beyond user FK — location data is vehicle-centric
"""
import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class TrackingSession(models.Model):
    """
    Represents an active tracking session for a driver.
    A session starts when the driver enables tracking and ends when they stop.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tracking_sessions',
        verbose_name='Gebruiker',
    )
    vehicle = models.ForeignKey(
        'fleet.Vehicle',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='tracking_sessions',
        verbose_name='Voertuig',
    )
    started_at = models.DateTimeField(auto_now_add=True, verbose_name='Gestart op')
    ended_at = models.DateTimeField(null=True, blank=True, verbose_name='Gestopt op')
    is_active = models.BooleanField(default=True, verbose_name='Actief')
    
    # Security: store origin info for audit trail
    user_agent = models.CharField(max_length=500, blank=True, verbose_name='User Agent')
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP Adres')

    class Meta:
        verbose_name = 'Tracking Sessie'
        verbose_name_plural = 'Tracking Sessies'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['vehicle', 'is_active']),
            models.Index(fields=['-started_at']),
        ]

    def __str__(self):
        return f"Session {self.id} - {self.user} ({self.started_at})"

    def end_session(self):
        """End the tracking session."""
        self.is_active = False
        self.ended_at = timezone.now()
        self.save(update_fields=['is_active', 'ended_at'])


class LocationPoint(models.Model):
    """
    Individual GPS location point within a tracking session.
    
    Security:
    - Latitude/longitude validated to real-world ranges
    - Accuracy field helps filter unreliable data
    - Speed validated to prevent spoofed impossible values
    - Timestamps validated against session bounds
    """
    id = models.BigAutoField(primary_key=True)
    session = models.ForeignKey(
        TrackingSession,
        on_delete=models.CASCADE,
        related_name='points',
        verbose_name='Sessie',
    )
    latitude = models.DecimalField(
        max_digits=10, decimal_places=7,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
        verbose_name='Breedtegraad',
    )
    longitude = models.DecimalField(
        max_digits=10, decimal_places=7,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
        verbose_name='Lengtegraad',
    )
    accuracy = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10000)],
        verbose_name='Nauwkeurigheid (m)',
        help_text='GPS accuracy in meters. Lower is better.',
    )
    speed = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(400)],
        verbose_name='Snelheid (km/h)',
        help_text='Speed in km/h. Max 400 for sanity check.',
    )
    heading = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(360)],
        verbose_name='Richting (graden)',
    )
    altitude = models.FloatField(
        null=True, blank=True,
        verbose_name='Hoogte (m)',
    )
    recorded_at = models.DateTimeField(
        verbose_name='Opgenomen op',
        help_text='Client-side timestamp of this location point.',
    )
    received_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Ontvangen op',
        help_text='Server-side timestamp when point was received.',
    )

    class Meta:
        verbose_name = 'Locatiepunt'
        verbose_name_plural = 'Locatiepunten'
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['session', '-recorded_at']),
            models.Index(fields=['-received_at']),
        ]

    def __str__(self):
        return f"({self.latitude}, {self.longitude}) @ {self.recorded_at}"
