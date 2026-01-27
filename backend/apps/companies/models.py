"""Companies models - To be implemented in Fase 2."""
import uuid
from django.db import models


class Company(models.Model):
    """Bedrijf model."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    naam = models.CharField(max_length=200, verbose_name='Naam')
    kvk = models.CharField(max_length=20, blank=True, verbose_name='KVK Nummer')
    telefoon = models.CharField(max_length=20, blank=True, verbose_name='Telefoon')
    contactpersoon = models.CharField(max_length=200, blank=True, verbose_name='Contactpersoon')
    email = models.EmailField(blank=True, verbose_name='E-mail')
    adres = models.CharField(max_length=255, blank=True, verbose_name='Adres')
    postcode = models.CharField(max_length=10, blank=True, verbose_name='Postcode')
    stad = models.CharField(max_length=100, blank=True, verbose_name='Stad')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Bedrijf'
        verbose_name_plural = 'Bedrijven'
        ordering = ['naam']
    
    def __str__(self):
        return self.naam
