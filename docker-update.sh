#!/bin/bash
# ===========================================
# TMS Docker Update Script
# ===========================================
# Simpel script om TMS te updaten.
# Secrets blijven automatisch behouden.
# ===========================================

set -e

# Configuratie
TMS_DIR="/var/www/tmsapp"
SECRETS_DIR="/opt/tms/secrets"
ENV_FILE="$SECRETS_DIR/.env"
BACKUP_DIR="/opt/tms/backups"

# Kleuren
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check root
if [ "$EUID" -ne 0 ]; then
    log_error "Dit script moet als root worden uitgevoerd (gebruik sudo)"
    exit 1
fi

# Check of secrets bestaan
if [ ! -f "$ENV_FILE" ]; then
    log_error "Geen secrets gevonden in $ENV_FILE"
    log_error "Voer eerst ./docker-install.sh uit voor een nieuwe installatie"
    exit 1
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  TMS Update                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Backup database
log_info "Database backup maken..."
mkdir -p "$BACKUP_DIR"
cd "$TMS_DIR"
docker compose exec -T db pg_dump -U tms_user tms_db > "$BACKUP_DIR/db-pre-update-$(date +%Y%m%d%H%M%S).sql" 2>/dev/null || log_info "Geen database om te backuppen"

# Pull latest code
log_info "Laatste code ophalen..."
git fetch origin
git reset --hard origin/main
git pull origin main
log_success "Code bijgewerkt"

# Ensure symlink exists
if [ ! -L "$TMS_DIR/.env" ]; then
    ln -sf "$ENV_FILE" "$TMS_DIR/.env"
    log_success "Environment symlink hersteld"
fi

# Rebuild en restart
log_info "Containers herbouwen en herstarten..."
docker compose down --remove-orphans
docker compose up -d --build

# Wacht even
log_info "Wachten tot services starten..."
sleep 10

# Status
echo ""
docker compose ps
echo ""

log_success "Update voltooid!"
echo ""
echo "Controleer de applicatie op je domein."
echo ""
