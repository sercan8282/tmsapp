# TMS Installatie Handleiding
## Docker met Portainer & Nginx Proxy Manager

Dit document beschrijft stap-voor-stap hoe je TMS installeert op een Ubuntu server.

---

## 📋 Overzicht

Na installatie heb je:

| Service | URL | Poort | Doel |
|---------|-----|-------|------|
| **TMS Applicatie** | https://jouwdomein.nl | 443 | De hoofdapplicatie |
| **Nginx Proxy Manager** | http://server-ip:81 | 81 | SSL en proxy beheer |
| **Portainer** | https://server-ip:9443 | 9443 | Container beheer |

---

## 🚀 Snelle Installatie (Interactief)

### Methode 1: Direct vanaf GitHub

```bash
# Download install script
curl -sSL https://raw.githubusercontent.com/yourusername/tmsapp/main/install.sh -o install.sh

# Maak uitvoerbaar
chmod +x install.sh

# Start installatie (als root)
sudo ./install.sh
```

### Methode 2: Repository eerst klonen

```bash
# Clone repository
git clone https://github.com/yourusername/tmsapp.git
cd tmsapp

# Start installatie
sudo ./install.sh
```

---

## 📝 Wat het Script Vraagt

Het installatiescript vraagt interactief naar de volgende gegevens:

### Stap 1: Repository Configuratie
| Vraag | Standaard | Uitleg |
|-------|-----------|--------|
| GitHub repository URL | https://github.com/.../tmsapp.git | URL van je repo |
| Branch | main | Welke branch te gebruiken |
| Installatie directory | /opt/tms | Waar de code komt |

### Stap 2: Domein Configuratie
| Vraag | Standaard | Uitleg |
|-------|-----------|--------|
| Domeinnaam | localhost | Je domein (bijv. tms.bedrijf.nl) |

### Stap 3: Database Configuratie
| Vraag | Standaard | Uitleg |
|-------|-----------|--------|
| Database naam | tms_db | Naam van de PostgreSQL database |
| Database gebruiker | tms_user | Gebruikersnaam voor database |
| Database wachtwoord | (genereren) | Wachtwoord (min 8 karakters) |

### Stap 4: Security Configuratie
| Vraag | Standaard | Uitleg |
|-------|-----------|--------|
| SECRET_KEY | (genereren) | Django encryptie sleutel |

### Stap 5: Service Account
| Vraag | Standaard | Uitleg |
|-------|-----------|--------|
| Service account naam | tms | Linux gebruiker voor containers |
| Service account wachtwoord | (genereren) | Wachtwoord voor deze gebruiker |

### Stap 6: TMS Admin Account
| Vraag | Standaard | Uitleg |
|-------|-----------|--------|
| Admin email | admin@jouwdomein.nl | Login email voor TMS |
| Admin wachtwoord | (genereren) | Wachtwoord voor TMS login |

---

## 🔧 Wat wordt Geïnstalleerd

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Nginx Proxy Manager (poort 80/443)             │
│              UI beschikbaar op poort 81                      │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│   Frontend      │ │    Backend      │ │   Portainer         │
│   (React)       │ │    (Django)     │ │   (Container UI)    │
│   poort 80      │ │    poort 8000   │ │   poort 9443        │
└─────────────────┘ └─────────────────┘ └─────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────┐                     ┌─────────────────┐
│   PostgreSQL    │                     │     Redis       │
│   Database      │                     │     Cache       │
└─────────────────┘                     └─────────────────┘
```

---

## 📁 Bestandsstructuur na Installatie

```
/opt/tms/
├── .env                    # Configuratie (GEHEIM!)
├── docker-compose.yml      # Container definities
├── INSTALL_INFO.txt        # Installatie gegevens
├── backend/                # Django API
├── frontend/               # React app
└── backups/                # Automatische backups

/usr/local/bin/
├── tms-update              # Update script
├── tms-backup              # Backup script
├── tms-logs                # Logs bekijken
└── tms-restart             # Herstart script

/var/log/
└── tms-install.log         # Installatie log
```

---

## 🌐 Nginx Proxy Manager Configuratie

Na de installatie moet je handmatig de proxy regels instellen.

### Eerste Login
1. Open `http://SERVER-IP:81`
2. Login met:
   - Email: `admin@example.com`
   - Password: `changeme`
3. **Wijzig direct je wachtwoord!**

### Proxy Host Aanmaken voor TMS

#### Frontend (hoofdapplicatie)
1. Ga naar **Hosts** → **Proxy Hosts**
2. Klik **Add Proxy Host**
3. Vul in:

| Veld | Waarde |
|------|--------|
| Domain Names | `jouwdomein.nl` |
| Scheme | `http` |
| Forward Hostname / IP | `tms_frontend` |
| Forward Port | `80` |
| Cache Assets | ✓ |
| Block Common Exploits | ✓ |

4. Klik op **SSL** tab:

| Veld | Waarde |
|------|--------|
| SSL Certificate | Request a new SSL Certificate |
| Force SSL | ✓ |
| HTTP/2 Support | ✓ |
| HSTS Enabled | ✓ |
| Email Address | jouw@email.nl |

5. Klik **Save**

#### Backend API (onder /api/)
1. Open de zojuist gemaakte proxy host
2. Ga naar **Custom locations**
3. Klik **Add location**
4. Vul in:

| Veld | Waarde |
|------|--------|
| Location | `/api` |
| Scheme | `http` |
| Forward Hostname / IP | `tms_backend` |
| Forward Port | `8000` |

5. Klik **Save**

### Optioneel: Portainer via Domein

Als je Portainer ook via je domein wilt bereiken (bijv. portainer.jouwdomein.nl):

1. **Add Proxy Host**
2. Domain: `portainer.jouwdomein.nl`
3. Scheme: `https`
4. Forward Hostname: `tms_portainer`
5. Forward Port: `9443`
6. SSL instellen zoals hierboven

---

## 🔐 Beveiliging

### Wachtwoorden Wijzigen

**Nginx Proxy Manager:**
1. Login op poort 81
2. Klik op je gebruikersnaam rechtsboven
3. Change Password

**Portainer:**
1. Login op poort 9443
2. Settings → Users → je gebruiker
3. Change password

**TMS Admin:**
1. Login op de applicatie
2. Instellingen → Profiel → Wachtwoord wijzigen

### Firewall Regels

Het script configureert automatisch UFW:

```bash
# Bekijk regels
sudo ufw status

# Poorten open:
# 22  - SSH
# 80  - HTTP (redirect naar HTTPS)
# 443 - HTTPS (TMS applicatie)
# 81  - Nginx Proxy Manager UI
# 9443 - Portainer UI
```

---

## 🔄 Dagelijks Beheer

### Updates Installeren

```bash
# Update TMS naar laatste versie
sudo tms-update
```

Dit doet:
1. `git pull` - haalt nieuwe code op
2. `docker compose build` - bouwt nieuwe images
3. `docker compose up -d` - start nieuwe containers
4. Migraties uitvoeren
5. Static files verzamelen

### Backups

```bash
# Handmatige backup
sudo tms-backup

# Backups staan in:
ls -la /opt/tms/backups/
```

Automatische backups draaien elke nacht om 02:00.

### Logs Bekijken

```bash
# Alle logs
sudo tms-logs

# Specifieke service
sudo tms-logs backend
sudo tms-logs frontend
sudo tms-logs db

# Nginx Proxy Manager logs
docker logs tms_npm
```

### Services Herstarten

```bash
# Alles herstarten
sudo tms-restart

# Specifieke service
sudo tms-restart backend
```

---

## 🐛 Troubleshooting

### Container Start Niet

```bash
# Bekijk status
docker compose -f /opt/tms/docker-compose.yml ps

# Bekijk logs
docker compose -f /opt/tms/docker-compose.yml logs backend
```

### Database Connectie Error

```bash
# Check of database draait
docker exec tms_db pg_isready -U tms_user

# Check database logs
docker logs tms_db
```

### Nginx Proxy Manager Error

```bash
# Herstart NPM
docker restart tms_npm

# Bekijk logs
docker logs tms_npm

# Reset NPM (verwijdert configuratie!)
docker volume rm tms_npm_data
docker compose up -d npm
```

### SSL Certificaat Vernieuwen

SSL certificaten worden automatisch vernieuwd door Nginx Proxy Manager.

Handmatig vernieuwen:
1. Open NPM UI (poort 81)
2. Ga naar SSL Certificates
3. Klik op certificaat → Renew

---

## 📊 Configuratie Referentie

### .env Bestand (/opt/tms/.env)

```bash
# ===========================================
# TMS Configuratie
# ===========================================

# Domein instellingen
DOMAIN_NAME=tms.example.com

# Database instellingen
DB_NAME=tms_db
DB_USER=tms_user
DB_PASSWORD=gegenereerd_wachtwoord

# Security
SECRET_KEY=lange_gegenereerde_sleutel

# Admin account
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_PASSWORD=admin_wachtwoord
```

### Docker Compose Services

| Container | Image | Interne Poort | Externe Poort |
|-----------|-------|---------------|---------------|
| tms_db | postgres:16-alpine | 5432 | - |
| tms_redis | redis:7-alpine | 6379 | - |
| tms_backend | custom build | 8000 | - |
| tms_frontend | custom build | 80 | - |
| tms_npm | jc21/nginx-proxy-manager | 80,443,81 | 80,443,81 |
| tms_portainer | portainer/portainer-ce | 9443 | 9443 |

### Netwerken

| Netwerk | Doel |
|---------|------|
| tms_internal | Interne communicatie (geen externe toegang) |
| tms_external | Externe toegang (NPM, Portainer) |

---

## ❓ FAQ

**V: Kan ik de database extern benaderen?**
A: Nee, de database zit op een intern netwerk. Dit is veiliger. Als je toch externe toegang nodig hebt, voeg dan een port mapping toe aan docker-compose.yml.

**V: Hoe verander ik de domeinnaam?**
A: 
1. Wijzig `DOMAIN_NAME` in `/opt/tms/.env`
2. Update de proxy host in Nginx Proxy Manager
3. `sudo tms-restart`

**V: Hoe maak ik een nieuwe admin gebruiker?**
A:
```bash
docker exec -it tms_backend python manage.py createsuperuser
```

**V: Hoe reset ik een wachtwoord?**
A:
```bash
docker exec -it tms_backend python manage.py changepassword admin@example.com
```

---

## 📞 Support

Bij problemen:
1. Check de logs: `sudo tms-logs`
2. Check container status: `docker compose ps`
3. Bekijk dit document voor veelvoorkomende problemen
