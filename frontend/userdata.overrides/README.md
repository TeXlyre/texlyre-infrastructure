# Userdata overrides

Each file here is a partial TeXlyre userdata document containing only the keys a
deployment needs to change. On container start `10-userdata.sh` deep-merges the
selected layers onto the defaults shipped inside the image and writes the result
to `userdata.local.json`, which TeXlyre loads in preference to `userdata.json`.

Select a variant with `TEXLYRE_USERDATA_VARIANT` (`traefik` or `production`).
`<variant>.json` applies to both layouts; `<variant>.mobile.json` applies to the
mobile layout only. `${BASE_DOMAIN}`, `${PRODUCTION_DOMAIN}`, `${HTTP_PORT}` and
`${HTTPS_PORT}` are substituted from the container environment.

Built-in service endpoints are separate `<variant>.<service>.json` layers. The
entrypoint applies one only when that service is present in `SERVICES`; omitting a
service therefore leaves its corresponding TeXlyre userdata setting unchanged.
`SERVICES=all` enables every built-in service, while `SERVICES=none` applies no
service endpoint layers.

Set `TEXLYRE_USERDATA` to a JSON object to override any further setting without
adding a file, for example:

```env
TEXLYRE_USERDATA={"settings":{"theme-variant":"atom_light","editor-font-size":"md"}}
```

That layer is applied last, so it wins over the variant and service layers.
`TEXLYRE_USERDATA_MOBILE` does the same for the mobile document and falls back to
`TEXLYRE_USERDATA`.
