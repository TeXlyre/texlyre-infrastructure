# Advanced Configuration

## Service Selection

The supplied environment files derive Docker Compose profiles from `SERVICES`:

```env
SERVICES=all
COMPOSE_PROFILES=${SERVICES:-all}
```

`all` starts every built-in service. `none` starts only the unprofiled Traefik routing
core. A custom selection is a comma-separated combination of:

```text
frontend, portainer, filepizza, ywebrtc, peerjs, texlive, texlive2026, proxy, redis
```

Redis also carries the `filepizza` and `texlive2026` profiles, so either service activates
its shared Redis dependency even when `redis` is not written explicitly.

The frontend receives the same `SERVICES` value. Its entrypoint applies only the
`<variant>.<service>.json` endpoint layers belonging to selected services. Removing a
service therefore stops the container and leaves the corresponding TeXlyre userdata key
untouched after the frontend is recreated.

Use the npm `up` wrappers, or add `--remove-orphans` to a direct `docker compose up`, when
changing the selection so containers from the previous profile set are removed:

```bash
npm run up
# or
docker compose up -d --remove-orphans
```

`npm run down` activates every profile for removal, regardless of the current selection.

## Network Hosting

For hosting on a local network or the internet, use the network configuration and point
`PRODUCTION_DOMAIN` at the server address:

```bash
cp envfile.network .env
# Edit .env and replace [YOUR_IP]
docker compose -f docker-compose.yml -f docker-compose.custom-ports.yml up -d --remove-orphans
```

Traefik subdomain routing remains available. To make the frontend use the directly exposed
ports instead, uncomment `TEXLYRE_USERDATA` and include only endpoints for services that
are selected in `SERVICES`:

```env
TEXLYRE_USERDATA={"settings":{"collab-signaling-servers":"ws://[YOUR_IP]:8085/","file-sync-server-url":"http://[YOUR_IP]:8083","latex-texlive-endpoint":"http://[YOUR_IP]:8084","latex-busytex-endpoint":"http://[YOUR_IP]:8087"}}
```

The inline layer is merged last and therefore overrides the selected deployment and
service layers.

### Direct Port Variables

```env
BIND_IP=0.0.0.0
HTTP_PORT_FILEPIZZA=8083
HTTP_PORT_TEXLIVE=8084
HTTP_PORT_YWEBRTC=8085
HTTP_PORT_PEERJS=8086
HTTP_PORT_TEXLIVE2026=8087
```

### Network Access URLs

The following URLs exist only for selected services.

**Direct service access:**

* **FilePizza**: http://[YOUR_IP]:8083
* **TeX Live**: http://[YOUR_IP]:8084
* **Y-WebRTC**: http://[YOUR_IP]:8085
* **PeerJS**: http://[YOUR_IP]:8086
* **TeX Live 2026**: http://[YOUR_IP]:8087
* **Repository Proxy**: http://[YOUR_IP]:8088

**Traefik routing:**

* **Traefik Dashboard**: http://traefik.[YOUR_IP]:8082
* **Portainer**: http://portainer.[YOUR_IP]:8082
* **TeXlyre Frontend**: http://[YOUR_IP]:8082/texlyre/
* **FilePizza**: http://filepizza.[YOUR_IP]:8082
* **Y-WebRTC**: http://ywebrtc.[YOUR_IP]:8082
* **PeerJS**: http://peerjs.[YOUR_IP]:8082
* **TeX Live**: http://texlive.[YOUR_IP]:8082
* **TeX Live 2026**: http://texlive2026.[YOUR_IP]:8082
* **Repository Proxy**: http://proxy.[YOUR_IP]:8082

## Production Deployment

> **Repository Proxy exposure.** `ALLOWED_ORIGINS` sets a CORS header, which only
> constrains browsers rather than access control. Anything that can reach
> `proxy.yourdomain.com` can use it to download from any host in `ALLOWED_HOSTS`
> at your bandwidth. Keep `PROXY_ALLOWED_HOSTS` to the links you import
> from or drop it from `SERVICES` if the
> deployment is public and does not need URL import.

For production with TLS and domain routing:

```bash
cp envfile.production .env
# Configure PRODUCTION_DOMAIN and Traefik certificate settings
docker compose up -d --remove-orphans
```

`envfile.production` sets `TEXLYRE_USERDATA_VARIANT=production`, which uses `https://`
and `wss://` endpoint layers for selected services.

### Production Environment Variables

```env
PRODUCTION_DOMAIN=yourdomain.com
BIND_IP=0.0.0.0
TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_EMAIL=your@email.com
```

Production deployment also requires DNS records for the selected service subdomains,
valid certificate configuration in Traefik, and firewall access to ports 80 and 443.

### HTTPS Access

* **TeXlyre Frontend**: https://yourdomain.com/texlyre/
* **FilePizza**: https://filepizza.yourdomain.com
* **Y-WebRTC**: https://ywebrtc.yourdomain.com
* **PeerJS**: https://peerjs.yourdomain.com
* **TeX Live**: https://texlive.yourdomain.com
* **TeX Live 2026**: https://texlive2026.yourdomain.com
* **Repository Proxy**: https://proxy.yourdomain.com

## Custom Port Configuration

`docker-compose.custom-ports.yml` exposes the service ports directly while retaining
Traefik routing:

```bash
docker compose -f docker-compose.yml -f docker-compose.custom-ports.yml up -d --remove-orphans
```

Disabled profile services are ignored even though the override file contains their port
mapping.

## TeX Live 2026 Storage

`texlive2026-server` builds from
`services/texlyre-busytex-build/texlive-server`. It requires a TeX Live 2026
`texmf-dist` tree mounted read-only at `/texmf` and uses the shared Redis service for path
lookup caching.

The tree is supplied by one of these variables:

| Variable | Effect |
|---|---|
| `TEXMF_URL` | The `texlive2026-texmf` initializer downloads and unpacks the archive into the `texmf` named volume on first start. |
| `TEXMF_ROOT` | An absolute host path is mounted instead, bypassing the download. |
| neither | The initializer fails with instructions and the server is not started against an empty tree. |

`TEXMF_STRIP` controls `tar --strip-components` and defaults to `1`, matching an archive
whose single top-level directory is `texmf-dist`.

The default environment files select `texlive2026`, so the initializer and server start
with the rest of the stack:

```bash
docker compose up -d
```

To start only this built-in service group with Traefik:

```bash
SERVICES=texlive2026 COMPOSE_PROFILES=texlive2026 docker compose up -d --remove-orphans
```

`texlive2026-server` waits for `texlive2026-texmf` to complete successfully. A failed or
missing archive therefore prevents the server from returning redirects against an empty
tree.

The default archive is produced by the `build-texlive-full` workflow in
`texlyre-busytex-build`. That workflow installs the full TeX Live 2026 scheme, prunes
content not needed by the on-demand server, and publishes the result under the stable
`texlive-full-2026` release.

## Chelys Recipes

`RECIPES` accepts comma- or whitespace-separated recipe references:

```text
[<type>/]<id>[@<version>][?<variable>=<value>&...]
```

For example:

```env
RECIPES=sile@0.15.13,ltex-ls-plus?language=en-GB
```

`npm run recipes` resolves the references from `RECIPES_REGISTRY` (defaulting to the
public Chelys recipe registry), writes `docker-compose.recipes.yml`, and writes the
matching frontend userdata layer. Start it with `npm run up:recipes`. Run
`npm run recipes:list-verbose` to inspect recipe variables.

## Image Publishing and Versions

Every buildable service in `docker-compose.yml` declares both an `image:` tag and an
`x-publish:` block. `scripts/publish-matrix.cjs` reads that file and emits the CI build
matrix, so the Compose file is the only place an infrastructure image version is decided.

Image versions are owned by this repository rather than inherited from the upstream forks,
since each fork's release is independent of the deployment bundle. The `image:` tag is
bumped whenever a submodule pin moves.

Images are labelled with `org.opencontainers.image.source` and `.revision` pointing at
the submodule repository and commit. `x-publish.source` names the submodule when the build
context is a subdirectory of it, as with `texlive2026-server`.

Until the first successful workflow run, the published tags may not exist. Every service
retains its `build:` context, so `docker compose up -d --build` can build and tag it
locally.

To publish a new build:

1. Move the submodule pointer, or merge the Renovate PR that does so.
2. Bump the matching `image:` tag in `docker-compose.yml`.
3. Push to `main`.

Existing tags are not overwritten unless the workflow is run manually with `force`.

### Build Architecture

Multi-platform images are built on native runners. The workflow expands each service's
`x-publish.platforms` into one job per platform, maps `linux/arm64` to
`ubuntu-24.04-arm`, pushes each build by digest, and then assembles the manifest list.
Build cache scopes are separated by service and platform.

### Submodule Pinning

A version is declared once and propagated in one direction:

```text
.gitmodules tag=  ->  submodule commit  ->  docker-compose.yml image tag
```

`scripts/sync-submodule-tags.cjs` fetches tags, checks out each declared tag, and stages
the resulting commit. `scripts/sync-compose-tags.cjs` reads the exact tag at each source
and rewrites the service's `image:` tag, removing a leading `v` from semantic versions.

```bash
npm run sync
npm run sync:check
```

Git itself does not interpret the custom `tag` property in `.gitmodules`; the recorded
submodule commit is what `git submodule update` restores, and these scripts keep it equal
to the declared release.

### Consuming Images from Chelys

When `RECIPES_DISPATCH_TOKEN` is configured, each successful image publish dispatches an
`image-published` event to `TeXlyre/chelys-recipes` with the service name and image
reference. The matching recipe version can then be updated after the multi-platform
manifest exists. Without the secret, image publishing proceeds without dispatching.
