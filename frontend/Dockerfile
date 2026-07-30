FROM node:24.13.1-alpine AS builder

RUN apk add --no-cache jq

WORKDIR /app

COPY frontend/texlyre/package*.json ./
RUN npm ci

COPY frontend/texlyre/ ./

RUN npm run build:local \
    && test -f /app/dist/userdata.local.json \
    && jq -e 'type == "object" and .version != null and (.settings | type == "object") and (.properties | type == "object")' \
    /app/dist/userdata.local.json

FROM nginx:alpine

RUN apk add --no-cache jq gettext

COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/userdata.overrides/ /etc/texlyre/overrides/
COPY frontend/docker-entrypoint.d/10-userdata.sh /docker-entrypoint.d/10-userdata.sh

RUN chmod +x /docker-entrypoint.d/10-userdata.sh

RUN sed -i \
    '/application\/javascript/a\    application/javascript                   mjs;' \
    /etc/nginx/mime.types

EXPOSE 80
