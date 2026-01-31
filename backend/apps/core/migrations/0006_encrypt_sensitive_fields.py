"""
Migration to encrypt existing sensitive fields (smtp_password, oauth_client_secret).

This migration:
1. Changes field types to support encrypted values
2. Encrypts any existing plaintext values in the database

IMPORTANT: This is a one-way migration. After running, existing plaintext values
will be encrypted. The application code handles decryption automatically.
"""
from django.db import migrations
import apps.core.models


def encrypt_existing_values(apps, schema_editor):
    """
    Encrypt existing plaintext values for sensitive fields.
    Only encrypts values that don't already have the 'enc:' prefix.
    """
    import base64
    import hashlib
    from django.conf import settings
    
    try:
        from cryptography.fernet import Fernet
        
        # Create Fernet instance using the same key derivation as EncryptedCharField
        key = base64.urlsafe_b64encode(
            hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        )
        fernet = Fernet(key)
        
        AppSettings = apps.get_model('core', 'AppSettings')
        
        for app_settings in AppSettings.objects.all():
            updated = False
            
            # Encrypt smtp_password if it exists and is not already encrypted
            if app_settings.smtp_password and not app_settings.smtp_password.startswith('enc:'):
                encrypted = fernet.encrypt(app_settings.smtp_password.encode()).decode()
                app_settings.smtp_password = f'enc:{encrypted}'
                updated = True
            
            # Encrypt oauth_client_secret if it exists and is not already encrypted
            if app_settings.oauth_client_secret and not app_settings.oauth_client_secret.startswith('enc:'):
                encrypted = fernet.encrypt(app_settings.oauth_client_secret.encode()).decode()
                app_settings.oauth_client_secret = f'enc:{encrypted}'
                updated = True
            
            if updated:
                app_settings.save(update_fields=['smtp_password', 'oauth_client_secret'])
                
    except ImportError:
        # cryptography not installed, skip encryption
        # Values will remain plaintext but the app will still work
        pass


def decrypt_values_for_rollback(apps, schema_editor):
    """
    Reverse migration: decrypt values back to plaintext.
    Note: This is generally not recommended in production.
    """
    import base64
    import hashlib
    from django.conf import settings
    
    try:
        from cryptography.fernet import Fernet
        
        key = base64.urlsafe_b64encode(
            hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        )
        fernet = Fernet(key)
        
        AppSettings = apps.get_model('core', 'AppSettings')
        
        for app_settings in AppSettings.objects.all():
            updated = False
            
            # Decrypt smtp_password if encrypted
            if app_settings.smtp_password and app_settings.smtp_password.startswith('enc:'):
                try:
                    encrypted_data = app_settings.smtp_password[4:]
                    app_settings.smtp_password = fernet.decrypt(encrypted_data.encode()).decode()
                    updated = True
                except Exception:
                    pass
            
            # Decrypt oauth_client_secret if encrypted
            if app_settings.oauth_client_secret and app_settings.oauth_client_secret.startswith('enc:'):
                try:
                    encrypted_data = app_settings.oauth_client_secret[4:]
                    app_settings.oauth_client_secret = fernet.decrypt(encrypted_data.encode()).decode()
                    updated = True
                except Exception:
                    pass
            
            if updated:
                app_settings.save(update_fields=['smtp_password', 'oauth_client_secret'])
                
    except ImportError:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_alter_appsettings_ai_azure_api_key_and_more'),
    ]

    operations = [
        # First, alter the fields to support longer encrypted values
        migrations.AlterField(
            model_name='appsettings',
            name='smtp_password',
            field=apps.core.models.EncryptedCharField(
                blank=True, 
                max_length=512, 
                verbose_name='SMTP Wachtwoord'
            ),
        ),
        migrations.AlterField(
            model_name='appsettings',
            name='oauth_client_secret',
            field=apps.core.models.EncryptedCharField(
                blank=True, 
                max_length=512, 
                verbose_name='OAuth Client Secret'
            ),
        ),
        # Then run data migration to encrypt existing values
        migrations.RunPython(
            encrypt_existing_values,
            decrypt_values_for_rollback,
        ),
    ]
