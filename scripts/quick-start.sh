#!/bin/bash
set -e

echo "🚀 TeXlyre Infrastructure Quick Start"
echo "===================================="

# Check if submodules exist and initialize if needed
echo "📦 Checking git submodules..."

# Initialize existing submodules
git submodule update --init --recursive

# Add missing submodules only if they don't exist
declare -A submodules=(
    ["frontend/texlyre"]="git@github.com:TeXlyre/texlyre.git"
    ["services/texlive-ondemand-server"]="git@github.com:TeXlyre/texlive-ondemand-server.git"
    ["services/y-webrtc-server"]="git@github.com:TeXlyre/y-webrtc-server.git"
    ["services/filepizza-server"]="git@github.com:TeXlyre/filepizza-server.git"
    ["services/peerjs-server"]="git@github.com:TeXlyre/peerjs-server.git"
)

for path in "${!submodules[@]}"; do
    if [ ! -d "$path" ]; then
        echo "  Adding missing submodule: $path"
        git submodule add "${submodules[$path]}" "$path"
    else
        echo "  ✅ Submodule exists: $path"
    fi
done

# Deploy infrastructure
echo ""
echo "🏗️  Deploying infrastructure..."
./scripts/deploy.sh local

echo ""
echo "✅ TeXlyre infrastructure is ready!"
echo ""
echo "🌐 Access Points:"
echo "   • Portainer:     http://portainer.localhost"
echo "   • Traefik:       http://traefik.localhost"
echo "   • TeXlyre:       http://texlyre.localhost"
echo ""
echo "📋 Available APIs:"
echo "   • LaTeX Compile: http://compile.localhost"
echo "   • File Transfer: http://files.localhost"
echo "   • Sync Server:   http://sync.localhost"
echo "   • Peer Server:   http://peer.localhost"
echo ""
echo "📝 Next Steps:"
echo "1. Access Portainer and create admin user"
echo "2. Deploy services using generated/stacks/ files"
echo "3. Configure environments in config/env/"