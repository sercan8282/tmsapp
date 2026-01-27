#!/bin/bash
# ===========================================
# TMS Update Script - Productie
# ===========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

INSTALL_DIR="${INSTALL_DIR:-/opt/tms}"

echo -e "${YELLOW}TMS Update Script${NC}"
echo "================================"

cd "$INSTALL_DIR"

# Check which mode we're running
if [ -f "docker-compose.yml" ] && docker compose ps &>/dev/null; then
    echo -e "${YELLOW}Detected: Docker mode${NC}"
    
    # Pull latest code
    echo "Pulling latest code..."
    git pull origin main
    
    # Rebuild and restart
    echo "Rebuilding containers..."
    docker compose build --no-cache
    docker compose up -d
    
    # Run migrations
    echo "Running migrations..."
    docker compose exec -T backend python manage.py migrate --noinput
    docker compose exec -T backend python manage.py collectstatic --noinput
    
else
    echo -e "${YELLOW}Detected: Native mode${NC}"
    
    # Pull latest code
    echo "Pulling latest code..."
    git pull origin main
    
    # Update backend
    echo "Updating backend..."
    cd "$INSTALL_DIR/backend"
    ./venv/bin/pip install -r requirements/production.txt
    ./venv/bin/python manage.py migrate --noinput
    ./venv/bin/python manage.py collectstatic --noinput
    
    # Update frontend
    echo "Building frontend..."
    cd "$INSTALL_DIR/frontend"
    npm ci
    npm run build
    
    # Restart services
    echo "Restarting services..."
    supervisorctl restart tms
    systemctl reload nginx
fi

echo ""
echo -e "${GREEN}Update completed successfully!${NC}"
