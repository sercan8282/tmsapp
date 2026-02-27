"""
Management command: Generate Ed25519 keypair for license signing.

Run this ONCE to create your keys:
    python manage.py generate_license_keys

The PRIVATE key must be stored securely on your machine.
The PUBLIC key is embedded in the application.
"""
import os
from django.core.management.base import BaseCommand
from apps.licensing.services import generate_keypair


class Command(BaseCommand):
    help = 'Generate Ed25519 keypair for license signing. Run once and store private key securely.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output-dir',
            type=str,
            default='.',
            help='Directory to save the key files (default: current directory)',
        )

    def handle(self, *args, **options):
        output_dir = options['output_dir']
        
        private_key_path = os.path.join(output_dir, 'license_private_key.pem')
        public_key_path = os.path.join(output_dir, 'license_public_key.pem')
        
        # Safety check
        if os.path.exists(private_key_path):
            self.stderr.write(
                self.style.ERROR(
                    f'\n⚠️  Private key already exists at: {private_key_path}\n'
                    f'   If you generate new keys, existing licenses become INVALID.\n'
                    f'   Delete the file manually if you want to regenerate.\n'
                )
            )
            return
        
        self.stdout.write(self.style.WARNING('\n🔐 Generating Ed25519 keypair for license signing...\n'))
        
        private_pem, public_pem = generate_keypair()
        
        # Save private key
        with open(private_key_path, 'wb') as f:
            f.write(private_pem)
        os.chmod(private_key_path, 0o600)  # Owner read-only
        
        # Save public key
        with open(public_key_path, 'wb') as f:
            f.write(public_pem)
        
        self.stdout.write(self.style.SUCCESS(f'✅ Private key saved to: {private_key_path}'))
        self.stdout.write(self.style.SUCCESS(f'✅ Public key saved to:  {public_key_path}'))
        
        self.stdout.write(self.style.WARNING(
            f'\n'
            f'📋 NEXT STEPS:\n'
            f'   1. Copy the PUBLIC key below into:\n'
            f'      backend/apps/licensing/services.py → LICENSE_PUBLIC_KEY_PEM\n'
            f'   2. Store the PRIVATE key file securely (NEVER commit to git!)\n'
            f'   3. Add "license_private_key.pem" to .gitignore\n'
            f'   4. Use: python manage.py generate_license --help\n'
        ))
        
        self.stdout.write(self.style.HTTP_INFO(
            f'\n─── PUBLIC KEY (copy this into services.py) ───\n'
        ))
        self.stdout.write(public_pem.decode())
        self.stdout.write(self.style.HTTP_INFO(
            f'─── END PUBLIC KEY ───\n'
        ))
