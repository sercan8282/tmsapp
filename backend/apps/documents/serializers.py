"""
Serializers voor documenten en handtekeningen.
"""
from rest_framework import serializers
from .models import SignedDocument, SavedSignature


class SavedSignatureSerializer(serializers.ModelSerializer):
    """Serializer voor opgeslagen handtekeningen."""
    
    class Meta:
        model = SavedSignature
        fields = [
            'id', 'name', 'signature_image', 'is_default', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SignedDocumentListSerializer(serializers.ModelSerializer):
    """Serializer voor document lijst weergave."""
    uploaded_by_name = serializers.SerializerMethodField()
    signed_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = SignedDocument
        fields = [
            'id', 'title', 'description', 'original_filename',
            'status', 'status_display',
            'uploaded_by', 'uploaded_by_name',
            'signed_by', 'signed_by_name',
            'created_at', 'signed_at'
        ]
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.full_name or obj.uploaded_by.email
        return None
    
    def get_signed_by_name(self, obj):
        if obj.signed_by:
            return obj.signed_by.full_name or obj.signed_by.email
        return None


class SignedDocumentDetailSerializer(serializers.ModelSerializer):
    """Serializer voor document detail weergave."""
    uploaded_by_name = serializers.SerializerMethodField()
    signed_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    original_file_url = serializers.SerializerMethodField()
    signed_file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = SignedDocument
        fields = [
            'id', 'title', 'description', 
            'original_file', 'original_file_url', 'original_filename',
            'signed_file', 'signed_file_url',
            'signature_data',
            'status', 'status_display',
            'uploaded_by', 'uploaded_by_name',
            'signed_by', 'signed_by_name',
            'created_at', 'updated_at', 'signed_at'
        ]
        read_only_fields = [
            'id', 'signed_file', 'status', 
            'uploaded_by', 'signed_by', 'signed_at',
            'created_at', 'updated_at'
        ]
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.full_name or obj.uploaded_by.email
        return None
    
    def get_signed_by_name(self, obj):
        if obj.signed_by:
            return obj.signed_by.full_name or obj.signed_by.email
        return None
    
    def get_original_file_url(self, obj):
        if obj.original_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.original_file.url)
            return obj.original_file.url
        return None
    
    def get_signed_file_url(self, obj):
        if obj.signed_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.signed_file.url)
            return obj.signed_file.url
        return None


class DocumentUploadSerializer(serializers.Serializer):
    """Serializer voor document upload."""
    file = serializers.FileField()
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    
    def validate_file(self, value):
        # Alleen PDF bestanden toestaan
        if not value.name.lower().endswith('.pdf'):
            raise serializers.ValidationError('Alleen PDF bestanden zijn toegestaan.')
        
        # Max 20MB
        max_size = 20 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError('Bestand mag maximaal 20MB zijn.')
        
        return value


class SignDocumentSerializer(serializers.Serializer):
    """Serializer voor het ondertekenen van een document."""
    signature_image = serializers.CharField(
        help_text='Base64 encoded PNG afbeelding van de handtekening'
    )
    page = serializers.IntegerField(
        min_value=1,
        help_text='Paginanummer waar de handtekening moet komen (1-indexed)'
    )
    x = serializers.FloatField(
        min_value=0,
        help_text='X positie in percentage van pagina breedte (0-100)'
    )
    y = serializers.FloatField(
        min_value=0,
        help_text='Y positie in percentage van pagina hoogte (0-100)'
    )
    width = serializers.FloatField(
        min_value=1,
        max_value=100,
        default=20,
        help_text='Breedte van handtekening in percentage van pagina breedte'
    )
    save_signature = serializers.BooleanField(
        default=False,
        help_text='Sla deze handtekening op voor later gebruik'
    )
    signature_name = serializers.CharField(
        max_length=100,
        required=False,
        help_text='Naam voor opgeslagen handtekening'
    )
    
    def validate(self, data):
        if data.get('save_signature') and not data.get('signature_name'):
            raise serializers.ValidationError({
                'signature_name': 'Naam is verplicht als je de handtekening wilt opslaan.'
            })
        return data
