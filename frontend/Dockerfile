FROM node:18-alpine AS builder

WORKDIR /app
COPY /frontend/texlyre/package*.json ./
RUN npm install
COPY /frontend/texlyre/ ./
COPY /frontend/userdata.json ./userdata.json
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Fix MIME types properly
RUN sed -i '/application\/javascript/a\    application/javascript                   mjs;' /etc/nginx/mime.types

EXPOSE 80