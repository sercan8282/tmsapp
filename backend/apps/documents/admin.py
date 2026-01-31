from django.contrib import admin
from .models import SignedDocument, SavedSignature


@admin.register(SignedDocument)
class SignedDocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'status', 'uploaded_by', 'signed_by', 'created_at', 'signed_at']
    list_filter = ['status', 'created_at', 'signed_at']
    search_fields = ['title', 'description', 'original_filename']
    readonly_fields = ['created_at', 'updated_at', 'signed_at']
    raw_id_fields = ['uploaded_by', 'signed_by']


@admin.register(SavedSignature)
class SavedSignatureAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'is_default', 'created_at']
    list_filter = ['is_default', 'created_at']
    search_fields = ['name', 'user__email', 'user__first_name', 'user__last_name']
    raw_id_fields = ['user']
