#!/bin/bash
set -e

echo "Initializing TeXlyre service submodules..."

# Add all TeXlyre services as submodules
git submodule add git@github.com:TeXlyre/texlyre.git frontend/texlyre
git submodule add git@github.com:TeXlyre/texlive-ondemand-server.git services/texlive-ondemand-server
git submodule add git@github.com:TeXlyre/y-webrtc-server.git services/y-webrtc-server
git submodule add git@github.com:TeXlyre/filepizza-server.git services/filepizza-server
git submodule add git@github.com:TeXlyre/peerjs-server.git services/peerjs-server

echo "✅ All submodules added!"
echo ""
echo "Next steps:"
echo "1. Run './scripts/deploy.sh local' to set up infrastructure"
echo "2. Configure environment files in config/env/"
echo "3. Deploy services through Portainer"