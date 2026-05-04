"""Models voor dossiers (case management)."""
import uuid
import os
from django.db import models
from django.conf import settings


def dossier_bijlage_upload_path(instance, filename):
    ext = filename.split('.')[-1]
    new_name = f"{uuid.uuid4().hex}.{ext}"
    return os.path.join('dossiers', 'bijlagen', new_name)


class DossierType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    naam = models.CharField(max_length=100, verbose_name='Naam')
    actief = models.BooleanField(default=True, verbose_name='Actief')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Dossiertype'
        verbose_name_plural = 'Dossiertypen'
        ordering = ['naam']

    def __str__(self):
        return self.naam


class Dossier(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    onderwerp = models.CharField(max_length=255, verbose_name='Onderwerp')
    inhoud = models.TextField(verbose_name='Inhoud')
    type = models.ForeignKey(DossierType, on_delete=models.PROTECT, verbose_name='Type', related_name='dossiers')
    instuurder = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='ingediende_dossiers', verbose_name='Instuurder')
    betreft_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='dossiers_als_gebruiker', verbose_name='Betreft gebruiker')
    betreft_chauffeur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='dossiers_als_chauffeur', verbose_name='Betreft chauffeur')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Dossier'
        verbose_name_plural = 'Dossiers'
        ordering = ['-created_at']

    def __str__(self):
        return self.onderwerp

    @property
    def betreft(self):
        return self.betreft_user or self.betreft_chauffeur


class DossierReactie(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dossier = models.ForeignKey(Dossier, on_delete=models.CASCADE, related_name='reacties', verbose_name='Dossier')
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='dossier_reacties', verbose_name='Auteur')
    tekst = models.TextField(verbose_name='Tekst')
    intern = models.BooleanField(default=False, verbose_name='Intern')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Dossierreactie'
        verbose_name_plural = 'Dossierreacties'
        ordering = ['created_at']

    def __str__(self):
        return f"Reactie op {self.dossier.onderwerp}"


class DossierBijlage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dossier = models.ForeignKey(Dossier, on_delete=models.CASCADE, null=True, blank=True, related_name='bijlagen', verbose_name='Dossier')
    reactie = models.ForeignKey(DossierReactie, on_delete=models.CASCADE, null=True, blank=True, related_name='bijlagen', verbose_name='Reactie')
    bestand = models.FileField(upload_to=dossier_bijlage_upload_path, verbose_name='Bestand')
    bestandsnaam = models.CharField(max_length=255, verbose_name='Bestandsnaam')
    mimetype = models.CharField(max_length=100, blank=True, verbose_name='Mimetype')
    grootte = models.PositiveIntegerField(default=0, verbose_name='Grootte (bytes)')
    geupload_door = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='dossier_bijlagen', verbose_name='Geüpload door')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Dossierbijlage'
        verbose_name_plural = 'Dossierbijlagen'
        ordering = ['uploaded_at']

    def __str__(self):
        return self.bestandsnaam
