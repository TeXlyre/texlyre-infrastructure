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
* TeXlyre Frontend: http://localhost:8082/texlyre/ (also works with `IP:PORT/texlyre/` and HTTPS [Remember to change the port])

## Portainer localhost (HTTP)
* FilePizza: http://filepizza.localhost:8082 (new container: infra-filepizza-server)
* Y-WebRTC: http://ywebrtc.localhost:8082 (new container: infra-y-webrtc-server)
* PeerJS: http://peerjs.localhost:8082 (new container: infra-peerjs-server)
* TeXlive: http://texlive.localhost:8082 (new container: infra-texlive-ondemand-server)

## Portainer localhost (TLS) [Problems with cetificates for filepizza+peerjs_local]
* FilePizza: https://filepizza.localhost:8443
* Y-WebRTC: https://ywebrtc.localhost:8443 
* PeerJS: https://peerjs.localhost:8443 (BROKEN: problems with certicate when connecting to local peerjs)
* TeXlive: https://texlive.localhost:8443

## Network IP (BIND_IP: 0.0.0.0) [Same for HTTP, just change port 8082 and protocol to http://]
* FilePizza: https://192.168.0.63:8443/filepizza (BROKEN: expects filepizza hosted on root)
* Y-WebRTC: https://192.168.0.63:8443/ywebrtc (seemingly working: rember to add /ywebretc prefix)
* PeerJS: https://192.168.0.63:8443/peerjs (seemingly working: rember to add /peerjs prefix)
* TeXlive: https://192.168.0.63:8443/texlive (seemingly working: rember to add /texlive prefix)
