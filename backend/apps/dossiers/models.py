"""Models voor dossiers (case management)."""
import uuid
import os
from django.db import models
from django.conf import settings


def dossier_bijlage_upload_path(instance, filename):
    ext = filename.split('.')[-1]
    new_name = f"{uuid.uuid4().hex}.{ext}"
    return os.path.join('dossiers', 'bijlagen', new_name)


class Organisatie(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    naam = models.CharField(max_length=255, unique=True, verbose_name='Naam')
    email = models.EmailField(blank=True, verbose_name='E-mail')
    telefoon = models.CharField(max_length=50, blank=True, verbose_name='Telefoon')
    opmerkingen = models.TextField(blank=True, verbose_name='Opmerkingen')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Organisatie'
        verbose_name_plural = 'Organisaties'
        ordering = ['naam']

    def __str__(self):
        return self.naam


class Contactpersoon(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisatie = models.ForeignKey(
        Organisatie, on_delete=models.CASCADE,
        related_name='contactpersonen', verbose_name='Organisatie',
    )
    naam = models.CharField(max_length=255, verbose_name='Naam')
    email = models.EmailField(verbose_name='E-mail')
    telefoon = models.CharField(max_length=50, blank=True, verbose_name='Telefoon')
    functie = models.CharField(max_length=100, blank=True, verbose_name='Functie / rol')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Contactpersoon'
        verbose_name_plural = 'Contactpersonen'
        ordering = ['naam']

    def __str__(self):
        return f"{self.naam} ({self.organisatie.naam})"


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
    organisatie = models.ForeignKey(
        Organisatie, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='dossiers', verbose_name='Organisatie / leverancier',
    )
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


class DossierMailLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dossier = models.ForeignKey(Dossier, on_delete=models.CASCADE, related_name='maillogs', verbose_name='Dossier')
    verzonden_door = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='dossier_mails', verbose_name='Verzonden door')
    ontvangers = models.TextField(verbose_name='Ontvangers')  # comma-separated email addresses
    onderwerp = models.CharField(max_length=255, verbose_name='Onderwerp')
    type = models.ForeignKey(
        DossierType, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='maillogs', verbose_name='Type',
    )
    verzonden_op = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Dossiermail'
        verbose_name_plural = 'Dossiermails'
        ordering = ['-verzonden_op']

    def __str__(self):
        return f"Mail van {self.dossier.onderwerp} op {self.verzonden_op:%d-%m-%Y %H:%M}"
