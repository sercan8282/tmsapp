"""
OCR Invoice Import Module

Self-learning invoice OCR system for automated data extraction.

Features:
- PDF and image processing with Tesseract OCR
- Pattern-based extraction with self-learning
- Visual region selection for training
- Company-specific templates

Usage:
    from apps.invoicing.ocr.services import InvoiceImportService
    
    service = InvoiceImportService()
    invoice_import = service.process_upload(file, user)
"""

default_app_config = 'apps.invoicing.ocr.apps.InvoiceOCRConfig'
