FROM node:18-alpine AS builder

WORKDIR /app
COPY /frontend/texlyre/package*.json ./
RUN npm install
COPY /frontend/texlyre/ ./
COPY /frontend/userdata.traefik.json ./userdata.json
COPY /frontend/userdata.traefik.mobile.json ./userdata.mobile.json
RUN npm run build:local

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Fix MIME types properly
RUN sed -i '/application\/javascript/a\    application/javascript                   mjs;' /etc/nginx/mime.types


EXPOSE 80

