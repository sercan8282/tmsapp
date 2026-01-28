#!/bin/bash
# ===========================================
# TMS Production Install Script
# Secure deployment with SSL, firewall, fail2ban
# ===========================================

set -e

# Kleuren
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Defaults
INSTALL_DIR="/opt/tms"
SERVICE_USER="tms"
DOMAIN=""
REPO_URL=""
DB_PASSWORD=""
SECRET_KEY=""

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║     TMS - Production Installation Script                   ║"
    echo "║     Version: 1.0 | Security Hardened                       ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✖ $1${NC}"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root"
        exit 1
    fi
}

check_ubuntu_version() {
    print_step "Checking Ubuntu version..."
    
    if [ ! -f /etc/os-release ]; then
        print_error "Cannot detect OS. This script requires Ubuntu."
        exit 1
    fi
    
    . /etc/os-release
    
    if [ "$ID" != "ubuntu" ]; then
        print_error "This script requires Ubuntu. Detected: $ID"
        exit 1
    fi
    
    # Get version number
    VERSION_NUM=$(echo "$VERSION_ID" | cut -d. -f1)
    
    # List of supported LTS versions
    case "$VERSION_ID" in
        "22.04"|"24.04")
            echo "  Ubuntu $VERSION_ID LTS detected ✓"
            ;;
        "20.04")
            print_warning "Ubuntu 20.04 LTS detected. Consider upgrading to 22.04 or 24.04."
            read -p "Continue anyway? (y/n): " continue_old
            if [ "$continue_old" != "y" ]; then
                exit 0
            fi
            ;;
        "23.04"|"23.10"|"24.10")
            print_error "Ubuntu $VERSION_ID is a non-LTS release and has reached End of Life."
            echo ""
            echo "  Non-LTS releases are only supported for 9 months."
            echo "  Your repositories are no longer available."
            echo ""
            echo "  Options:"
            echo "  1. Upgrade to Ubuntu 24.04 LTS (recommended)"
            echo "     sudo do-release-upgrade -d"
            echo ""
            echo "  2. Fresh install with Ubuntu 22.04 LTS or 24.04 LTS"
            echo ""
            echo "  LTS releases are supported for 5 years."
            exit 1
            ;;
        *)
            if [ "$VERSION_NUM" -lt 20 ]; then
                print_error "Ubuntu $VERSION_ID is too old. Minimum required: 20.04 LTS"
                exit 1
            else
                print_warning "Ubuntu $VERSION_ID detected. LTS versions (22.04, 24.04) are recommended."
                read -p "Continue anyway? (y/n): " continue_unknown
                if [ "$continue_unknown" != "y" ]; then
                    exit 0
                fi
            fi
            ;;
    esac
}

generate_password() {
    openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32
}

# Interactive prompts
get_user_input() {
    print_step "Configuration"
    
    read -p "Domain name (e.g., tms.example.com): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        print_error "Domain is required"
        exit 1
    fi
    
    read -p "Git repository URL: " REPO_URL
    if [ -z "$REPO_URL" ]; then
        print_error "Repository URL is required"
        exit 1
    fi
    
    read -p "Admin email for SSL certificates: " ADMIN_EMAIL
    if [ -z "$ADMIN_EMAIL" ]; then
        print_error "Admin email is required"
        exit 1
    fi
    
    # Generate secure passwords
    DB_PASSWORD=$(generate_password)
    SECRET_KEY=$(generate_password)
    
    echo ""
    echo "Configuration:"
    echo "  Domain:       $DOMAIN"
    echo "  Install Dir:  $INSTALL_DIR"
    echo "  Service User: $SERVICE_USER"
    echo ""
    read -p "Continue with installation? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "Installation cancelled"
        exit 0
    fi
}

# System updates and dependencies
install_dependencies() {
    print_step "Installing system dependencies..."
    
    apt-get update
    apt-get upgrade -y
    
    apt-get install -y \
        python3.11 \
        python3.11-venv \
        python3.11-dev \
        python3-pip \
        postgresql \
        postgresql-contrib \
        redis-server \
        nginx \
        certbot \
        python3-certbot-nginx \
        supervisor \
        git \
        curl \
        ufw \
        fail2ban \
        unattended-upgrades \
        libpq-dev \
        build-essential \
        libffi-dev \
        libssl-dev
    
    # Node.js 20 LTS
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
}

# Security: Firewall setup
configure_firewall() {
    print_step "Configuring firewall (UFW)..."
    
    ufw default deny incoming
    ufw default allow outgoing
    
    # SSH (rate limited)
    ufw limit ssh
    
    # HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Enable firewall
    echo "y" | ufw enable
    ufw status
}

# Security: Fail2ban setup
configure_fail2ban() {
    print_step "Configuring Fail2ban..."
    
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = auto

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 5

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10

[tms-login]
enabled = true
port = http,https
filter = tms-login
logpath = /opt/tms/backend/logs/security.log
maxretry = 5
bantime = 1800
EOF

    # Custom TMS login filter
    cat > /etc/fail2ban/filter.d/tms-login.conf << 'EOF'
[Definition]
failregex = ^.*Failed login attempt.*IP: <HOST>.*$
            ^.*Rate limit exceeded.*IP: <HOST>.*$
            ^.*Failed MFA verification.*IP: <HOST>.*$
ignoreregex =
EOF

    systemctl enable fail2ban
    systemctl restart fail2ban
}

# Security: Automatic updates
configure_auto_updates() {
    print_step "Configuring automatic security updates..."
    
    cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

    systemctl enable unattended-upgrades
}

# Create service user
create_service_user() {
    print_step "Creating service user: $SERVICE_USER"
    
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd -r -m -s /bin/bash "$SERVICE_USER"
    fi
}

# PostgreSQL setup
setup_database() {
    print_step "Setting up PostgreSQL database..."
    
    # Configure PostgreSQL for security
    sudo -u postgres psql << EOF
CREATE USER tms_user WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE tms_db OWNER tms_user;
ALTER USER tms_user SET client_encoding TO 'utf8';
ALTER USER tms_user SET default_transaction_isolation TO 'read committed';
ALTER USER tms_user SET timezone TO 'Europe/Amsterdam';
GRANT ALL PRIVILEGES ON DATABASE tms_db TO tms_user;
EOF

    # Secure PostgreSQL
    PG_HBA=$(find /etc/postgresql -name pg_hba.conf | head -1)
    if [ -f "$PG_HBA" ]; then
        # Only allow local connections
        sed -i 's/host    all             all             127.0.0.1\/32            md5/host    all             all             127.0.0.1\/32            scram-sha-256/' "$PG_HBA"
    fi
    
    systemctl restart postgresql
}

# Clone and setup application
setup_application() {
    print_step "Cloning and setting up application..."
    
    # Clone repository
    git clone "$REPO_URL" "$INSTALL_DIR"
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    
    cd "$INSTALL_DIR"
    
    # Create environment file with secure permissions
    cat > "$INSTALL_DIR/backend/.env" << EOF
# Django Settings
SECRET_KEY=$SECRET_KEY
DEBUG=False
ALLOWED_HOSTS=$DOMAIN,www.$DOMAIN
DJANGO_SETTINGS_MODULE=tms.settings.production

# Database
DB_NAME=tms_db
DB_USER=tms_user
DB_PASSWORD=$DB_PASSWORD
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379/1

# Security
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

# CORS
CORS_ALLOWED_ORIGINS=https://$DOMAIN

# Logging
LOG_DIR=/opt/tms/backend/logs
EOF

    # Secure the env file
    chmod 600 "$INSTALL_DIR/backend/.env"
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/backend/.env"
    
    # Backend setup
    cd "$INSTALL_DIR/backend"
    sudo -u "$SERVICE_USER" python3.11 -m venv venv
    sudo -u "$SERVICE_USER" ./venv/bin/pip install --upgrade pip
    sudo -u "$SERVICE_USER" ./venv/bin/pip install -r requirements/production.txt
    
    # Create logs directory
    mkdir -p logs
    chown "$SERVICE_USER:$SERVICE_USER" logs
    chmod 755 logs
    
    # Run migrations
    sudo -u "$SERVICE_USER" ./venv/bin/python manage.py migrate --noinput
    sudo -u "$SERVICE_USER" ./venv/bin/python manage.py collectstatic --noinput
    
    # Frontend setup
    cd "$INSTALL_DIR/frontend"
    sudo -u "$SERVICE_USER" npm ci
    sudo -u "$SERVICE_USER" npm run build
}

# Nginx configuration
configure_nginx() {
    print_step "Configuring Nginx with security headers..."
    
    cat > /etc/nginx/sites-available/tms << EOF
# Rate limiting zone
limit_req_zone \$binary_remote_addr zone=tms_limit:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_conn_zone \$binary_remote_addr zone=conn_limit:10m;

# Upstream for gunicorn
upstream tms_backend {
    server 127.0.0.1:8000 fail_timeout=0;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Allow certbot challenges
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL configuration (will be updated by certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self';" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    
    # Connection limits
    limit_conn conn_limit 20;
    
    # Client body size (for file uploads)
    client_max_body_size 10M;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;
    
    # Static files (frontend build)
    location / {
        root $INSTALL_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API requests
    location /api {
        limit_req zone=api_limit burst=50 nodelay;
        
        proxy_pass http://tms_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Django admin (extra rate limiting)
    location /admin {
        limit_req zone=tms_limit burst=5 nodelay;
        
        proxy_pass http://tms_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Media files
    location /media {
        alias $INSTALL_DIR/backend/media;
        
        # Prevent script execution in uploads
        location ~* \.(php|py|pl|cgi|sh|asp|aspx|jsp)$ {
            deny all;
        }
    }
    
    # Static files (Django)
    location /static {
        alias $INSTALL_DIR/backend/staticfiles;
    }
    
    # Block common attack patterns
    location ~* /(\.git|\.env|\.htaccess|\.htpasswd|wp-admin|wp-login|phpmyadmin) {
        deny all;
        return 404;
    }
    
    # Block file extensions
    location ~* \.(bak|config|sql|fla|psd|ini|log|sh|swp|dist)$ {
        deny all;
        return 404;
    }
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/tms /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    nginx -t
}

# Supervisor configuration
configure_supervisor() {
    print_step "Configuring Supervisor for process management..."
    
    cat > /etc/supervisor/conf.d/tms.conf << EOF
[program:tms]
command=$INSTALL_DIR/backend/venv/bin/gunicorn tms.wsgi:application -b 127.0.0.1:8000 -w 4 --max-requests 1000 --max-requests-jitter 50 --timeout 30 --graceful-timeout 10 --keep-alive 5
directory=$INSTALL_DIR/backend
user=$SERVICE_USER
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/tms/gunicorn.log
stderr_logfile=/var/log/tms/gunicorn-error.log
environment=DJANGO_SETTINGS_MODULE="tms.settings.production"
EOF

    mkdir -p /var/log/tms
    chown "$SERVICE_USER:$SERVICE_USER" /var/log/tms
    
    supervisorctl reread
    supervisorctl update
}

# SSL certificate setup
setup_ssl() {
    print_step "Setting up SSL certificate with Let's Encrypt..."
    
    # Create webroot for certbot
    mkdir -p /var/www/certbot
    
    # Get certificate
    certbot certonly --webroot -w /var/www/certbot \
        -d "$DOMAIN" -d "www.$DOMAIN" \
        --email "$ADMIN_EMAIL" \
        --agree-tos \
        --non-interactive
    
    # Setup auto-renewal
    systemctl enable certbot.timer
    
    # Restart nginx with SSL
    systemctl restart nginx
}

# Final security hardening
final_hardening() {
    print_step "Final security hardening..."
    
    # Secure SSH
    sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
    sed -i 's/#MaxAuthTries 6/MaxAuthTries 3/' /etc/ssh/sshd_config
    sed -i 's/#LoginGraceTime 2m/LoginGraceTime 60/' /etc/ssh/sshd_config
    
    # Disable unused network protocols
    echo "net.ipv6.conf.all.disable_ipv6 = 1" >> /etc/sysctl.conf 2>/dev/null || true
    echo "net.ipv4.conf.all.rp_filter = 1" >> /etc/sysctl.conf
    echo "net.ipv4.conf.default.rp_filter = 1" >> /etc/sysctl.conf
    echo "net.ipv4.icmp_echo_ignore_broadcasts = 1" >> /etc/sysctl.conf
    echo "net.ipv4.conf.all.accept_source_route = 0" >> /etc/sysctl.conf
    echo "net.ipv4.conf.default.accept_source_route = 0" >> /etc/sysctl.conf
    echo "net.ipv4.tcp_syncookies = 1" >> /etc/sysctl.conf
    sysctl -p 2>/dev/null || true
    
    # Set proper permissions
    chmod 750 "$INSTALL_DIR"
    chmod 640 "$INSTALL_DIR/backend/.env"
    
    # Secure logs
    chmod 750 "$INSTALL_DIR/backend/logs"
    
    # Secure media uploads directory
    chmod 750 "$INSTALL_DIR/backend/media"
    
    # Remove world-readable permissions from sensitive files
    find "$INSTALL_DIR/backend" -name "*.py" -exec chmod 640 {} \;
    find "$INSTALL_DIR/backend" -name "*.json" -exec chmod 640 {} \;
    
    systemctl restart sshd
}

# Save credentials
save_credentials() {
    print_step "Saving credentials..."
    
    CREDS_FILE="$INSTALL_DIR/CREDENTIALS.txt"
    
    cat > "$CREDS_FILE" << EOF
╔════════════════════════════════════════════════════════════╗
║               TMS Installation Credentials                 ║
║           KEEP THIS FILE SECURE - DELETE AFTER BACKUP      ║
╚════════════════════════════════════════════════════════════╝

Domain: https://$DOMAIN

Database:
  Name:     tms_db
  User:     tms_user
  Password: $DB_PASSWORD

Django Secret Key: $SECRET_KEY

Installation Directory: $INSTALL_DIR
Service User: $SERVICE_USER

Next Steps:
1. Create admin user:
   sudo -u $SERVICE_USER $INSTALL_DIR/backend/venv/bin/python manage.py createsuperuser

2. Configure SMTP settings in web interface:
   Instellingen → E-mail

3. IMPORTANT: Backup and then DELETE this file!
   cp $CREDS_FILE ~/tms-credentials-backup.txt
   rm $CREDS_FILE

4. Setup regular backups for:
   - PostgreSQL database: pg_dump tms_db
   - Media folder: $INSTALL_DIR/backend/media/
   - Environment file: $INSTALL_DIR/backend/.env

5. Consider setting up:
   - Monitoring (e.g., Uptime Robot for health endpoint)
   - Log rotation (logrotate)
   - Database backups (cron + pg_dump)

Security Checklist:
   [ ] Delete this credentials file
   [ ] Test SSL certificate: https://www.ssllabs.com/ssltest/
   [ ] Verify firewall: ufw status
   [ ] Check fail2ban: fail2ban-client status
   [ ] Test health endpoint: curl https://$DOMAIN/api/health/

EOF

    chmod 600 "$CREDS_FILE"
    chown root:root "$CREDS_FILE"
}

# Main installation
main() {
    print_header
    check_root
    check_ubuntu_version
    get_user_input
    
    install_dependencies
    configure_firewall
    configure_fail2ban
    configure_auto_updates
    create_service_user
    setup_database
    setup_application
    configure_nginx
    configure_supervisor
    
    # Start services first (for certbot)
    systemctl start nginx
    supervisorctl start tms
    
    # Setup SSL
    setup_ssl
    
    final_hardening
    save_credentials
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           Installation Complete!                           ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Your TMS application is now running at: https://$DOMAIN"
    echo ""
    echo -e "${YELLOW}IMPORTANT: Read $INSTALL_DIR/CREDENTIALS.txt for login details${NC}"
    echo -e "${YELLOW}           Then delete it after backing up!${NC}"
    echo ""
    echo "Service management:"
    echo "  supervisorctl status tms"
    echo "  supervisorctl restart tms"
    echo "  systemctl status nginx"
    echo ""
}

main "$@"
