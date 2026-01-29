#!/bin/bash
# ===========================================
# TMS Install Script - Local Development
# ===========================================

set -e

# Kleuren
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════╗"
echo "║  TMS - Local Development Setup             ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# Check Python
echo -e "${YELLOW}Checking Python...${NC}"
if ! command -v python &> /dev/null; then
    echo "Python is not installed. Please install Python 3.11+"
    exit 1
fi
python --version

# Check Node.js
echo -e "${YELLOW}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 18+"
    exit 1
fi
node --version

# Backend setup
echo ""
echo -e "${GREEN}Setting up Backend...${NC}"
cd backend

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate || source venv/Scripts/activate

echo "Installing Python dependencies..."
pip install -r requirements/local.txt

echo "Running migrations..."
python manage.py migrate

echo "Creating superuser (if not exists)..."
python manage.py shell -c "
from apps.accounts.models import User
if not User.objects.filter(email='admin@tms.local').exists():
    User.objects.create_superuser(
        email='admin@tms.local',
        username='admin',
        password='admin123',
        voornaam='Admin',
        achternaam='User'
    )
    print('Superuser created: admin@tms.local / admin123')
else:
    print('Superuser already exists')
"

cd ..

# Frontend setup
echo ""
echo -e "${GREEN}Setting up Frontend...${NC}"
cd frontend

echo "Installing Node.js dependencies..."
npm install

echo "Dependencies installed:"
echo "  - jspdf (PDF generation)"
echo "  - jspdf-autotable (PDF tables)"
echo "  - react, react-dom"
echo "  - tailwindcss"
echo "  - and more..."

cd ..

# Done
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Installation Complete!                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo "To start the application:"
echo ""
echo "  Backend:  cd backend && source venv/bin/activate && python manage.py runserver 8001"
echo "  Frontend: cd frontend && npm run dev"
echo ""
echo "Or use the PowerShell script (Windows):"
echo "  ./start-local.ps1"
echo ""
echo "Login: admin@tms.local / admin123"
echo ""
echo "AI Invoice Extraction (optional):"
echo "  1. Log in as admin"
echo "  2. Go to Settings → AI Extraction"
echo "  3. Configure GitHub Models (FREE), OpenAI, or Azure OpenAI"
echo ""
