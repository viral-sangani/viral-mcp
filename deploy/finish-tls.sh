#!/usr/bin/env bash
# Run on the server once DNS (mcp.thefriday.xyz → this host) resolves.
# Issues the Let's Encrypt cert via the signal-nginx webroot and enables HTTPS.
set -euo pipefail

DOMAIN=mcp.thefriday.xyz
CONF=/opt/signal/infra/nginx/conf.d/mcp.conf
LE_DIR=/opt/signal/infra/certs/letsencrypt
WEBROOT=/opt/signal/infra/certs/webroot

if ! dig +short "$DOMAIN" A | grep -q .; then
  echo "DNS for $DOMAIN does not resolve yet — add the A record first." >&2
  exit 1
fi

docker run --rm \
  -v "$LE_DIR:/etc/letsencrypt" \
  -v "$WEBROOT:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --non-interactive --agree-tos -m admin@thefriday.xyz

if ! grep -q "listen 443" "$CONF"; then
  cat >> "$CONF" <<'EOF'

server {
    listen 443 ssl;
    http2 on;
    server_name mcp.thefriday.xyz;

    ssl_certificate     /etc/letsencrypt/live/mcp.thefriday.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.thefriday.xyz/privkey.pem;

    location / {
        proxy_pass http://viral-mcp:3030;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        # MCP responses stream over SSE: no buffering, long read timeout.
        proxy_buffering off;
        proxy_read_timeout 660s;
        proxy_http_version 1.1;
    }
}
EOF
fi

docker exec signal-nginx nginx -t
docker exec signal-nginx nginx -s reload
echo "HTTPS enabled for $DOMAIN"
