# texlyre-infrastructure

An omni-repo for deploying all TeXlyre servers

## Quick Start

Create your local environment file and deploy:

```bash
cp envfile.local .env
git submodule deinit --all -f
git submodule update --init --recursive --remote
docker compose up -d --build
```

To update submodules to latest version:
```bash
git submodule update --remote --merge
```

To stop containers:
```bash
docker compose down
```

## Custom Port Access

For direct port access when using network hosting (`BIND_IP=0.0.0.0`):

```bash
docker compose -f docker-compose.yml -f docker-compose.custom-ports.yml up -d --build
```

## Service Access

### Management Services

* **Traefik Dashboard**: http://traefik.localhost:8082
* **Portainer**: http://portainer.localhost:8082

### Application Services

#### Default Access (via Traefik)

**HTTP:**
* **TeXlyre Frontend**: http://localhost:8082/texlyre/
* **FilePizza**: http://filepizza.localhost:8082
* **Y-WebRTC**: http://ywebrtc.localhost:8082
* **PeerJS**: http://peerjs.localhost:8082
* **TeXlive**: http://texlive.localhost:8082

**HTTPS:**
* **TeXlyre Frontend**: https://localhost:8443/texlyre/
* **FilePizza**: https://filepizza.localhost:8443
* **Y-WebRTC**: https://ywebrtc.localhost:8443
* **PeerJS**: https://peerjs.localhost:8443
* **TeXlive**: https://texlive.localhost:8443

#### Network Access (Custom Ports Required)

When using network hosting (`BIND_IP=0.0.0.0`), you **must** specify custom ports for each service:

**Custom Port Configuration Required:**
```env
HTTP_PORT_FILEPIZZA=8083
HTTP_PORT_TEXLIVE=8084
HTTP_PORT_YWEBRTC=8085
HTTP_PORT_PEERJS=8086
```

Deploy with:
```bash
docker compose -f docker-compose.yml -f docker-compose.custom-ports.yml up -d --build
```

#### Direct Service Access

With custom ports configured:
* **FilePizza**: http://localhost:8083, http://[YOUR_IP]:8083
* **Y-WebRTC**: http://localhost:8085, http://[YOUR_IP]:8085
* **PeerJS**: http://localhost:8086, http://[YOUR_IP]:8086
* **TeXlive**: http://localhost:8084, http://[YOUR_IP]:8084

**Standard Access (still available):**
* All services remain accessible via subdomain routing through Traefik

## Environment Configuration

Copy and modify environment files as needed:
* `envfile.local` - Local development
* `envfile.network` - Network hosting example

Key variables for custom ports:
```env
HTTP_PORT_FILEPIZZA=8083
HTTP_PORT_TEXLIVE=8084
HTTP_PORT_YWEBRTC=8085
HTTP_PORT_PEERJS=8086
```

## Container Names

Services are deployed with the following container names:
* `${COMPOSE_PROJECT_NAME}-traefik`
* `${COMPOSE_PROJECT_NAME}-portainer`
* `${COMPOSE_PROJECT_NAME}-frontend`
* `${COMPOSE_PROJECT_NAME}-filepizza`
* `${COMPOSE_PROJECT_NAME}-ywebrtc`
* `${COMPOSE_PROJECT_NAME}-peerjs`
* `${COMPOSE_PROJECT_NAME}-texlive`
* `${COMPOSE_PROJECT_NAME}-redis`