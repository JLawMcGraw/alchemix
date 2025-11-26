# AlcheMix Docker Quick Start Guide

Quick reference for getting the AlcheMix Docker environment running on your Mac.

## Prerequisites

- Docker Desktop installed and running
- Git installed
- OpenAI API key
- Anthropic API key

## Setup (5 minutes)

### 1. Clone Repositories

Both `alchemix` and `MemMachine` must be in the same parent directory:

```bash
cd ~/Desktop/DEV  # Or your preferred location

# Clone AlcheMix (if not already)
git clone https://github.com/YOUR_USERNAME/alchemix.git

# Clone MemMachine fork (if not already)
git clone https://github.com/JLawMcGraw/MemMachine.git
```

### 2. Configure Environment

```bash
cd alchemix
cp .env.docker .env
```

Edit `.env` and add your API keys:
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-secure-jwt-secret-minimum-32-characters
```

### 3. Start Services

```bash
docker-compose up --build
```

First run takes 5-10 minutes. Services start in this order:
1. Neo4j + PostgreSQL (databases)
2. MemMachine (memory service)
3. Bar Server (query constructor)
4. API (Express backend)
5. Frontend (Next.js)

### 4. Verify

Open in your browser:
- **Frontend:** http://localhost:3001
- **API Health:** http://localhost:3000/health
- **Neo4j Browser:** http://localhost:7474 (neo4j/alchemixpassword)

## Common Commands

```bash
# Start services (detached)
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f
docker compose logs -f memmachine

# Rebuild after code changes
docker compose up --build

# Check service status
docker compose ps

# Restart specific service
docker compose restart api
```

**Note:** Use `docker compose` (space) not `docker-compose` (hyphen) for Docker Compose V2.

## Troubleshooting

### Mac: Docker command not found

If you get "command not found: docker" even though Docker Desktop is running:

```bash
# Check if Docker is in Applications
ls -la /Applications/Docker.app

# If yes, create symlinks manually
sudo ln -s /Applications/Docker.app/Contents/Resources/bin/docker /usr/local/bin/docker
sudo ln -s /Applications/Docker.app/Contents/Resources/bin/docker-credential-desktop /usr/local/bin/docker-credential-desktop
sudo ln -s /Applications/Docker.app/Contents/Resources/bin/docker-credential-ecr-login /usr/local/bin/docker-credential-ecr-login
sudo ln -s /Applications/Docker.app/Contents/Resources/bin/docker-credential-osxkeychain /usr/local/bin/docker-credential-osxkeychain

# Verify
docker --version
```

**Note:** Use `docker compose` (space) not `docker-compose` (hyphen) - Docker Compose V2 syntax.

### Neo4j "already running" error

If Neo4j container exits with "Neo4j is already running":

```bash
# Stop all containers and restart
docker compose down
docker compose up
```

### Services won't start

```bash
# Clean everything and rebuild
docker compose down -v
docker system prune -af
docker compose up --build
```

### Check service health

```bash
docker compose ps
# All services should show (healthy) status
```

### View service logs

```bash
# All services
docker compose logs

# Specific service
docker compose logs memmachine
docker compose logs bar-server
docker compose logs api
```

### Port already in use

```bash
# Find what's using the port
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Can't login with test credentials

Test users don't exist in your local database. Create a test user:

```bash
node create-test-user.js
```

Or sign up through the app at http://localhost:3001

## Architecture

```
Frontend (3001) → API (3000) → Bar Server (8001) → MemMachine (8080)
                                                           ↓
                                                  Neo4j (7687) + Postgres (5432)
```

## Development Workflow

1. Make code changes in `alchemix/api/` or `alchemix/src/`
2. Changes auto-reload (hot reload enabled)
3. For MemMachine changes: `docker-compose build memmachine && docker-compose up -d`

## Data Persistence

Data is stored in Docker volumes and persists between restarts:
- `neo4j_data` - Graph database
- `postgres_data` - User profiles
- `./api/data/alchemix.db` - SQLite database

## Need Help?

- Full documentation: `docker_setup.md`
- View service status: `docker-compose ps`
- View logs: `docker-compose logs -f [service-name]`
- Check health: Visit http://localhost:3000/health

---

**Ready to code!** 🧪🍹
