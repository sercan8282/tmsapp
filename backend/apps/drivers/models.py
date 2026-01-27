"""Drivers models - To be implemented in Fase 2."""
import uuid
from django.db import models
from django.conf import settings


class Driver(models.Model):
    """Chauffeur model."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    naam = models.CharField(max_length=200, verbose_name='Naam')
    telefoon = models.CharField(max_length=20, blank=True, verbose_name='Telefoon')
    bedrijf = models.ForeignKey(
        'companies.Company',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='drivers',
        verbose_name='Bedrijf'
    )
    gekoppelde_gebruiker = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='driver_profile',
        verbose_name='Gekoppelde Gebruiker'
    )
    adr = models.BooleanField(default=False, verbose_name='ADR Gecertificeerd')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Chauffeur'
        verbose_name_plural = 'Chauffeurs'
        ordering = ['naam']
    
    def __str__(self):
        return self.naam
