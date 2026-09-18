#!/usr/bin/env bash
# Update only EventPlay; preserve nginx, credentials, SQLite and the previous release.
set -euo pipefail
RELEASE="$(realpath -e "${1:?release path required}")"
[[ "$RELEASE" == /opt/eventplay/releases/* && "$RELEASE" != *"/../"* && -f "$RELEASE/apps/api/main.py" ]] || exit 1
PREVIOUS="$(readlink -f /opt/eventplay/current)"
[[ "$PREVIOUS" == /opt/eventplay/releases/* && "$PREVIOUS" != "$RELEASE" ]] || exit 1
BACKUP="/var/lib/eventplay/backups/$(basename "$RELEASE")"
[[ ! -e "$BACKUP" ]] || { echo "Backup already exists; refusing overwrite"; exit 1; }
install -d -m 700 "$BACKUP"
cp -p /etc/nginx/conf.d/event.siping.me.conf /etc/nginx/eventplay.htpasswd "$BACKUP/"
sha256sum /etc/nginx/conf.d/event.siping.me.conf /etc/nginx/eventplay.htpasswd > "$BACKUP/config.sha256"
printf '%s\n' "$PREVIOUS" > "$BACKUP/previous-release.txt"
chown -R eventplay:eventplay "$RELEASE"
cd "$RELEASE/apps/admin"
runuser -u eventplay -- npm ci --ignore-scripts --no-audit --no-fund
runuser -u eventplay -- npm test
runuser -u eventplay -- env NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536 npm run build -- --webpack
python3.11 -m venv "$RELEASE/apps/api/.venv"
"$RELEASE/apps/api/.venv/bin/pip" install -r "$RELEASE/apps/api/requirements.txt"
chown -R eventplay:eventplay "$RELEASE/apps/api/.venv"
cd "$RELEASE/apps/api"
runuser -u eventplay -- .venv/bin/python -m unittest discover -q
# Inspect without modifying active rooms, and use SQLite's online backup API.
"$RELEASE/apps/api/.venv/bin/python" - "$BACKUP" <<'PY'
import collections,json,pathlib,sqlite3,sys
src=sqlite3.connect('/var/lib/eventplay/eventplay.sqlite3')
states=collections.Counter(json.loads(b)['state'] for (b,) in src.execute('select body from rooms'))
print('Existing room states:',dict(states))
if states['running']:
    raise SystemExit('Active games detected; postpone cutover to avoid interrupting attendees')
dst=sqlite3.connect(str(pathlib.Path(sys.argv[1])/'eventplay.sqlite3'))
src.backup(dst)
assert dst.execute('pragma integrity_check').fetchone()[0]=='ok'
dst.close();src.close()
PY
rollback() {
  echo "Cutover failed; restoring previous application release"
  ln -sfn "$PREVIOUS" /opt/eventplay/current
  systemctl restart eventplay-api eventplay-web
}
trap rollback ERR
ln -sfn "$RELEASE" /opt/eventplay/current
systemctl restart eventplay-api eventplay-web
for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:4181/login >/dev/null && curl -fsS http://127.0.0.1:8002/health >/dev/null; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:4181/login >/dev/null
curl -fsS http://127.0.0.1:8002/health
sha256sum -c "$BACKUP/config.sha256"
systemctl is-active eventplay-api eventplay-web
trap - ERR
printf '\nActive release: %s\nPrevious release: %s\nBackup: %s\n' "$RELEASE" "$PREVIOUS" "$BACKUP"
