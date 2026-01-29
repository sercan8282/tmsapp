"""
Core app models - Application settings.
"""
import os
import uuid
import hashlib
from django.db import models
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator


def validate_font_file(value):
    """
    Validate font file:
    - Check file extension
    - Check file size (max 5MB)
    - Check magic bytes for font files
    """
    # Check file size (max 5MB)
    max_size = 5 * 1024 * 1024
    if value.size > max_size:
        raise ValidationError(f'Bestand is te groot. Maximum is 5MB, dit bestand is {value.size / 1024 / 1024:.1f}MB.')
    
    # Read first bytes to check magic numbers
    value.seek(0)
    header = value.read(12)
    value.seek(0)
    
    # Font magic bytes
    valid_signatures = [
        b'wOFF',           # WOFF
        b'wOF2',           # WOFF2
        b'\x00\x01\x00\x00',  # TrueType
        b'OTTO',           # OpenType
        b'true',           # TrueType
        b'typ1',           # PostScript Type 1
    ]
    
    is_valid = any(header.startswith(sig) for sig in valid_signatures)
    if not is_valid:
        raise ValidationError('Ongeldig font bestand. Alleen WOFF, WOFF2, TTF en OTF bestanden zijn toegestaan.')


def font_upload_path(instance, filename):
    """Generate secure upload path for fonts."""
    # Sanitize filename
    ext = os.path.splitext(filename)[1].lower()
    # Generate unique filename with hash
    content_hash = hashlib.md5(instance.name.encode()).hexdigest()[:8]
    safe_name = f"font_{instance.id}_{content_hash}{ext}"
    return f'fonts/{safe_name}'


class CustomFont(models.Model):
    """
    Custom font uploads for use in templates and site styling.
    """
    FONT_WEIGHTS = [
        (100, 'Thin (100)'),
        (200, 'Extra Light (200)'),
        (300, 'Light (300)'),
        (400, 'Regular (400)'),
        (500, 'Medium (500)'),
        (600, 'Semi Bold (600)'),
        (700, 'Bold (700)'),
        (800, 'Extra Bold (800)'),
        (900, 'Black (900)'),
    ]
    
    FONT_STYLES = [
        ('normal', 'Normaal'),
        ('italic', 'Cursief'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Font family name (grouping)
    family = models.CharField(
        max_length=100,
        verbose_name='Font Familie',
        help_text='Naam van de font familie (bijv. "Roboto", "Open Sans")'
    )
    
    # Display name
    name = models.CharField(
        max_length=100,
        verbose_name='Naam',
        help_text='Weergavenaam voor dit font'
    )
    
    # Font file
    font_file = models.FileField(
        upload_to=font_upload_path,
        validators=[
            FileExtensionValidator(allowed_extensions=['woff', 'woff2', 'ttf', 'otf']),
            validate_font_file,
        ],
        verbose_name='Font Bestand'
    )
    
    # Font properties
    weight = models.PositiveIntegerField(
        choices=FONT_WEIGHTS,
        default=400,
        verbose_name='Gewicht'
    )
    style = models.CharField(
        max_length=10,
        choices=FONT_STYLES,
        default='normal',
        verbose_name='Stijl'
    )
    
    # Is this a system/built-in font?
    is_system = models.BooleanField(
        default=False,
        verbose_name='Systeemfont',
        help_text='Systeemfonts kunnen niet worden verwijderd'
    )
    
    # Active state
    is_active = models.BooleanField(
        default=True,
        verbose_name='Actief'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    uploaded_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Geüpload door'
    )
    
    class Meta:
        verbose_name = 'Custom Font'
        verbose_name_plural = 'Custom Fonts'
        ordering = ['family', 'weight', 'style']
        unique_together = ['family', 'weight', 'style']
    
    def __str__(self):
        return f"{self.family} {self.get_weight_display()} {self.get_style_display()}"
    
    @property
    def file_format(self):
        """Get the font file format."""
        if self.font_file:
            ext = os.path.splitext(self.font_file.name)[1].lower()
            return ext[1:] if ext else 'unknown'
        return 'unknown'
    
    @property
    def css_format(self):
        """Get CSS format string for @font-face."""
        format_map = {
            'woff2': 'woff2',
            'woff': 'woff',
            'ttf': 'truetype',
            'otf': 'opentype',
        }
        return format_map.get(self.file_format, 'truetype')
    
    def delete(self, *args, **kwargs):
        # Prevent deletion of system fonts
        if self.is_system:
            raise ValidationError('Systeemfonts kunnen niet worden verwijderd.')
        # Delete the file
        if self.font_file:
            self.font_file.delete(save=False)
        super().delete(*args, **kwargs)
    
    def save(self, *args, **kwargs):
        # Clear font cache
        cache.delete('custom_fonts')
        cache.delete('font_families')
        super().save(*args, **kwargs)
    
    @classmethod
    def get_font_families(cls):
        """Get distinct font families."""
        families = cache.get('font_families')
        if families is None:
            families = list(
                cls.objects.filter(is_active=True)
                .values_list('family', flat=True)
                .distinct()
                .order_by('family')
            )
            cache.set('font_families', families, 3600)
        return families


class AppSettings(models.Model):
    """
    Singleton model for application-wide settings.
    Only one instance should exist.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Branding
    app_name = models.CharField(
        max_length=100, 
        default='TMS',
        verbose_name='Applicatie Naam'
    )
    logo = models.ImageField(
        upload_to='branding/', 
        null=True, 
        blank=True,
        verbose_name='Logo'
    )
    favicon = models.ImageField(
        upload_to='branding/', 
        null=True, 
        blank=True,
        verbose_name='Favicon'
    )
    primary_color = models.CharField(
        max_length=7, 
        default='#3B82F6',
        verbose_name='Primaire Kleur'
    )
    
    # Company info (for invoices, etc.)
    company_name = models.CharField(
        max_length=200, 
        blank=True,
        verbose_name='Bedrijfsnaam'
    )
    company_address = models.TextField(
        blank=True,
        verbose_name='Adres'
    )
    company_phone = models.CharField(
        max_length=20, 
        blank=True,
        verbose_name='Telefoon'
    )
    company_email = models.EmailField(
        blank=True,
        verbose_name='E-mail'
    )
    company_kvk = models.CharField(
        max_length=20, 
        blank=True,
        verbose_name='KVK Nummer'
    )
    company_btw = models.CharField(
        max_length=20, 
        blank=True,
        verbose_name='BTW Nummer'
    )
    company_iban = models.CharField(
        max_length=34, 
        blank=True,
        verbose_name='IBAN'
    )
    
    # Email settings
    smtp_host = models.CharField(
        max_length=255, 
        blank=True,
        verbose_name='SMTP Host'
    )
    smtp_port = models.PositiveIntegerField(
        default=587,
        verbose_name='SMTP Poort'
    )
    smtp_username = models.CharField(
        max_length=255, 
        blank=True,
        verbose_name='SMTP Gebruikersnaam'
    )
    smtp_password = models.CharField(
        max_length=255, 
        blank=True,
        verbose_name='SMTP Wachtwoord'
    )
    smtp_use_tls = models.BooleanField(
        default=True,
        verbose_name='Gebruik TLS'
    )
    smtp_from_email = models.EmailField(
        blank=True,
        verbose_name='Van E-mail'
    )
    
    # OAuth settings for Exchange Online
    oauth_enabled = models.BooleanField(
        default=False,
        verbose_name='OAuth Ingeschakeld'
    )
    oauth_client_id = models.CharField(
        max_length=255, 
        blank=True,
        verbose_name='OAuth Client ID'
    )
    oauth_client_secret = models.CharField(
        max_length=255, 
        blank=True,
        verbose_name='OAuth Client Secret'
    )
    oauth_tenant_id = models.CharField(
        max_length=255, 
        blank=True,
        verbose_name='OAuth Tenant ID'
    )
    
    # Invoice settings
    invoice_payment_text = models.TextField(
        blank=True,
        default='Wij verzoeken u vriendelijk het totaalbedrag vóór de vervaldatum over te maken op bovenstaand IBAN onder vermelding van het factuurnummer.',
        verbose_name='Factuur Betalingstekst',
        help_text='Tekst die onderaan de factuur wordt getoond. Gebruik {bedrag}, {vervaldatum} en {factuurnummer} als variabelen.'
    )
    
    # Email signature
    email_signature = models.TextField(
        blank=True,
        default='',
        verbose_name='E-mail Handtekening',
        help_text='Handtekening die onderaan alle uitgaande e-mails wordt toegevoegd.'
    )
    
    # Typography settings
    primary_font = models.ForeignKey(
        'CustomFont',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='primary_for_settings',
        verbose_name='Primair Font',
        help_text='Het hoofdfont voor de applicatie (koppen en tekst)'
    )
    secondary_font = models.ForeignKey(
        'CustomFont',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='secondary_for_settings',
        verbose_name='Secundair Font',
        help_text='Optioneel secundair font (voor accenten)'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'App Instellingen'
        verbose_name_plural = 'App Instellingen'
    
    def __str__(self):
        return self.app_name
    
    def save(self, *args, **kwargs):
        # Clear cache when settings are updated
        cache.delete('app_settings')
        super().save(*args, **kwargs)
    
    @classmethod
    def get_settings(cls):
        """
        Get the singleton settings instance.
        Uses caching for performance.
        """
        settings = cache.get('app_settings')
        if settings is None:
            settings, _ = cls.objects.get_or_create(pk=cls.get_default_pk())
            cache.set('app_settings', settings, 3600)  # Cache for 1 hour
        return settings
    
    @classmethod
    def get_default_pk(cls):
        """Get or create the default primary key for singleton."""
        return uuid.UUID('00000000-0000-0000-0000-000000000001')
