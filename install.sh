#!/bin/bash
# ===========================================
# TMS Install Script (Docker) - Production
# Haalt de repo op en installeert alles
# ===========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="${REPO_URL:-https://github.com/yourusername/tmsapp.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/tms}"
BRANCH="${BRANCH:-main}"

echo -e "${BLUE}"
echo "============================================="
echo "   TMS - Transport Management System"
echo "   Docker Production Install Script"
echo "============================================="
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Usage: sudo ./install.sh"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Function to prompt for input
prompt_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    read -p "$prompt [$default]: " input
    eval "$var_name=\"${input:-$default}\""
}

# Function to prompt for password (hidden)
prompt_password() {
    local prompt="$1"
    local var_name="$2"
    
    while true; do
        read -sp "$prompt: " password
        echo
        read -sp "Confirm password: " password2
        echo
        
        if [ "$password" = "$password2" ]; then
            eval "$var_name=\"$password\""
            break
        else
            echo -e "${RED}Passwords do not match. Try again.${NC}"
        fi
    done
}

echo -e "${YELLOW}Step 1: Checking system requirements...${NC}"

# Check for Ubuntu/Debian
if ! command_exists apt-get; then
    echo -e "${RED}Error: This script requires Ubuntu/Debian (apt-get not found)${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 2: Installing system dependencies...${NC}"

# Update system
apt-get update
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

# Install Docker if not present
if ! command_exists docker; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose if not present
if ! command_exists docker-compose && ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    apt-get install -y docker-compose-plugin
fi

echo -e "${GREEN}Docker installed successfully!${NC}"
docker --version

echo -e "${YELLOW}Step 3: Cloning repository...${NC}"

# Clone or update repository
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Directory exists. Pulling latest changes...${NC}"
    cd "$INSTALL_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
else
    echo -e "${YELLOW}Cloning repository...${NC}"
    git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo -e "${YELLOW}Step 4: Configuring environment...${NC}"

# Create .env file if it doesn't exist
if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo ""
    echo -e "${BLUE}=== Environment Configuration ===${NC}"
    echo ""
    
    # Domain configuration
    prompt_input "Enter your domain name (e.g., tms.example.com)" "localhost" DOMAIN_NAME
    
    # Database configuration
    prompt_input "Database name" "tms_db" DB_NAME
    prompt_input "Database user" "tms_user" DB_USER
    prompt_password "Database password (min 12 characters)" DB_PASSWORD
    
    # Generate secret key
    SECRET_KEY=$(openssl rand -base64 64 | tr -d '\n')
    
    # Django superuser
    echo ""
    echo -e "${BLUE}=== Initial Admin Account ===${NC}"
    prompt_input "Admin email" "admin@example.com" ADMIN_EMAIL
    prompt_password "Admin password" ADMIN_PASSWORD
    
    # Create .env file
    cat > "$INSTALL_DIR/.env" << EOF
# ===========================================
# TMS Production Environment Configuration
# Generated on $(date)
# ===========================================

# Domain
DOMAIN_NAME=$DOMAIN_NAME

# Database
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Security
SECRET_KEY=$SECRET_KEY

# Initial Admin
DJANGO_SUPERUSER_EMAIL=$ADMIN_EMAIL
DJANGO_SUPERUSER_PASSWORD=$ADMIN_PASSWORD
EOF

    chmod 600 "$INSTALL_DIR/.env"
    echo -e "${GREEN}Environment file created!${NC}"
else
    echo -e "${YELLOW}Using existing .env file${NC}"
fi

# Load environment
source "$INSTALL_DIR/.env"

echo -e "${YELLOW}Step 5: Setting up SSL certificates...${NC}"

# Create initial nginx config without SSL for certbot
if [ "$DOMAIN_NAME" != "localhost" ]; then
    # Create temporary nginx config for certbot
    mkdir -p "$INSTALL_DIR/nginx/conf.d"
    cat > "$INSTALL_DIR/nginx/conf.d/default.conf" << 'EOF'
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'TMS Installation in progress...';
        add_header Content-Type text/plain;
    }
}
EOF

    # Start nginx temporarily
    docker compose up -d nginx
    
    # Get SSL certificate
    echo -e "${YELLOW}Obtaining SSL certificate for $DOMAIN_NAME...${NC}"
    docker compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$DJANGO_SUPERUSER_EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN_NAME"
    
    # Restore full nginx config
    cat > "$INSTALL_DIR/nginx/conf.d/default.conf" << 'EOFNGINX'
# Upstream definitions
upstream backend {
    server backend:8000;
    keepalive 32;
}

upstream frontend {
    server frontend:80;
    keepalive 32;
}

server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
    
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    client_max_body_size 100M;

    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /var/www/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /media/ {
        alias /var/www/media/;
        expires 7d;
    }

    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOFNGINX
    
    # Replace domain placeholder
    sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN_NAME/g" "$INSTALL_DIR/nginx/conf.d/default.conf"
    
    docker compose down
else
    echo -e "${YELLOW}Skipping SSL (localhost mode)${NC}"
fi

echo -e "${YELLOW}Step 6: Building and starting containers...${NC}"

cd "$INSTALL_DIR"

# Build images
docker compose build --no-cache

# Start services
docker compose up -d

echo -e "${YELLOW}Step 7: Running database migrations...${NC}"

# Wait for database to be ready
echo "Waiting for database..."
sleep 10

# Run migrations
docker compose exec -T backend python manage.py migrate --noinput

# Create superuser
echo -e "${YELLOW}Step 8: Creating admin user...${NC}"
docker compose exec -T backend python manage.py shell << PYTHON_EOF
from apps.accounts.models import User
if not User.objects.filter(email='$DJANGO_SUPERUSER_EMAIL').exists():
    User.objects.create_superuser(
        email='$DJANGO_SUPERUSER_EMAIL',
        password='$DJANGO_SUPERUSER_PASSWORD',
        first_name='Admin',
        last_name='User'
    )
    print('Superuser created successfully!')
else:
    print('Superuser already exists.')
PYTHON_EOF

echo -e "${YELLOW}Step 9: Configuring firewall...${NC}"

# Configure firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

echo -e "${YELLOW}Step 10: Creating maintenance scripts...${NC}"

# Create update script
cat > /usr/local/bin/tms-update << 'EOF'
#!/bin/bash
cd /opt/tms
git pull origin main
docker compose build --no-cache
docker compose up -d
docker compose exec -T backend python manage.py migrate --noinput
docker compose exec -T backend python manage.py collectstatic --noinput
echo "TMS updated successfully!"
EOF
chmod +x /usr/local/bin/tms-update

# Create backup script
cat > /usr/local/bin/tms-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/tms/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Backup database
docker compose -f /opt/tms/docker-compose.yml exec -T db pg_dump -U tms_user tms_db > "$BACKUP_DIR/db_$TIMESTAMP.sql"

# Backup media files
tar -czf "$BACKUP_DIR/media_$TIMESTAMP.tar.gz" -C /opt/tms media/

# Keep only last 7 backups
find "$BACKUP_DIR" -type f -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR"
EOF
chmod +x /usr/local/bin/tms-backup

# Create systemd service
cat > /etc/systemd/system/tms.service << EOF
[Unit]
Description=TMS - Transport Management System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/tms
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable tms

# Add cron job for backups
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/tms-backup") | crontab -

echo ""
echo -e "${GREEN}============================================="
echo "   Installation Complete!"
echo "=============================================${NC}"
echo ""
if [ "$DOMAIN_NAME" != "localhost" ]; then
    echo -e "Your TMS is now running at: ${BLUE}https://$DOMAIN_NAME${NC}"
else
    echo -e "Your TMS is now running at: ${BLUE}http://localhost${NC}"
fi
echo ""
echo -e "Admin login: ${YELLOW}$DJANGO_SUPERUSER_EMAIL${NC}"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  tms-update   - Update to latest version"
echo "  tms-backup   - Create a backup"
echo ""
echo -e "${YELLOW}Docker commands:${NC}"
echo "  docker compose logs -f          - View logs"
echo "  docker compose restart          - Restart services"
echo "  docker compose down              - Stop all services"
echo ""
echo -e "${GREEN}Installation log saved to: /opt/tms/install.log${NC}"
