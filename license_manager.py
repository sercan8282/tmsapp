#!/usr/bin/env python3
"""
TMS License Manager - Standalone tool
=====================================

Standalone script for generating Ed25519 keypairs and license keys.
Does NOT require Django or any project dependencies — only the 'cryptography' package.

Usage:
    pip install cryptography
    python license_manager.py generate-keys
    python license_manager.py create-license

The private key stays with YOU. The public key goes into the application code.
License keys are given to customers to activate their installation.
"""
import sys
import os
import json
import base64
import uuid
import argparse
from datetime import datetime, timezone, timedelta

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives import serialization
except ImportError:
    print("❌ 'cryptography' package is required.")
    print("   Install with: pip install cryptography")
    sys.exit(1)


# ============================================================================
# Colors for terminal output
# ============================================================================
class C:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'


# ============================================================================
# Key Generation
# ============================================================================
def generate_keys(output_dir: str = '.'):
    """Generate a new Ed25519 keypair."""
    print(f"\n{C.CYAN}🔐 Generating Ed25519 keypair...{C.END}\n")

    private_key = Ed25519PrivateKey.generate()

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    private_path = os.path.join(output_dir, 'license_private_key.pem')
    public_path = os.path.join(output_dir, 'license_public_key.pem')

    with open(private_path, 'wb') as f:
        f.write(private_pem)
    os.chmod(private_path, 0o600)  # Only owner can read

    with open(public_path, 'wb') as f:
        f.write(public_pem)

    print(f"{C.GREEN}✅ Private key saved to:{C.END} {private_path}")
    print(f"{C.GREEN}✅ Public key saved to:{C.END}  {public_path}")
    print(f"\n{C.YELLOW}⚠️  BEWAAR de private key VEILIG!{C.END}")
    print(f"   - Nooit committen naar git")
    print(f"   - Nooit op de productieserver plaatsen")
    print(f"   - Maak een backup op een veilige locatie")

    print(f"\n{C.CYAN}─── PUBLIC KEY (kopieer naar services.py → LICENSE_PUBLIC_KEY_PEM) ───{C.END}\n")
    print(public_pem.decode())
    print(f"{C.CYAN}─── EINDE PUBLIC KEY ───{C.END}\n")


# ============================================================================
# License Creation
# ============================================================================
def create_license(
    private_key_path: str,
    customer: str,
    expires: str,
    max_users: int = 0,
    features: str = '',
) -> str:
    """Create a signed license key."""

    # Load private key
    if not os.path.exists(private_key_path):
        print(f"{C.RED}❌ Private key niet gevonden: {private_key_path}{C.END}")
        sys.exit(1)

    with open(private_key_path, 'rb') as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)

    # Parse expiry date
    try:
        expires_dt = datetime.strptime(expires, '%Y-%m-%d')
        expires_dt = expires_dt.replace(
            hour=23, minute=59, second=59, tzinfo=timezone.utc
        )
    except ValueError:
        print(f"{C.RED}❌ Ongeldig datumformaat: {expires} (verwacht: YYYY-MM-DD){C.END}")
        sys.exit(1)

    # Build payload
    payload = {
        'license_id': str(uuid.uuid4()),
        'customer': customer,
        'issued_at': datetime.now(timezone.utc).isoformat(),
        'expires_at': expires_dt.isoformat(),
        'max_users': max_users,
        'features': [f.strip() for f in features.split(',') if f.strip()] if features else [],
        'nonce': str(uuid.uuid4()),
    }

    # Sort keys for consistent serialization
    payload_json = json.dumps(payload, sort_keys=True, separators=(',', ':'))
    payload_bytes = payload_json.encode('utf-8')

    # Sign
    signature = private_key.sign(payload_bytes)

    # Encode
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode()
    sig_b64 = base64.urlsafe_b64encode(signature).decode()
    license_key = f"{payload_b64}.{sig_b64}"

    # Verify (sanity check)
    try:
        public_key = private_key.public_key()
        decoded_payload = base64.urlsafe_b64decode(payload_b64)
        decoded_sig = base64.urlsafe_b64decode(sig_b64)
        public_key.verify(decoded_sig, decoded_payload)
        verified = True
    except Exception:
        verified = False

    return license_key, payload, verified


def interactive_create():
    """Interactive license creation with prompts."""
    print(f"\n{C.CYAN}{'=' * 50}{C.END}")
    print(f"{C.BOLD}  TMS Licentie Generator{C.END}")
    print(f"{C.CYAN}{'=' * 50}{C.END}\n")

    # Private key path
    default_key = './license_private_key.pem'
    key_path = input(f"  Private key pad [{default_key}]: ").strip() or default_key

    # Customer name
    customer = ''
    while not customer:
        customer = input("  Klantnaam: ").strip()
        if not customer:
            print(f"  {C.RED}Klantnaam is verplicht{C.END}")

    # Expiry date
    default_expires = (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d')
    expires = ''
    while not expires:
        expires = input(f"  Verloopdatum (YYYY-MM-DD) [{default_expires}]: ").strip() or default_expires
        try:
            datetime.strptime(expires, '%Y-%m-%d')
        except ValueError:
            print(f"  {C.RED}Ongeldig datumformaat, gebruik YYYY-MM-DD{C.END}")
            expires = ''

    # Max users
    max_users_str = input("  Max gebruikers (0 = onbeperkt) [0]: ").strip() or '0'
    try:
        max_users = int(max_users_str)
    except ValueError:
        max_users = 0

    # Features
    features = input("  Features (komma-gescheiden, bijv: fleet,invoicing,planning): ").strip()

    # Confirmation
    print(f"\n{C.CYAN}─── Overzicht ───{C.END}")
    print(f"  Klant:        {customer}")
    print(f"  Verloopt:     {expires}")
    print(f"  Max users:    {max_users if max_users > 0 else 'Onbeperkt'}")
    print(f"  Features:     {features or '(geen)'}")
    print(f"  Private key:  {key_path}")
    print()

    confirm = input("  Doorgaan? (j/N): ").strip().lower()
    if confirm not in ('j', 'ja', 'y', 'yes'):
        print(f"\n{C.YELLOW}Geannuleerd.{C.END}")
        sys.exit(0)

    # Generate
    print(f"\n{C.CYAN}🔐 Licentie aanmaken...{C.END}\n")
    license_key, payload, verified = create_license(
        private_key_path=key_path,
        customer=customer,
        expires=expires,
        max_users=max_users,
        features=features,
    )

    print(f"{C.GREEN}✅ Licentie succesvol aangemaakt!{C.END}")
    print(f"   Klant:       {payload['customer']}")
    print(f"   Verloopt:    {expires}")
    print(f"   Max users:   {payload['max_users']}")
    print(f"   Features:    {', '.join(payload['features']) if payload['features'] else '(geen)'}")
    print(f"   Geverifieerd: {'✅ Ja' if verified else '❌ Nee'}")

    print(f"\n{C.CYAN}─── LICENTIESLEUTEL (geef aan de klant) ───{C.END}\n")
    print(license_key)
    print(f"\n{C.CYAN}─── EINDE LICENTIESLEUTEL ───{C.END}\n")
    print(f"📋 Lengte: {len(license_key)} tekens")
    print(f"   De klant plakt deze sleutel in het activatiescherm.\n")


# ============================================================================
# CLI
# ============================================================================
def main():
    parser = argparse.ArgumentParser(
        description='TMS License Manager - Standalone license generation tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Voorbeelden:
  %(prog)s generate-keys                          Genereer nieuw keypair
  %(prog)s generate-keys --output /veilige/map     Keypair opslaan in specifieke map
  %(prog)s create-license                          Interactief licentie aanmaken
  %(prog)s create-license --customer "Bedrijf" --expires 2027-01-01
  %(prog)s create-license --customer "Bedrijf" --expires 2027-01-01 --max-users 25 --features "fleet,invoicing"
        """,
    )

    subparsers = parser.add_subparsers(dest='command', help='Beschikbare commando\'s')

    # generate-keys command
    keys_parser = subparsers.add_parser('generate-keys', help='Genereer Ed25519 keypair')
    keys_parser.add_argument('--output', '-o', default='.', help='Uitvoermap (default: huidige map)')

    # create-license command
    license_parser = subparsers.add_parser('create-license', help='Maak een nieuwe licentie aan')
    license_parser.add_argument('--private-key', '-k', default='./license_private_key.pem', help='Pad naar private key')
    license_parser.add_argument('--customer', '-c', help='Klantnaam')
    license_parser.add_argument('--expires', '-e', help='Verloopdatum (YYYY-MM-DD)')
    license_parser.add_argument('--max-users', '-u', type=int, default=0, help='Max gebruikers (0=onbeperkt)')
    license_parser.add_argument('--features', '-f', default='', help='Features (komma-gescheiden)')

    args = parser.parse_args()

    if args.command == 'generate-keys':
        generate_keys(args.output)

    elif args.command == 'create-license':
        # If all required args are given, run non-interactively
        if args.customer and args.expires:
            license_key, payload, verified = create_license(
                private_key_path=args.private_key,
                customer=args.customer,
                expires=args.expires,
                max_users=args.max_users,
                features=args.features,
            )
            print(f"\n{C.GREEN}✅ Licentie aangemaakt!{C.END}")
            print(f"   Klant:       {payload['customer']}")
            print(f"   Verloopt:    {args.expires}")
            print(f"   Max users:   {payload['max_users']}")
            print(f"   Geverifieerd: {'✅ Ja' if verified else '❌ Nee'}")
            print(f"\n{C.CYAN}─── LICENTIESLEUTEL ───{C.END}\n")
            print(license_key)
            print(f"\n{C.CYAN}─── EINDE ───{C.END}\n")
        else:
            interactive_create()

    else:
        parser.print_help()
        print(f"\n{C.YELLOW}Gebruik: {sys.argv[0]} generate-keys | create-license{C.END}\n")


if __name__ == '__main__':
    main()
