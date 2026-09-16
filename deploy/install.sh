#!/usr/bin/env bash
set -euo pipefail
DOMAIN=event.siping.me
BASE=/opt/eventplay
RELEASE="$1"
[[ "$RELEASE" == /opt/eventplay/releases/* && -f "$RELEASE/apps/api/main.py" ]] || exit 1
id eventplay >/dev/null 2>&1 || useradd --system --home-dir "$BASE" --shell /sbin/nologin eventplay
install -d -o eventplay -g eventplay /var/lib/eventplay
chown -R eventplay:eventplay "$RELEASE"
cd "$RELEASE/apps/admin"
runuser -u eventplay -- npm ci --ignore-scripts --no-audit --no-fund
runuser -u eventplay -- env NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536 npm run build -- --webpack
python3.11 -m venv "$RELEASE/apps/api/.venv"
"$RELEASE/apps/api/.venv/bin/pip" install -r "$RELEASE/apps/api/requirements.txt"
chown -R eventplay:eventplay "$RELEASE/apps/api/.venv"
ln -sfn "$RELEASE" "$BASE/current"
install -m 644 "$RELEASE/deploy/eventplay-web.service" /etc/systemd/system/eventplay-web.service
install -m 644 "$RELEASE/deploy/eventplay-api.service" /etc/systemd/system/eventplay-api.service
systemctl daemon-reload
systemctl enable --now eventplay-api eventplay-web
systemctl restart eventplay-api eventplay-web
for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:4181/login >/dev/null && curl -fsS http://127.0.0.1:8002/health >/dev/null; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:4181/login >/dev/null
curl -fsS http://127.0.0.1:8002/health
install -d /var/www/eventplay-acme
if [[ ! -e /etc/nginx/conf.d/event.siping.me.conf ]]; then
  install -m 644 "$RELEASE/deploy/nginx-http.conf" /etc/nginx/conf.d/event.siping.me.conf
  nginx -t
  systemctl reload nginx
fi
certbot certonly --webroot -w /var/www/eventplay-acme -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
umask 077
if [[ ! -f /root/eventplay-access.txt ]]; then
  PASS=$(openssl rand -hex 12)
  printf 'Username: eventplay\nPassword: %s\n' "$PASS" > /root/eventplay-access.txt
  HASH=$(printf '%s\n' "$PASS" | openssl passwd -apr1 -stdin)
  printf 'eventplay:%s\n' "$HASH" > /etc/nginx/eventplay.htpasswd
fi
COOKIE=$(openssl rand -hex 32)
sed "s/__ACCESS_COOKIE__/$COOKIE/g" "$RELEASE/deploy/nginx-https.conf" > /etc/nginx/conf.d/event.siping.me.conf
chmod 600 /etc/nginx/conf.d/event.siping.me.conf
chmod 640 /etc/nginx/eventplay.htpasswd
chgrp nginx /etc/nginx/eventplay.htpasswd
nginx -t
systemctl reload nginx
install -d /etc/letsencrypt/renewal-hooks/deploy
install -m 755 "$RELEASE/deploy/reload-nginx.sh" /etc/letsencrypt/renewal-hooks/deploy/eventplay-reload-nginx
printf '\nEventPlay installation complete. Credentials: /root/eventplay-access.txt\n'
