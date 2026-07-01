# WikiCafé Admin Guide — Shared Care Plan & Groove

**Version:** 1.0  
**GitHub:** https://github.com/marpie1/rcn-scp  
**Contact:** Marc Pierson / RCN

---

## Overview

This guide walks you through deploying the **Shared Care Plan (SCP)** and **Groove** workspace on a WikiCafé server. The deployment consists of three Docker containers managed by Docker Compose.

| Container | Internal Port | Purpose |
|-----------|--------------|---------|
| `wiki`    | 3000 | FedWiki server with all SCP plugins |
| `groove`  | 3001 | Groove Networks collaboration workspace |
| `proxy`   | 8765 | API proxy — Anthropic AI + FedWiki page operations |

**Authentication model:** Your existing WikiCafé reverse proxy (nginx) handles login. These containers run behind it and do not need to enforce their own authentication for viewing. FedWiki's built-in `friends` security controls who can *edit* pages — the assigned Community Health Worker (CHW) claims their wiki instance on first setup (see step 5 below).

---

## Prerequisites

- Docker Engine 24+ and Docker Compose V2 (`docker compose` not `docker-compose`)
- Git
- An Anthropic API key (for the AI pre-visit chat feature) — get one at https://console.anthropic.com/
- Your reverse proxy configured to forward traffic to the ports above (see [Reverse Proxy Setup](#reverse-proxy-setup))

---

## 1. Clone the repository

```bash
git clone https://github.com/marpie1/rcn-scp.git
cd rcn-scp
```

This is the canonical source. There is no pre-built Docker Hub image — you build from source so you can audit exactly what runs on your server.

---

## 2. Configure environment

```bash
cp .env.example .env
nano .env  # or your preferred editor
```

Set your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Optionally set a secret to protect the proxy's API endpoints from unauthenticated local calls:

```env
SODOTO_PROXY_SECRET=choose-a-random-string
```

If your reverse proxy uses non-default ports, override them here:

```env
WIKI_PORT=3000
GROOVE_PORT=3001
PROXY_PORT=8765
```

---

## 3. Build and start

```bash
docker compose up --build -d
```

The first build takes 3–5 minutes (downloading base images and installing dependencies). Subsequent starts are fast.

**On first start**, the wiki container seeds 13 blank patient pages:

- About Me · Medications · Vitals · Symptoms · Visits
- Providers · Care Team · Diagnoses · Allergies & Reactions
- Medical History · Next Steps · Medical Directives · Health Log

These pages are written to a Docker named volume (`wiki-data`) and are **never overwritten** on subsequent restarts.

---

## 4. Verify the containers are running

```bash
docker compose ps
```

Expected output — all three containers should show `Up`:

```
NAME                 STATUS    PORTS
rcn-scp-wiki-1      Up        0.0.0.0:3000->3000/tcp
rcn-scp-groove-1    Up        0.0.0.0:3001->3001/tcp
rcn-scp-proxy-1     Up        0.0.0.0:8765->8765/tcp
```

Check the wiki log to confirm SCP plugins loaded:

```bash
docker logs rcn-scp-wiki-1 | grep "starting plugin"
```

You should see `wiki-plugin-scp-medication` and `wiki-plugin-scp-factory` in the list.

---

## 5. First-time wiki setup — CHW claims the site

The wiki uses FedWiki's `friends` security model: anyone who reaches the URL can read pages; editing requires the assigned user to *claim* the site.

1. Open the wiki in a browser (via your reverse proxy URL)
2. Click the padlock icon in the top-right corner
3. Select **"Claim this wiki"** and follow the prompts
4. The CHW is now the owner and can add and edit entries

This step is done once per patient deployment.

---

## 6. Reverse proxy setup

Point your nginx (or other reverse proxy) at the three container ports. Example nginx location blocks:

```nginx
# Shared Care Plan wiki
location /scp/ {
    proxy_pass         http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
}

# Groove workspace
location /groove/ {
    proxy_pass         http://127.0.0.1:3001/;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
}

# Proxy (AI + page operations) — keep this internal or behind auth
location /api/ {
    proxy_pass         http://127.0.0.1:8765/api/;
    proxy_set_header   Host $host;
}
```

Your existing WikiCafé authentication wrapper applies to these locations in the usual way — no changes needed to the Docker setup.

---

## 7. Patient data and backups

All wiki page data is stored in the `wiki-data` Docker volume. To back it up:

```bash
docker run --rm \
  -v rcn-scp_wiki-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/wiki-data-$(date +%Y%m%d).tar.gz -C /data .
```

To restore from a backup, stop the stack, extract into the volume, and restart.

---

## 8. Multiple patients

Each patient needs their own stack with a separate data volume. The recommended approach is separate compose projects:

```bash
# Patient A
cp -r rcn-scp patient-a && cd patient-a
# Edit .env: set WIKI_PORT=3000, GROOVE_PORT=3001, PROXY_PORT=8765
docker compose -p patient-a up -d

# Patient B
cp -r rcn-scp patient-b && cd patient-b
# Edit .env: set WIKI_PORT=3100, GROOVE_PORT=3101, PROXY_PORT=8865
docker compose -p patient-b up -d
```

Each project gets its own `wiki-data` volume automatically.

---

## 9. Updating

```bash
cd rcn-scp
git pull
docker compose up --build -d
```

Patient data in the `wiki-data` volume is unaffected by image rebuilds. The seed pages are only written on first start (when pages don't already exist), so updates will never overwrite patient data.

---

## 10. Stopping and removing

```bash
# Stop containers (data preserved)
docker compose down

# Stop and remove data volume (CAUTION: deletes all patient data)
docker compose down -v
```

---

## Troubleshooting

**Wiki won't start:**
```bash
docker logs rcn-scp-wiki-1
```
Most common cause: port already in use. Change `WIKI_PORT` in `.env`.

**Plugins not loading:**
```bash
docker logs rcn-scp-wiki-1 | grep "starting plugin"
```
If `wiki-plugin-scp-medication` is missing, rebuild: `docker compose up --build -d`

**AI chat not working:**
Check that `ANTHROPIC_API_KEY` is set in `.env` and the proxy container is running:
```bash
docker logs rcn-scp-proxy-1
```

**Groove not connecting to wiki:**
The containers communicate internally by service name. If you see connection errors in Groove logs, verify both containers are on the same Docker network:
```bash
docker network inspect rcn-scp_default
```

---

## Source & support

- **GitHub:** https://github.com/marpie1/rcn-scp
- **Groove repo:** https://github.com/marpie1/rcn-groove
- **Contact:** Marc Pierson, Relocalizing Creativity Network
