# EventPlay VPS deployment

Domain: https://event.siping.me

This deployment is a password-protected preview, not production account authentication. Native WeChat login is not implemented. H5 participants also need the preview access password. Do not remove the gate until real organizer/player authentication and abuse controls are implemented.

## Layout

- `/opt/eventplay/current`: active release symlink
- `/opt/eventplay/releases/`: versioned source and builds
- `/var/lib/eventplay/eventplay.sqlite3`: persistent realtime room database
- `/root/eventplay-access.txt`: preview credentials (never commit)
- `/etc/nginx/conf.d/event.siping.me.conf`: HTTPS reverse proxy
- `eventplay-web`: Next.js, loopback port 4181
- `eventplay-api`: single-worker FastAPI, loopback port 8002

Run `bash deploy/install.sh /opt/eventplay/releases/<release>` as root on the target server after extracting source there. Requires Node 22, Python 3.11, nginx, certbot and DNS pointing to the server. Installation builds the frontend and installs backend dependencies. Existing unrelated virtual hosts are preserved. Certificate renewal uses certbot with a nginx reload hook.

The frontend requires Basic authentication; successful access sets a secure HttpOnly preview cookie. `/realtime/` requires that cookie while preserving Bearer room/player tokens. Unauthenticated requests should return 401 for pages and 403 for realtime endpoints. The API is not publicly bound.

## Operations

```sh
systemctl status eventplay-web eventplay-api
journalctl -u eventplay-web -u eventplay-api -n 100
nginx -t
```

Back up SQLite using its backup API and preserve credentials/config before updates. A backend restart pauses active rounds. Organizer demo activities remain in each browser's localStorage; local development activities are not automatically migrated. Create and publish an activity on the deployed origin, then create a real-time room from the host page.

2026-09-16 verification: HTTPS dashboard 200 with credentials, unauthorized page 401 without cookie issuance, unauthorized API 403, room create/join/start/tap/finish and WSS score delivery passed. A completed `Deployment smoke test` room is retained for deployment diagnostics.

## Cartoon race release — 2026-09-16

- Active release: `/opt/eventplay/releases/20260916-cartoon-race` (tested working-tree source, not a new Git commit).
- Previous release retained: `/opt/eventplay/releases/20260916-616bb74`.
- SQLite backup: `/var/lib/eventplay/backup-before-race-20260916.sqlite3`.
- Adds bright cartoon stadium, four team-colored horse animation strips, sprint notice, final standings including ties, and responsive/fullscreen presentation.
- Local checks: production build, 5 frontend tests, 25 backend tests, browser regression for race/quiz/draw including fullscreen and mobile layout.
- Server checks: Linux production build, 25 backend tests, HTTPS dashboard and five race assets, anonymous access rejection, join/start/tap/WSS/finish. Nginx and password-file checksums unchanged.
- Completed diagnostic room: `pALPAc6ov-3XrbLV`. No active race was present at deployment. Existing database and preview credentials were preserved.
- Rollback if needed: repoint `/opt/eventplay/current` to the previous release and restart `eventplay-web` and `eventplay-api`. Do not automatically restore the database backup: doing so would discard activity created after deployment.
