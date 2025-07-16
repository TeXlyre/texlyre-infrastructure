FROM node:18-alpine AS builder

WORKDIR /app
COPY /frontend/texlyre/package*.json ./
RUN npm install
COPY /frontend/texlyre/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80