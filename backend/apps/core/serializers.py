"""
Core app serializers.
"""
from rest_framework import serializers
from .models import AppSettings


class AppSettingsSerializer(serializers.ModelSerializer):
    """Serializer for public app settings (branding only)."""
    logo_url = serializers.SerializerMethodField()
    favicon_url = serializers.SerializerMethodField()
    
    class Meta:
        model = AppSettings
        fields = [
            'app_name',
            'logo_url',
            'favicon_url',
            'primary_color',
            'company_name',
        ]
    
    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None
    
    def get_favicon_url(self, obj):
        if obj.favicon:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.favicon.url)
            return obj.favicon.url
        return None


class AppSettingsAdminSerializer(serializers.ModelSerializer):
    """Full serializer for admin settings management."""
    logo_url = serializers.SerializerMethodField()
    favicon_url = serializers.SerializerMethodField()
    
    class Meta:
        model = AppSettings
        fields = [
            'id', 'app_name', 'logo', 'logo_url', 'favicon', 'favicon_url', 'primary_color',
            'company_name', 'company_address', 'company_phone', 'company_email',
            'company_kvk', 'company_btw', 'company_iban',
            'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password',
            'smtp_use_tls', 'smtp_from_email',
            'oauth_enabled', 'oauth_client_id', 'oauth_client_secret', 'oauth_tenant_id',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'smtp_password': {'write_only': True},
            'oauth_client_secret': {'write_only': True},
        }
    
    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None
    
    def get_favicon_url(self, obj):
        if obj.favicon:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.favicon.url)
            return obj.favicon.url
        return None


class EmailTestSerializer(serializers.Serializer):
    """Serializer for testing email configuration."""
    to_email = serializers.EmailField()
