#!/bin/bash
# ============================================================================
# TMS Licentie Generator
# 
# Interactief script om licenties aan te maken voor klanten.
# Vereist: private key (license_private_key.pem)
# ============================================================================

set -e

# Kleuren
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       ${BOLD}TMS Licentie Generator${NC}${BLUE}                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Bepaal het pad naar de backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Check of backend directory bestaat
if [ ! -d "$BACKEND_DIR" ]; then
    # Misschien draait het script vanuit de backend directory
    if [ -f "manage.py" ]; then
        BACKEND_DIR="."
    else
        echo -e "${RED}❌ Backend directory niet gevonden.${NC}"
        echo "   Draai dit script vanuit de TMS root of backend directory."
        exit 1
    fi
fi

# Check of manage.py bestaat
if [ ! -f "$BACKEND_DIR/manage.py" ]; then
    echo -e "${RED}❌ manage.py niet gevonden in $BACKEND_DIR${NC}"
    exit 1
fi

# ── Private Key ──────────────────────────────────────────────────────────────

DEFAULT_KEY_PATH="$BACKEND_DIR/license_private_key.pem"

echo -e "${CYAN}🔑 Private Key${NC}"

if [ -f "$DEFAULT_KEY_PATH" ]; then
    echo -e "   Gevonden: ${GREEN}$DEFAULT_KEY_PATH${NC}"
    PRIVATE_KEY="$DEFAULT_KEY_PATH"
else
    echo -e "   ${YELLOW}Private key niet gevonden op standaard locatie.${NC}"
    echo ""
    read -p "   Pad naar private key bestand: " PRIVATE_KEY
    
    if [ ! -f "$PRIVATE_KEY" ]; then
        echo -e "${RED}❌ Bestand niet gevonden: $PRIVATE_KEY${NC}"
        echo ""
        echo "   Genereer eerst een keypair met:"
        echo "   cd backend && python manage.py generate_license_keys"
        exit 1
    fi
fi

echo ""

# ── Klantnaam ────────────────────────────────────────────────────────────────

echo -e "${CYAN}👤 Klantgegevens${NC}"
echo ""
read -p "   Klantnaam (bijv. Transport Bedrijf X BV): " CUSTOMER

if [ -z "$CUSTOMER" ]; then
    echo -e "${RED}❌ Klantnaam is verplicht.${NC}"
    exit 1
fi

echo ""

# ── Verloopdatum ─────────────────────────────────────────────────────────────

# Bereken een voorbeeld: 1 jaar vanaf nu
if date --version >/dev/null 2>&1; then
    # GNU date (Linux)
    EXAMPLE_DATE=$(date -d "+1 year" +%Y-%m-%d)
    TODAY=$(date +%Y-%m-%d)
else
    # BSD date (macOS)
    EXAMPLE_DATE=$(date -v+1y +%Y-%m-%d)
    TODAY=$(date +%Y-%m-%d)
fi

echo -e "${CYAN}📅 Verloopdatum${NC}"
echo -e "   Formaat: ${BOLD}JJJJ-MM-DD${NC}"
echo -e "   Vandaag: ${YELLOW}$TODAY${NC}"
echo -e "   Voorbeeld (1 jaar): ${GREEN}$EXAMPLE_DATE${NC}"
echo ""
read -p "   Verloopdatum (bijv. $EXAMPLE_DATE): " EXPIRES

if [ -z "$EXPIRES" ]; then
    echo -e "${RED}❌ Verloopdatum is verplicht.${NC}"
    exit 1
fi

# Valideer datumformaat (basis check)
if ! echo "$EXPIRES" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
    echo -e "${RED}❌ Ongeldig datumformaat. Gebruik JJJJ-MM-DD (bijv. $EXAMPLE_DATE)${NC}"
    exit 1
fi

echo ""

# ── Max Gebruikers ───────────────────────────────────────────────────────────

echo -e "${CYAN}👥 Maximaal aantal gebruikers${NC}"
echo -e "   Voer ${BOLD}0${NC} in voor onbeperkt."
echo ""
read -p "   Max gebruikers [0]: " MAX_USERS

# Default naar 0 als leeg
MAX_USERS=${MAX_USERS:-0}

# Valideer dat het een nummer is
if ! echo "$MAX_USERS" | grep -qE '^[0-9]+$'; then
    echo -e "${RED}❌ Voer een geldig nummer in.${NC}"
    exit 1
fi

echo ""

# ── Features ─────────────────────────────────────────────────────────────────

echo -e "${CYAN}🧩 Features (optioneel)${NC}"
echo -e "   Beschikbare features: planning, invoicing, documents, fleet,"
echo -e "   timetracking, leave, spreadsheets, maintenance, notifications"
echo -e "   Laat leeg voor ${GREEN}alle features${NC}."
echo -e "   Meerdere scheiden met spaties."
echo ""
read -p "   Features (bijv. planning invoicing): " FEATURES_INPUT

echo ""

# ── Bevestiging ──────────────────────────────────────────────────────────────

echo -e "${BLUE}══════════════════════════════════════════════${NC}"
echo -e "${BOLD}   Overzicht licentie:${NC}"
echo -e "${BLUE}══════════════════════════════════════════════${NC}"
echo -e "   Klant:          ${BOLD}$CUSTOMER${NC}"
echo -e "   Verloopdatum:   ${BOLD}$EXPIRES${NC}"
if [ "$MAX_USERS" -eq 0 ]; then
    echo -e "   Max gebruikers: ${BOLD}Onbeperkt${NC}"
else
    echo -e "   Max gebruikers: ${BOLD}$MAX_USERS${NC}"
fi
if [ -z "$FEATURES_INPUT" ]; then
    echo -e "   Features:       ${BOLD}Alle${NC}"
else
    echo -e "   Features:       ${BOLD}$FEATURES_INPUT${NC}"
fi
echo -e "   Private key:    ${BOLD}$PRIVATE_KEY${NC}"
echo -e "${BLUE}══════════════════════════════════════════════${NC}"
echo ""

read -p "   Licentie aanmaken? (j/n) [j]: " CONFIRM
CONFIRM=${CONFIRM:-j}

if [[ "$CONFIRM" != "j" && "$CONFIRM" != "J" && "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo -e "${YELLOW}   Geannuleerd.${NC}"
    exit 0
fi

echo ""

# ── Genereer Licentie ───────────────────────────────────────────────────────

echo -e "${YELLOW}🔐 Licentie wordt gegenereerd...${NC}"
echo ""

# Bouw het commando op
CMD="python $BACKEND_DIR/manage.py generate_license"
CMD="$CMD --customer \"$CUSTOMER\""
CMD="$CMD --expires $EXPIRES"
CMD="$CMD --max-users $MAX_USERS"
CMD="$CMD --private-key \"$PRIVATE_KEY\""

if [ -n "$FEATURES_INPUT" ]; then
    CMD="$CMD --features $FEATURES_INPUT"
fi

# Draai het commando
eval $CMD

echo ""
echo -e "${GREEN}✅ Klaar! Geef de licentiesleutel hierboven aan de klant.${NC}"
echo ""
