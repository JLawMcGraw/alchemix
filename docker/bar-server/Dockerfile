FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package installer)
RUN pip install uv

# Copy bar_assistant files from build context
COPY memmachine/examples/bar_assistant /app/

# Copy additional required modules from examples
COPY memmachine/examples/base_query_constructor.py /app/
COPY memmachine/examples/default_query_constructor.py /app/
COPY memmachine/examples/example_server.py /app/

# Copy health endpoint helper and wrapper script
COPY alchemix/docker/bar-server/health_endpoint.py /app/
COPY alchemix/docker/bar-server/bar_server_wrapper.py /app/

# Install MemMachine package
COPY memmachine /tmp/memmachine
RUN uv pip install --system -e /tmp/memmachine

# Install bar_assistant dependencies if they exist
RUN if [ -f requirements.txt ]; then uv pip install --system -r requirements.txt; fi
RUN if [ -f pyproject.toml ]; then uv pip install --system -e .; fi

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=15s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run bar server wrapper (includes health endpoint)
CMD ["python", "bar_server_wrapper.py"]
