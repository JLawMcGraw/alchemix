# AlcheMix Docker Setup Guide

Complete Docker Compose setup for AlcheMix with MemMachine integration. Run the entire stack (Neo4j, Postgres, MemMachine, Bar Server, API, Frontend) with one command.

---

## Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Docker Compose** v2.0+ (included with Docker Desktop)
- **Git** (to clone repositories)
- **API Keys:**
  - OpenAI API key (for MemMachine embeddings)
  - Anthropic API key (for AI Bartender)

---

## Quick Start

### 1. Clone Repositories

You need both `alchemix` and `memmachine` repositories in the same parent directory:

```bash
cd ~/Desktop/DEV\ Work/  # Or your preferred directory

# Clone AlcheMix (if not already cloned)
git clone https://github.com/YOUR_USERNAME/alchemix.git

# Clone MemMachine fork (if not already cloned)
git clone https://github.com/JLawMcGraw/MemMachine.git MemMachine
```

**Directory structure should look like:**
```
DEV Work/
├── alchemix/          ← You are here
│   ├── docker-compose.yml
│   ├── docker/bar-server/Dockerfile
│   ├── api/
│   ├── src/
│   └── ...
└── MemMachine/        ← Sibling directory (your fork)
    ├── Dockerfile
    ├── examples/bar_assistant/
    └── ...
```

### 2. Configure Environment Variables

Copy the environment template and add your API keys:

```bash
cd alchemix
cp .env.docker .env
```

Edit `.env` and add your keys:
```bash
# Required API Keys
OPENAI_API_KEY=sk-...your-openai-key...
ANTHROPIC_API_KEY=sk-ant-...your-anthropic-key...
JWT_SECRET=your-secure-jwt-secret-minimum-32-characters
```

### 3. Start All Services

```bash
docker-compose up
```

**First run will take 5-10 minutes** (downloads images, builds containers, initializes databases).

### 4. Verify Services

Open these URLs in your browser:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3001 | Next.js UI |
| **API** | http://localhost:3000/health | Backend health check |
| **Neo4j Browser** | http://localhost:7474 | Graph database UI |
| **MemMachine** | http://localhost:8080/health | Memory service |
| **Bar Server** | http://localhost:8001/health | Query constructor |

**Neo4j Credentials:**
- Username: `neo4j`
- Password: `alchemixpassword`
- URI: `bolt://localhost:7687`

---

## Usage

### Starting Services

```bash
# Start all services (attached - see logs)
docker-compose up

# Start all services (detached - background)
docker-compose up -d

# Start specific service
docker-compose up api
```

### Stopping Services

```bash
# Stop all services (keeps data)
docker-compose down

# Stop and remove volumes (deletes data)
docker-compose down -v
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f memmachine
docker-compose logs -f bar-server
```

### Rebuilding Services

```bash
# Rebuild all services
docker-compose build

# Rebuild specific service
docker-compose build api

# Rebuild and restart
docker-compose up --build
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Network                           │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Neo4j   │  │ Postgres │  │MemMachine│  │   Bar    │   │
│  │  :7687   │  │  :5432   │  │  :8080   │  │  Server  │   │
│  │  :7474   │  │          │  │          │  │  :8001   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       │             │              │              │         │
│       └─────────────┴──────────────┴──────────────┘         │
│                           │                                 │
│                    ┌──────────┐                             │
│                    │AlcheMix  │                             │
│                    │   API    │                             │
│                    │  :3000   │                             │
│                    └──────────┘                             │
│                           │                                 │
│                    ┌──────────┐                             │
│                    │AlcheMix  │                             │
│                    │Frontend  │                             │
│                    │  :3001   │                             │
│                    └──────────┘                             │
└─────────────────────────────────────────────────────────────┘
          │                                   │
    http://localhost:3001           http://localhost:3000
```

### Service Dependencies

```
Frontend → API → Bar Server → MemMachine → Neo4j + Postgres
```

**Startup Order:**
1. Neo4j & Postgres (databases)
2. MemMachine (waits for Neo4j + Postgres)
3. Bar Server (waits for MemMachine)
4. API (waits for Bar Server)
5. Frontend (waits for API)

---

## Data Persistence

Data is stored in Docker volumes and persists between restarts:

- `neo4j_data` - Graph database (vector embeddings)
- `neo4j_logs` - Neo4j logs
- `postgres_data` - User profiles and preferences
- `./api/data/alchemix.db` - SQLite database (recipes, inventory, users)

### Backing Up Data

```bash
# Backup SQLite database
cp api/data/alchemix.db api/data/alchemix.db.backup

# Backup Neo4j data
docker exec alchemix-neo4j neo4j-admin dump --to=/backups/neo4j.dump

# Backup Postgres data
docker exec alchemix-postgres pg_dump -U memmachine memmachine > postgres_backup.sql
```

### Resetting Data

```bash
# Remove all data and start fresh
docker-compose down -v
rm -rf api/data/alchemix.db
docker-compose up
```

---

## Troubleshooting

### Port Conflicts

**Error:** `bind: address already in use`

**Solution:** Stop conflicting services or change ports in `docker-compose.yml`:
```bash
# Find process using port
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Kill process
taskkill /PID <PID> /F        # Windows
kill -9 <PID>                 # Mac/Linux
```

### Neo4j Connection Errors

**Error:** `ServiceUnavailable: Connection refused`

**Solution:** Wait for Neo4j to fully start (can take 30-60 seconds):
```bash
docker-compose logs -f neo4j
# Wait for: "Remote interface available at http://localhost:7474/"
```

### MemMachine Not Starting

**Error:** `Failed to connect to Neo4j` or `Postgres connection error`

**Solution:** Check database health:
```bash
# Check Neo4j
docker-compose ps neo4j
docker-compose logs neo4j

# Check Postgres
docker-compose ps postgres
docker-compose logs postgres

# Restart databases
docker-compose restart neo4j postgres
```

### Out of Memory Errors

**Solution:** Increase Docker Desktop memory:
- Docker Desktop → Settings → Resources
- Increase Memory to at least **8GB**
- Click "Apply & Restart"

### Slow Build Times

**Solution:** Enable BuildKit for faster builds:
```bash
# Linux/Mac
export DOCKER_BUILDKIT=1

# Windows PowerShell
$env:DOCKER_BUILDKIT=1

# Windows CMD
set DOCKER_BUILDKIT=1
```

---

## Development Workflow

### Hot Reload

All services support hot reload (auto-restart on file changes):

- **API**: Changes to `api/src/**` trigger restart
- **Frontend**: Changes to `src/**` trigger Next.js hot reload
- **MemMachine**: Requires manual rebuild (`docker-compose build memmachine`)

### Running Tests

```bash
# API tests (inside container)
docker-compose exec api npm test

# Frontend tests (inside container)
docker-compose exec web npm test

# Run tests locally (without Docker)
cd api && npm test
```

### Accessing Container Shell

```bash
# API container
docker-compose exec api sh

# Frontend container
docker-compose exec web sh

# Neo4j container
docker-compose exec neo4j bash
```

---

## Production Deployment

This `docker-compose.yml` is configured for **development**. For production:

1. **Remove dev-only features:**
   - Change `Dockerfile.dev` → `Dockerfile`
   - Remove volume mounts for source code
   - Build production images

2. **Use environment-specific configs:**
   - Create `docker-compose.prod.yml`
   - Use secrets management (not `.env` file)
   - Enable SSL/TLS

3. **Deploy to cloud:**
   - Railway, Fly.io, AWS ECS, or DigitalOcean
   - Use managed databases (Neo4j Aura, RDS Postgres)
   - Set up proper networking and security groups

---

## Moving to Another System

### Prerequisites on New System

1. Install Docker Desktop
2. Install Git
3. Clone both repositories (`alchemix` + `memmachine`)

### Transfer Steps

```bash
# On old system: Backup data
docker-compose exec alchemix-postgres pg_dump -U memmachine > backup.sql
cp api/data/alchemix.db alchemix.db.backup

# Transfer files to new system
scp backup.sql alchemix.db.backup user@new-system:~/

# On new system: Restore data
cd alchemix
cp ~/alchemix.db.backup api/data/alchemix.db
docker-compose up -d postgres
docker-compose exec postgres psql -U memmachine < ~/backup.sql
docker-compose up
```

---

## Useful Commands

```bash
# View service status
docker-compose ps

# Restart specific service
docker-compose restart api

# View resource usage
docker stats

# Remove orphaned containers
docker-compose down --remove-orphans

# Prune unused images/volumes
docker system prune -a --volumes

# Export logs
docker-compose logs > docker-logs.txt
```

---

## FAQ

**Q: Can I run this on Windows/Mac/Linux?**
A: Yes! Docker Compose works identically on all platforms.

**Q: How much RAM do I need?**
A: Minimum 8GB recommended. Neo4j alone uses ~2GB.

**Q: Can I use this in production?**
A: Not as-is. This is a dev setup. See "Production Deployment" section above.

**Q: Do I need the AlcheMix frontend running?**
A: No, you can run just the API and databases:
```bash
docker-compose up neo4j postgres memmachine bar-server api
```

**Q: Can I access Neo4j Browser?**
A: Yes! http://localhost:7474 (credentials above)

**Q: Where is the data stored?**
A: In Docker volumes. Run `docker volume ls` to see them.

**Q: How do I update MemMachine?**
A: Pull latest changes and rebuild:
```bash
cd ../memmachine && git pull && cd ../alchemix
docker-compose build memmachine bar-server
docker-compose up -d
```

---

## Support

For issues:
- AlcheMix: https://github.com/YOUR_USERNAME/alchemix/issues
- MemMachine: https://github.com/MemMachine/MemMachine/issues
- Docker: https://docs.docker.com/

---

**Last Updated:** 2025-11-21
**Version:** v1.13.0 (MemMachine Integration)
