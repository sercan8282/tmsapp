# Nginx Proxy Manager Configuratie

Dit document beschrijft de configuratie van Nginx Proxy Manager (NPM) voor de TMS applicatie.

## Overzicht

NPM fungeert als reverse proxy en SSL terminator voor alle TMS services:

```
Internet
    │
    ▼
┌─────────────────────────────────────┐
│  Nginx Proxy Manager (poort 80/443) │
│  - SSL certificaten (Let's Encrypt) │
│  - Reverse proxy                    │
│  - www redirect                     │
└─────────────────────────────────────┘
    │
    ├──► tms-frontend:80     (moveo-bv.nl)
    ├──► tms-backend:8000    (moveo-bv.nl/api)
    ├──► portainer:9443      (portainer.moveo-bv.nl)
    └──► localhost:81        (npm.moveo-bv.nl)
```

## Toegang tot NPM Admin

| Setting | Waarde |
|---------|--------|
| **URL** | `http://SERVER-IP:81` of `https://npm.moveo-bv.nl` |
| **Default Email** | `admin@example.com` |
| **Default Password** | `changeme` |

> ⚠️ Wijzig het wachtwoord direct na eerste login!

---

## Proxy Hosts Configuratie

### 1. TMS Applicatie (`moveo-bv.nl`)

**Details tab:**
| Veld | Waarde |
|------|--------|
| Domain Names | `moveo-bv.nl` |
| Scheme | `http` |
| Forward Hostname / IP | `tms-frontend` |
| Forward Port | `80` |
| Block Common Exploits | ✅ |
| Websockets Support | ✅ |

**Custom Locations tab:**
| Location | Scheme | Forward Host | Port |
|----------|--------|--------------|------|
| `/api` | `http` | `tms-backend` | `8000` |
| `/admin` | `http` | `tms-backend` | `8000` |
| `/static` | `http` | `tms-backend` | `8000` |
| `/media` | `http` | `tms-backend` | `8000` |

**SSL tab:**
| Setting | Waarde |
|---------|--------|
| SSL Certificate | Let's Encrypt |
| Force SSL | ✅ |
| HTTP/2 Support | ✅ |
| HSTS Enabled | ✅ |

---

### 2. Portainer (`portainer.moveo-bv.nl`)

**Details tab:**
| Veld | Waarde |
|------|--------|
| Domain Names | `portainer.moveo-bv.nl` |
| Scheme | `https` |
| Forward Hostname / IP | `portainer` |
| Forward Port | `9443` |
| Block Common Exploits | ✅ |
| Websockets Support | ✅ |

**SSL tab:**
| Setting | Waarde |
|---------|--------|
| SSL Certificate | Let's Encrypt |
| Force SSL | ✅ |
| HTTP/2 Support | ✅ |

---

### 3. NPM Admin (`npm.moveo-bv.nl`)

**Details tab:**
| Veld | Waarde |
|------|--------|
| Domain Names | `npm.moveo-bv.nl` |
| Scheme | `http` |
| Forward Hostname / IP | `127.0.0.1` |
| Forward Port | `81` |
| Block Common Exploits | ✅ |

**SSL tab:**
| Setting | Waarde |
|---------|--------|
| SSL Certificate | Let's Encrypt |
| Force SSL | ✅ |

---

## Redirection Hosts

### WWW naar non-WWW redirect

**Details tab:**
| Veld | Waarde |
|------|--------|
| Domain Names | `www.moveo-bv.nl` |
| Scheme | `auto` |
| Forward Domain | `moveo-bv.nl` |
| HTTP Code | `301 Moved Permanently` |
| Preserve Path | ✅ |

**SSL tab:**
| Setting | Waarde |
|---------|--------|
| SSL Certificate | Eigen certificaat voor www.moveo-bv.nl |
| Force SSL | ✅ |

---

## SSL Certificaten

### Certificaten aanmaken

1. Ga naar **SSL Certificates** → **Add SSL Certificate**
2. Kies **Let's Encrypt**
3. Vul in:
   - **Domain Names**: het domein (bijv. `moveo-bv.nl`)
   - **Email Address**: jouw email voor verloopmeldingen
   - **Agree to ToS**: ✅
4. Klik **Save**

### Benodigde certificaten

| Domein | Type |
|--------|------|
| `moveo-bv.nl` | Let's Encrypt |
| `www.moveo-bv.nl` | Let's Encrypt |
| `portainer.moveo-bv.nl` | Let's Encrypt |
| `npm.moveo-bv.nl` | Let's Encrypt |

> 💡 **Tip**: Je kunt ook een wildcard certificaat aanmaken voor `*.moveo-bv.nl` via DNS challenge.

---

## DNS Configuratie

Maak deze A-records aan bij je DNS provider:

| Type | Naam | Waarde | TTL |
|------|------|--------|-----|
| A | `@` | `SERVER-IP` | 3600 |
| A | `www` | `SERVER-IP` | 3600 |
| A | `portainer` | `SERVER-IP` | 3600 |
| A | `npm` | `SERVER-IP` | 3600 |

Of gebruik een wildcard:

| Type | Naam | Waarde | TTL |
|------|------|--------|-----|
| A | `@` | `SERVER-IP` | 3600 |
| A | `*` | `SERVER-IP` | 3600 |

---

## Troubleshooting

### SSL certificaat aanvraag mislukt

1. Check of DNS correct is geconfigureerd:
   ```bash
   dig moveo-bv.nl +short
   # Moet je server IP tonen
   ```

2. Check of poort 80 open is (Let's Encrypt gebruikt HTTP challenge):
   ```bash
   sudo ufw status
   sudo ufw allow 80/tcp
   ```

3. Wacht 5-10 minuten na DNS wijziging voor propagatie

### Proxy Host toont "502 Bad Gateway"

1. Check of de container draait:
   ```bash
   docker ps | grep tms
   ```

2. Check container logs:
   ```bash
   docker logs tms-backend
   docker logs tms-frontend
   ```

3. Check of de forward hostname correct is (gebruik container naam, niet IP)

### Websockets werken niet

Zorg dat **Websockets Support** is ingeschakeld op de proxy host.

---

## Backup & Restore

### NPM Data locatie

```
/opt/docker/nginx-proxy/data       - NPM configuratie
/opt/docker/nginx-proxy/letsencrypt - SSL certificaten
```

### Backup maken

```bash
# Stop NPM tijdelijk
docker stop nginx-proxy-manager

# Backup
tar -czf npm-backup-$(date +%Y%m%d).tar.gz \
    /opt/docker/nginx-proxy/data \
    /opt/docker/nginx-proxy/letsencrypt

# Start NPM
docker start nginx-proxy-manager
```

### Restore

```bash
# Stop NPM
docker stop nginx-proxy-manager

# Restore
tar -xzf npm-backup-YYYYMMDD.tar.gz -C /

# Start NPM
docker start nginx-proxy-manager
```

---

## Security Best Practices

1. **Wijzig default NPM wachtwoord** direct na installatie
2. **Beperk toegang tot NPM admin** (gebruik Access Lists)
3. **Enable HSTS** op alle proxy hosts
4. **Block Common Exploits** inschakelen
5. **Gebruik sterke SSL settings** (TLS 1.2+)
6. **Regelmatig certificaten vernieuwen** (automatisch bij Let's Encrypt)

---

## Handige Links

- [NPM Documentatie](https://nginxproxymanager.com/guide/)
- [Let's Encrypt](https://letsencrypt.org/)
- [SSL Labs Test](https://www.ssllabs.com/ssltest/)
