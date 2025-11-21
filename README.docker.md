# AlcheMix Docker Quick Start

Run the entire AlcheMix stack (with MemMachine AI memory) using Docker Compose.

## What You Get

- ✅ **Neo4j** - Graph database for vector embeddings
- ✅ **Postgres** - Profile storage
- ✅ **MemMachine** - AI memory backend
- ✅ **Bar Server** - Query constructor middleware
- ✅ **AlcheMix API** - Express backend
- ✅ **AlcheMix Frontend** - Next.js UI

All services configured and ready to use!

---

## Prerequisites

1. **Docker Desktop** installed and running
2. **Git** to clone repositories
3. **API Keys:**
   - OpenAI API key
   - Anthropic API key

---

## Quick Start (3 Steps)

### 1. Clone Both Repositories

```bash
cd ~/Desktop/DEV\ Work/  # Or your preferred directory

# Clone AlcheMix (if not already)
git clone https://github.com/YOUR_USERNAME/alchemix.git

# Clone MemMachine (if not already)
git clone https://github.com/MemMachine/MemMachine.git memmachine
```

**Directory structure:**
```
DEV Work/
├── alchemix/      ← AlcheMix repo
└── memmachine/    ← MemMachine repo (sibling directory)
```

### 2. Configure API Keys

```bash
cd alchemix
cp .env.docker .env
```

Edit `.env` and add your keys:
```bash
OPENAI_API_KEY=sk-...your-key...
ANTHROPIC_API_KEY=sk-ant-...your-key...
JWT_SECRET=your-secure-secret-32-chars-minimum
```

### 3. Start Everything

```bash
docker-compose up
```

**First run takes 5-10 minutes** (downloads images, builds containers).

---

## Access Services

| Service | URL |
|---------|-----|
| **AlcheMix Frontend** | http://localhost:3001 |
| **AlcheMix API** | http://localhost:3000 |
| **Neo4j Browser** | http://localhost:7474 |
| **MemMachine** | http://localhost:8080 |
| **Bar Server** | http://localhost:8001 |

**Neo4j Credentials:**
- Username: `neo4j`
- Password: `alchemixpassword`

---

## Common Commands

```bash
# Start services (attached - see logs)
docker-compose up

# Start services (detached - background)
docker-compose up -d

# Stop services (keeps data)
docker-compose down

# Stop and delete all data
docker-compose down -v

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api

# Rebuild after code changes
docker-compose build
docker-compose up
```

---

## Moving to Another System

1. Install Docker Desktop
2. Clone both repos (`alchemix` + `memmachine`)
3. Copy `.env` with your API keys
4. Run `docker-compose up`

**That's it!** All data persists in Docker volumes.

---

## Troubleshooting

**Port already in use?**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3000
kill -9 <PID>
```

**Services not starting?**
```bash
# Check logs
docker-compose logs -f

# Restart specific service
docker-compose restart neo4j
```

**Out of memory?**
- Docker Desktop → Settings → Resources
- Increase Memory to at least **8GB**

---

## Full Documentation

See **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** for complete documentation including:
- Architecture details
- Data persistence and backups
- Production deployment
- Advanced configuration

---

**Last Updated:** 2025-11-21
**Version:** v1.13.0 (MemMachine Integration)
