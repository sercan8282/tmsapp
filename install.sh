#!/bin/bash
# ===========================================
# TMS Install Script - Docker Production
# Volledig interactief installatiescript
# ===========================================
#
# Dit script:
# 1. Vraagt interactief naar alle configuratie
# 2. Installeert Docker als nodig
# 3. Maakt een service account aan
# 4. Clone de repository
# 5. Configureert alles automatisch
# 6. Start alle containers
# 7. Toont toegangsinformatie
#
# ===========================================

set -e

# Kleuren voor output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Standaard waarden
DEFAULT_REPO_URL="https://github.com/yourusername/tmsapp.git"
DEFAULT_INSTALL_DIR="/opt/tms"
DEFAULT_BRANCH="main"
DEFAULT_DB_NAME="tms_db"
DEFAULT_DB_USER="tms_user"
DEFAULT_SERVICE_USER="tms"

# Log file
LOG_FILE="/var/log/tms-install.log"

# ===========================================
# Helper functies
# ===========================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

print_header() {
    clear
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║   ████████╗███╗   ███╗███████╗                            ║"
    echo "║   ╚══██╔══╝████╗ ████║██╔════╝                            ║"
    echo "║      ██║   ██╔████╔██║███████╗                            ║"
    echo "║      ██║   ██║╚██╔╝██║╚════██║                            ║"
    echo "║      ██║   ██║ ╚═╝ ██║███████║                            ║"
    echo "║      ╚═╝   ╚═╝     ╚═╝╚══════╝                            ║"
    echo "║                                                            ║"
    echo "║   Transport Management System - Installer                  ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
}

print_step() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

prompt_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    local input
    
    if [ -n "$default" ]; then
        read -p "$(echo -e "${GREEN}?${NC} $prompt ${YELLOW}[$default]${NC}: ")" input
        eval "$var_name=\"${input:-$default}\""
    else
        read -p "$(echo -e "${GREEN}?${NC} $prompt: ")" input
        eval "$var_name=\"$input\""
    fi
}

prompt_password() {
    local prompt="$1"
    local var_name="$2"
    local password
    local password2
    
    while true; do
        read -sp "$(echo -e "${GREEN}?${NC} $prompt: ")" password
        echo
        
        if [ ${#password} -lt 8 ]; then
            echo -e "${RED}✗ Wachtwoord moet minimaal 8 karakters zijn${NC}"
            continue
        fi
        
        read -sp "$(echo -e "${GREEN}?${NC} Bevestig wachtwoord: ")" password2
        echo
        
        if [ "$password" = "$password2" ]; then
            eval "$var_name=\"$password\""
            echo -e "${GREEN}✓ Wachtwoord ingesteld${NC}"
            break
        else
            echo -e "${RED}✗ Wachtwoorden komen niet overeen. Probeer opnieuw.${NC}"
        fi
    done
}

prompt_yes_no() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    local input
    
    if [ "$default" = "y" ]; then
        read -p "$(echo -e "${GREEN}?${NC} $prompt ${YELLOW}[Y/n]${NC}: ")" input
        input="${input:-y}"
    else
        read -p "$(echo -e "${GREEN}?${NC} $prompt ${YELLOW}[y/N]${NC}: ")" input
        input="${input:-n}"
    fi
    
    if [[ "$input" =~ ^[Yy] ]]; then
        eval "$var_name=true"
    else
        eval "$var_name=false"
    fi
}

generate_password() {
    openssl rand -base64 32 | tr -d '/+=' | head -c 24
}

generate_secret_key() {
    openssl rand -base64 64 | tr -d '\n'
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}✗ Dit script moet als root worden uitgevoerd${NC}"
        echo ""
        echo "Gebruik: sudo ./install.sh"
        exit 1
    fi
}

check_system() {
    if ! command -v apt-get &> /dev/null; then
        echo -e "${RED}✗ Dit script vereist Ubuntu/Debian (apt-get niet gevonden)${NC}"
        exit 1
    fi
    
    # Check minimum requirements
    local mem_total=$(free -m | awk '/^Mem:/{print $2}')
    local disk_free=$(df -m / | awk 'NR==2{print $4}')
    
    if [ "$mem_total" -lt 1024 ]; then
        echo -e "${YELLOW}⚠ Waarschuwing: Minder dan 1GB RAM beschikbaar ($mem_total MB)${NC}"
    fi
    
    if [ "$disk_free" -lt 5120 ]; then
        echo -e "${YELLOW}⚠ Waarschuwing: Minder dan 5GB schijfruimte beschikbaar ($disk_free MB)${NC}"
    fi
}

# ===========================================
# Installatie functies
# ===========================================

install_docker() {
    print_step "Docker installeren..."
    
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✓ Docker is al geïnstalleerd${NC}"
        docker --version
    else
        echo "Docker installeren..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
        systemctl enable docker
        systemctl start docker
        echo -e "${GREEN}✓ Docker geïnstalleerd${NC}"
    fi
    
    # Check docker compose
    if docker compose version &> /dev/null; then
        echo -e "${GREEN}✓ Docker Compose beschikbaar${NC}"
    else
        echo "Docker Compose plugin installeren..."
        apt-get install -y docker-compose-plugin
    fi
}

create_service_user() {
    print_step "Service account aanmaken..."
    
    if id "$SERVICE_USER" &>/dev/null; then
        echo -e "${YELLOW}! Gebruiker $SERVICE_USER bestaat al${NC}"
    else
        useradd -r -m -s /bin/bash -G docker "$SERVICE_USER"
        echo "$SERVICE_USER:$SERVICE_PASSWORD" | chpasswd
        echo -e "${GREEN}✓ Gebruiker $SERVICE_USER aangemaakt${NC}"
    fi
    
    # Zorg dat gebruiker in docker groep zit
    usermod -aG docker "$SERVICE_USER"
}

clone_repository() {
    print_step "Repository klonen..."
    
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${YELLOW}! Directory $INSTALL_DIR bestaat al${NC}"
        prompt_yes_no "Wil je de bestaande installatie overschrijven?" "n" OVERWRITE
        
        if [ "$OVERWRITE" = "true" ]; then
            rm -rf "$INSTALL_DIR"
        else
            echo "Bestaande code updaten..."
            cd "$INSTALL_DIR"
            git fetch origin
            git checkout "$BRANCH"
            git pull origin "$BRANCH"
            return
        fi
    fi
    
    # Clone public repository (geen authenticatie nodig)
    echo "Repository klonen van $REPO_URL..."
    GIT_TERMINAL_PROMPT=0 git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Kan repository niet klonen. Controleer de URL.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Repository gekloond naar $INSTALL_DIR${NC}"
}

create_env_file() {
    print_step "Configuratiebestand aanmaken..."
    
    cat > "$INSTALL_DIR/.env" << EOF
# ===========================================
# TMS Configuratie
# Gegenereerd op $(date)
# ===========================================

# Domein instellingen
DOMAIN_NAME=$DOMAIN_NAME

# Database instellingen
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Security
SECRET_KEY=$SECRET_KEY

# Admin account
DJANGO_SUPERUSER_EMAIL=$ADMIN_EMAIL
DJANGO_SUPERUSER_PASSWORD=$ADMIN_PASSWORD
EOF

    chmod 600 "$INSTALL_DIR/.env"
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/.env"
    
    echo -e "${GREEN}✓ Configuratiebestand aangemaakt${NC}"
}

set_permissions() {
    print_step "Rechten instellen..."
    
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    chmod -R 755 "$INSTALL_DIR"
    chmod 600 "$INSTALL_DIR/.env"
    
    # Zorg voor juiste rechten op volumes directory
    mkdir -p "$INSTALL_DIR/data"
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/data"
    
    echo -e "${GREEN}✓ Rechten ingesteld voor $SERVICE_USER${NC}"
}

build_and_start() {
    print_step "Containers bouwen en starten..."
    
    cd "$INSTALL_DIR"
    
    # Bouw images
    echo "Images bouwen (dit kan enkele minuten duren)..."
    sudo -u "$SERVICE_USER" docker compose build --no-cache
    
    # Start containers
    echo "Containers starten..."
    sudo -u "$SERVICE_USER" docker compose up -d
    
    # Wacht op database
    echo "Wachten op database..."
    sleep 15
    
    # Run migrations
    echo "Database migraties uitvoeren..."
    sudo -u "$SERVICE_USER" docker compose exec -T backend python manage.py migrate --noinput
    
    # Collectstatic
    echo "Static files verzamelen..."
    sudo -u "$SERVICE_USER" docker compose exec -T backend python manage.py collectstatic --noinput
    
    # Create superuser
    echo "Admin gebruiker aanmaken..."
    sudo -u "$SERVICE_USER" docker compose exec -T backend python manage.py shell << PYTHON_EOF
from apps.accounts.models import User
if not User.objects.filter(email='$ADMIN_EMAIL').exists():
    User.objects.create_superuser(
        email='$ADMIN_EMAIL',
        password='$ADMIN_PASSWORD',
        first_name='Admin',
        last_name='User'
    )
    print('Admin aangemaakt!')
else:
    print('Admin bestaat al.')
PYTHON_EOF

    echo -e "${GREEN}✓ Containers draaien${NC}"
}

configure_firewall() {
    print_step "Firewall configureren..."
    
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    ufw allow 81/tcp comment 'Nginx Proxy Manager'
    ufw allow 9443/tcp comment 'Portainer'
    ufw --force enable
    
    echo -e "${GREEN}✓ Firewall geconfigureerd${NC}"
}

create_maintenance_scripts() {
    print_step "Beheerscripts aanmaken..."
    
    # tms-update script
    cat > /usr/local/bin/tms-update << 'SCRIPT'
#!/bin/bash
cd /opt/tms
GIT_TERMINAL_PROMPT=0 git pull origin main
docker compose build --no-cache
docker compose up -d
docker compose exec -T backend python manage.py migrate --noinput
docker compose exec -T backend python manage.py collectstatic --noinput
echo "TMS succesvol bijgewerkt!"
SCRIPT
    chmod +x /usr/local/bin/tms-update
    
    # tms-backup script
    cat > /usr/local/bin/tms-backup << 'SCRIPT'
#!/bin/bash
BACKUP_DIR="/opt/tms/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Database backup
docker compose -f /opt/tms/docker-compose.yml exec -T db pg_dump -U ${DB_USER:-tms_user} ${DB_NAME:-tms_db} > "$BACKUP_DIR/db_$TIMESTAMP.sql"

# Media backup
docker cp tms_backend:/app/media "$BACKUP_DIR/media_$TIMESTAMP"
tar -czf "$BACKUP_DIR/media_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" "media_$TIMESTAMP"
rm -rf "$BACKUP_DIR/media_$TIMESTAMP"

# Cleanup old backups (keep 7 days)
find "$BACKUP_DIR" -type f -mtime +7 -delete

echo "Backup voltooid: $BACKUP_DIR"
SCRIPT
    chmod +x /usr/local/bin/tms-backup
    
    # tms-logs script
    cat > /usr/local/bin/tms-logs << 'SCRIPT'
#!/bin/bash
cd /opt/tms
docker compose logs -f "$@"
SCRIPT
    chmod +x /usr/local/bin/tms-logs
    
    # tms-restart script
    cat > /usr/local/bin/tms-restart << 'SCRIPT'
#!/bin/bash
cd /opt/tms
docker compose restart "$@"
echo "TMS herstart!"
SCRIPT
    chmod +x /usr/local/bin/tms-restart
    
    # Cron voor backups
    (crontab -l 2>/dev/null | grep -v tms-backup; echo "0 2 * * * /usr/local/bin/tms-backup") | crontab -
    
    echo -e "${GREEN}✓ Beheerscripts aangemaakt${NC}"
}

create_systemd_service() {
    print_step "Systemd service aanmaken..."
    
    cat > /etc/systemd/system/tms.service << EOF
[Unit]
Description=TMS - Transport Management System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable tms
    
    echo -e "${GREEN}✓ TMS start automatisch bij boot${NC}"
}

print_summary() {
    local SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║   ✓ INSTALLATIE VOLTOOID!                                  ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "${BOLD}=== TOEGANGSINFORMATIE ===${NC}"
    echo ""
    echo -e "${CYAN}TMS Applicatie:${NC}"
    if [ "$DOMAIN_NAME" != "localhost" ]; then
        echo "  URL:       https://$DOMAIN_NAME"
    else
        echo "  URL:       http://$SERVER_IP"
    fi
    echo "  Email:     $ADMIN_EMAIL"
    echo "  Wachtwoord: $ADMIN_PASSWORD"
    echo ""
    echo -e "${CYAN}Nginx Proxy Manager (proxy beheer):${NC}"
    echo "  URL:       http://$SERVER_IP:81"
    echo "  Email:     admin@example.com"
    echo "  Wachtwoord: changeme"
    echo -e "  ${YELLOW}⚠ Wijzig dit wachtwoord direct na eerste login!${NC}"
    echo ""
    echo -e "${CYAN}Portainer (container beheer):${NC}"
    echo "  URL:       https://$SERVER_IP:9443"
    echo -e "  ${YELLOW}⚠ Maak een admin account aan bij eerste bezoek${NC}"
    echo ""
    echo -e "${BOLD}=== NGINX PROXY MANAGER SETUP ===${NC}"
    echo ""
    echo "Om SSL en proxy in te stellen:"
    echo "1. Ga naar http://$SERVER_IP:81"
    echo "2. Login met admin@example.com / changeme"
    echo "3. Wijzig je wachtwoord"
    echo "4. Ga naar 'Proxy Hosts' → 'Add Proxy Host'"
    echo "5. Vul in:"
    echo "   - Domain Names: $DOMAIN_NAME"
    echo "   - Scheme: http"
    echo "   - Forward Hostname: tms_frontend"
    echo "   - Forward Port: 80"
    echo "6. Klik 'SSL' tab:"
    echo "   - Request new SSL Certificate"
    echo "   - Force SSL: ✓"
    echo "   - HTTP/2 Support: ✓"
    echo "7. Voeg tweede proxy toe voor API:"
    echo "   - Domain: $DOMAIN_NAME"
    echo "   - Locations: /api → http://tms_backend:8000"
    echo ""
    echo -e "${BOLD}=== SERVICE ACCOUNT ===${NC}"
    echo ""
    echo "  Gebruiker: $SERVICE_USER"
    echo "  Wachtwoord: $SERVICE_PASSWORD"
    echo "  Home:      /home/$SERVICE_USER"
    echo ""
    echo -e "${BOLD}=== BEHEER COMMANDO'S ===${NC}"
    echo ""
    echo "  tms-update    - Update naar laatste versie"
    echo "  tms-backup    - Maak een backup"
    echo "  tms-logs      - Bekijk container logs"
    echo "  tms-restart   - Herstart containers"
    echo ""
    echo -e "${BOLD}=== CONFIGURATIE OPGESLAGEN ===${NC}"
    echo ""
    echo "  Locatie: $INSTALL_DIR/.env"
    echo "  Log:     $LOG_FILE"
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  BELANGRIJK: Bewaar deze gegevens veilig!                  ${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Save summary to file
    cat > "$INSTALL_DIR/INSTALL_INFO.txt" << EOF
===========================================
TMS INSTALLATIE INFORMATIE
Geïnstalleerd op: $(date)
===========================================

TOEGANG
-------
TMS URL: https://$DOMAIN_NAME (of http://$SERVER_IP)
Admin Email: $ADMIN_EMAIL
Admin Wachtwoord: $ADMIN_PASSWORD

Nginx Proxy Manager: http://$SERVER_IP:81
Portainer: https://$SERVER_IP:9443

SERVICE ACCOUNT
---------------
Gebruiker: $SERVICE_USER
Wachtwoord: $SERVICE_PASSWORD

DATABASE
--------
Naam: $DB_NAME
Gebruiker: $DB_USER
Wachtwoord: $DB_PASSWORD

LOCATIES
--------
Installatie: $INSTALL_DIR
Configuratie: $INSTALL_DIR/.env
Backups: $INSTALL_DIR/backups/
Logs: $LOG_FILE

COMMANDO'S
----------
tms-update  - Update applicatie
tms-backup  - Maak backup
tms-logs    - Bekijk logs
tms-restart - Herstart services
EOF
    chmod 600 "$INSTALL_DIR/INSTALL_INFO.txt"
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/INSTALL_INFO.txt"
}

# ===========================================
# Hoofdprogramma
# ===========================================

main() {
    # Start logging
    mkdir -p "$(dirname "$LOG_FILE")"
    log "Installatie gestart"
    
    # Checks
    check_root
    check_system
    
    print_header
    
    echo -e "${BOLD}Welkom bij de TMS installatie!${NC}"
    echo ""
    echo "Dit script zal je door de installatie leiden en vraagt"
    echo "om de benodigde configuratie in te vullen."
    echo ""
    echo -e "${YELLOW}Druk op Enter om te beginnen of Ctrl+C om te annuleren${NC}"
    read
    
    # ===========================================
    # STAP 1: Repository configuratie
    # ===========================================
    print_step "Stap 1/8: Repository configuratie"
    
    prompt_input "GitHub repository URL" "$DEFAULT_REPO_URL" REPO_URL
    prompt_input "Branch" "$DEFAULT_BRANCH" BRANCH
    prompt_input "Installatie directory" "$DEFAULT_INSTALL_DIR" INSTALL_DIR
    
    # ===========================================
    # STAP 2: Domein configuratie
    # ===========================================
    print_step "Stap 2/8: Domein configuratie"
    
    echo "Voer je domeinnaam in (bijv. tms.jouwbedrijf.nl)"
    echo "Gebruik 'localhost' voor lokaal testen zonder SSL"
    echo ""
    prompt_input "Domeinnaam" "localhost" DOMAIN_NAME
    
    # ===========================================
    # STAP 3: Database configuratie
    # ===========================================
    print_step "Stap 3/8: Database configuratie"
    
    prompt_input "Database naam" "$DEFAULT_DB_NAME" DB_NAME
    prompt_input "Database gebruiker" "$DEFAULT_DB_USER" DB_USER
    
    echo ""
    prompt_yes_no "Wil je een wachtwoord laten genereren?" "y" GEN_DB_PASS
    if [ "$GEN_DB_PASS" = "true" ]; then
        DB_PASSWORD=$(generate_password)
        echo -e "${GREEN}✓ Database wachtwoord gegenereerd: ${YELLOW}$DB_PASSWORD${NC}"
    else
        prompt_password "Database wachtwoord (min 8 karakters)" DB_PASSWORD
    fi
    
    # ===========================================
    # STAP 4: Security configuratie
    # ===========================================
    print_step "Stap 4/8: Security configuratie"
    
    echo "De SECRET_KEY wordt gebruikt voor encryptie in Django."
    echo ""
    prompt_yes_no "Wil je een SECRET_KEY laten genereren? (aanbevolen)" "y" GEN_SECRET
    if [ "$GEN_SECRET" = "true" ]; then
        SECRET_KEY=$(generate_secret_key)
        echo -e "${GREEN}✓ Secret key gegenereerd${NC}"
    else
        prompt_input "SECRET_KEY (min 50 karakters)" "" SECRET_KEY
    fi
    
    # ===========================================
    # STAP 5: Service account
    # ===========================================
    print_step "Stap 5/8: Service account configuratie"
    
    echo "Het service account wordt gebruikt om de containers te draaien."
    echo ""
    prompt_input "Service account naam" "$DEFAULT_SERVICE_USER" SERVICE_USER
    
    prompt_yes_no "Wil je een wachtwoord laten genereren?" "y" GEN_SVC_PASS
    if [ "$GEN_SVC_PASS" = "true" ]; then
        SERVICE_PASSWORD=$(generate_password)
        echo -e "${GREEN}✓ Service wachtwoord gegenereerd: ${YELLOW}$SERVICE_PASSWORD${NC}"
    else
        prompt_password "Service account wachtwoord" SERVICE_PASSWORD
    fi
    
    # ===========================================
    # STAP 6: Admin account
    # ===========================================
    print_step "Stap 6/8: TMS Admin account"
    
    echo "Dit is het account waarmee je inlogt op de TMS applicatie."
    echo ""
    prompt_input "Admin email adres" "admin@$DOMAIN_NAME" ADMIN_EMAIL
    
    prompt_yes_no "Wil je een wachtwoord laten genereren?" "y" GEN_ADMIN_PASS
    if [ "$GEN_ADMIN_PASS" = "true" ]; then
        ADMIN_PASSWORD=$(generate_password)
        echo -e "${GREEN}✓ Admin wachtwoord gegenereerd: ${YELLOW}$ADMIN_PASSWORD${NC}"
    else
        prompt_password "Admin wachtwoord (min 8 karakters)" ADMIN_PASSWORD
    fi
    
    # ===========================================
    # BEVESTIGING
    # ===========================================
    print_step "Configuratie overzicht"
    
    echo -e "${CYAN}Repository:${NC}"
    echo "  URL:        $REPO_URL"
    echo "  Branch:     $BRANCH"
    echo "  Directory:  $INSTALL_DIR"
    echo ""
    echo -e "${CYAN}Domein:${NC}"
    echo "  Naam:       $DOMAIN_NAME"
    echo ""
    echo -e "${CYAN}Database:${NC}"
    echo "  Naam:       $DB_NAME"
    echo "  Gebruiker:  $DB_USER"
    echo "  Wachtwoord: ********"
    echo ""
    echo -e "${CYAN}Service Account:${NC}"
    echo "  Gebruiker:  $SERVICE_USER"
    echo "  Wachtwoord: ********"
    echo ""
    echo -e "${CYAN}TMS Admin:${NC}"
    echo "  Email:      $ADMIN_EMAIL"
    echo "  Wachtwoord: ********"
    echo ""
    
    prompt_yes_no "Klopt deze configuratie?" "y" CONFIRM
    
    if [ "$CONFIRM" != "true" ]; then
        echo -e "${YELLOW}Installatie geannuleerd.${NC}"
        exit 0
    fi
    
    # ===========================================
    # INSTALLATIE UITVOEREN
    # ===========================================
    print_step "Stap 7/8: Installatie uitvoeren"
    
    # Update systeem
    echo "Systeem updaten..."
    apt-get update
    apt-get install -y curl git ufw openssl
    
    install_docker
    create_service_user
    clone_repository
    create_env_file
    set_permissions
    build_and_start
    configure_firewall
    create_maintenance_scripts
    create_systemd_service
    
    # ===========================================
    # VOLTOOID
    # ===========================================
    print_step "Stap 8/8: Installatie voltooid"
    
    print_summary
    
    log "Installatie voltooid"
}

# Start
main "$@"
