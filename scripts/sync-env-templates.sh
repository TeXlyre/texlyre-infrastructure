#!/bin/bash
set -e

echo "Syncing environment templates from submodules..."

# Ensure directories exist
mkdir -p config/env-templates

# Sync templates from each service
for service_dir in services/*/; do
    if [ -d "$service_dir" ]; then
        service_name=$(basename "$service_dir")
        envfile_path="$service_dir/envfile"
        template_path="config/env-templates/$service_name.env"

        if [ -f "$envfile_path" ]; then
            cp "$envfile_path" "$template_path"
            echo "  ✅ Synced: $service_name.env"
        else
            echo "  ⚠️  No envfile found for: $service_name"
        fi
    fi
done

echo "Template sync complete!"