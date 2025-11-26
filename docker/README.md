# Docker Configuration

This directory contains Docker-related configuration files for AlcheMix services.

## Directory Structure

```
docker/
├── bar-server/
│   ├── Dockerfile              # Bar Server container config
│   ├── health_endpoint.py      # Health check endpoint
│   └── bar_server_wrapper.py   # Wrapper script with health endpoint
└── memmachine/
    ├── config.yaml.template    # MemMachine config template (env vars substituted)
    └── entrypoint.sh          # Entrypoint script for env var substitution
```

## Bar Server

The Bar Server is a FastAPI middleware that implements the `BarQueryConstructor` for AlcheMix-specific memory queries.

### Files

- **Dockerfile**: Builds the bar-server image
  - Uses Python 3.12
  - Copies MemMachine examples and base modules
  - Installs MemMachine package
  - Includes health endpoint wrapper

- **health_endpoint.py**: Adds `/health` endpoint to the FastAPI app
  - Returns `{"status": "healthy", "service": "bar-server"}`

- **bar_server_wrapper.py**: Wrapper around `bar_server.py`
  - Initializes BarQueryConstructor
  - Adds health endpoint
  - Starts FastAPI server

### Build Context

The Dockerfile build context is set to the **parent directory** (`..`) to access both:
- `alchemix/docker/bar-server/` (this directory)
- `MemMachine/examples/` (sibling repository)

## MemMachine

MemMachine is the core memory service that manages episodic and profile memory.

### Files

- **config.yaml.template**: Configuration template with placeholders
  - Uses environment variable syntax: `${VARIABLE_NAME}`
  - Contains database credentials, API keys, and service URLs
  - Substituted at runtime by entrypoint script

- **entrypoint.sh**: Container entrypoint script
  - Uses `envsubst` to replace environment variables in config template
  - Creates `config.yaml` from template
  - Executes the original CMD

### Environment Variable Substitution

The entrypoint script automatically substitutes these variables in the config:
- `${OPENAI_API_KEY}` - OpenAI API key for embeddings
- `${NEO4J_URI}` - Neo4j connection URI
- `${NEO4J_USER}` - Neo4j username
- `${NEO4J_PASSWORD}` - Neo4j password
- `${POSTGRES_HOST}` - PostgreSQL host
- `${POSTGRES_PORT}` - PostgreSQL port
- `${POSTGRES_USER}` - PostgreSQL username
- `${POSTGRES_DB}` - PostgreSQL database name
- `${POSTGRES_PASSWORD}` - PostgreSQL password

### Build Context

The MemMachine Dockerfile build context is also set to the **parent directory** to access:
- `MemMachine/` (sibling repository)
- `alchemix/docker/memmachine/` (this directory)

## Important Notes

1. **Build Context**: Both services use `..` (parent directory) as build context
   - This requires `alchemix` and `MemMachine` to be sibling directories
   - Docker Compose runs from the `alchemix/` directory

2. **Environment Variables**: All sensitive values should be in `.env` file
   - Never commit API keys or passwords to git
   - Template files use `${VAR}` syntax for substitution

3. **Health Checks**: All services must have working health endpoints
   - Bar Server: `/health`
   - MemMachine: `/health` (built-in)
   - API: `/health` (built-in)

4. **PostgreSQL**: Must use `pgvector/pgvector:pg16` for vector extension support
   - Standard PostgreSQL images don't include pgvector
   - Required for MemMachine profile storage

## Rebuilding

When making changes to these files:

```bash
# Rebuild specific service
docker-compose build memmachine
docker-compose build bar-server

# Rebuild and restart
docker-compose up --build -d

# Force clean rebuild
docker-compose down
docker-compose build --no-cache memmachine
docker-compose up -d
```

## Debugging

```bash
# Check if files are copied correctly
docker run --rm alchemix-memmachine:latest ls -la /app/
docker run --rm alchemix-bar-server:latest ls -la /app/

# Test health endpoints
curl http://localhost:8080/health  # MemMachine
curl http://localhost:8001/health  # Bar Server

# View environment variables
docker-compose run --rm memmachine env | grep MEMORY
docker-compose run --rm bar-server env | grep PORT
```
