"""Planning models - To be fully implemented in Fase 4."""
import uuid
from django.db import models


class Weekday(models.TextChoices):
    MAANDAG = 'ma', 'Maandag'
    DINSDAG = 'di', 'Dinsdag'
    WOENSDAG = 'wo', 'Woensdag'
    DONDERDAG = 'do', 'Donderdag'
    VRIJDAG = 'vr', 'Vrijdag'


class WeekPlanning(models.Model):
    """Weekplanning header."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bedrijf = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='plannings',
        verbose_name='Bedrijf'
    )
    weeknummer = models.PositiveIntegerField(verbose_name='Weeknummer')
    jaar = models.PositiveIntegerField(verbose_name='Jaar')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Weekplanning'
        verbose_name_plural = 'Weekplanningen'
        unique_together = ['bedrijf', 'weeknummer', 'jaar']
        ordering = ['-jaar', '-weeknummer']
    
    def __str__(self):
        return f"{self.bedrijf.naam} - Week {self.weeknummer}/{self.jaar}"


class PlanningEntry(models.Model):
    """Individuele planningsregel."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    planning = models.ForeignKey(
        WeekPlanning,
        on_delete=models.CASCADE,
        related_name='entries',
        verbose_name='Planning'
    )
    vehicle = models.ForeignKey(
        'fleet.Vehicle',
        on_delete=models.CASCADE,
        related_name='planning_entries',
        verbose_name='Voertuig'
    )
    dag = models.CharField(
        max_length=2,
        choices=Weekday.choices,
        verbose_name='Dag'
    )
    chauffeur = models.ForeignKey(
        'drivers.Driver',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='planning_entries',
        verbose_name='Chauffeur'
    )
    
    # Ritnummer for this day
    ritnummer = models.CharField(max_length=50, blank=True, verbose_name='Ritnummer')
    
    # These are auto-filled from chauffeur
    telefoon = models.CharField(max_length=20, blank=True, verbose_name='Telefoon')
    adr = models.BooleanField(default=False, verbose_name='ADR')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Planningsregel'
        verbose_name_plural = 'Planningsregels'
        ordering = ['dag']
    
    def __str__(self):
        return f"{self.vehicle.kenteken} - {self.get_dag_display()}"
    
    def save(self, *args, **kwargs):
        # Auto-fill from chauffeur
        if self.chauffeur:
            self.telefoon = self.chauffeur.telefoon
            self.adr = self.chauffeur.adr
        super().save(*args, **kwargs)
