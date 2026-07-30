FROM node:24-alpine AS builder

WORKDIR /app
COPY /frontend/texlyre/package*.json ./
RUN npm install
COPY /frontend/texlyre/ ./
RUN npm run build:local

FROM nginx:alpine

RUN apk add --no-cache jq gettext

COPY --from=builder /app/dist /usr/share/nginx/html
COPY /frontend/userdata.overrides/ /etc/texlyre/overrides/
COPY /frontend/docker-entrypoint.d/10-userdata.sh /docker-entrypoint.d/10-userdata.sh

RUN chmod +x /docker-entrypoint.d/10-userdata.sh

# Fix MIME types properly
RUN sed -i '/application\/javascript/a\    application/javascript                   mjs;' /etc/nginx/mime.types


EXPOSE 80
