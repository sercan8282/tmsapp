"""
Models for push notifications.
"""
import uuid
from django.db import models
from django.conf import settings
from cryptography.fernet import Fernet
from django.core.exceptions import ValidationError


class PushProvider(models.TextChoices):
    """Available push notification providers."""
    NONE = 'none', 'Uitgeschakeld'
    WEBPUSH = 'webpush', 'Web Push (VAPID) - Gratis'
    FIREBASE = 'firebase', 'Firebase Cloud Messaging (FCM)'


class ScheduleFrequency(models.TextChoices):
    """Notification schedule frequency options."""
    DAILY = 'daily', 'Dagelijks'
    WEEKDAYS = 'weekdays', 'Alleen werkdagen (ma-vr)'
    WEEKEND = 'weekend', 'Alleen weekend (za-zo)'
    WEEKLY = 'weekly', 'Wekelijks (specifieke dag)'
    CUSTOM = 'custom', 'Aangepaste dagen'


class WeekDay(models.IntegerChoices):
    """Days of the week."""
    MONDAY = 0, 'Maandag'
    TUESDAY = 1, 'Dinsdag'
    WEDNESDAY = 2, 'Woensdag'
    THURSDAY = 3, 'Donderdag'
    FRIDAY = 4, 'Vrijdag'
    SATURDAY = 5, 'Zaterdag'
    SUNDAY = 6, 'Zondag'


class PushSettings(models.Model):
    """
    Singleton model for push notification settings.
    Stores provider configuration with encrypted secrets.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Provider selection
    provider = models.CharField(
        max_length=20,
        choices=PushProvider.choices,
        default=PushProvider.NONE,
        verbose_name='Push Provider'
    )
    
    # Web Push (VAPID) settings
    vapid_public_key = models.TextField(blank=True, null=True, verbose_name='VAPID Public Key')
    vapid_private_key_encrypted = models.TextField(blank=True, null=True, verbose_name='VAPID Private Key (encrypted)')
    vapid_admin_email = models.EmailField(blank=True, null=True, verbose_name='VAPID Admin Email')
    
    # Firebase settings
    firebase_project_id = models.CharField(max_length=255, blank=True, null=True, verbose_name='Firebase Project ID')
    firebase_api_key_encrypted = models.TextField(blank=True, null=True, verbose_name='Firebase API Key (encrypted)')
    firebase_sender_id = models.CharField(max_length=255, blank=True, null=True, verbose_name='Firebase Sender ID')
    
    # Notification polling settings
    notification_poll_interval = models.IntegerField(
        default=10,
        verbose_name='Poll Interval (seconden)',
        help_text='Hoe vaak de notificatie-teller wordt bijgewerkt (in seconden)'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Push Settings'
        verbose_name_plural = 'Push Settings'
    
    def __str__(self):
        return f"Push Settings ({self.get_provider_display()})"
    
    @classmethod
    def get_encryption_key(cls):
        """Get or generate encryption key from settings."""
        from django.conf import settings
        key = getattr(settings, 'PUSH_ENCRYPTION_KEY', None)
        if not key:
            # Fallback to SECRET_KEY derived key
            import hashlib
            import base64
            hash_key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
            key = base64.urlsafe_b64encode(hash_key)
        return key
    
    @classmethod
    def encrypt_value(cls, value):
        """Encrypt a sensitive value."""
        if not value:
            return None
        f = Fernet(cls.get_encryption_key())
        return f.encrypt(value.encode()).decode()
    
    @classmethod
    def decrypt_value(cls, encrypted_value):
        """Decrypt a sensitive value."""
        if not encrypted_value:
            return None
        try:
            f = Fernet(cls.get_encryption_key())
            return f.decrypt(encrypted_value.encode()).decode()
        except Exception:
            return None
    
    def set_vapid_private_key(self, key):
        """Set and encrypt VAPID private key."""
        self.vapid_private_key_encrypted = self.encrypt_value(key)
    
    def get_vapid_private_key(self):
        """Get decrypted VAPID private key."""
        return self.decrypt_value(self.vapid_private_key_encrypted)
    
    def set_firebase_api_key(self, key):
        """Set and encrypt Firebase API key."""
        self.firebase_api_key_encrypted = self.encrypt_value(key)
    
    def get_firebase_api_key(self):
        """Get decrypted Firebase API key."""
        return self.decrypt_value(self.firebase_api_key_encrypted)
    
    @classmethod
    def get_settings(cls):
        """Get or create singleton settings object."""
        obj, created = cls.objects.get_or_create(
            pk='00000000-0000-0000-0000-000000000001'
        )
        return obj
    
    @classmethod
    def generate_vapid_keys(cls):
        """Generate new VAPID key pair."""
        try:
            from py_vapid import Vapid
            vapid = Vapid()
            vapid.generate_keys()
            return {
                'public_key': vapid.public_key.public_bytes_raw().hex() if hasattr(vapid.public_key, 'public_bytes_raw') else str(vapid.public_key),
                'private_key': vapid.private_key.private_bytes_raw().hex() if hasattr(vapid.private_key, 'private_bytes_raw') else str(vapid.private_key),
            }
        except ImportError:
            # Fallback: generate using cryptography directly
            from cryptography.hazmat.primitives.asymmetric import ec
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.backends import default_backend
            import base64
            
            private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
            public_key = private_key.public_key()
            
            # Get raw bytes
            private_bytes = private_key.private_numbers().private_value.to_bytes(32, 'big')
            public_bytes = public_key.public_bytes(
                encoding=serialization.Encoding.X962,
                format=serialization.PublicFormat.UncompressedPoint
            )
            
            return {
                'public_key': base64.urlsafe_b64encode(public_bytes).decode().rstrip('='),
                'private_key': base64.urlsafe_b64encode(private_bytes).decode().rstrip('='),
            }
    
    def is_configured(self):
        """Check if push notifications are properly configured."""
        if self.provider == PushProvider.NONE:
            return False
        
        if self.provider == PushProvider.WEBPUSH:
            return bool(self.vapid_public_key and self.vapid_private_key_encrypted and self.vapid_admin_email)
        
        if self.provider == PushProvider.FIREBASE:
            return bool(self.firebase_project_id and self.firebase_api_key_encrypted and self.firebase_sender_id)
        
        return False


class PushSubscription(models.Model):
    """
    Stores push notification subscriptions for users.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_subscriptions'
    )
    
    # Subscription data (JSON from browser)
    endpoint = models.TextField(verbose_name='Push Endpoint')
    p256dh_key = models.TextField(verbose_name='P256DH Key')
    auth_key = models.TextField(verbose_name='Auth Key')
    
    # Device info
    user_agent = models.TextField(blank=True, null=True, verbose_name='User Agent')
    device_name = models.CharField(max_length=255, blank=True, null=True, verbose_name='Device Name')
    
    # Status
    is_active = models.BooleanField(default=True, verbose_name='Active')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(blank=True, null=True, verbose_name='Last Used')
    
    class Meta:
        verbose_name = 'Push Subscription'
        verbose_name_plural = 'Push Subscriptions'
        unique_together = ['user', 'endpoint']
    
    def __str__(self):
        return f"{self.user.email} - {self.device_name or 'Unknown device'}"


class PushNotification(models.Model):
    """
    Log of sent push notifications.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Target
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_notifications',
        blank=True,
        null=True,
        verbose_name='Recipient'
    )
    send_to_all = models.BooleanField(default=False, verbose_name='Send to All')
    group = models.ForeignKey(
        'NotificationGroup',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
        verbose_name='Groep'
    )
    
    # Content
    title = models.CharField(max_length=255, verbose_name='Title')
    body = models.TextField(verbose_name='Body')
    icon = models.URLField(blank=True, null=True, verbose_name='Icon URL')
    url = models.URLField(blank=True, null=True, verbose_name='Click URL')
    data = models.JSONField(blank=True, null=True, verbose_name='Extra Data')
    
    # Status
    sent_at = models.DateTimeField(auto_now_add=True, verbose_name='Sent At')
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_notifications',
        verbose_name='Sent By'
    )
    success_count = models.IntegerField(default=0, verbose_name='Success Count')
    failure_count = models.IntegerField(default=0, verbose_name='Failure Count')
    
    class Meta:
        verbose_name = 'Push Notification'
        verbose_name_plural = 'Push Notifications'
        ordering = ['-sent_at']
    
    def __str__(self):
        return f"{self.title} - {self.sent_at}"


class NotificationGroup(models.Model):
    """
    Groups for organizing notification recipients.
    Can be linked to a company or standalone.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, verbose_name='Naam')
    description = models.TextField(blank=True, null=True, verbose_name='Beschrijving')
    
    # Optional link to company
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notification_groups',
        verbose_name='Bedrijf'
    )
    
    # Members
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='notification_groups',
        blank=True,
        verbose_name='Leden'
    )
    
    # Status
    is_active = models.BooleanField(default=True, verbose_name='Actief')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Notificatie Groep'
        verbose_name_plural = 'Notificatie Groepen'
        ordering = ['name']
    
    def __str__(self):
        if self.company:
            return f"{self.name} ({self.company.name})"
        return self.name
    
    def get_member_count(self):
        return self.members.count()


class NotificationSchedule(models.Model):
    """
    Scheduled notifications for groups.
    Defines when and what to send.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, verbose_name='Naam')
    
    # Target group
    group = models.ForeignKey(
        NotificationGroup,
        on_delete=models.CASCADE,
        related_name='schedules',
        verbose_name='Groep'
    )
    
    # Schedule settings
    frequency = models.CharField(
        max_length=20,
        choices=ScheduleFrequency.choices,
        default=ScheduleFrequency.DAILY,
        verbose_name='Frequentie'
    )
    
    # For weekly: which day
    weekly_day = models.IntegerField(
        choices=WeekDay.choices,
        null=True,
        blank=True,
        verbose_name='Dag van de week'
    )
    
    # For custom: which days (stored as JSON array of integers 0-6)
    custom_days = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Aangepaste dagen'
    )
    
    # Time to send (24h format)
    send_time = models.TimeField(verbose_name='Verzendtijd')
    
    # Notification content
    title = models.CharField(max_length=255, verbose_name='Titel')
    body = models.TextField(verbose_name='Bericht')
    icon = models.URLField(blank=True, null=True, verbose_name='Icon URL')
    url = models.URLField(blank=True, null=True, verbose_name='Link URL')
    
    # Status
    is_active = models.BooleanField(default=True, verbose_name='Actief')
    
    # Tracking
    last_sent_at = models.DateTimeField(null=True, blank=True, verbose_name='Laatst verzonden')
    next_send_at = models.DateTimeField(null=True, blank=True, verbose_name='Volgende verzending')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Notificatie Schema'
        verbose_name_plural = 'Notificatie Schema\'s'
        ordering = ['send_time', 'name']
    
    def __str__(self):
        return f"{self.name} - {self.group.name}"
    
    def should_send_today(self):
        """Check if this schedule should send today."""
        from datetime import date
        today = date.today().weekday()  # 0=Monday, 6=Sunday
        
        if self.frequency == ScheduleFrequency.DAILY:
            return True
        elif self.frequency == ScheduleFrequency.WEEKDAYS:
            return today < 5  # Monday-Friday
        elif self.frequency == ScheduleFrequency.WEEKEND:
            return today >= 5  # Saturday-Sunday
        elif self.frequency == ScheduleFrequency.WEEKLY:
            return today == self.weekly_day
        elif self.frequency == ScheduleFrequency.CUSTOM:
            return today in (self.custom_days or [])
        
        return False
    
    def get_schedule_display(self):
        """Get human-readable schedule description."""
        time_str = self.send_time.strftime('%H:%M')
        
        if self.frequency == ScheduleFrequency.DAILY:
            return f"Dagelijks om {time_str}"
        elif self.frequency == ScheduleFrequency.WEEKDAYS:
            return f"Werkdagen om {time_str}"
        elif self.frequency == ScheduleFrequency.WEEKEND:
            return f"Weekend om {time_str}"
        elif self.frequency == ScheduleFrequency.WEEKLY:
            day_name = WeekDay(self.weekly_day).label if self.weekly_day is not None else '?'
            return f"Elke {day_name} om {time_str}"
        elif self.frequency == ScheduleFrequency.CUSTOM:
            days = [WeekDay(d).label[:2] for d in (self.custom_days or [])]
            return f"{', '.join(days)} om {time_str}"
        
        return f"Om {time_str}"
    
    def calculate_next_send(self):
        """Calculate and set the next send datetime."""
        from django.utils import timezone
        from datetime import datetime, timedelta
        
        now = timezone.now()
        today = now.date()
        
        # Create datetime with send_time for today
        send_datetime = timezone.make_aware(
            datetime.combine(today, self.send_time)
        ) if timezone.is_naive(datetime.combine(today, self.send_time)) else datetime.combine(today, self.send_time)
        
        # If already past today's send time, start checking from tomorrow
        if now.time() >= self.send_time:
            check_date = today + timedelta(days=1)
        else:
            check_date = today
        
        # Find the next valid day
        for i in range(7):  # Check up to 7 days ahead
            check_weekday = check_date.weekday()
            should_send = False
            
            if self.frequency == ScheduleFrequency.DAILY:
                should_send = True
            elif self.frequency == ScheduleFrequency.WEEKDAYS:
                should_send = check_weekday < 5
            elif self.frequency == ScheduleFrequency.WEEKEND:
                should_send = check_weekday >= 5
            elif self.frequency == ScheduleFrequency.WEEKLY:
                should_send = check_weekday == self.weekly_day
            elif self.frequency == ScheduleFrequency.CUSTOM:
                should_send = check_weekday in (self.custom_days or [])
            
            if should_send:
                self.next_send_at = timezone.make_aware(
                    datetime.combine(check_date, self.send_time)
                ) if timezone.is_naive(datetime.combine(check_date, self.send_time)) else datetime.combine(check_date, self.send_time)
                return
            
            check_date += timedelta(days=1)
        
        # Fallback to None if no valid day found
        self.next_send_at = None
    
    def save(self, *args, **kwargs):
        """Override save to calculate next_send_at on creation."""
        if not self.next_send_at:
            self.calculate_next_send()
        super().save(*args, **kwargs)


class UserNotification(models.Model):
    """
    Individual notification delivered to a user.
    Tracks read status for notification inbox and read receipts.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Link to the original push notification
    notification = models.ForeignKey(
        PushNotification,
        on_delete=models.CASCADE,
        related_name='user_notifications',
        verbose_name='Notificatie'
    )
    
    # Recipient
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='inbox_notifications',
        verbose_name='Gebruiker'
    )
    
    # Status
    is_read = models.BooleanField(default=False, verbose_name='Gelezen')
    read_at = models.DateTimeField(blank=True, null=True, verbose_name='Gelezen op')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Gebruiker Notificatie'
        verbose_name_plural = 'Gebruiker Notificaties'
        ordering = ['-created_at']
        unique_together = ['notification', 'user']
    
    def __str__(self):
        status = "Gelezen" if self.is_read else "Ongelezen"
        return f"{self.notification.title} - {self.user.email} ({status})"
    
    def mark_as_read(self):
        """Mark this notification as read."""
        if not self.is_read:
            from django.utils import timezone
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])

