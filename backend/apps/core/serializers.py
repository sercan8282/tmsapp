"""
Core app serializers.
"""
from rest_framework import serializers
from .models import AppSettings, CustomFont


class CustomFontSerializer(serializers.ModelSerializer):
    """Serializer for custom fonts."""
    font_url = serializers.SerializerMethodField()
    file_format = serializers.ReadOnlyField()
    css_format = serializers.ReadOnlyField()
    weight_display = serializers.CharField(source='get_weight_display', read_only=True)
    style_display = serializers.CharField(source='get_style_display', read_only=True)
    
    class Meta:
        model = CustomFont
        fields = [
            'id', 'family', 'name', 'font_file', 'font_url',
            'weight', 'weight_display', 'style', 'style_display',
            'file_format', 'css_format',
            'is_system', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'is_system', 'created_at', 'updated_at', 'file_format', 'css_format']
        extra_kwargs = {
            'font_file': {'write_only': True},
        }
    
    def get_font_url(self, obj):
        if obj.font_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.font_file.url)
            return obj.font_file.url
        return None


class FontFamilySerializer(serializers.Serializer):
    """Serializer for font family with all variants."""
    family = serializers.CharField()
    fonts = CustomFontSerializer(many=True)
    
    @staticmethod
    def get_families_with_fonts():
        """Get all font families with their font variants."""
        fonts = CustomFont.objects.filter(is_active=True).order_by('family', 'weight', 'style')
        families = {}
        for font in fonts:
            if font.family not in families:
                families[font.family] = []
            families[font.family].append(font)
        
        return [
            {'family': family, 'fonts': font_list}
            for family, font_list in families.items()
        ]


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
    primary_font_data = CustomFontSerializer(source='primary_font', read_only=True)
    secondary_font_data = CustomFontSerializer(source='secondary_font', read_only=True)
    
    class Meta:
        model = AppSettings
        fields = [
            'id', 'app_name', 'logo', 'logo_url', 'favicon', 'favicon_url', 'primary_color',
            'company_name', 'company_address', 'company_phone', 'company_email',
            'company_kvk', 'company_btw', 'company_iban',
            'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password',
            'smtp_use_tls', 'smtp_from_email',
            'oauth_enabled', 'oauth_client_id', 'oauth_client_secret', 'oauth_tenant_id',
            'invoice_payment_text', 'email_signature',
            'primary_font', 'primary_font_data', 'secondary_font', 'secondary_font_data',
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
