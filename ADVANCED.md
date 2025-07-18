# Advanced Configuration

## Network Hosting

For hosting on your local network or internet, you will need to make a copy of `frontend/userdata.local.json` to 
`frontend/userdata.json` and modify it to point to your network address of each service. 
Use network configuration (and modify the `.env` file after the copy):

```bash
cp envfile.network .env
# Edit .env and set your server IP 
cp frontend/userdata.local.json frontend/userdata.json
# Edit frontend/userdata.json to change all links to services to point to the network addresses (see bellow)
docker compose -f docker-compose.yml -f docker-compose.custom-ports.yml up -d --build
```

### Required Environment Variables

```env
BIND_IP=0.0.0.0
HTTP_PORT_FILEPIZZA=8083
HTTP_PORT_TEXLIVE=8084
HTTP_PORT_YWEBRTC=8085
HTTP_PORT_PEERJS=8086
```

### Network Access URLs

**Direct Service Access:**
* **FilePizza**: http://[YOUR_IP]:8083
* **Y-WebRTC**: http://[YOUR_IP]:8085
* **PeerJS**: http://[YOUR_IP]:8086
* **TeXlive**: http://[YOUR_IP]:8084

**Traefik Routing (still available):**
* **Traefik Dashboard**: http://traefik.[YOUR_IP]:8082
* **Portainer**: http://portainer.[YOUR_IP]:8082
* **TeXlyre Frontend**: http://[YOUR_IP]:8082/texlyre/
* **FilePizza**: http://filepizza.[YOUR_IP]:8082
* **Y-WebRTC**: http://ywebrtc.[YOUR_IP]:8082
* **PeerJS**: http://peerjs.[YOUR_IP]:8082
* **TeXlive**: http://texlive.[YOUR_IP]:8082

## Production Deployment

For production with SSL certificates and domain routing:

```bash
cp envfile.network .env
# Configure your domain and SSL settings
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
```

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

## Custom Port Configuration

When using network hosting, custom ports prevent conflicts and provide direct access:

```bash
docker compose -f docker-compose.yml -f docker-compose.custom-ports.yml up -d --build
```

This configuration exposes services on dedicated ports while maintaining subdomain routing through Traefik.

## Networking Requirements

### Local Network
- Configure router port forwarding if accessing from outside local network
- Ensure firewall allows configured ports

### Production
- DNS A records for domain and subdomains
- SSL certificate management (Let's Encrypt automatic renewal)
- Reverse proxy configuration
- Security headers and rate limiting