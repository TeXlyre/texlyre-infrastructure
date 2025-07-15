#!/bin/bash

SERVICE_NAME=$1

if [ -z "$SERVICE_NAME" ]; then
    echo "Showing all environment files:"
    echo ""
    for env_file in config/env/*.env; do
        if [ -f "$env_file" ]; then
            service_name=$(basename "$env_file" .env)
            echo "=== $service_name ==="
            grep -v '^#' "$env_file" | grep -v '^$' || echo "  (empty)"
            echo ""
        fi
    done
    exit 0
fi

ENV_FILE="config/env/$SERVICE_NAME.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Environment file not found: $ENV_FILE"
    exit 1
fi

echo "Environment for $SERVICE_NAME:"
echo ""
cat "$ENV_FILE"