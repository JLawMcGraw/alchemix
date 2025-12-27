# Docker Configuration

This directory contains Docker-related configuration files for AlcheMix services.

## Directory Structure

```
docker/
├── docker-compose.yml          # Main Docker Compose config
├── docker-compose.dev.yml      # Development overrides (infrastructure only)
├── docker-compose.prod.yml     # Production overrides
├── docker-compose.test.yml     # Test overrides
├── Dockerfile.dev              # Development frontend Dockerfile
├── Dockerfile.prod             # Production frontend Dockerfile
├── docker-start.sh             # Startup script
├── .env.example                # Environment variables template
└── memmachine/
    ├── config.yaml.template    # MemMachine config template
    └── entrypoint.sh           # Entrypoint for env var substitution
```

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- MemMachine repository cloned as sibling directory:
  ```
  parent-folder/
  ├── alchemix/      # This repo
  └── memmachine/    # github.com/JLawMcGraw/memmachine
  ```

### Start Services

```bash
# Copy environment template
cp docker/.env.example docker/.env

# Edit .env with your API keys
# Required: OPENAI_API_KEY (for MemMachine embeddings)

# Option 1: Infrastructure only (recommended for development)
# Runs Neo4j, Postgres, MemMachine in Docker; API/Frontend locally
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d
npm run dev:all

# Option 2: Full stack in Docker
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Neo4j | 17474, 17687 | Graph database for vector embeddings |
| Postgres | 5432 | Profile storage (pgvector enabled) |
| MemMachine | 8080 | Semantic memory API (v2) |
| API | 3000 | Express backend |
| Frontend | 3001 | Next.js frontend |

## MemMachine Configuration

MemMachine is the core memory service that manages episodic and semantic memory for the AI Bartender.

### Files

- **config.yaml.template**: Configuration with environment variable placeholders
- **entrypoint.sh**: Substitutes `${VAR}` syntax with actual values at runtime

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for embeddings |
| `NEO4J_URI` | Neo4j connection URI |
| `NEO4J_USER` | Neo4j username |
| `NEO4J_PASSWORD` | Neo4j password |
| `POSTGRES_HOST` | PostgreSQL host |
| `POSTGRES_PORT` | PostgreSQL port |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_PASSWORD` | PostgreSQL password |

## Important Notes

1. **Build Context**: The memmachine service uses `../..` (grandparent) as build context
   - Requires `alchemix` and `memmachine` to be sibling directories
   - Docker Compose runs from the `alchemix/docker/` directory

2. **Environment Variables**: Keep sensitive values in `.env` file
   - Never commit API keys or passwords to git
   - `.env` is already in `.gitignore`

3. **Health Checks**: All services have health endpoints
   - MemMachine: `http://localhost:8080/api/v2/health`
   - API: `http://localhost:3000/health`

4. **PostgreSQL**: Uses `pgvector/pgvector:pg16` for vector extension support
   - Required for MemMachine profile storage

## Common Commands

```bash
# View logs
docker compose -f docker/docker-compose.yml logs -f

# View specific service logs
docker compose -f docker/docker-compose.yml logs -f memmachine

# Restart a service
docker compose -f docker/docker-compose.yml restart memmachine

# Stop all services
docker compose -f docker/docker-compose.yml down

# Stop and remove volumes (clean slate)
docker compose -f docker/docker-compose.yml down -v

# Rebuild a service
docker compose -f docker/docker-compose.yml build --no-cache memmachine
```

## Troubleshooting

**Neo4j or Postgres connection refused**
- Wait 30-60 seconds after starting - databases need time to initialize
- Check logs: `docker compose -f docker/docker-compose.yml logs neo4j`

**MemMachine health check failing**
- Ensure Neo4j and Postgres are healthy first
- Check OPENAI_API_KEY is set in `.env`
- View logs: `docker compose -f docker/docker-compose.yml logs memmachine`

**Port conflicts**
- Neo4j uses 17474/17687 (mapped to avoid Windows Hyper-V conflicts)
- If ports are in use, stop other services or modify `docker-compose.yml`
