#!/bin/bash
set -e

SERVICE_NAME=$1
SUBDOMAIN=$2
PORT=$3
DESCRIPTION=$4

if [ -z "$SERVICE_NAME" ] || [ -z "$SUBDOMAIN" ] || [ -z "$PORT" ]; then
    echo "Usage: ./scripts/add-service.sh <service-name> <subdomain> <port> [description]"
    echo "Example: ./scripts/add-service.sh auth-server auth 4000 'Authentication service'"
    exit 1
fi

echo "Adding new service: $SERVICE_NAME"

# Add to services.yml
python3 -c "
import yaml

# Load existing config
with open('services/services.yml', 'r') as f:
    config = yaml.safe_load(f)

# Add new service
config['services']['$SERVICE_NAME'] = {
    'subdomain': '$SUBDOMAIN',
    'port': $PORT,
    'description': '$DESCRIPTION' if '$DESCRIPTION' else 'New service',
    'env_file': '$SERVICE_NAME.env'
}

# Write back
with open('services/services.yml', 'w') as f:
    yaml.dump(config, f, default_flow_style=False)

print('✅ Service added to configuration')
"

# Regenerate configurations
python3 scripts/generate-configs.py

echo "✅ Service $SERVICE_NAME added successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Add git submodule: git submodule add <repo-url> services/$SERVICE_NAME"
echo "2. Edit config/env/$SERVICE_NAME.env with your service settings"
echo "3. Run './scripts/deploy.sh' to update infrastructure"