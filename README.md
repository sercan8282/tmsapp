# TMS - Transport Management System

Een complete web applicatie voor transport management, urenregistratie, weekplanning en facturatie.

## 🚀 Snelle Installatie (Productie)

### Optie 1: Docker (Aanbevolen)

Installeer alles met één command op een verse Ubuntu server:

```bash
# Download en run het install script
curl -sSL https://raw.githubusercontent.com/yourusername/tmsapp/main/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

Het script vraagt om:
- Domeinnaam (bijv. `tms.jouwbedrijf.nl`)
- Database wachtwoord
- Admin email en wachtwoord

Na installatie draait alles automatisch met SSL!

### Optie 2: Native (Zonder Docker)

Voor servers waar je geen Docker wilt:

```bash
curl -sSL https://raw.githubusercontent.com/yourusername/tmsapp/main/install-native.sh -o install-native.sh
chmod +x install-native.sh
sudo ./install-native.sh
```

---

## 📋 Wat wordt geïnstalleerd?

| Component | Docker | Native |
|-----------|--------|--------|
| PostgreSQL 16 | Container | Systemd service |
| Redis 7 | Container | Systemd service |
| Django Backend | Container | Gunicorn + Supervisor |
| React Frontend | Container | Static files |
| Nginx | Container | Native |
| SSL (Let's Encrypt) | Certbot container | Certbot |

---

## 🔧 Beheer Commands

```bash
# Update naar laatste versie
tms-update

# Maak een backup
tms-backup

# Docker: Bekijk logs
docker compose logs -f

# Docker: Herstart
docker compose restart

# Native: Bekijk logs
tail -f /var/log/tms/gunicorn.log

# Native: Herstart
supervisorctl restart tms
```

---

## 🛠️ Tech Stack

- **Backend**: Django 5.x + Django REST Framework
- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: TailwindCSS
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Auth**: JWT + TOTP 2FA
- **PDF**: WeasyPrint

## 📁 Project Structuur

```
tmsapp/
├── backend/                 # Django API
│   ├── apps/
│   │   ├── accounts/       # Gebruikers & auth
│   │   ├── companies/      # Bedrijven
│   │   ├── drivers/        # Chauffeurs
│   │   ├── fleet/          # Voertuigen
│   │   ├── timetracking/   # Urenregistratie
│   │   ├── planning/       # Weekplanning
│   │   └── invoicing/      # Facturatie
│   └── tms/settings/       # Django settings
├── frontend/               # React SPA
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page components
│   │   └── stores/        # Zustand stores
│   └── package.json
├── nginx/                  # Nginx config
├── docker-compose.yml
├── install.sh             # Docker install
├── install-native.sh      # Native install
└── update.sh              # Update script
```

## 📚 API Endpoints

| Module | Endpoint | Beschrijving |
|--------|----------|--------------|
| Health | `/api/health/` | Status check |
| Auth | `/api/auth/login/` | JWT Login |
| Auth | `/api/auth/users/` | Gebruikersbeheer |
| Core | `/api/core/settings/` | App instellingen |
| Companies | `/api/companies/` | Bedrijven CRUD |
| Drivers | `/api/drivers/` | Chauffeurs CRUD |
| Fleet | `/api/fleet/` | Voertuigen CRUD |
| Time | `/api/time-entries/` | Urenregistratie |
| Planning | `/api/planning/` | Weekplanning |
| Invoicing | `/api/invoicing/` | Facturen |

API Documentatie: `https://your-domain/api/docs/`

## 🔐 Rollen

- **Admin**: Volledige toegang
- **Gebruiker**: Standaard gebruiker
- **Chauffeur**: Urenregistratie toegang

## 💾 Backups

Automatische dagelijkse backups om 02:00.

Handmatig: `tms-backup`

Locatie: `/opt/tms/backups/`

## 📄 Licentie

MIT License
