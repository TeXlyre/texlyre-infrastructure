# Advanced Configuration

## Network Hosting

For hosting on your local network or internet, use the network configuration and point
the frontend at your network addresses:

```bash
cp envfile.network .env
# Edit .env and set PRODUCTION_DOMAIN to your server IP
docker compose -f docker-compose.yml -f docker-compose.custom-ports.yml up -d
```

Traefik subdomain routing keeps working. If you also want the frontend to communicate with the
directly exposed ports instead of going through Traefik, uncomment and edit
`TEXLYRE_USERDATA` in `.env`:

```env
TEXLYRE_USERDATA={"settings":{"collab-signaling-servers":"ws://[YOUR_IP]:8085/","file-sync-server-url":"http://[YOUR_IP]:8083","latex-texlive-endpoint":"http://[YOUR_IP]:8084","latex-busytex-endpoint":"http://[YOUR_IP]:8087"}}
```

That layer is merged last, so it overrides whatever `TEXLYRE_USERDATA_VARIANT` set.

### Required Environment Variables

```env
BIND_IP=0.0.0.0
HTTP_PORT_FILEPIZZA=8083
HTTP_PORT_TEXLIVE=8084
HTTP_PORT_YWEBRTC=8085
HTTP_PORT_PEERJS=8086
HTTP_PORT_TEXLIVE2026=8087
```

### Network Access URLs

**Direct Service Access:**
* **FilePizza**: http://[YOUR_IP]:8083
* **Y-WebRTC**: http://[YOUR_IP]:8085
* **PeerJS**: http://[YOUR_IP]:8086
* **TeXlive**: http://[YOUR_IP]:8084
* **TeXLive 2026**: http://[YOUR_IP]:8087

**Traefik Routing:**
* **Traefik Dashboard**: http://traefik.[YOUR_IP]:8082
* **Portainer**: http://portainer.[YOUR_IP]:8082
* **TeXlyre Frontend**: http://[YOUR_IP]:8082/texlyre/
* **FilePizza**: http://filepizza.[YOUR_IP]:8082
* **Y-WebRTC**: http://ywebrtc.[YOUR_IP]:8082
* **PeerJS**: http://peerjs.[YOUR_IP]:8082
* **TeXlive**: http://texlive.[YOUR_IP]:8082
* **TeXLive 2026**: http://texlive2026.[YOUR_IP]:8082

## Production Deployment

For production with SSL certificates and domain routing:

```bash
cp envfile.production .env
# Configure your domain and SSL settings
docker compose up -d
```

`envfile.production` sets `TEXLYRE_USERDATA_VARIANT=production`, which points the
frontend at `https://` and `wss://` subdomains of `PRODUCTION_DOMAIN`.

### SSL Configuration

Production deployment requires:
1. Valid domain name pointing to your server
2. SSL certificate configuration in Traefik
3. Firewall configuration for ports 80, 443
4. DNS configuration for subdomains

### Production Environment Variables

```env
DOMAIN=yourdomain.com
BIND_IP=0.0.0.0
TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_EMAIL=your@email.com
```

### HTTPS Access

**Production URLs:**
* **TeXlyre Frontend**: https://yourdomain.com/texlyre/
* **FilePizza**: https://filepizza.yourdomain.com
* **Y-WebRTC**: https://ywebrtc.yourdomain.com
* **PeerJS**: https://peerjs.yourdomain.com
* **TeXlive**: https://texlive.yourdomain.com
* **TeXLive 2026**: https://texlive2026.yourdomain.com

## Custom Port Configuration

When using network hosting, custom ports prevent conflicts and provide direct access:

```bash
docker compose -f docker-compose.yml -f docker-compose.custom-ports.yml up -d
```

This configuration exposes services on dedicated ports while maintaining subdomain routing through Traefik.

## TeXLive 2026 Server

The service builds from `services/texlyre-busytex-build/texlive-server`, which is a
subdirectory of the submodule rather than its root. It requires a TeX Live 2026
`texmf-dist` tree on the host, mounted read-only at `/texmf`, and caches path lookups
in the shared `redis` service.

The tree is supplied by whichever of these is set:

| Variable | Effect |
|---|---|
| `TEXMF_URL` | default; `texlive2026-texmf` downloads and unpacks the archive into the `texmf` named volume on first start |
| `TEXMF_ROOT` | absolute host path bind mounted read-only, no download, overrides the URL |
| neither | the init container fails with instructions, and the server does not start |

`TEXMF_STRIP` controls `tar --strip-components` and defaults to `1`, matching an
archive whose single top-level directory is `texmf-dist`.

```bash
TEXMF_URL=https://example.org/texmf-dist.tar.zst
docker compose --profile texlive2026 up -d
```

`texlive2026-server` waits on `service_completed_successfully`, so a failed or missing
download stops the server from starting against an empty tree rather than serving 301s
for every request.

The archive is produced by the `build-texlive-full` workflow in `texlyre-busytex-build`,
which downloads the TeX Live 2026 ISO, runs `install-tl` with `scheme-full`, prunes
`doc/`, `source/`, `scripts/`, `bin/` and `tlpkg/`, and publishes the result to the
`texlive-full-2026` release. That tag is stable, so the default `TEXMF_URL` keeps working
across rebuilds. If the release has not been published yet, the init container says so
rather than failing with a bare download error.

Because it sits behind the `texlive2026` profile, plain `docker compose up -d` leaves it
untouched. The publish workflow builds it regardless of the profile.

## Image Publishing and Versions

Every buildable service in `docker-compose.yml` declares both an `image:` tag and an
`x-publish:` block. `scripts/publish-matrix.cjs` reads that file and emits the CI build
matrix, so the compose file is the only place a version is decided.

Versions here are owned by this repo, not inherited from the upstream forks, because a
submodule pins a commit rather than a release. Bump the tag whenever you move a
submodule pointer.

Images are labelled with `org.opencontainers.image.source` and `.revision` pointing at
the submodule's own repository and commit, since the building repo is not the source
repo. Use `x-publish.source` when the build context is not the submodule root, as with
`texlive2026-server`.

Until the first successful run of that workflow no tags exist yet, which is harmless:
every service keeps its `build:` context, so `docker compose up -d --build` compiles from
the submodules and tags the result under the GHCR name locally. The registry only becomes
the source once something has been pushed there.

To publish a new build:

1. Move the submodule pointer (or merge the Renovate PR that does).
2. Bump the matching `image:` tag in `docker-compose.yml`.
3. Push to `main`.

Existing tags are never overwritten unless you run the workflow manually with `force`.

### Consuming from Chelys

When `RECIPES_DISPATCH_TOKEN` is configured, each successful publish dispatches an
`image-published` event to `TeXlyre/chelys-recipes` with the service name and image
reference, so the matching recipe version can be raised automatically. Without the
secret, that step is skipped and publishing works as normal.
