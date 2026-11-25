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

Redis also carries the `filepizza`, `texlive` and `texlive2026` profiles, so these services
activate their shared Redis dependency even when `redis` is not written explicitly.

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

* **Traefik Dashboard**: http://localhost:8080/dashboard/ (on the Docker host)
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

For direct public hosting with automatic Let's Encrypt certificates, copy the production
settings:

```bash
cp envfile.production .env
```

Set `BASE_DOMAIN` and `PRODUCTION_DOMAIN` to your public domain, configure `FRONTEND_HOST`
and `PORTAINER_HOST` if used, and select the required `SERVICES`. For example:

```env
SERVICES=texlive,texlive2026
ACME_EMAIL=your@email.com
COMPOSE_FILE=docker-compose.yml:docker-compose.production.yml
```

```bash
docker compose pull
docker compose up -d --no-build --remove-orphans
```

The production override requires Docker Compose 2.24.4 or later. It publishes HTTP and
HTTPS on all host addresses (including IPv6 where supported), redirects HTTP to HTTPS,
disables the Traefik dashboard and stores certificates in the `traefik-certs` volume.
Point the selected service hostnames at the server and allow inbound ports 80 and 443
before starting. Use public DNS without a tunnel or proxy for direct HTTP validation.
Use `docker compose restart traefik` to retry issuance after fixing DNS or routing.

For a tunnel or externally terminated TLS, omit `COMPOSE_FILE` to retain the base
configuration. The base dashboard is available only on the Docker host at
`http://localhost:8080/dashboard/`.

For direct HTTPS with recipes, regenerate them with `npm run recipes`, then use
`docker compose -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.recipes.yml up -d --remove-orphans`.
Use the same files for subsequent management commands.

`TRAEFIK_VERSION` defaults to `v3.7` and requires Docker API 1.40 or later. If automatic
API negotiation fails, set `TRAEFIK_DOCKER_API_VERSION` to a compatible version reported
by `docker version`. `LOG_MAX_SIZE` and `LOG_MAX_FILES` default to `10m` and `3`.

`envfile.production` sets `TEXLYRE_USERDATA_VARIANT=production`, which uses `https://`
and `wss://` endpoint layers for selected services. Keep management services out of
`SERVICES` unless you intend to expose them and have secured access.

### HTTPS Access

* **TeXlyre Frontend**: https://texlyre.yourdomain.com/texlyre/
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
tree. Interrupted downloads in the default managed volume are retried on the next
start. Completed downloads record the archive configuration; changing it requires a
controlled volume migration. Existing valid trees without a marker are reused without
assuming their version. `TEXMF_ROOT` is never downloaded into or cleared automatically.

The default archive is produced by the `build-texlive-full` workflow in
`texlyre-busytex-build`. That workflow installs the full TeX Live 2026 scheme, prunes
content not needed by the on-demand server, and publishes the result under the stable
`texlive-full-2026.1.0` release.

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

Storage and ACP recipes can declare persistent Docker volumes. Unnamed volumes retain
their existing Compose-managed names. If a recipe declares an explicit `volumes[].name`,
the generator treats that volume as **external**: it must already exist, and Compose
will not silently create an empty replacement. Restore the original volume or create
a genuinely new one with `docker volume create <name>` before deploying. Never mount
the same Garage volume into two running Garage instances (e.g., running it through the infrastructure and Chelys standalone simultaneously). Note to retain volume data, metadata,
configuration, and `storage.env` together when backing it up or restoring a storage volume.

ACP recipes generate `generic-acp-configs` with newline-delimited transport
(`contentLength: false`) and forward any declared secret environment variable from
the Compose environment instead of embedding its value in generated files. For the
Claude Agent recipe, set `ANTHROPIC_API_KEY` in the shell or a private, untracked
`.env` file, then select `RECIPES=acp/claude-agent`. Do not place secrets in recipe
references. ACP endpoints can consume paid API access: restrict the Traefik endpoint
to trusted clients, especially when using a publicly reachable deployment.

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
