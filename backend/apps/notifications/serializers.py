"""
Serializers for push notifications.
"""
from rest_framework import serializers
from .models import (
    PushSettings, PushSubscription, PushNotification, PushProvider,
    NotificationGroup, NotificationSchedule, ScheduleFrequency, WeekDay
)


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
            'notification_poll_interval',
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
    group_id = serializers.UUIDField(required=False, help_text="Send to notification group")
    
    def validate(self, attrs):
        # Must specify at least one target
        if not attrs.get('user_id') and not attrs.get('send_to_all') and not attrs.get('user_ids') and not attrs.get('group_id'):
            raise serializers.ValidationError(
                "Must specify user_id, user_ids, group_id, or send_to_all=true"
            )
        return attrs


class PushNotificationSerializer(serializers.ModelSerializer):
    """Serializer for push notification log entries."""
    recipient_email = serializers.CharField(source='recipient.email', read_only=True, allow_null=True)
    sent_by_email = serializers.CharField(source='sent_by.email', read_only=True, allow_null=True)
    group_name = serializers.CharField(source='group.name', read_only=True, allow_null=True)
    
    class Meta:
        model = PushNotification
        fields = [
            'id',
            'recipient',
            'recipient_email',
            'send_to_all',
            'group',
            'group_name',
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


# ============ Notification Groups ============

class NotificationGroupListSerializer(serializers.ModelSerializer):
    """Serializer for listing notification groups."""
    member_count = serializers.SerializerMethodField()
    company_name = serializers.CharField(source='company.name', read_only=True, allow_null=True)
    schedule_count = serializers.SerializerMethodField()
    member_ids = serializers.SerializerMethodField()
    
    class Meta:
        model = NotificationGroup
        fields = [
            'id',
            'name',
            'description',
            'company',
            'company_name',
            'member_ids',
            'member_count',
            'schedule_count',
            'is_active',
            'created_at',
        ]
    
    def get_member_count(self, obj):
        return obj.members.count()
    
    def get_member_ids(self, obj):
        return [str(m.id) for m in obj.members.all()]
    
    def get_schedule_count(self, obj):
        return obj.schedules.filter(is_active=True).count()


class NotificationGroupDetailSerializer(serializers.ModelSerializer):
    """Serializer for notification group details with members."""
    member_count = serializers.SerializerMethodField()
    company_name = serializers.CharField(source='company.name', read_only=True, allow_null=True)
    member_ids = serializers.SerializerMethodField()
    members_detail = serializers.SerializerMethodField()
    
    class Meta:
        model = NotificationGroup
        fields = [
            'id',
            'name',
            'description',
            'company',
            'company_name',
            'member_ids',
            'members_detail',
            'member_count',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_member_count(self, obj):
        return obj.members.count()
    
    def get_member_ids(self, obj):
        return [str(m.id) for m in obj.members.all()]
    
    def get_members_detail(self, obj):
        return [
            {
                'id': str(m.id),
                'email': m.email,
                'full_name': m.full_name or m.email,
            }
            for m in obj.members.all()
        ]


class NotificationGroupCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating notification groups."""
    member_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True
    )
    
    class Meta:
        model = NotificationGroup
        fields = [
            'name',
            'description',
            'company',
            'member_ids',
            'is_active',
        ]
    
    def create(self, validated_data):
        member_ids = validated_data.pop('member_ids', [])
        group = NotificationGroup.objects.create(**validated_data)
        
        if member_ids:
            from apps.accounts.models import User
            members = User.objects.filter(id__in=member_ids)
            group.members.set(members)
        
        return group
    
    def update(self, instance, validated_data):
        member_ids = validated_data.pop('member_ids', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if member_ids is not None:
            from apps.accounts.models import User
            members = User.objects.filter(id__in=member_ids)
            instance.members.set(members)
        
        return instance


# ============ Notification Schedules ============

class NotificationScheduleListSerializer(serializers.ModelSerializer):
    """Serializer for listing notification schedules."""
    group_name = serializers.CharField(source='group.name', read_only=True)
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)
    schedule_display = serializers.SerializerMethodField()
    
    class Meta:
        model = NotificationSchedule
        fields = [
            'id',
            'name',
            'group',
            'group_name',
            'frequency',
            'frequency_display',
            'send_time',
            'schedule_display',
            'title',
            'is_active',
            'last_sent_at',
            'next_send_at',
        ]
    
    def get_schedule_display(self, obj):
        return obj.get_schedule_display()


class NotificationScheduleDetailSerializer(serializers.ModelSerializer):
    """Serializer for notification schedule details."""
    group_name = serializers.CharField(source='group.name', read_only=True)
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)
    schedule_display = serializers.SerializerMethodField()
    weekly_day_display = serializers.SerializerMethodField()
    
    class Meta:
        model = NotificationSchedule
        fields = [
            'id',
            'name',
            'group',
            'group_name',
            'frequency',
            'frequency_display',
            'weekly_day',
            'weekly_day_display',
            'custom_days',
            'send_time',
            'schedule_display',
            'title',
            'body',
            'icon',
            'url',
            'is_active',
            'last_sent_at',
            'next_send_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'last_sent_at', 'next_send_at', 'created_at', 'updated_at']
    
    def get_schedule_display(self, obj):
        return obj.get_schedule_display()
    
    def get_weekly_day_display(self, obj):
        if obj.weekly_day is not None:
            return WeekDay(obj.weekly_day).label
        return None
    
    def validate(self, attrs):
        frequency = attrs.get('frequency', self.instance.frequency if self.instance else None)
        
        # Validate weekly_day is set for weekly frequency
        if frequency == ScheduleFrequency.WEEKLY:
            weekly_day = attrs.get('weekly_day', self.instance.weekly_day if self.instance else None)
            if weekly_day is None:
                raise serializers.ValidationError({
                    'weekly_day': 'Dag van de week is verplicht voor wekelijkse frequentie.'
                })
        
        # Validate custom_days is set for custom frequency
        if frequency == ScheduleFrequency.CUSTOM:
            custom_days = attrs.get('custom_days', self.instance.custom_days if self.instance else None)
            if not custom_days:
                raise serializers.ValidationError({
                    'custom_days': 'Selecteer minimaal één dag voor aangepaste frequentie.'
                })
        
        return attrs


class ScheduleFrequencyChoicesSerializer(serializers.Serializer):
    """Serializer for frequency choices."""
    value = serializers.CharField()
    label = serializers.CharField()


# ============ User Notification Inbox ============

class UserNotificationSerializer(serializers.ModelSerializer):
    """Serializer for user's notification inbox."""
    title = serializers.CharField(source='notification.title', read_only=True)
    body = serializers.CharField(source='notification.body', read_only=True)
    icon = serializers.URLField(source='notification.icon', read_only=True, allow_null=True)
    url = serializers.URLField(source='notification.url', read_only=True, allow_null=True)
    sent_at = serializers.DateTimeField(source='notification.sent_at', read_only=True)
    notification_id = serializers.UUIDField(source='notification.id', read_only=True)
    
    class Meta:
        from .models import UserNotification
        model = UserNotification
        fields = [
            'id',
            'notification_id',
            'title',
            'body',
            'icon',
            'url',
            'is_read',
            'read_at',
            'sent_at',
            'created_at',
        ]
        read_only_fields = ['id', 'notification_id', 'title', 'body', 'icon', 'url', 'sent_at', 'created_at']


class NotificationInboxCountSerializer(serializers.Serializer):
    """Serializer for notification count."""
    unread_count = serializers.IntegerField()
    total_count = serializers.IntegerField()


# ============ Admin: Read Receipts ============

class ReadReceiptSerializer(serializers.Serializer):
    """Serializer for read receipts."""
    user_id = serializers.UUIDField()
    user_email = serializers.EmailField()
    user_full_name = serializers.CharField()
    is_read = serializers.BooleanField()
    read_at = serializers.DateTimeField(allow_null=True)


class SentNotificationDetailSerializer(serializers.ModelSerializer):
    """Serializer for admin view of sent notifications with read receipts."""
    sent_by_email = serializers.EmailField(source='sent_by.email', read_only=True, allow_null=True)
    sent_by_name = serializers.CharField(source='sent_by.full_name', read_only=True, allow_null=True)
    group_name = serializers.CharField(source='group.name', read_only=True, allow_null=True)
    recipient_email = serializers.EmailField(source='recipient.email', read_only=True, allow_null=True)
    recipient_name = serializers.CharField(source='recipient.full_name', read_only=True, allow_null=True)
    read_receipts = serializers.SerializerMethodField()
    total_recipients = serializers.SerializerMethodField()
    read_count = serializers.SerializerMethodField()
    
    class Meta:
        model = PushNotification
        fields = [
            'id',
            'title',
            'body',
            'icon',
            'url',
            'recipient',
            'recipient_email',
            'recipient_name',
            'group',
            'group_name',
            'send_to_all',
            'sent_by',
            'sent_by_email',
            'sent_by_name',
            'sent_at',
            'success_count',
            'failure_count',
            'total_recipients',
            'read_count',
            'read_receipts',
        ]
    
    def get_read_receipts(self, obj):
        """Get read receipts for all recipients of this notification."""
        from .models import UserNotification
        user_notifications = UserNotification.objects.filter(
            notification=obj
        ).select_related('user')
        
        return [
            {
                'user_id': str(un.user.id),
                'user_email': un.user.email,
                'user_full_name': un.user.full_name or un.user.email,
                'is_read': un.is_read,
                'read_at': un.read_at,
            }
            for un in user_notifications
        ]
    
    def get_total_recipients(self, obj):
        """Get total number of recipients."""
        return obj.user_notifications.count()
    
    def get_read_count(self, obj):
        """Get number of recipients who read the notification."""
        return obj.user_notifications.filter(is_read=True).count()


class SentNotificationListSerializer(serializers.ModelSerializer):
    """Serializer for listing sent notifications (admin view)."""
    sent_by_email = serializers.EmailField(source='sent_by.email', read_only=True, allow_null=True)
    group_name = serializers.CharField(source='group.name', read_only=True, allow_null=True)
    recipient_email = serializers.EmailField(source='recipient.email', read_only=True, allow_null=True)
    total_recipients = serializers.SerializerMethodField()
    read_count = serializers.SerializerMethodField()
    
    class Meta:
        model = PushNotification
        fields = [
            'id',
            'title',
            'body',
            'recipient',
            'recipient_email',
            'group',
            'group_name',
            'send_to_all',
            'sent_by_email',
            'sent_at',
            'success_count',
            'failure_count',
            'total_recipients',
            'read_count',
        ]
    
    def get_total_recipients(self, obj):
        return obj.user_notifications.count()
    
    def get_read_count(self, obj):
        return obj.user_notifications.filter(is_read=True).count()

class WeekDayChoicesSerializer(serializers.Serializer):
    """Serializer for weekday choices."""
    value = serializers.IntegerField()
    label = serializers.CharField()
