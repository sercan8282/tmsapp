import uuid
from django.db import models
from django.conf import settings


class SpreadsheetColumnType(models.TextChoices):
    TEXT = 'text', 'Tekst'
    NUMMER = 'nummer', 'Nummer'
    DATUM = 'datum', 'Datum'
    TIJD = 'tijd', 'Tijd (decimaal)'
    VALUTA = 'valuta', 'Valuta'
    BEREKEND = 'berekend', 'Berekend (formule)'


class SpreadsheetTemplate(models.Model):
    """
    Admin-configureerbaar template voor ritregistratie spreadsheets.
    Bevat kolommen, formules, styling en footer-configuratie.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    naam = models.CharField(max_length=150, verbose_name='Template naam')
    beschrijving = models.TextField(blank=True, default='', verbose_name='Beschrijving')

    # JSON: lijst van kolommen met configuratie
    # Elke kolom: {id, naam, type, breedte, formule?, styling?, zichtbaar?}
    kolommen = models.JSONField(
        default=list,
        verbose_name='Kolommen',
        help_text='Kolom-definities: id, naam, type, breedte, formule, styling',
    )

    # JSON: footer/totalen configuratie
    # {toon_subtotaal, toon_btw, toon_totaal, btw_percentage, extra_rijen: [...]}
    footer = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Footer configuratie',
    )

    # JSON: standaard tarieven
    # {tarief_per_uur, tarief_per_km, tarief_dot}
    standaard_tarieven = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Standaard tarieven',
    )

    # JSON: globale styling
    # {header_achtergrond, header_tekst_kleur, header_lettertype, ...}
    styling = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Styling configuratie',
    )

    is_active = models.BooleanField(default=True, verbose_name='Actief')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Spreadsheet Template'
        verbose_name_plural = 'Spreadsheet Templates'
        ordering = ['naam']

    def __str__(self):
        return self.naam


class SpreadsheetStatus(models.TextChoices):
    CONCEPT = 'concept', 'Concept'
    INGEDIEND = 'ingediend', 'Ingediend'


class Spreadsheet(models.Model):
    """
    Transport ritregistratie spreadsheet.
    Stores structured transport trip data with configurable rates.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    naam = models.CharField(
        max_length=255,
        verbose_name='Naam',
        help_text='Naam van de spreadsheet',
    )
    template = models.ForeignKey(
        SpreadsheetTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='spreadsheets',
        verbose_name='Template',
    )
    bedrijf = models.ForeignKey(
        'companies.Company',
        on_delete=models.PROTECT,
        related_name='spreadsheets',
        verbose_name='Bedrijf',
    )
    week_nummer = models.PositiveIntegerField(
        verbose_name='Weeknummer',
    )
    jaar = models.PositiveIntegerField(
        verbose_name='Jaar',
    )
    tarief_per_uur = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=38.00,
        verbose_name='Tarief per uur',
    )
    tarief_per_km = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.38,
        verbose_name='Tarief per km',
    )
    tarief_dot = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.22,
        verbose_name='Tarief DOT',
    )
    rijen = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Rijen',
        help_text='Array van ritregistratie rijen',
    )
    notities = models.TextField(
        blank=True,
        default='',
        verbose_name='Notities',
    )
    totaal_factuur = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Totaal factuur',
    )
    status = models.CharField(
        max_length=20,
        choices=SpreadsheetStatus.choices,
        default=SpreadsheetStatus.CONCEPT,
        verbose_name='Status',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='spreadsheets',
        verbose_name='Aangemaakt door',
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Aangemaakt op',
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Bijgewerkt op',
    )

    class Meta:
        verbose_name = 'Spreadsheet'
        verbose_name_plural = 'Spreadsheets'
        ordering = ['-jaar', '-week_nummer', '-updated_at']

    def __str__(self):
        return f"{self.naam} - Week {self.week_nummer}/{self.jaar}"

    def bereken_totaal(self):
        """Bereken het totaal van alle rijen."""
        totaal = 0
        for rij in self.rijen:
            begin_tijd = float(rij.get('begin_tijd', 0) or 0)
            eind_tijd = float(rij.get('eind_tijd', 0) or 0)
            pauze = float(rij.get('pauze', 0) or 0)
            correctie = float(rij.get('correctie', 0) or 0)
            begin_km = float(rij.get('begin_km', 0) or 0)
            eind_km = float(rij.get('eind_km', 0) or 0)
            overnachting = float(rij.get('overnachting', 0) or 0)
            overige_kosten = float(rij.get('overige_kosten', 0) or 0)

            totaal_tijd = eind_tijd - begin_tijd
            totaal_uren = totaal_tijd - pauze - correctie
            totaal_km = eind_km - begin_km

            tarief_uur = totaal_uren * float(self.tarief_per_uur)
            tarief_km_bedrag = totaal_km * float(self.tarief_per_km)
            subtotaal = tarief_uur + tarief_km_bedrag
            dot = totaal_km * float(self.tarief_dot)

            rij_totaal = subtotaal + dot + overnachting + overige_kosten
            totaal += rij_totaal

        return round(totaal, 2)

    def save(self, *args, **kwargs):
        self.totaal_factuur = self.bereken_totaal()
        super().save(*args, **kwargs)
