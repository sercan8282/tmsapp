"""
Email Invoice Import Module

Automated invoice import from shared mailboxes.

Features:
- Microsoft 365 / IMAP shared mailbox support
- Automatic PDF attachment extraction
- Integration with OCR for invoice recognition
- Approval queue with pagination

Usage:
    from apps.invoicing.email_import.services import EmailImportService
    
    service = EmailImportService()
    imported = service.fetch_and_process_emails(config_id)
"""

default_app_config = 'apps.invoicing.email_import.apps.EmailImportConfig'
