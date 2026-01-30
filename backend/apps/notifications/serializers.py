"""
Serializers for push notifications.
"""
from rest_framework import serializers
from .models import PushSettings, PushSubscription, PushNotification, PushProvider


class PushSettingsSerializer(serializers.ModelSerializer):
    """
    Serializer for push notification settings.
    Handles encryption of sensitive fields.
    """
    # Write-only fields for sensitive data
    vapid_private_key = serializers.CharField(
        write_only=True, 
        required=False, 
        allow_blank=True,
        help_text="VAPID Private Key (will be encrypted)"
    )
    firebase_api_key = serializers.CharField(
        write_only=True, 
        required=False, 
        allow_blank=True,
        help_text="Firebase API Key (will be encrypted)"
    )
    
    # Read-only status fields
    is_configured = serializers.SerializerMethodField()
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    
    # Indicate if keys are set (without exposing them)
    has_vapid_private_key = serializers.SerializerMethodField()
    has_firebase_api_key = serializers.SerializerMethodField()
    
    class Meta:
        model = PushSettings
        fields = [
            'id',
            'provider',
            'provider_display',
            'vapid_public_key',
            'vapid_private_key',
            'vapid_admin_email',
            'has_vapid_private_key',
            'firebase_project_id',
            'firebase_api_key',
            'firebase_sender_id',
            'has_firebase_api_key',
            'is_configured',
            'updated_at',
        ]
        read_only_fields = ['id', 'updated_at', 'provider_display', 'is_configured']
    
    def get_is_configured(self, obj):
        return obj.is_configured()
    
    def get_has_vapid_private_key(self, obj):
        return bool(obj.vapid_private_key_encrypted)
    
    def get_has_firebase_api_key(self, obj):
        return bool(obj.firebase_api_key_encrypted)
    
    def update(self, instance, validated_data):
        # Handle VAPID private key encryption
        vapid_private_key = validated_data.pop('vapid_private_key', None)
        if vapid_private_key:
            instance.set_vapid_private_key(vapid_private_key)
        
        # Handle Firebase API key encryption
        firebase_api_key = validated_data.pop('firebase_api_key', None)
        if firebase_api_key:
            instance.set_firebase_api_key(firebase_api_key)
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


class GenerateVapidKeysSerializer(serializers.Serializer):
    """Response serializer for VAPID key generation."""
    public_key = serializers.CharField(read_only=True)
    private_key = serializers.CharField(read_only=True)


class PushSubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for push subscriptions."""
    
    class Meta:
        model = PushSubscription
        fields = [
            'id',
            'endpoint',
            'p256dh_key',
            'auth_key',
            'device_name',
            'is_active',
            'created_at',
            'last_used_at',
        ]
        read_only_fields = ['id', 'created_at', 'last_used_at']


class PushSubscriptionCreateSerializer(serializers.Serializer):
    """Serializer for creating push subscriptions from browser."""
    endpoint = serializers.CharField()
    keys = serializers.DictField(child=serializers.CharField())
    device_name = serializers.CharField(required=False, allow_blank=True)
    
    def validate_keys(self, value):
        if 'p256dh' not in value or 'auth' not in value:
            raise serializers.ValidationError(
                "Keys must contain 'p256dh' and 'auth' fields"
            )
        return value
    
    def create(self, validated_data):
        user = self.context['request'].user
        keys = validated_data['keys']
        user_agent = self.context['request'].META.get('HTTP_USER_AGENT', '')
        
        # Update or create subscription
        subscription, created = PushSubscription.objects.update_or_create(
            user=user,
            endpoint=validated_data['endpoint'],
            defaults={
                'p256dh_key': keys['p256dh'],
                'auth_key': keys['auth'],
                'device_name': validated_data.get('device_name', ''),
                'user_agent': user_agent,
                'is_active': True,
            }
        )
        return subscription


class SendPushNotificationSerializer(serializers.Serializer):
    """Serializer for sending push notifications."""
    title = serializers.CharField(max_length=255)
    body = serializers.CharField()
    icon = serializers.URLField(required=False, allow_blank=True)
    url = serializers.URLField(required=False, allow_blank=True)
    data = serializers.DictField(required=False)
    
    # Target options
    user_id = serializers.UUIDField(required=False, help_text="Send to specific user")
    send_to_all = serializers.BooleanField(default=False, help_text="Send to all users")
    user_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        help_text="Send to multiple specific users"
    )
    
    def validate(self, attrs):
        # Must specify at least one target
        if not attrs.get('user_id') and not attrs.get('send_to_all') and not attrs.get('user_ids'):
            raise serializers.ValidationError(
                "Must specify user_id, user_ids, or send_to_all=true"
            )
        return attrs


class PushNotificationSerializer(serializers.ModelSerializer):
    """Serializer for push notification log entries."""
    recipient_email = serializers.CharField(source='recipient.email', read_only=True)
    sent_by_email = serializers.CharField(source='sent_by.email', read_only=True)
    
    class Meta:
        model = PushNotification
        fields = [
            'id',
            'recipient',
            'recipient_email',
            'send_to_all',
            'title',
            'body',
            'icon',
            'url',
            'data',
            'sent_at',
            'sent_by',
            'sent_by_email',
            'success_count',
            'failure_count',
        ]
        read_only_fields = ['id', 'sent_at', 'success_count', 'failure_count']


class PublicVapidKeySerializer(serializers.Serializer):
    """Serializer for public VAPID key (for frontend)."""
    public_key = serializers.CharField(read_only=True)
    provider = serializers.CharField(read_only=True)
    is_configured = serializers.BooleanField(read_only=True)
