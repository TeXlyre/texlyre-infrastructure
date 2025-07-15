#!/bin/bash
set -e

PROJECT_NAME=${COMPOSE_PROJECT_NAME:-texlyre-infra}

echo "Setting up TeXlyre infrastructure with project name: $PROJECT_NAME"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required for dynamic configuration generation"
    exit 1
fi

# Install PyYAML if not available
python3 -c "import yaml" 2>/dev/null || {
    echo "Installing PyYAML..."
    pip3 install PyYAML --user
}

# Clean up any existing network with wrong labels
NETWORK_NAME="${PROJECT_NAME}-traefik"
if docker network ls | grep -q "$NETWORK_NAME"; then
    echo "Removing existing network: $NETWORK_NAME"
    docker network rm "$NETWORK_NAME" 2>/dev/null || echo "Network removal failed or already removed"
fi

# Generate dynamic configurations
echo "Generating service configurations..."
python3 scripts/generate-configs.py

# Initialize git submodules
echo "Initializing git submodules..."
git submodule update --init --recursive

# Build frontend if needed
if [ -d "frontend/texlyre" ]; then
    echo "Building TeXlyre frontend..."
    cd frontend/texlyre
    if [ -f "package.json" ]; then
        npm install
        npm run build
    fi
    cd ../..
fi

# Copy generated traefik configs
if [ -d "generated/traefik/dynamic" ]; then
    echo "Copying generated Traefik configurations..."
    cp -r generated/traefik/dynamic/* traefik/dynamic/ 2>/dev/null || echo "No dynamic configs to copy"
fi

echo "Setup complete! Run './scripts/deploy.sh [env]' to start services."
echo "Containers will be prefixed with: ${PROJECT_NAME}-"