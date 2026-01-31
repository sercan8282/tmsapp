"""
Email Import Models

Models for managing shared mailbox configurations and tracking imported emails.
"""
import uuid
from django.db import models
from django.conf import settings
from cryptography.fernet import Fernet
import base64
import os


def get_encryption_key():
    """Get or generate encryption key for credentials."""
    key = getattr(settings, 'EMAIL_IMPORT_ENCRYPTION_KEY', None)
    if not key:
        # Use Django's SECRET_KEY to derive a key
        from django.utils.encoding import force_bytes
        import hashlib
        key = base64.urlsafe_b64encode(
            hashlib.sha256(force_bytes(settings.SECRET_KEY)).digest()
        )
    return key


class MailboxConfig(models.Model):
    """
    Configuration for a shared mailbox to monitor for invoices.
    Supports IMAP and Microsoft 365 OAuth.
    """
    class Protocol(models.TextChoices):
        IMAP = 'imap', 'IMAP'
        MICROSOFT_365 = 'ms365', 'Microsoft 365 (OAuth)'
    
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Actief'
        INACTIVE = 'inactive', 'Inactief'
        ERROR = 'error', 'Fout'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Configuration name and organization link
    name = models.CharField(max_length=100, verbose_name='Configuratie Naam')
    description = models.TextField(blank=True, verbose_name='Beschrijving')
    
    # Connection type
    protocol = models.CharField(
        max_length=20,
        choices=Protocol.choices,
        default=Protocol.IMAP,
        verbose_name='Protocol'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.INACTIVE,
        verbose_name='Status'
    )
    
    # IMAP Settings
    imap_server = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name='IMAP Server',
        help_text='bijv. outlook.office365.com'
    )
    imap_port = models.PositiveIntegerField(
        default=993, 
        verbose_name='IMAP Poort'
    )
    imap_use_ssl = models.BooleanField(
        default=True, 
        verbose_name='SSL Gebruiken'
    )
    
    # Email address (the shared mailbox address)
    email_address = models.EmailField(verbose_name='E-mail Adres (Shared Mailbox)')
    
    # Credentials (encrypted)
    _username = models.CharField(
        max_length=500, 
        blank=True, 
        verbose_name='Gebruikersnaam (versleuteld)'
    )
    _password = models.CharField(
        max_length=500, 
        blank=True, 
        verbose_name='Wachtwoord (versleuteld)'
    )
    
    # Microsoft 365 OAuth settings
    ms365_client_id = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name='MS365 Client ID'
    )
    _ms365_client_secret = models.CharField(
        max_length=500, 
        blank=True, 
        verbose_name='MS365 Client Secret (versleuteld)'
    )
    ms365_tenant_id = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name='MS365 Tenant ID'
    )
    
    # Mailbox folder to monitor
    folder_name = models.CharField(
        max_length=500, 
        default='INBOX', 
        verbose_name='Map ID'
    )
    folder_display_name = models.CharField(
        max_length=255,
        default='INBOX',
        verbose_name='Map Naam',
        help_text='Leesbare naam van de map'
    )
    
    # Processing settings
    mark_as_read = models.BooleanField(
        default=True, 
        verbose_name='Als Gelezen Markeren'
    )
    move_to_folder = models.CharField(
        max_length=500, 
        blank=True, 
        verbose_name='Verplaats naar Map ID',
        help_text='Optioneel: verplaats verwerkte mails naar deze map'
    )
    move_to_folder_display_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Verplaats naar Map Naam'
    )
    
    # Invoice type setting
    class InvoiceType(models.TextChoices):
        PURCHASE = 'purchase', 'Inkoop'
        CREDIT = 'credit', 'Credit'
        SALES = 'sales', 'Verkoop'
    
    default_invoice_type = models.CharField(
        max_length=20,
        choices=InvoiceType.choices,
        default=InvoiceType.PURCHASE,
        verbose_name='Standaard Factuurtype',
        help_text='Het type factuur dat vanuit deze mailbox geïmporteerd wordt'
    )
    
    # Filter settings
    only_unread = models.BooleanField(
        default=True, 
        verbose_name='Alleen Ongelezen'
    )
    subject_filter = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name='Onderwerp Filter',
        help_text='Optioneel: alleen mails die dit bevatten'
    )
    sender_filter = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name='Afzender Filter',
        help_text='Optioneel: alleen mails van dit adres/domein'
    )
    
    # Auto-processing
    auto_fetch_enabled = models.BooleanField(
        default=False, 
        verbose_name='Automatisch Ophalen'
    )
    auto_fetch_interval_minutes = models.PositiveIntegerField(
        default=15, 
        verbose_name='Interval (minuten)'
    )
    
    # Statistics
    last_fetch_at = models.DateTimeField(
        null=True, 
        blank=True, 
        verbose_name='Laatst Opgehaald'
    )
    last_error = models.TextField(blank=True, verbose_name='Laatste Fout')
    total_emails_processed = models.PositiveIntegerField(
        default=0, 
        verbose_name='Totaal Verwerkte E-mails'
    )
    total_invoices_imported = models.PositiveIntegerField(
        default=0, 
        verbose_name='Totaal Geïmporteerde Facturen'
    )
    
    # Tracking
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='mailbox_configs',
        verbose_name='Aangemaakt door'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Mailbox Configuratie'
        verbose_name_plural = 'Mailbox Configuraties'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.email_address})"
    
    def _encrypt(self, value: str) -> str:
        """Encrypt a value using Fernet."""
        if not value:
            return ''
        f = Fernet(get_encryption_key())
        return f.encrypt(value.encode()).decode()
    
    def _decrypt(self, encrypted_value: str) -> str:
        """Decrypt a value using Fernet."""
        if not encrypted_value:
            return ''
        try:
            f = Fernet(get_encryption_key())
            return f.decrypt(encrypted_value.encode()).decode()
        except Exception:
            return ''
    
    @property
    def username(self) -> str:
        return self._decrypt(self._username)
    
    @username.setter
    def username(self, value: str):
        self._username = self._encrypt(value)
    
    @property
    def password(self) -> str:
        return self._decrypt(self._password)
    
    @password.setter
    def password(self, value: str):
        self._password = self._encrypt(value)
    
    @property
    def ms365_client_secret(self) -> str:
        return self._decrypt(self._ms365_client_secret)
    
    @ms365_client_secret.setter
    def ms365_client_secret(self, value: str):
        self._ms365_client_secret = self._encrypt(value)


class EmailImport(models.Model):
    """
    Imported email record - tracks individual emails that were processed.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'In wachtrij'
        PROCESSING = 'processing', 'Verwerken'
        AWAITING_REVIEW = 'awaiting_review', 'Wacht op Review'
        APPROVED = 'approved', 'Goedgekeurd'
        REJECTED = 'rejected', 'Afgewezen'
        COMPLETED = 'completed', 'Voltooid'
        FAILED = 'failed', 'Mislukt'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Source configuration
    mailbox_config = models.ForeignKey(
        MailboxConfig,
        on_delete=models.CASCADE,
        related_name='imports',
        verbose_name='Mailbox Configuratie'
    )
    
    # Email metadata
    email_message_id = models.CharField(
        max_length=500, 
        verbose_name='Message ID',
        help_text='Uniek ID van de email'
    )
    email_subject = models.CharField(max_length=500, verbose_name='Onderwerp')
    email_from = models.CharField(max_length=255, verbose_name='Van')
    email_date = models.DateTimeField(verbose_name='E-mail Datum')
    email_body_preview = models.TextField(
        blank=True, 
        verbose_name='Voorvertoning',
        help_text='Eerste deel van de email body'
    )
    
    # Processing status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name='Status'
    )
    error_message = models.TextField(blank=True, verbose_name='Foutmelding')
    
    # Tracking
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name='Verwerkt op')
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_email_imports',
        verbose_name='Gereviewd door'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='Gereviewd op')
    review_notes = models.TextField(blank=True, verbose_name='Review Notities')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'E-mail Import'
        verbose_name_plural = 'E-mail Imports'
        ordering = ['-created_at']
        # Prevent duplicate imports of the same email
        unique_together = ['mailbox_config', 'email_message_id']
    
    def __str__(self):
        return f"{self.email_subject} ({self.get_status_display()})"


class EmailAttachment(models.Model):
    """
    PDF attachment extracted from an imported email.
    Each attachment becomes an InvoiceImport for OCR processing.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Parent email
    email_import = models.ForeignKey(
        EmailImport,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='E-mail Import'
    )
    
    # Attachment details
    original_filename = models.CharField(max_length=255, verbose_name='Originele Bestandsnaam')
    file = models.FileField(
        upload_to='imports/email_attachments/',
        verbose_name='Bestand'
    )
    file_size = models.PositiveIntegerField(default=0, verbose_name='Bestandsgrootte')
    content_type = models.CharField(max_length=100, verbose_name='Content Type')
    
    # Link to OCR import (when processed)
    invoice_import = models.OneToOneField(
        'invoicing_ocr.InvoiceImport',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='email_source',
        verbose_name='Factuur Import'
    )
    
    # Processing status
    is_processed = models.BooleanField(default=False, verbose_name='Verwerkt')
    error_message = models.TextField(blank=True, verbose_name='Foutmelding')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'E-mail Bijlage'
        verbose_name_plural = 'E-mail Bijlages'
        ordering = ['email_import', 'original_filename']
    
    def __str__(self):
        return self.original_filename
