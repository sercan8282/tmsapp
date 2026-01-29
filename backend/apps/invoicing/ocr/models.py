"""
Invoice OCR Models - Self-learning extraction patterns
"""
import uuid
from django.db import models
from django.conf import settings


class InvoiceImport(models.Model):
    """
    Imported invoice record - tracks the import process and results.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'In wachtrij'
        PROCESSING = 'processing', 'Verwerken'
        EXTRACTED = 'extracted', 'Geëxtraheerd'
        REVIEW = 'review', 'Review nodig'
        COMPLETED = 'completed', 'Voltooid'
        FAILED = 'failed', 'Mislukt'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # File upload
    original_file = models.FileField(
        upload_to='imports/invoices/',
        verbose_name='Origineel Bestand'
    )
    file_name = models.CharField(max_length=255, verbose_name='Bestandsnaam')
    file_type = models.CharField(max_length=20, verbose_name='Bestandstype')  # pdf, jpg, png
    file_size = models.PositiveIntegerField(default=0, verbose_name='Bestandsgrootte')
    
    # Processing status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name='Status'
    )
    error_message = models.TextField(blank=True, verbose_name='Foutmelding')
    
    # OCR results
    ocr_text = models.TextField(blank=True, verbose_name='OCR Tekst')
    ocr_confidence = models.FloatField(null=True, blank=True, verbose_name='OCR Confidence')
    
    # Extracted data (JSON)
    extracted_data = models.JSONField(default=dict, verbose_name='Geëxtraheerde Data')
    
    # Matched pattern (for learning)
    matched_pattern = models.ForeignKey(
        'InvoicePattern',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='imports',
        verbose_name='Gematchte Patroon'
    )
    
    # If converted to invoice
    created_invoice = models.ForeignKey(
        'invoicing.Invoice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='import_source',
        verbose_name='Aangemaakte Factuur'
    )
    
    # User corrections (for training)
    user_corrections = models.JSONField(default=dict, verbose_name='Gebruiker Correcties')
    
    # Tracking
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='invoice_imports',
        verbose_name='Geüpload door'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'Factuur Import'
        verbose_name_plural = 'Factuur Imports'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.file_name} ({self.get_status_display()})"


class InvoicePattern(models.Model):
    """
    Self-learning pattern for recognizing invoice layouts.
    Each company/supplier can have their own pattern.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Pattern identification
    name = models.CharField(max_length=100, verbose_name='Patroon Naam')
    description = models.TextField(blank=True, verbose_name='Beschrijving')
    
    # Associated company (supplier)
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='invoice_patterns',
        verbose_name='Bedrijf'
    )
    
    # Pattern is active
    is_active = models.BooleanField(default=True, verbose_name='Actief')
    
    # Field extraction rules (JSON)
    # Structure: {
    #   "invoice_number": {"type": "regex|region|keyword", "pattern": "...", "region": {...}},
    #   "date": {...},
    #   "total": {...},
    #   ...
    # }
    field_patterns = models.JSONField(default=dict, verbose_name='Veld Patronen')
    
    # Line item extraction rules (JSON)
    # Structure: {
    #   "table_region": {...},
    #   "columns": [{"name": "description", "region": {...}}, ...],
    #   "row_separator": "...",
    # }
    line_patterns = models.JSONField(default=dict, verbose_name='Regel Patronen')
    
    # Visual signature for matching (logo position, header layout hash)
    visual_signature = models.JSONField(default=dict, verbose_name='Visuele Signatuur')
    
    # Training stats
    times_used = models.PositiveIntegerField(default=0, verbose_name='Keer Gebruikt')
    times_corrected = models.PositiveIntegerField(default=0, verbose_name='Keer Gecorrigeerd')
    accuracy_score = models.FloatField(default=0.0, verbose_name='Nauwkeurigheid')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'Factuur Patroon'
        verbose_name_plural = 'Factuur Patronen'
        ordering = ['-accuracy_score', '-times_used']
    
    def __str__(self):
        return f"{self.name} ({self.company.naam})"
    
    def update_accuracy(self):
        """Calculate accuracy based on corrections."""
        if self.times_used > 0:
            self.accuracy_score = 1 - (self.times_corrected / self.times_used)
            self.save(update_fields=['accuracy_score'])


class FieldMapping(models.Model):
    """
    Individual field mapping for a pattern.
    Allows fine-grained control and training per field.
    """
    class FieldType(models.TextChoices):
        INVOICE_NUMBER = 'invoice_number', 'Factuurnummer'
        INVOICE_DATE = 'invoice_date', 'Factuurdatum'
        DUE_DATE = 'due_date', 'Vervaldatum'
        SUPPLIER_NAME = 'supplier_name', 'Leverancier Naam'
        SUPPLIER_ADDRESS = 'supplier_address', 'Leverancier Adres'
        SUPPLIER_VAT = 'supplier_vat', 'Leverancier BTW Nr.'
        SUPPLIER_KVK = 'supplier_kvk', 'Leverancier KVK'
        SUBTOTAL = 'subtotal', 'Subtotaal'
        VAT_AMOUNT = 'vat_amount', 'BTW Bedrag'
        VAT_PERCENTAGE = 'vat_percentage', 'BTW Percentage'
        TOTAL = 'total', 'Totaal'
        IBAN = 'iban', 'IBAN'
        REFERENCE = 'reference', 'Referentie'
        DESCRIPTION = 'description', 'Omschrijving'
    
    class ExtractionMethod(models.TextChoices):
        REGEX = 'regex', 'Regular Expression'
        REGION = 'region', 'Vaste Regio'
        KEYWORD_AFTER = 'keyword_after', 'Na Keyword'
        KEYWORD_BELOW = 'keyword_below', 'Onder Keyword'
        TABLE_COLUMN = 'table_column', 'Tabel Kolom'
        OCR_ANCHOR = 'ocr_anchor', 'OCR Anker'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    pattern = models.ForeignKey(
        InvoicePattern,
        on_delete=models.CASCADE,
        related_name='field_mappings',
        verbose_name='Patroon'
    )
    
    field_type = models.CharField(
        max_length=30,
        choices=FieldType.choices,
        verbose_name='Veld Type'
    )
    
    extraction_method = models.CharField(
        max_length=20,
        choices=ExtractionMethod.choices,
        verbose_name='Extractie Methode'
    )
    
    # Extraction configuration
    # For regex: {"pattern": "Factuurnummer[:\s]*(\d+)"}
    # For region: {"x": 100, "y": 200, "width": 150, "height": 30, "page": 0}
    # For keyword: {"keyword": "Totaal", "offset_x": 100, "offset_y": 0}
    config = models.JSONField(default=dict, verbose_name='Configuratie')
    
    # Data type for parsing
    data_type = models.CharField(
        max_length=20,
        choices=[
            ('string', 'Tekst'),
            ('number', 'Nummer'),
            ('currency', 'Bedrag'),
            ('date', 'Datum'),
            ('percentage', 'Percentage'),
        ],
        default='string',
        verbose_name='Data Type'
    )
    
    # Validation rules
    validation_rules = models.JSONField(default=dict, verbose_name='Validatie Regels')
    
    # Training stats
    correct_extractions = models.PositiveIntegerField(default=0)
    incorrect_extractions = models.PositiveIntegerField(default=0)
    
    # Priority (for multiple mappings of same field)
    priority = models.PositiveIntegerField(default=0, verbose_name='Prioriteit')
    
    is_active = models.BooleanField(default=True, verbose_name='Actief')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Veld Mapping'
        verbose_name_plural = 'Veld Mappings'
        ordering = ['pattern', 'field_type', '-priority']
    
    def __str__(self):
        return f"{self.pattern.name} - {self.get_field_type_display()}"
    
    @property
    def accuracy(self):
        total = self.correct_extractions + self.incorrect_extractions
        if total > 0:
            return self.correct_extractions / total
        return 0.0


class ImportedInvoiceLine(models.Model):
    """
    Extracted line item from an imported invoice.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    invoice_import = models.ForeignKey(
        InvoiceImport,
        on_delete=models.CASCADE,
        related_name='lines',
        verbose_name='Import'
    )
    
    # Extracted data
    omschrijving = models.CharField(max_length=500, blank=True, verbose_name='Omschrijving')
    aantal = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Aantal')
    eenheid = models.CharField(max_length=20, blank=True, verbose_name='Eenheid')
    prijs_per_eenheid = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Prijs/Eenheid')
    totaal = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Totaal')
    btw_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, verbose_name='BTW %')
    
    # Raw extracted text
    raw_text = models.TextField(blank=True, verbose_name='Ruwe Tekst')
    
    # Position on page
    position = models.JSONField(default=dict, verbose_name='Positie')
    
    # Order
    volgorde = models.PositiveIntegerField(default=0, verbose_name='Volgorde')
    
    # User verified
    is_verified = models.BooleanField(default=False, verbose_name='Geverifieerd')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Geïmporteerde Regel'
        verbose_name_plural = 'Geïmporteerde Regels'
        ordering = ['volgorde']
    
    def __str__(self):
        return f"{self.omschrijving[:50]}..." if len(self.omschrijving) > 50 else self.omschrijving
