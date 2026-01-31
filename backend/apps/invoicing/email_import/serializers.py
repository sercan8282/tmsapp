"""
Email Import Serializers

Serializers for the email import API.
"""
from rest_framework import serializers
from .models import MailboxConfig, EmailImport, EmailAttachment


class MailboxConfigSerializer(serializers.ModelSerializer):
    """Serializer for mailbox configuration list view."""
    
    created_by_name = serializers.SerializerMethodField()
    protocol_display = serializers.CharField(source='get_protocol_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    default_invoice_type_display = serializers.CharField(source='get_default_invoice_type_display', read_only=True)
    
    class Meta:
        model = MailboxConfig
        fields = [
            'id', 'name', 'description', 'protocol', 'protocol_display',
            'status', 'status_display', 'email_address', 'folder_name',
            'folder_display_name', 'default_invoice_type', 'default_invoice_type_display',
            'auto_fetch_enabled', 'auto_fetch_interval_minutes',
            'last_fetch_at', 'total_emails_processed', 'total_invoices_imported',
            'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status', 'last_fetch_at', 'total_emails_processed',
                          'total_invoices_imported', 'created_at', 'updated_at']
    
    def get_created_by_name(self, obj) -> str:
        if obj.created_by:
            name = getattr(obj.created_by, 'full_name', '') or ''
            name = name.strip()
            if name:
                return name
            return obj.created_by.email
        return ''


class MailboxConfigDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for mailbox configuration."""
    
    created_by_name = serializers.SerializerMethodField()
    protocol_display = serializers.CharField(source='get_protocol_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    # Write-only fields for credentials (never expose in responses)
    username = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    ms365_client_secret = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    # Indicators for whether credentials are set
    has_credentials = serializers.SerializerMethodField()
    has_ms365_secret = serializers.SerializerMethodField()
    
    class Meta:
        model = MailboxConfig
        fields = [
            'id', 'name', 'description', 'protocol', 'protocol_display',
            'status', 'status_display', 'email_address',
            'imap_server', 'imap_port', 'imap_use_ssl',
            'username', 'password', 'has_credentials',
            'ms365_client_id', 'ms365_client_secret', 'ms365_tenant_id', 'has_ms365_secret',
            'folder_name', 'folder_display_name', 'mark_as_read', 
            'move_to_folder', 'move_to_folder_display_name',
            'default_invoice_type',
            'only_unread', 'subject_filter', 'sender_filter',
            'auto_fetch_enabled', 'auto_fetch_interval_minutes',
            'last_fetch_at', 'last_error', 'total_emails_processed', 'total_invoices_imported',
            'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status', 'last_fetch_at', 'last_error',
                          'total_emails_processed', 'total_invoices_imported',
                          'created_at', 'updated_at']
    
    def get_created_by_name(self, obj) -> str:
        if obj.created_by:
            name = getattr(obj.created_by, 'full_name', '') or ''
            name = name.strip()
            if name:
                return name
            return obj.created_by.email
        return ''
    
    def get_has_credentials(self, obj) -> bool:
        return bool(obj._username or obj._password)
    
    def get_has_ms365_secret(self, obj) -> bool:
        return bool(obj._ms365_client_secret)
    
    def validate_imap_port(self, value):
        """Validate IMAP port is in valid range."""
        if value < 1 or value > 65535:
            raise serializers.ValidationError("Poort moet tussen 1 en 65535 zijn")
        return value
    
    def validate_auto_fetch_interval_minutes(self, value):
        """Validate fetch interval is reasonable."""
        if value < 5:
            raise serializers.ValidationError("Interval moet minimaal 5 minuten zijn")
        if value > 1440:
            raise serializers.ValidationError("Interval mag maximaal 1440 minuten (24 uur) zijn")
        return value
    
    def validate_email_address(self, value):
        """Basic email validation."""
        import re
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', value):
            raise serializers.ValidationError("Ongeldig e-mail adres")
        return value.lower()
    
    def validate(self, data):
        """Cross-field validation."""
        protocol = data.get('protocol', self.instance.protocol if self.instance else 'imap')
        
        if protocol == 'imap':
            # IMAP requires server settings
            if not data.get('imap_server') and (not self.instance or not self.instance.imap_server):
                raise serializers.ValidationError({
                    'imap_server': 'IMAP server is verplicht voor IMAP protocol'
                })
        elif protocol == 'ms365':
            # Microsoft 365 requires OAuth settings
            if not data.get('ms365_client_id') and (not self.instance or not self.instance.ms365_client_id):
                raise serializers.ValidationError({
                    'ms365_client_id': 'Client ID is verplicht voor Microsoft 365'
                })
            if not data.get('ms365_tenant_id') and (not self.instance or not self.instance.ms365_tenant_id):
                raise serializers.ValidationError({
                    'ms365_tenant_id': 'Tenant ID is verplicht voor Microsoft 365'
                })
        
        return data
    
    def create(self, validated_data):
        """Handle credential encryption on create."""
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"CREATE validated_data keys: {validated_data.keys()}")
        logger.info(f"CREATE ms365_client_secret present: {'ms365_client_secret' in validated_data}")
        
        username = validated_data.pop('username', '')
        password = validated_data.pop('password', '')
        ms365_secret = validated_data.pop('ms365_client_secret', '')
        
        logger.info(f"CREATE ms365_secret value (truncated): {ms365_secret[:10] if ms365_secret else 'EMPTY'}...")
        
        instance = MailboxConfig(**validated_data)
        
        if username:
            instance.username = username
        if password:
            instance.password = password
        if ms365_secret:
            instance.ms365_client_secret = ms365_secret
        
        instance.save()
        return instance
    
    def update(self, instance, validated_data):
        """Handle credential encryption on update."""
        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        ms365_secret = validated_data.pop('ms365_client_secret', None)
        
        # Update regular fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Update credentials only if provided (non-empty)
        if username:
            instance.username = username
        if password:
            instance.password = password
        if ms365_secret:
            instance.ms365_client_secret = ms365_secret
        
        instance.save()
        return instance


class EmailAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for email attachments."""
    
    file_url = serializers.SerializerMethodField()
    invoice_import_id = serializers.UUIDField(source='invoice_import.id', read_only=True, allow_null=True)
    invoice_import_status = serializers.CharField(
        source='invoice_import.get_status_display', 
        read_only=True, 
        allow_null=True
    )
    extracted_data = serializers.SerializerMethodField()
    
    class Meta:
        model = EmailAttachment
        fields = [
            'id', 'original_filename', 'file_url', 'file_size', 'content_type',
            'invoice_import_id', 'invoice_import_status', 'is_processed',
            'error_message', 'created_at', 'extracted_data'
        ]
    
    def get_file_url(self, obj) -> str:
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return ''
    
    def get_extracted_data(self, obj) -> dict:
        """Return extracted invoice data from linked InvoiceImport."""
        if obj.invoice_import and obj.invoice_import.extracted_data:
            data = obj.invoice_import.extracted_data
            fields = data.get('fields', {})
            line_items = data.get('line_items', [])
            
            # Map the fields to a frontend-friendly format
            return {
                'invoice_number': fields.get('invoice_number') or fields.get('factuurnummer'),
                'invoice_date': fields.get('invoice_date') or fields.get('factuurdatum'),
                'due_date': fields.get('due_date') or fields.get('vervaldatum'),
                'supplier_name': fields.get('supplier_name') or fields.get('leverancier'),
                'supplier_address': fields.get('supplier_address') or fields.get('adres'),
                'supplier_vat': fields.get('vat_number') or fields.get('btw_nummer'),
                'supplier_kvk': fields.get('kvk_number') or fields.get('kvk'),
                'supplier_iban': fields.get('iban'),
                'total_amount': fields.get('total_amount') or fields.get('totaal'),
                'vat_amount': fields.get('vat_amount') or fields.get('btw_bedrag'),
                'net_amount': fields.get('net_amount') or fields.get('netto'),
                'currency': fields.get('currency', 'EUR'),
                'line_items': [
                    {
                        'description': item.get('omschrijving') or item.get('description', ''),
                        'quantity': item.get('aantal') or item.get('quantity'),
                        'unit_price': item.get('prijs_per_eenheid') or item.get('unit_price'),
                        'total': item.get('totaal') or item.get('total'),
                        'vat_rate': item.get('btw_percentage') or item.get('vat_rate'),
                    }
                    for item in line_items
                ] if line_items else []
            }
        return {}


class EmailImportSerializer(serializers.ModelSerializer):
    """Serializer for email import list view."""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    mailbox_name = serializers.CharField(source='mailbox_config.name', read_only=True)
    default_invoice_type = serializers.CharField(source='mailbox_config.default_invoice_type', read_only=True)
    attachment_count = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    attachments = EmailAttachmentSerializer(many=True, read_only=True)
    first_invoice_import_id = serializers.SerializerMethodField()
    
    class Meta:
        model = EmailImport
        fields = [
            'id', 'mailbox_name', 'default_invoice_type', 'email_subject', 'email_from', 'email_date',
            'email_body_preview', 'status', 'status_display', 'attachment_count',
            'processed_at', 'reviewed_by_name', 'reviewed_at',
            'created_at', 'updated_at', 'attachments', 'first_invoice_import_id'
        ]
    
    def get_attachment_count(self, obj) -> int:
        return obj.attachments.count()
    
    def get_reviewed_by_name(self, obj) -> str:
        if obj.reviewed_by:
            name = getattr(obj.reviewed_by, 'full_name', '') or ''
            name = name.strip()
            if name:
                return name
            return obj.reviewed_by.email
        return ''
    
    def get_first_invoice_import_id(self, obj) -> str:
        """Return the ID of the first attachment's invoice import."""
        first_attachment = obj.attachments.filter(invoice_import__isnull=False).first()
        if first_attachment and first_attachment.invoice_import:
            return str(first_attachment.invoice_import.id)
        return None


class EmailImportDetailSerializer(EmailImportSerializer):
    """Detailed serializer for email import."""
    
    attachments = EmailAttachmentSerializer(many=True, read_only=True)
    
    class Meta(EmailImportSerializer.Meta):
        fields = EmailImportSerializer.Meta.fields + [
            'attachments', 'error_message', 'review_notes'
        ]


class EmailImportReviewSerializer(serializers.Serializer):
    """Serializer for reviewing (approving/rejecting) an email import."""
    
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    invoice_type = serializers.ChoiceField(
        choices=['purchase', 'credit', 'sales'],
        required=False,
        allow_null=True,
        help_text='Type factuur: inkoop, credit, of verkoop'
    )


class BulkDeleteSerializer(serializers.Serializer):
    """Serializer for bulk deleting email imports."""
    
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=100,
        help_text='Lijst van email import IDs om te verwijderen'
    )


class TestConnectionSerializer(serializers.Serializer):
    """Serializer for testing mailbox connection."""
    pass  # No input needed, uses the config


class FetchEmailsSerializer(serializers.Serializer):
    """Serializer for manually triggering email fetch."""
    
    limit = serializers.IntegerField(min_value=1, max_value=100, default=50)
