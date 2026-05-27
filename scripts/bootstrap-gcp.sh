#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="advaita-unplayed"
SERVICE_NAME="advaita-unplayed"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NGINX_SITE="/etc/nginx/sites-available/${SERVICE_NAME}"
NGINX_LINK="/etc/nginx/sites-enabled/${SERVICE_NAME}"
ENV_FILE="${PROJECT_ROOT}/.env"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo: sudo bash scripts/bootstrap-gcp.sh"
  exit 1
fi

cd "${PROJECT_ROOT}"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git nginx build-essential python3

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

prompt_default() {
  local message="$1"
  local default_value="$2"
  local reply=""
  read -r -p "${message} [${default_value}]: " reply
  echo "${reply:-$default_value}"
}

generate_secret() {
  python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
}

fetch_gcp_public_ip() {
  curl -fsH 'Metadata-Flavor: Google' \
    http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip \
    2>/dev/null || true
}

upsert_cloudflare_record() {
  local api_token="$1"
  local zone_name="$2"
  local record_name="$3"
  local record_content="$4"
  local proxied="$5"

  python3 - "$api_token" "$zone_name" "$record_name" "$record_content" "$proxied" <<'PY'
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

api_token, zone_name, record_name, record_content, proxied = sys.argv[1:6]
proxied = proxied.lower() == 'true'

def api_request(method, url, payload=None):
    headers = {
        'Authorization': f'Bearer {api_token}',
        'Content-Type': 'application/json',
    }
    data = None if payload is None else json.dumps(payload).encode('utf-8')
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
      with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as error:
      body = error.read().decode('utf-8', errors='ignore')
      raise SystemExit(f'Cloudflare API error: {error.code} {body}')

zones = api_request(
    'GET',
    f'https://api.cloudflare.com/client/v4/zones?name={urllib.parse.quote(zone_name)}',
)
zone_result = zones.get('result') or []
if not zone_result:
    raise SystemExit(f'Cloudflare zone not found: {zone_name}')

zone_id = zone_result[0]['id']
records = api_request(
    'GET',
    'https://api.cloudflare.com/client/v4/zones/{}/dns_records?type=A&name={}'.format(
        zone_id, urllib.parse.quote(record_name)
    ),
)
record_result = records.get('result') or []
payload = {
    'type': 'A',
    'name': record_name,
    'content': record_content,
    'ttl': 1,
    'proxied': proxied,
}

if record_result:
    record_id = record_result[0]['id']
    api_request(
        'PUT',
        f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id}',
        payload,
    )
    print(f'Updated Cloudflare A record for {record_name} -> {record_content}')
else:
    api_request(
        'POST',
        f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records',
        payload,
    )
    print(f'Created Cloudflare A record for {record_name} -> {record_content}')
PY
}

read -r -p "Cloudflare API token: " CLOUDFLARE_API_TOKEN
read -r -p "Cloudflare zone name (example.com): " CLOUDFLARE_ZONE_NAME
read -r -p "Subdomain label (watch, media, etc.): " SUBDOMAIN_LABEL

if [[ -z "${SUBDOMAIN_LABEL}" ]]; then
  echo "Subdomain label is required."
  exit 1
fi

FULL_HOSTNAME="${SUBDOMAIN_LABEL}.${CLOUDFLARE_ZONE_NAME}"
PUBLIC_IP="$(fetch_gcp_public_ip)"
if [[ -z "${PUBLIC_IP}" ]]; then
  read -r -p "Public IPv4 address for this server: " PUBLIC_IP
fi

PORT="$(prompt_default 'App port' '3000')"
ADMIN_PASSWORD="$(prompt_default 'Admin password' 'admin123')"
SESSION_SECRET_DEFAULT="$(generate_secret)"
SESSION_SECRET="$(prompt_default 'Session secret' "${SESSION_SECRET_DEFAULT}")"
TRUST_PROXY="$(prompt_default 'Trust proxy behind Cloudflare/nginx (1 or 0)' '1')"
ENABLE_PROXIED_DNS="$(prompt_default 'Proxy the Cloudflare record through Cloudflare (1 or 0)' '1')"

cat > "${ENV_FILE}" <<EOF
PORT=${PORT}
SESSION_SECRET=${SESSION_SECRET}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
APP_HOSTNAME=${FULL_HOSTNAME}
TRUST_PROXY=${TRUST_PROXY}
EOF

chmod 600 "${ENV_FILE}"

cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=${APP_NAME}
After=network.target

[Service]
Type=simple
WorkingDirectory=${PROJECT_ROOT}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${PROJECT_ROOT}/backend/server.js
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

cat > "${NGINX_SITE}" <<EOF
server {
    listen 80;
    server_name ${FULL_HOSTNAME};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
EOF

ln -sf "${NGINX_SITE}" "${NGINX_LINK}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
systemctl restart nginx

upsert_cloudflare_record "${CLOUDFLARE_API_TOKEN}" "${CLOUDFLARE_ZONE_NAME}" "${FULL_HOSTNAME}" "${PUBLIC_IP}" "${ENABLE_PROXIED_DNS}"

cat <<EOF

Bootstrap complete.
App hostname: https://${FULL_HOSTNAME}
Local service: http://127.0.0.1:${PORT}
Config written to: ${ENV_FILE}
Systemd service: ${SERVICE_FILE}
EOF