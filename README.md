# Hawkins Sync Broadcast

Stranger Things themed synchronized broadcast system with admin-controlled media playback, live chat, and real-time audience sync.

The UI carries the InSpace theme; the codebase is documented and packaged for reuse, modification, and self-hosting.

## What It Does

- Admin-controlled playback with play, pause, seek, and source switching
- User clients synchronized over Socket.IO
- Local video uploads and YouTube sources
- SQLite-backed authentication and role checks
- Live chat and break-request workflow on the player side
- Docker support and a guided GCP bootstrap script

## Stack

- Node.js + Express
- Socket.IO
- SQLite
- Vanilla JavaScript, HTML, and CSS

## Repository Layout

- `backend/` contains the server, auth, database, media, and socket logic
- `frontend/` contains the browser UI for login, admin, and player views
- `videos/` stores uploaded media
- `data/` stores the SQLite database at runtime
- `scripts/` contains deployment helpers, including the GCP bootstrap flow

## Local Development

1. Install dependencies.

```bash
npm install
```

1. Start the server.

```bash
npm start
```

1. Open the app.

```text
http://localhost:3000
```

The default admin account is created automatically on first boot:

- username: `admin`
- password: `admin123`

Override the admin password with `ADMIN_PASSWORD`.

## One-Command GCP Bootstrap

For a fresh Ubuntu VM on GCP, run:

```bash
sudo bash scripts/bootstrap-gcp.sh
```

The script will:

- install system packages, Node.js, nginx, and build tools
- prompt for your Cloudflare API token and zone name
- ask for the subdomain label to create
- detect the VM public IP when running on GCP
- write `.env` for the app
- create and enable a systemd service
- configure nginx as a reverse proxy
- create or update the Cloudflare A record for the requested subdomain
- start the app automatically

Use a Cloudflare API token with DNS edit permissions on the target zone. Cloudflare does not support password-based DNS automation for this flow.

## Environment Variables

Copy `.env.example` and adjust as needed.

- `PORT` sets the HTTP port
- `SESSION_SECRET` sets the session signing secret
- `ADMIN_PASSWORD` sets the initial admin password
- `APP_HOSTNAME` stores the public hostname used by the bootstrap script
- `TRUST_PROXY` enables proxy-aware behavior behind nginx or Cloudflare

## Routes

- `/static/login.html` handles login and registration
- `/static/admin.html` is the admin dashboard
- `/static/player.html` is the end-user player

## API Summary

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/auth/me/username`
- `GET /api/media`
- `POST /api/media/upload` for admins
- `POST /api/media/youtube` for admins
- `POST /api/admin/activate-source` for admins

## Socket Events

Admin to server:

- `admin_control` with `play`, `pause`, or `seek`

Server to clients:

- `sync_state`
- `sync_command`
- `source_update`
- `connected_users`

## Docker

Build the image:

```bash
docker build -f docker/Dockerfile -t hawkins-sync .
```

Run the container:

```bash
docker run -p 3000:3000 hawkins-sync
```

For persistent uploads and data, mount:

- `/app/videos`
- `/app/data`

## Notes

- Local video streaming uses HTTP range responses via `/stream/:filename`.
- YouTube playback uses the browser IFrame API.
- Sessions, media metadata, and settings are stored in SQLite on disk.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the MIT License. See [LICENSE](LICENSE).
