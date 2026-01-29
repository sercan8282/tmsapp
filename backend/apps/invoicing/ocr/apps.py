from django.apps import AppConfig


class InvoiceOCRConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.invoicing.ocr'
    label = 'invoicing_ocr'
    verbose_name = 'Invoice OCR Import'
