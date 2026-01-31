from django.contrib import admin
from .models import MailboxConfig, EmailImport, EmailAttachment


@admin.register(MailboxConfig)
class MailboxConfigAdmin(admin.ModelAdmin):
    list_display = ['name', 'email_address', 'protocol', 'status', 'auto_fetch_enabled', 
                    'total_emails_processed', 'last_fetch_at', 'created_at']
    list_filter = ['protocol', 'status', 'auto_fetch_enabled']
    search_fields = ['name', 'email_address', 'description']
    readonly_fields = ['id', 'status', 'last_fetch_at', 'last_error', 
                      'total_emails_processed', 'total_invoices_imported',
                      'created_at', 'updated_at']
    
    fieldsets = (
        ('Basis', {
            'fields': ('id', 'name', 'description', 'email_address', 'protocol', 'status')
        }),
        ('IMAP Instellingen', {
            'fields': ('imap_server', 'imap_port', 'imap_use_ssl'),
            'classes': ('collapse',)
        }),
        ('Microsoft 365 Instellingen', {
            'fields': ('ms365_client_id', 'ms365_tenant_id'),
            'classes': ('collapse',)
        }),
        ('Verwerking', {
            'fields': ('folder_name', 'mark_as_read', 'move_to_folder',
                      'only_unread', 'subject_filter', 'sender_filter')
        }),
        ('Automatisch Ophalen', {
            'fields': ('auto_fetch_enabled', 'auto_fetch_interval_minutes')
        }),
        ('Statistieken', {
            'fields': ('last_fetch_at', 'last_error', 'total_emails_processed', 
                      'total_invoices_imported'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(EmailImport)
class EmailImportAdmin(admin.ModelAdmin):
    list_display = ['email_subject', 'email_from', 'email_date', 'status', 
                    'attachment_count', 'processed_at', 'created_at']
    list_filter = ['status', 'mailbox_config']
    search_fields = ['email_subject', 'email_from', 'email_message_id']
    readonly_fields = ['id', 'email_message_id', 'created_at', 'updated_at']
    
    def attachment_count(self, obj):
        return obj.attachments.count()
    attachment_count.short_description = 'Bijlages'


@admin.register(EmailAttachment)
class EmailAttachmentAdmin(admin.ModelAdmin):
    list_display = ['original_filename', 'email_import', 'file_size', 
                    'is_processed', 'created_at']
    list_filter = ['is_processed', 'content_type']
    search_fields = ['original_filename']
    readonly_fields = ['id', 'created_at']
