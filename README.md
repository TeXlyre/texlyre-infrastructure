# texlyre-infrastructure
An omni-repo for deploying all TeXlyre servers

# Scripts

```bash
# You should create a new .env.local if you want your own settings and edit them there ONLY
cp envfile .env.local
./quick-start.sh
./auto-deploy-stacks.sh
```

# Links

* Traefik Dashboard: http://traefik.localhost:8082
* Portainer: http://portainer.localhost:8082
* TeXlyre Frontend: http://texlyre.localhost:8082/texlyre/

## Current localhost (no portainer)
* FilePizza: http://localhost:8080 (container: filepizza-server-filepizza-1)
* Y-WebRTC: http://localhost:4444 (container: y-webrtc-y-webrtc-signaling-1)
* PeerJS: http://localhost:9000 (container: peerjs-server-peerjs-1)
* APT/SwiftLaTeX: http://localhost:5004 (container: apt)

## Portainer localhost (not working yet - possibly clashing with running servers)
* FilePizza: http://files.localhost:8082 (new container: infra-filepizza-server)
* Y-WebRTC: http://sync.localhost:8082 (new container: infra-y-webrtc-server)
* PeerJS: http://peer.localhost:8082 (new container: infra-peerjs-server)
* TeXlive: http://compile.localhost:8082 (new container: infra-texlive-ondemand-server)