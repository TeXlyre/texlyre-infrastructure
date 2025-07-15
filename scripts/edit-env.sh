#!/bin/bash

SERVICE_NAME=$1

if [ -z "$SERVICE_NAME" ]; then
    echo "Available services:"
    ls config/env/*.env 2>/dev/null | xargs -n1 basename | sed 's/.env$//' | sed 's/^/  /'
    echo ""
    echo "Usage: ./scripts/edit-env.sh <service-name>"
    exit 1
fi

ENV_FILE="config/env/$SERVICE_NAME.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Environment file not found: $ENV_FILE"
    echo "Run './scripts/generate-configs.py' to create it"
    exit 1
fi

# Open in default editor
${EDITOR:-nano} "$ENV_FILE"

echo "Environment file updated: $ENV_FILE"
echo "Restart the service in Portainer to apply changes"