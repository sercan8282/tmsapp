"""
Licensing app serializers.
"""
from rest_framework import serializers
from .models import License


class LicenseActivateSerializer(serializers.Serializer):
    """Serializer for license activation request."""
    license_key = serializers.CharField(
        help_text='De licentiesleutel (gesigneerde payload)'
    )


class LicenseStatusSerializer(serializers.ModelSerializer):
    """Serializer for license status response."""
    days_remaining = serializers.ReadOnlyField()
    is_valid = serializers.ReadOnlyField()
    is_expiring_soon = serializers.ReadOnlyField()
    
    class Meta:
        model = License
        fields = [
            'id',
            'customer_name',
            'status',
            'issued_at',
            'expires_at',
            'max_users',
            'features',
            'activated_at',
            'days_remaining',
            'is_valid',
            'is_expiring_soon',
        ]
        read_only_fields = fields
