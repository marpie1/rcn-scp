# WikiCafé Admin Guide — Shared Care Plan & Groove

**Version:** 1.0  
**Docker images:** `ghcr.io/marpie1/rcn-scp-wiki`, `ghcr.io/marpie1/rcn-scp-groove`, `ghcr.io/marpie1/rcn-scp-proxy`  
**GitHub:** https://github.com/marpie1/rcn-scp  
**Contact:** Marc Pierson / Relocalizing Creativity Network

---

## Overview

This deployment runs three Docker containers managed by Docker Compose. Pre-built images are hosted on GitHub Container Registry — no build step required.

| Container | Image | Internal Port | Purpose |
|-----------|-------|--------------|---------|
| `wiki`    | `ghcr.io/marpie1/rcn-scp-wiki` | 3000 | FedWiki server with all SCP plugins |
| `groove`  | `ghcr.io/marpie1/rcn-scp-groove` | 3001 | Groove Networks collaboration workspace |
| `proxy`   | `ghcr.io/marpie1/rcn-scp-proxy` | 8765 | API proxy — Anthropic AI + FedWiki page operations |

**Authentication model:** Your existing WikiCafé reverse proxy handles login — these containers run behind it. FedWiki's built-in `friends` security controls who can *edit* pages; the assigned CHW claims their wiki instance on first setup (see step 4).

---

## Prerequisites

- Docker Engine 24+ and Docker Compose V2
- An Anthropic API key (for AI pre-visit chat) — https://console.anthropic.com/
- Git (only to get the `docker-compose.yml` and seed files)

---

## 1. Get the deployment files

```bash
git clone https://github.com/marpie1/rcn-scp.git
cd rcn-scp
```

You only need the repo for the `docker-compose.yml`, `.env.example`, and `seeds/` folder. The Docker images themselves are pulled automatically.

---

## 2. Configure environment

```bash
cp .env.example .env
nano .env
```

Set your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Optionally protect the proxy endpoints with a bearer token:

```env
SODOTO_PROXY_SECRET=choose-a-random-string
```

To use non-default ports:

```env
WIKI_PORT=3000
GROOVE_PORT=3001
PROXY_PORT=8765
```

---

## 3. Start

```bash
docker compose up -d
```

Docker pulls the three pre-built images from `ghcr.io/marpie1/` and starts the containers. First pull takes 1–2 minutes; subsequent starts are near-instant.

**On first start**, the wiki container seeds 13 blank patient pages into the `wiki-data` volume:

- About Me · Medications · Vitals · Symptoms · Visits
- Providers · Care Team · Diagnoses · Allergies & Reactions
- Medical History · Next Steps · Medical Directives · Health Log

These pages are **never overwritten** on subsequent restarts.

---

## 4. Verify

```bash
docker compose ps
```

All three should show `Up`. Check that SCP plugins loaded in the wiki:

```bash
docker logs rcn-scp-wiki-1 | grep "starting plugin"
```

Look for `wiki-plugin-scp-medication` and `wiki-plugin-scp-factory`.

---

## 5. First-time wiki setup — CHW claims the site

1. Open the wiki in a browser (via your reverse proxy URL)
2. Click the padlock icon (top-right corner)
3. Select **"Claim this wiki"** and follow the prompts
4. The CHW is now the owner and can add/edit entries

Done once per patient deployment.

---

## 6. Reverse proxy

Point your nginx at the container ports. Example:

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

# API proxy (AI + page operations)
location /api/ {
    proxy_pass         http://127.0.0.1:8765/api/;
    proxy_set_header   Host $host;
}
```

Your existing WikiCafé authentication wrapper applies at this layer — no changes to Docker needed.

---

## 7. Backups

Patient data lives in the `wiki-data` Docker volume. To back up:

```bash
docker run --rm \
  -v rcn-scp_wiki-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/wiki-data-$(date +%Y%m%d).tar.gz -C /data .
```

---

## 8. Multiple patients

Run a separate compose project per patient, each with different ports:

```bash
# Copy the repo folder for each patient
cp -r rcn-scp patient-a && cd patient-a
# Edit .env: WIKI_PORT=3000, GROOVE_PORT=3001, PROXY_PORT=8765
docker compose -p patient-a up -d

cp -r rcn-scp patient-b && cd patient-b
# Edit .env: WIKI_PORT=3100, GROOVE_PORT=3101, PROXY_PORT=8865
docker compose -p patient-b up -d
```

Each project gets its own isolated `wiki-data` volume.

---

## 9. Updating to a new version

```bash
cd rcn-scp
git pull                        # get latest docker-compose.yml and seeds
docker compose pull             # pull updated images from ghcr.io
docker compose up -d            # restart containers with new images
```

Patient data in the volume is never touched by updates.

---

## 10. Stopping

```bash
# Stop (data preserved)
docker compose down

# Stop and delete all patient data — CAUTION
docker compose down -v
```

---

## Troubleshooting

**Wiki won't start** — check logs:
```bash
docker logs rcn-scp-wiki-1
```

**AI chat not working** — verify `ANTHROPIC_API_KEY` is set in `.env`, then:
```bash
docker logs rcn-scp-proxy-1
```

**Port conflict** — change the relevant `_PORT` variable in `.env` and restart.

---

## Image registry

All images are public on GitHub Container Registry:

```
ghcr.io/marpie1/rcn-scp-wiki:latest
ghcr.io/marpie1/rcn-scp-groove:latest
ghcr.io/marpie1/rcn-scp-proxy:latest
```

Source code and Dockerfiles: https://github.com/marpie1/rcn-scp  
Contact: Marc Pierson, Relocalizing Creativity Network
