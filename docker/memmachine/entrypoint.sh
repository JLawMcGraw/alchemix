#!/bin/sh
set -e

# Substitute environment variables in config.yaml
envsubst < /app/config.yaml.template > /app/config.yaml

# Run the original command
exec "$@"