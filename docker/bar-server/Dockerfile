FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package installer)
RUN pip install uv

# Copy bar_assistant files from mounted MemMachine volume
# The volume is mounted at /memmachine during build
ARG MEMMACHINE_PATH=/memmachine
COPY ${MEMMACHINE_PATH}/examples/bar_assistant /app/

# Install MemMachine package from mounted volume
RUN uv pip install --system -e ${MEMMACHINE_PATH}

# Install bar_assistant dependencies if they exist
RUN if [ -f requirements.txt ]; then uv pip install --system -r requirements.txt; fi
RUN if [ -f pyproject.toml ]; then uv pip install --system -e .; fi

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=15s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run bar server
CMD ["python", "bar_server.py"]
