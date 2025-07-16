# texlyre-infrastructure
An omni-repo for deploying all TeXlyre servers

# Scripts

To build and deploy containers:

```bash
# You should create a new .env.local if you want your own settings and edit them there ONLY
cp envfile.local .env
git submodule deinit --all -f
git submodule update --init --recursive --remote
# To update submodules to lastest version
# git submodule update --remote --merge
docker compose up -d --build
```

To stop containers:

```bash
docker compose down
```

# Links

* Traefik Dashboard: http://traefik.localhost:8082
* Portainer: http://portainer.localhost:8082
* TeXlyre Frontend: http://texlyre.localhost:8082/texlyre/

## Portainer localhost (HTTP)
* FilePizza: http://filepizza.localhost:8082 (new container: infra-filepizza-server)
* Y-WebRTC: http://ywebrtc.localhost:8082 (new container: infra-y-webrtc-server)
* PeerJS: http://peerjs.localhost:8082 (new container: infra-peerjs-server)
* TeXlive: http://texlive.localhost:8082 (new container: infra-texlive-ondemand-server)

## Portainer localhost (TLS)
* FilePizza: https://filepizza.localhost:8443 (new container: infra-filepizza-server)
* Y-WebRTC: https://ywebrtc.localhost:8443 (new container: infra-y-webrtc-server)
* PeerJS: https://peerjs.localhost:8443 (new container: infra-peerjs-server)
* TeXlive: https://texlive.localhost:8443 (new container: infra-texlive-ondemand-server)

