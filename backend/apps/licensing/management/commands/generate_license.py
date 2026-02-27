"""
Management command: Generate a signed license key for a customer.

Usage:
    python manage.py generate_license \
        --customer "Transport Bedrijf X" \
        --expires 2027-02-27 \
        --max-users 10 \
        --private-key ./license_private_key.pem

    python manage.py generate_license \
        --customer "Big Logistics BV" \
        --expires 2028-01-01 \
        --max-users 0 \
        --features planning invoicing documents \
        --private-key ./license_private_key.pem
"""
import os
from datetime import datetime, timezone
from django.core.management.base import BaseCommand, CommandError
from apps.licensing.services import create_license, verify_license


class Command(BaseCommand):
    help = 'Generate a signed license key for a customer.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--customer',
            type=str,
            required=True,
            help='Customer/organization name',
        )
        parser.add_argument(
            '--expires',
            type=str,
            required=True,
            help='Expiration date (YYYY-MM-DD)',
        )
        parser.add_argument(
            '--max-users',
            type=int,
            default=0,
            help='Maximum number of users (0 = unlimited)',
        )
        parser.add_argument(
            '--features',
            nargs='*',
            default=[],
            help='List of enabled features (e.g., planning invoicing documents)',
        )
        parser.add_argument(
            '--private-key',
            type=str,
            required=True,
            help='Path to the Ed25519 private key PEM file',
        )

    def handle(self, *args, **options):
        customer = options['customer']
        expires_str = options['expires']
        max_users = options['max_users']
        features = options['features']
        private_key_path = options['private_key']
        
        # Validate private key exists
        if not os.path.exists(private_key_path):
            raise CommandError(
                f'Private key file not found: {private_key_path}\n'
                f'Run: python manage.py generate_license_keys'
            )
        
        # Parse expiration date
        try:
            expires_at = datetime.strptime(expires_str, '%Y-%m-%d').replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
        except ValueError:
            raise CommandError(f'Invalid date format: {expires_str}. Use YYYY-MM-DD.')
        
        # Validate date is in the future
        if expires_at <= datetime.now(timezone.utc):
            raise CommandError('Expiration date must be in the future.')
        
        # Read private key
        with open(private_key_path, 'rb') as f:
            private_key_pem = f.read()
        
        # Generate license
        self.stdout.write(self.style.WARNING(f'\n🔐 Generating license...\n'))
        
        license_key = create_license(
            private_key_pem=private_key_pem,
            customer_name=customer,
            expires_at=expires_at,
            max_users=max_users,
            features=features,
        )
        
        # Verify the generated license (sanity check)
        # We need the public key for this - try to load it
        try:
            payload = verify_license(license_key)
            if payload is None:
                raise CommandError(
                    'Generated license failed verification! '
                    'Make sure the public key in services.py matches your private key.'
                )
            verified = True
        except Exception:
            verified = False
        
        # Display results
        self.stdout.write(self.style.SUCCESS(f'✅ License generated successfully!\n'))
        self.stdout.write(f'   Customer:    {customer}')
        self.stdout.write(f'   Expires:     {expires_str}')
        self.stdout.write(f'   Max Users:   {"Unlimited" if max_users == 0 else max_users}')
        self.stdout.write(f'   Features:    {", ".join(features) if features else "All"}')
        self.stdout.write(f'   Verified:    {"✅ Yes" if verified else "⚠️ Could not verify (check public key)"}')
        
        self.stdout.write(self.style.HTTP_INFO(
            f'\n─── LICENSE KEY (give this to the customer) ───\n'
        ))
        self.stdout.write(license_key)
        self.stdout.write(self.style.HTTP_INFO(
            f'\n─── END LICENSE KEY ───\n'
        ))
        
        # Also show a compact version
        self.stdout.write(
            f'\n📋 License key length: {len(license_key)} characters\n'
            f'   The customer pastes this key in the activation screen.\n'
        )
