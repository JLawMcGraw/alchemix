# AlcheMix - Railway Full Stack Deployment Guide

## Overview

This guide deploys the complete AlcheMix stack to Railway:
- **Neo4j** - Graph database (Railway plugin)
- **PostgreSQL** - Vector storage (Railway plugin)
- **MemMachine** - AI memory service (custom Docker)
- **AlcheMix API** - Express backend (custom Docker)
- **Frontend** - Next.js (Vercel recommended)

## Prerequisites

1. Railway account at [railway.app](https://railway.app)
2. Vercel account at [vercel.com](https://vercel.com)
3. GitHub repository access to both:
   - `alchemix` repository
   - `memmachine` repository
4. API Keys:
   - OpenAI API key (for MemMachine embeddings)
   - Anthropic API key (for AI bartender)

## Step 1: Prepare MemMachine Repository

Copy these files from `alchemix/railway/memmachine/` to your `memmachine` repository:

```
memmachine/
├── railway/
│   ├── Dockerfile.railway
│   ├── config.yaml.template
│   ├── entrypoint.sh
│   └── railway.json
```

Then copy the `railway.json` to the root of memmachine repo:
```bash
cp railway/railway.json ./railway.json
```

Commit and push these changes to the memmachine repo.

## Step 2: Create Railway Project

1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click **"New Project"** → **"Empty Project"**
3. Name it: `alchemix-production`

## Step 3: Add Neo4j Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Neo4j"**
3. Wait for provisioning (1-2 minutes)
4. Click on Neo4j service → **"Variables"** tab
5. Note these auto-generated variables:
   - `NEO4J_URI` (e.g., `bolt://xxx.railway.app:7687`)
   - `NEO4J_PASSWORD`

## Step 4: Add PostgreSQL Database

1. Click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Wait for provisioning
3. Note these auto-generated variables:
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`

## Step 5: Deploy MemMachine Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your `memmachine` repository
3. Railway will detect `railway.json` and use `railway/Dockerfile.railway`
4. Go to **"Variables"** tab and add:

| Variable | Value |
|----------|-------|
| `NEO4J_URI` | `${{Neo4j.NEO4J_URI}}` |
| `NEO4J_USER` | `neo4j` |
| `NEO4J_PASSWORD` | `${{Neo4j.NEO4J_PASSWORD}}` |
| `POSTGRES_HOST` | `${{Postgres.PGHOST}}` |
| `POSTGRES_PORT` | `${{Postgres.PGPORT}}` |
| `POSTGRES_USER` | `${{Postgres.PGUSER}}` |
| `POSTGRES_PASSWORD` | `${{Postgres.PGPASSWORD}}` |
| `POSTGRES_DB` | `${{Postgres.PGDATABASE}}` |
| `OPENAI_API_KEY` | `sk-...` (your OpenAI key) |
| `PORT` | `8080` |
| `HOST` | `0.0.0.0` |

5. Click **"Deploy"** and wait for build to complete
6. Verify health at: `https://your-memmachine-domain.railway.app/api/v2/health`

## Step 6: Deploy AlcheMix API

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your `alchemix` repository
3. Railway will detect `railway.json` and use `api/Dockerfile`
4. Go to **"Settings"** tab:
   - Set **Root Directory** to `/` (leave empty)
   - Verify **Dockerfile Path** is `api/Dockerfile`

5. Go to **"Variables"** tab and add:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `JWT_SECRET` | Generate with: `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` (your Anthropic key) |
| `MEMMACHINE_API_URL` | `http://${{MemMachine.RAILWAY_PRIVATE_DOMAIN}}:8080` |
| `MEMMACHINE_ENABLED` | `true` |
| `FRONTEND_URL` | `https://alchemix.vercel.app` (update after Vercel deploy) |
| `DATABASE_PATH` | `/app/data/alchemix.db` |

6. Go to **"Settings"** → **"Volumes"**:
   - Add volume mounted at `/app/data`
   - This persists the SQLite database

7. Go to **"Settings"** → **"Networking"**:
   - Generate a public domain (e.g., `alchemix-api-production.up.railway.app`)

8. Click **"Deploy"**

## Step 7: Deploy Frontend to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your `alchemix` repository
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `/` (leave default)
4. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://alchemix-api-production.up.railway.app
   ```
5. Click **"Deploy"**
6. Note your Vercel domain (e.g., `alchemix.vercel.app`)

## Step 8: Update API CORS

Go back to Railway → AlcheMix API → Variables:
- Update `FRONTEND_URL` to your Vercel domain:
  ```
  FRONTEND_URL=https://alchemix.vercel.app
  ```
- Redeploy the API

## Step 9: Configure Email (Optional)

For password reset and email verification, add SMTP variables to the API:

| Variable | Value |
|----------|-------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `your-email@gmail.com` |
| `SMTP_PASS` | `your-app-password` |
| `SMTP_FROM` | `AlcheMix <your-email@gmail.com>` |

## Verification Checklist

- [ ] Neo4j is healthy (green status in Railway)
- [ ] PostgreSQL is healthy (green status in Railway)
- [ ] MemMachine health check passes: `GET /api/v2/health`
- [ ] API health check passes: `GET /health/ready`
- [ ] Frontend loads at Vercel domain
- [ ] Can create account and log in
- [ ] Can add inventory items
- [ ] Can add recipes
- [ ] AI recommendations work (MemMachine integration)

## Estimated Monthly Costs

| Service | Estimated Cost |
|---------|----------------|
| Neo4j | $5-15/month |
| PostgreSQL | $5-10/month |
| MemMachine | $5-15/month |
| AlcheMix API | $5-10/month |
| Vercel (Frontend) | Free tier |
| **Total** | **~$20-50/month** |

*Costs depend on usage. Railway charges based on resource consumption.*

## Troubleshooting

### MemMachine fails to start
- Check Neo4j and PostgreSQL are running first
- Verify all environment variables are set
- Check logs: Railway → MemMachine → **"Logs"** tab

### API can't connect to MemMachine
- Use private domain: `${{MemMachine.RAILWAY_PRIVATE_DOMAIN}}`
- Ensure port 8080 is specified
- Check MemMachine is healthy first

### CORS errors in browser
- Verify `FRONTEND_URL` exactly matches your Vercel domain
- Include `https://` prefix
- Redeploy API after changing

### Database not persisting
- Ensure volume is mounted at `/app/data`
- Check `DATABASE_PATH` environment variable

### Neo4j connection refused
- Wait for Neo4j to fully initialize (can take 2-3 minutes)
- Check `NEO4J_URI` format: `bolt://hostname:7687`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        RAILWAY PROJECT                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │    Neo4j     │  │  PostgreSQL  │  │      MemMachine        ││
│  │   (Graph)    │  │   (Vector)   │  │   (AI Memory API)      ││
│  │              │  │              │  │                        ││
│  │  Port 7687   │  │  Port 5432   │  │  Port 8080             ││
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘│
│         │                 │                      │              │
│         └─────────────────┼──────────────────────┘              │
│                           │                                     │
│                    Private Network                              │
│                           │                                     │
│                  ┌────────┴────────┐                           │
│                  │  AlcheMix API   │                           │
│                  │  (Express.js)   │                           │
│                  │                 │                           │
│                  │  Port 3000      │                           │
│                  └────────┬────────┘                           │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                     Public Domain
                   (Railway-generated)
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                          VERCEL                                │
│                                                                │
│                  ┌─────────────────────┐                      │
│                  │   AlcheMix Web      │                      │
│                  │    (Next.js)        │                      │
│                  │                     │                      │
│                  │  alchemix.vercel.app│                      │
│                  └─────────────────────┘                      │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

## Next Steps After Deployment

1. **Set up custom domain** (optional)
   - Railway: Settings → Domains → Add custom domain
   - Vercel: Settings → Domains → Add domain

2. **Enable monitoring**
   - Railway provides basic metrics
   - Consider adding Sentry for error tracking

3. **Set up backups**
   - Railway PostgreSQL has automatic backups
   - For SQLite, set up periodic volume snapshots

4. **Configure alerts**
   - Railway → Project Settings → Notifications
   - Add webhook for deployment status
