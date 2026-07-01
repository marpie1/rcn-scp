# RCN Shared Care Plan — Docker Deployment

Shared Care Plan (SCP) is a structured health record built on [Federated Wiki](https://github.com/fedwiki/wiki), with typed plugins for each clinical domain. This repo contains everything a WikiCafé administrator needs to run it.

## What's included

| Service | Port | Purpose |
|---------|------|---------|
| `wiki` | 3000 | FedWiki server with all SCP plugins pre-installed |
| `groove` | 3001 | Groove Networks workspace (collaboration + contracts) |
| `proxy` | 8765 | API proxy — Anthropic AI + direct wiki page access |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose)
- An [Anthropic API key](https://console.anthropic.com/) (for AI pre-visit chat)

## Setup

### 1. Clone this repo

```bash
git clone https://github.com/marpie1/rcn-scp.git
cd rcn-scp
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set your `ANTHROPIC_API_KEY`.

### 3. Start

```bash
docker compose up --build
```

On first start the wiki service seeds 13 blank patient pages (About Me, Medications, Vitals, Symptoms, Visits, Providers, Care Team, Diagnoses, Allergies & Reactions, Medical History, Next Steps, Medical Directives, Health Log).

### 4. Open

- SCP: [http://localhost:3000](http://localhost:3000)
- Groove: [http://localhost:3001](http://localhost:3001)

## Adding a new patient

Patient data lives in a Docker named volume (`wiki-data`). Each FedWiki *site* is a subdirectory under `/wiki-data/`. For a multi-patient deployment, the recommended pattern is to run one stack per patient (using different ports), or deploy to separate subdomains via a reverse proxy.

The seed pages in `seeds/new-patient/` are copied into the volume on first start only — existing pages are never overwritten.

## Updating

```bash
git pull
docker compose up --build
```

Patient data in the `wiki-data` volume is unaffected by image rebuilds.

## Ports

Change any port by editing `.env`:

```env
WIKI_PORT=3000
GROOVE_PORT=3001
PROXY_PORT=8765
```

## SCP Plugins

All SCP item types are handled by a single JS file (`wiki-plugin-scp-medication`) with server-side aliases for each type:

- `scp-medication` `scp-vital` `scp-symptom` `scp-visit`
- `scp-about` `scp-provider` `scp-care-member` `scp-diagnosis`
- `scp-reaction` `scp-history` `scp-next-step` `scp-directive`
- `scp-factory` (page-specific add-entry buttons)

## Source

- SCP plugins: [github.com/marpie1/rcn-scp](https://github.com/marpie1/rcn-scp)
- Groove workspace: [github.com/marpie1/rcn-groove](https://github.com/marpie1/rcn-groove)
