#!/bin/bash
# ===========================================
# TMS Native Install Script (zonder Docker)
# Voor Ubuntu 22.04/24.04 LTS
# ===========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REPO_URL="${REPO_URL:-https://github.com/yourusername/tmsapp.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/tms}"
BRANCH="${BRANCH:-main}"
PYTHON_VERSION="3.12"

echo -e "${BLUE}"
echo "============================================="
echo "   TMS - Transport Management System"
echo "   Native Production Install Script"
echo "   (Ubuntu without Docker)"
echo "============================================="
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    exit 1
fi

# Function to prompt for input
prompt_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    read -p "$prompt [$default]: " input
    eval "$var_name=\"${input:-$default}\""
}

# Function to prompt for password
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
            echo -e "${RED}Passwords do not match.${NC}"
        fi
    done
}

echo -e "${YELLOW}Step 1: Installing system packages...${NC}"

# Update system
apt-get update
apt-get upgrade -y

# Add deadsnakes PPA for Python 3.12
apt-get install -y software-properties-common
add-apt-repository -y ppa:deadsnakes/ppa
apt-get update

# Install packages
apt-get install -y \
    python3.12 \
    python3.12-venv \
    python3.12-dev \
    python3-pip \
    postgresql \
    postgresql-contrib \
    redis-server \
    nginx \
    certbot \
    python3-certbot-nginx \
    git \
    curl \
    build-essential \
    libpq-dev \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    ufw \
    supervisor

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo -e "${GREEN}System packages installed!${NC}"

echo -e "${YELLOW}Step 2: Configuring environment...${NC}"

# Get configuration
echo ""
prompt_input "Enter your domain name" "localhost" DOMAIN_NAME
prompt_input "Database name" "tms_db" DB_NAME
prompt_input "Database user" "tms_user" DB_USER
prompt_password "Database password" DB_PASSWORD
prompt_input "Admin email" "admin@example.com" ADMIN_EMAIL
prompt_password "Admin password" ADMIN_PASSWORD

# Generate secret key
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')

echo -e "${YELLOW}Step 3: Configuring PostgreSQL...${NC}"

# Start PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
ALTER USER $DB_USER CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

echo -e "${GREEN}PostgreSQL configured!${NC}"

echo -e "${YELLOW}Step 4: Configuring Redis...${NC}"

systemctl enable redis-server
systemctl start redis-server

echo -e "${YELLOW}Step 5: Cloning repository...${NC}"

# Create tms user
useradd -r -m -s /bin/bash tms || true

# Clone repository
if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
else
    git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

chown -R tms:tms "$INSTALL_DIR"

echo -e "${YELLOW}Step 6: Setting up Python environment...${NC}"

cd "$INSTALL_DIR/backend"

# Create virtual environment
sudo -u tms python3.12 -m venv venv

# Install dependencies
sudo -u tms ./venv/bin/pip install --upgrade pip
sudo -u tms ./venv/bin/pip install -r requirements/production.txt
sudo -u tms ./venv/bin/pip install gunicorn

# Create .env file
cat > "$INSTALL_DIR/backend/.env" << EOF
DJANGO_SETTINGS_MODULE=tms.settings.production
SECRET_KEY=$SECRET_KEY
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_HOST=localhost
DB_PORT=5432
REDIS_URL=redis://localhost:6379/1
ALLOWED_HOSTS=$DOMAIN_NAME,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://$DOMAIN_NAME,http://localhost
EOF

chmod 600 "$INSTALL_DIR/backend/.env"
chown tms:tms "$INSTALL_DIR/backend/.env"

# Run migrations
cd "$INSTALL_DIR/backend"
sudo -u tms ./venv/bin/python manage.py migrate --noinput
sudo -u tms ./venv/bin/python manage.py collectstatic --noinput

# Create superuser
sudo -u tms ./venv/bin/python manage.py shell << PYTHON_EOF
from apps.accounts.models import User
if not User.objects.filter(email='$ADMIN_EMAIL').exists():
    User.objects.create_superuser(
        email='$ADMIN_EMAIL',
        password='$ADMIN_PASSWORD',
        first_name='Admin',
        last_name='User'
    )
    print('Superuser created!')
else:
    print('Superuser already exists.')
PYTHON_EOF

echo -e "${GREEN}Backend configured!${NC}"

echo -e "${YELLOW}Step 7: Building frontend...${NC}"

cd "$INSTALL_DIR/frontend"

# Create frontend .env
cat > "$INSTALL_DIR/frontend/.env" << EOF
VITE_API_URL=/api
EOF

# Install and build
sudo -u tms npm ci
sudo -u tms npm run build

echo -e "${GREEN}Frontend built!${NC}"

echo -e "${YELLOW}Step 8: Configuring Gunicorn (Supervisor)...${NC}"

# Create Gunicorn config
cat > /etc/supervisor/conf.d/tms.conf << EOF
[program:tms]
directory=$INSTALL_DIR/backend
command=$INSTALL_DIR/backend/venv/bin/gunicorn --workers 4 --threads 2 --bind unix:/run/tms/gunicorn.sock tms.wsgi:application
user=tms
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/tms/gunicorn.log
environment=DJANGO_SETTINGS_MODULE="tms.settings.production"
EOF

# Create log and run directories
mkdir -p /var/log/tms /run/tms
chown -R tms:tms /var/log/tms /run/tms

# Create systemd service for socket directory
cat > /etc/systemd/system/tms-socket.service << EOF
[Unit]
Description=Create TMS socket directory

[Service]
Type=oneshot
ExecStart=/bin/mkdir -p /run/tms
ExecStart=/bin/chown tms:www-data /run/tms
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable tms-socket
systemctl start tms-socket

supervisorctl reread
supervisorctl update

echo -e "${GREEN}Gunicorn configured!${NC}"

echo -e "${YELLOW}Step 9: Configuring Nginx...${NC}"

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Create TMS site config
cat > /etc/nginx/sites-available/tms << EOF
upstream tms_backend {
    server unix:/run/tms/gunicorn.sock fail_timeout=0;
}

server {
    listen 80;
    server_name $DOMAIN_NAME;

    client_max_body_size 100M;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (static files)
    location / {
        root $INSTALL_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://tms_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://tms_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static files (Django)
    location /static/ {
        alias $INSTALL_DIR/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias $INSTALL_DIR/backend/media/;
        expires 7d;
    }
}
EOF

ln -sf /etc/nginx/sites-available/tms /etc/nginx/sites-enabled/

nginx -t
systemctl enable nginx
systemctl restart nginx

echo -e "${GREEN}Nginx configured!${NC}"

echo -e "${YELLOW}Step 10: Setting up SSL...${NC}"

if [ "$DOMAIN_NAME" != "localhost" ]; then
    certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos --email "$ADMIN_EMAIL"
    echo -e "${GREEN}SSL certificate installed!${NC}"
else
    echo -e "${YELLOW}Skipping SSL (localhost mode)${NC}"
fi

echo -e "${YELLOW}Step 11: Configuring firewall...${NC}"

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo -e "${YELLOW}Step 12: Creating maintenance scripts...${NC}"

# Update script
cat > /usr/local/bin/tms-update << 'EOF'
#!/bin/bash
set -e
cd /opt/tms

# Pull latest code
git pull origin main

# Update backend
cd backend
./venv/bin/pip install -r requirements/production.txt
./venv/bin/python manage.py migrate --noinput
./venv/bin/python manage.py collectstatic --noinput

# Update frontend
cd ../frontend
npm ci
npm run build

# Restart services
supervisorctl restart tms
systemctl reload nginx

echo "TMS updated successfully!"
EOF
chmod +x /usr/local/bin/tms-update

# Backup script
cat > /usr/local/bin/tms-backup << EOF
#!/bin/bash
BACKUP_DIR="/opt/tms/backups"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
mkdir -p "\$BACKUP_DIR"

# Backup database
PGPASSWORD=$DB_PASSWORD pg_dump -h localhost -U $DB_USER $DB_NAME > "\$BACKUP_DIR/db_\$TIMESTAMP.sql"

# Backup media
tar -czf "\$BACKUP_DIR/media_\$TIMESTAMP.tar.gz" -C /opt/tms/backend media/

# Keep only last 7 backups
find "\$BACKUP_DIR" -type f -mtime +7 -delete

echo "Backup completed: \$BACKUP_DIR"
EOF
chmod +x /usr/local/bin/tms-backup

# Setup daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/tms-backup") | crontab -

# Setup SSL renewal
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet") | crontab -

echo ""
echo -e "${GREEN}============================================="
echo "   Installation Complete!"
echo "=============================================${NC}"
echo ""
if [ "$DOMAIN_NAME" != "localhost" ]; then
    echo -e "Your TMS is running at: ${BLUE}https://$DOMAIN_NAME${NC}"
else
    echo -e "Your TMS is running at: ${BLUE}http://localhost${NC}"
fi
echo ""
echo -e "Admin login: ${YELLOW}$ADMIN_EMAIL${NC}"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  tms-update              - Update to latest version"
echo "  tms-backup              - Create a backup"
echo "  supervisorctl status    - Check service status"
echo "  supervisorctl restart tms - Restart backend"
echo ""
echo -e "${YELLOW}Log files:${NC}"
echo "  /var/log/tms/gunicorn.log"
echo "  /var/log/nginx/access.log"
echo "  /var/log/nginx/error.log"
echo ""
