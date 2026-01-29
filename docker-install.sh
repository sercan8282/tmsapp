#!/bin/bash
# ===========================================
# TMS Docker Installation Script
# ===========================================
# Dit script installeert TMS volledig via Docker
# Secrets worden opgeslagen in /opt/tms/secrets/.env
# en blijven behouden bij updates.
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
CYAN='\033[0;36m'
NC='\033[0m'

# Banner
show_banner() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║   ████████╗███╗   ███╗███████╗                            ║"
    echo "║      ██╔══╝████╗ ████║██╔════╝                            ║"
    echo "║      ██║   ██╔████╔██║███████╗                            ║"
    echo "║      ██║   ██║╚██╔╝██║╚════██║                            ║"
    echo "║      ██║   ██║ ╚═╝ ██║███████║                            ║"
    echo "║      ╚═╝   ╚═╝     ╚═╝╚══════╝                            ║"
    echo "║                                                            ║"
    echo "║   Transport Management System - Docker Installer           ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check of we root zijn
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Dit script moet als root worden uitgevoerd (gebruik sudo)"
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    log_info "Controleren van dependencies..."
    
    # Docker
    if ! command -v docker &> /dev/null; then
        log_warning "Docker niet gevonden. Installeren..."
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
        log_success "Docker geïnstalleerd"
    else
        log_success "Docker gevonden: $(docker --version)"
    fi
    
    # Docker Compose (v2 is ingebouwd in docker)
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose niet gevonden"
        exit 1
    fi
    log_success "Docker Compose gevonden: $(docker compose version --short)"
    
    # Git
    if ! command -v git &> /dev/null; then
        log_warning "Git niet gevonden. Installeren..."
        apt-get update && apt-get install -y git
        log_success "Git geïnstalleerd"
    else
        log_success "Git gevonden: $(git --version)"
    fi
}

# Genereer random string
generate_secret() {
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64
}

# Initialiseer secrets (alleen bij eerste installatie)
init_secrets() {
    log_info "Secrets configuratie controleren..."
    
    # Maak secrets directory
    mkdir -p "$SECRETS_DIR"
    chmod 700 "$SECRETS_DIR"
    
    if [ -f "$ENV_FILE" ]; then
        log_success "Bestaande secrets gevonden in $ENV_FILE"
        # Valideer dat alle verplichte keys aanwezig zijn
        if ! grep -q "DB_PASSWORD=" "$ENV_FILE" || ! grep -q "SECRET_KEY=" "$ENV_FILE"; then
            log_warning "Secrets bestand onvolledig, ontbrekende keys worden toegevoegd..."
            
            if ! grep -q "DB_PASSWORD=" "$ENV_FILE"; then
                echo "DB_PASSWORD=$(generate_secret)" >> "$ENV_FILE"
                log_info "DB_PASSWORD toegevoegd"
            fi
            
            if ! grep -q "SECRET_KEY=" "$ENV_FILE"; then
                echo "SECRET_KEY=$(generate_secret)" >> "$ENV_FILE"
                log_info "SECRET_KEY toegevoegd"
            fi
        fi
        return 0
    fi
    
    log_info "Nieuwe secrets genereren..."
    
    # Vraag om domain naam
    echo ""
    read -p "Voer je domain naam in (bijv. moveo-bv.nl) of druk Enter voor localhost: " DOMAIN_INPUT
    DOMAIN_NAME="${DOMAIN_INPUT:-localhost}"
    
    # Genereer secrets
    DB_PASSWORD=$(generate_secret)
    SECRET_KEY=$(generate_secret)
    
    # Schrijf .env bestand
    cat > "$ENV_FILE" << EOF
# ===========================================
# TMS Environment Configuration
# Gegenereerd op: $(date)
# ===========================================
# WAARSCHUWING: Dit bestand bevat gevoelige informatie!
# Deel deze gegevens NOOIT en commit ze NIET naar git.
# ===========================================

# Database
DB_NAME=tms_db
DB_USER=tms_user
DB_PASSWORD=$DB_PASSWORD

# Django
SECRET_KEY=$SECRET_KEY

# Domain (voor CORS en allowed hosts)
DOMAIN_NAME=$DOMAIN_NAME
EOF

    chmod 600 "$ENV_FILE"
    log_success "Secrets gegenereerd en opgeslagen in $ENV_FILE"
    
    echo ""
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  BELANGRIJK: Noteer deze gegevens op een veilige plek!     ║${NC}"
    echo -e "${YELLOW}╠════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}║${NC}  Database wachtwoord: ${CYAN}$DB_PASSWORD${NC}"
    echo -e "${YELLOW}║${NC}  Secret key: ${CYAN}${SECRET_KEY:0:20}...${NC}"
    echo -e "${YELLOW}║${NC}  Domain: ${CYAN}$DOMAIN_NAME${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Symlink .env naar project directory
link_env_file() {
    log_info "Environment file linken..."
    
    # Verwijder bestaande .env als het geen symlink is
    if [ -f "$TMS_DIR/.env" ] && [ ! -L "$TMS_DIR/.env" ]; then
        log_warning "Bestaand .env bestand gevonden, backup maken..."
        mv "$TMS_DIR/.env" "$TMS_DIR/.env.backup.$(date +%Y%m%d%H%M%S)"
    fi
    
    # Maak symlink
    ln -sf "$ENV_FILE" "$TMS_DIR/.env"
    log_success "Symlink aangemaakt: $TMS_DIR/.env -> $ENV_FILE"
}

# Clone of update repository
setup_repository() {
    log_info "Repository configureren..."
    
    if [ -d "$TMS_DIR/.git" ]; then
        log_info "Bestaande installatie gevonden, updaten..."
        cd "$TMS_DIR"
        git fetch origin
        git reset --hard origin/main
        git pull origin main
        log_success "Repository bijgewerkt"
    else
        log_info "Nieuwe installatie, repository clonen..."
        mkdir -p "$(dirname $TMS_DIR)"
        
        if [ -d "$TMS_DIR" ]; then
            rm -rf "$TMS_DIR"
        fi
        
        git clone https://github.com/sercan8282/tmsapp.git "$TMS_DIR"
        cd "$TMS_DIR"
        log_success "Repository gecloned"
    fi
}

# Build en start containers
start_containers() {
    log_info "Docker containers bouwen en starten..."
    
    cd "$TMS_DIR"
    
    # Stop bestaande containers
    docker compose down --remove-orphans 2>/dev/null || true
    
    # Build en start
    docker compose up -d --build
    
    log_success "Containers gestart"
    
    # Wacht tot alles healthy is
    log_info "Wachten tot services healthy zijn..."
    sleep 10
    
    # Check status
    echo ""
    docker compose ps
}

# Maak superuser aan
create_superuser() {
    log_info "Controleren of superuser bestaat..."
    
    # Wacht tot backend ready is
    sleep 5
    
    # Check of er al users zijn
    USER_COUNT=$(docker compose exec -T backend python manage.py shell -c "from apps.accounts.models import User; print(User.objects.filter(is_superuser=True).count())" 2>/dev/null || echo "0")
    
    if [ "$USER_COUNT" = "0" ]; then
        echo ""
        log_info "Geen superuser gevonden. Aanmaken..."
        read -p "Admin email: " ADMIN_EMAIL
        read -p "Admin voornaam: " ADMIN_VOORNAAM
        read -p "Admin achternaam: " ADMIN_ACHTERNAAM
        read -s -p "Admin wachtwoord: " ADMIN_PASSWORD
        echo ""
        
        # Sla admin email op in secrets file voor latere referentie
        echo "" >> "$ENV_FILE"
        echo "# Admin gebruiker (aangemaakt tijdens installatie)" >> "$ENV_FILE"
        echo "ADMIN_EMAIL=$ADMIN_EMAIL" >> "$ENV_FILE"
        
        docker compose exec -T backend python manage.py shell << EOF
from apps.accounts.models import User
User.objects.create_superuser(
    email='$ADMIN_EMAIL',
    username='$ADMIN_EMAIL'.split('@')[0],
    password='$ADMIN_PASSWORD',
    voornaam='$ADMIN_VOORNAAM',
    achternaam='$ADMIN_ACHTERNAAM'
)
print('Superuser aangemaakt!')
EOF
        log_success "Superuser aangemaakt: $ADMIN_EMAIL"
        
        # Export voor show_completion functie
        export CREATED_ADMIN_EMAIL="$ADMIN_EMAIL"
    else
        log_success "Superuser bestaat al"
    fi
}

# Toon status en info
show_completion() {
    # Haal domain op uit env
    source "$ENV_FILE"
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║   ✓ TMS Installatie Voltooid!                             ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Services:${NC}"
    echo "  • TMS App:        https://$DOMAIN_NAME (na NPM configuratie)"
    echo "  • NPM Admin:      http://$(hostname -I | awk '{print $1}'):81"
    echo "  • Portainer:      https://$(hostname -I | awk '{print $1}'):9443"
    echo ""
    echo -e "${CYAN}TMS Admin Login:${NC}"
    if [ -n "$CREATED_ADMIN_EMAIL" ]; then
        echo "  • Email:    $CREATED_ADMIN_EMAIL"
        echo "  • Password: (het wachtwoord dat je zojuist hebt ingevoerd)"
    elif [ -n "$ADMIN_EMAIL" ]; then
        echo "  • Email:    $ADMIN_EMAIL"
        echo "  • Password: (opgeslagen tijdens installatie)"
    else
        echo "  • (Superuser bestond al)"
    fi
    echo ""
    echo -e "${CYAN}NPM Standaard login:${NC}"
    echo "  • Email:    admin@example.com"
    echo "  • Password: changeme"
    echo ""
    echo -e "${CYAN}Database:${NC}"
    echo "  • Gebruiker:   $DB_USER"
    echo "  • Database:    $DB_NAME"
    echo "  • Wachtwoord:  $DB_PASSWORD"
    echo ""
    echo -e "${CYAN}Bestanden:${NC}"
    echo "  • Secrets:     $ENV_FILE"
    echo "  • Project:     $TMS_DIR"
    echo ""
    echo -e "${CYAN}Beheer commando's:${NC}"
    echo "  • Status:      cd $TMS_DIR && docker compose ps"
    echo "  • Logs:        cd $TMS_DIR && docker compose logs -f"
    echo "  • Herstarten:  cd $TMS_DIR && docker compose restart"
    echo "  • Update:      cd $TMS_DIR && sudo ./docker-update.sh"
    echo ""
    echo -e "${CYAN}AI Factuur Extractie:${NC}"
    echo "  OCR is automatisch ingeschakeld (Tesseract + Poppler)."
    echo "  Voor AI-powered extractie (optioneel):"
    echo "    1. Log in als admin"
    echo "    2. Ga naar Instellingen → AI Extractie"
    echo "    3. Configureer GitHub Models (GRATIS), OpenAI of Azure OpenAI"
    echo ""
}

# Backup functie
create_backup() {
    log_info "Backup maken..."
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_FILE="$BACKUP_DIR/tms-backup-$(date +%Y%m%d%H%M%S).tar.gz"
    
    # Backup database
    docker compose exec -T db pg_dump -U tms_user tms_db > "$BACKUP_DIR/db-$(date +%Y%m%d%H%M%S).sql" 2>/dev/null || true
    
    # Backup secrets
    cp "$ENV_FILE" "$BACKUP_DIR/.env.backup" 2>/dev/null || true
    
    log_success "Backup gemaakt in $BACKUP_DIR"
}

# Main installatie flow
main() {
    show_banner
    check_root
    check_dependencies
    
    # Keuze menu
    echo ""
    echo "Wat wil je doen?"
    echo "  1) Nieuwe installatie"
    echo "  2) Update bestaande installatie"
    echo "  3) Alleen secrets opnieuw genereren"
    echo "  4) Backup maken"
    echo ""
    read -p "Keuze [1-4]: " CHOICE
    
    case $CHOICE in
        1)
            init_secrets
            setup_repository
            link_env_file
            start_containers
            create_superuser
            show_completion
            ;;
        2)
            if [ ! -f "$ENV_FILE" ]; then
                log_error "Geen secrets gevonden. Voer eerst een nieuwe installatie uit."
                exit 1
            fi
            create_backup
            setup_repository
            link_env_file
            start_containers
            show_completion
            ;;
        3)
            rm -f "$ENV_FILE"
            init_secrets
            log_success "Secrets opnieuw gegenereerd"
            ;;
        4)
            cd "$TMS_DIR" 2>/dev/null || true
            create_backup
            ;;
        *)
            log_error "Ongeldige keuze"
            exit 1
            ;;
    esac
}

# Start
main "$@"
