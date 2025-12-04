#!/bin/sh
set -e

# Substitute environment variables in config.yaml
envsubst < /app/config.yaml.template > /app/config.yaml

echo "Generated config.yaml with environment variables"

# Run the original command
exec "$@"
