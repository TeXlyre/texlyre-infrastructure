#!/bin/bash
set -e

ENV=${1:-local}

echo "Cleaning up TeXlyre infrastructure for environment: $ENV"

# Load environment
if [ -f ".env.$ENV" ]; then
    source ".env.$ENV"
elif [ -f ".env" ]; then
    source ".env"
else
    echo "Error: No environment file found"
    exit 1
fi

echo "Stopping and removing containers with project name: $COMPOSE_PROJECT_NAME"

# Stop and remove all containers
docker compose down -v --remove-orphans

# Remove network
docker network rm "${COMPOSE_PROJECT_NAME}-traefik" 2>/dev/null || echo "Network already removed"

# Remove volumes (optional - uncomment if needed)
# docker volume rm "${COMPOSE_PROJECT_NAME}-certs" 2>/dev/null || true
# docker volume rm "${COMPOSE_PROJECT_NAME}-portainer-data" 2>/dev/null || true

echo "Cleanup complete for project: $COMPOSE_PROJECT_NAME"