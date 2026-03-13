# Hawkins Sync Broadcast

Stranger Things themed synchronized broadcast system with:

- Admin-controlled playback (play, pause, seek)
- User clients synced in real time with Socket.io
- Media source support for uploaded local videos and YouTube URLs
- SQLite auth and role enforcement
- Dockerized runtime

## Tech Stack

- Node.js + Express
- Socket.io
- SQLite
- Vanilla JS + HTML + CSS

## Quick Start

1. Install dependencies:

```bash
npm install
```

1. Start server:

```bash
npm start
```

1. Open browser:

- <http://localhost:3000>

Default admin account:

- username: `admin`
- password: `admin123` (override with `ADMIN_PASSWORD` env var)

## Key Routes

- `/static/login.html` - login and registration
- `/static/admin.html` - admin dashboard
- `/static/player.html` - user player

## API Overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/auth/me/username`
- `GET /api/media`
- `POST /api/media/upload` (admin only)
- `POST /api/media/youtube` (admin only)
- `POST /api/admin/activate-source` (admin only)

## Socket Events

Admin -> Server:

- `admin_control` with action `play|pause|seek`

Server -> Clients:

- `sync_state`
- `sync_command`
- `source_update`
- `connected_users`

## Docker

Build image:

```bash
docker build -f docker/Dockerfile -t hawkins-sync .
```

Run container:

```bash
docker run -p 3000:3000 hawkins-sync
```

For persistent uploads/database in containerized runs, mount volumes for:

- `/app/videos`
- `/app/data`

## Notes

- Local video streaming uses HTTP range responses via `/stream/:filename`.
- YouTube playback uses the IFrame API in the browser.
- This is MVP scope and uses in-memory session store for simplicity.
