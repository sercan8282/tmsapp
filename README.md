# TMS - Transport Management System

Een complete web applicatie voor transport management, urenregistratie, weekplanning en facturatie.

## 🚀 Installatie (1 Command)

```bash
curl -sSL https://raw.githubusercontent.com/yourusername/tmsapp/main/install.sh | sudo bash
```

Of handmatig:

```bash
git clone https://github.com/yourusername/tmsapp.git
cd tmsapp
sudo ./install.sh
```

Het script vraagt interactief naar:
- ✅ Domeinnaam
- ✅ Database naam, gebruiker en wachtwoord
- ✅ Service account naam en wachtwoord
- ✅ Admin email en wachtwoord
- ✅ Secret key (kan ook genereren)

---

## 📋 Wat wordt geïnstalleerd?

| Service | Poort | URL | Doel |
|---------|-------|-----|------|
| **TMS App** | 443 | https://jouwdomein.nl | Hoofdapplicatie |
| **Nginx Proxy Manager** | 81 | http://server:81 | SSL & Proxy beheer |
| **Portainer** | 9443 | https://server:9443 | Container beheer |
| PostgreSQL | - | intern | Database |
| Redis | - | intern | Cache |

---

## 🔧 Beheer Commands

```bash
tms-update     # Update naar laatste versie
tms-backup     # Maak een backup  
tms-logs       # Bekijk logs
tms-restart    # Herstart containers
```

---

## 📁 Project Structuur

```
tmsapp/
├── backend/           # Django API
│   ├── apps/          # Django apps (accounts, companies, etc.)
│   └── tms/           # Settings
├── frontend/          # React + Vite + TypeScript
├── docs/              # Documentatie
│   └── INSTALLATIE.md # Uitgebreide handleiding
├── docker-compose.yml # Container setup
├── install.sh         # Installatiescript
└── .env.example       # Config template
```

---

## 📚 Documentatie

- 📖 [Uitgebreide Installatie Handleiding](docs/INSTALLATIE.md)
- 🔧 [Nginx Proxy Manager Setup](docs/INSTALLATIE.md#-nginx-proxy-manager-configuratie)
- 🔐 [Security & Wachtwoorden](docs/INSTALLATIE.md#-beveiliging)
- 🐛 [Troubleshooting](docs/INSTALLATIE.md#-troubleshooting)

---

## 🛠️ Tech Stack

| Component | Technologie |
|-----------|-------------|
| Backend | Django 5 + DRF |
| Frontend | React 18 + Vite + TypeScript |
| Styling | TailwindCSS |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | JWT + TOTP 2FA |
| Proxy | Nginx Proxy Manager |
| Containers | Docker + Portainer |

---

## 🗂️ Modules & Permissies

De TMS applicatie heeft een rolgebaseerd permissiesysteem. Hieronder een overzicht van de modules en vereiste permissies.

### Dossierbeheer (`manage_dossiers`)

Het **Dossierbeheer** module biedt een compleet dossier/case management systeem:

- **Dossiertypen** beheren (bijv. Verzekeringen, Contracten)
- **Dossiers** aanmaken, bekijken en beheren gekoppeld aan gebruikers of chauffeurs
- **Reacties** plaatsen inclusief interne notities (alleen zichtbaar voor beheerders)
- **Bijlagen** uploaden bij dossiers en reacties
- **Chauffeurs** kunnen hun eigen dossiers inzien (alleen-lezen)

| Rol | Toegang |
|-----|---------|
| `admin` | Volledige toegang |
| `gebruiker` met `manage_dossiers` | Alle dossiers beheren |
| `chauffeur` | Alleen eigen dossiers (read-only) |

---

## 📄 Licentie

MIT License
