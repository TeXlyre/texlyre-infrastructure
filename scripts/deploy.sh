#!/bin/bash
set -e

ENV=${1:-local}

echo "Deploying TeXlyre infrastructure for environment: $ENV"

# Copy appropriate environment file
if [ -f ".env.$ENV" ]; then
    cp ".env.$ENV" .env
    echo "Using .env.$ENV configuration"
else
    echo "Warning: .env.$ENV not found, using existing .env"
fi

# Source environment
if [ -f ".env" ]; then
    source .env
else
    echo "Error: .env file not found. Copy .env.example to .env first."
    exit 1
fi

# Export variables
export COMPOSE_PROJECT_NAME
export ENVIRONMENT
export BASE_DOMAIN
export TRAEFIK_HOST
export PORTAINER_HOST
export FRONTEND_HOST
export ACME_EMAIL

# Run setup (includes config generation)
./scripts/setup.sh

# Start main services
echo "Starting infrastructure services..."
docker compose up -d

# Wait for Portainer to be ready
echo "Waiting for Portainer to start..."
sleep 10

# Display service information
echo ""
echo "✅ Infrastructure deployed!"
echo ""
echo "🌐 Access points:"
echo "   Portainer:  http://$PORTAINER_HOST"
echo "   Traefik:    http://$TRAEFIK_HOST"
echo "   TeXlyre:    http://$FRONTEND_HOST"
echo ""
echo "📝 Use './scripts/auto-deploy-stacks.py' to deploy service stacks"
echo "📁 Stack files available in: generated/stacks/"