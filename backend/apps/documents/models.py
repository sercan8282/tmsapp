"""
Models voor documenten en digitale handtekeningen.
"""
import uuid
import os
from django.db import models
from django.conf import settings


def document_upload_path(instance, filename):
    """Generate upload path for documents."""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4().hex}.{ext}"
    return os.path.join('documents', 'uploads', filename)


def signed_document_path(instance, filename):
    """Generate path for signed documents."""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4().hex}_signed.{ext}"
    return os.path.join('documents', 'signed', filename)


def signature_image_path(instance, filename):
    """Generate path for signature images."""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4().hex}.{ext}"
    return os.path.join('signatures', filename)


class SavedSignature(models.Model):
    """
    Opgeslagen handtekening van een gebruiker.
    Gebruikers kunnen meerdere handtekeningen opslaan voor hergebruik.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_signatures'
    )
    name = models.CharField(max_length=100, verbose_name='Naam')
    signature_image = models.ImageField(
        upload_to=signature_image_path,
        verbose_name='Handtekening afbeelding'
    )
    is_default = models.BooleanField(default=False, verbose_name='Standaard')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Opgeslagen handtekening'
        verbose_name_plural = 'Opgeslagen handtekeningen'
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.name} - {self.user.full_name}"

    def save(self, *args, **kwargs):
        # Zorg dat er maar één default is per gebruiker
        if self.is_default:
            SavedSignature.objects.filter(
                user=self.user, 
                is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class SignedDocument(models.Model):
    """
    Een document dat ondertekend moet worden of is.
    """
    STATUS_CHOICES = [
        ('pending', 'Wacht op handtekening'),
        ('signed', 'Ondertekend'),
        ('expired', 'Verlopen'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Origineel document
    title = models.CharField(max_length=255, verbose_name='Titel')
    description = models.TextField(blank=True, verbose_name='Beschrijving')
    original_file = models.FileField(
        upload_to=document_upload_path,
        verbose_name='Origineel bestand'
    )
    original_filename = models.CharField(max_length=255, verbose_name='Originele bestandsnaam')
    
    # Ondertekend document
    signed_file = models.FileField(
        upload_to=signed_document_path,
        blank=True,
        null=True,
        verbose_name='Ondertekend bestand'
    )
    
    # Handtekening details
    signature_data = models.JSONField(
        blank=True,
        null=True,
        verbose_name='Handtekening data',
        help_text='JSON met handtekening positie en metadata'
    )
    
    # Status en tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='Status'
    )
    
    # Gebruikers
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_documents',
        verbose_name='Geüpload door'
    )
    signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='signed_documents',
        verbose_name='Ondertekend door'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    signed_at = models.DateTimeField(null=True, blank=True, verbose_name='Ondertekend op')

    class Meta:
        verbose_name = 'Ondertekend document'
        verbose_name_plural = 'Ondertekende documenten'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

    @property
    def file_extension(self):
        if self.original_file:
            return self.original_file.name.split('.')[-1].lower()
        return None

    @property
    def is_pdf(self):
        return self.file_extension == 'pdf'
