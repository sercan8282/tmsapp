"""
Core app models - Application settings.
"""
import uuid
from django.db import models
from django.core.cache import cache


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
