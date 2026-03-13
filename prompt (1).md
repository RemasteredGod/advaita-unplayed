# Hawkins Sync Broadcast --- Full Project Prompt

## Project Goal

Build a **Stranger Things themed synchronized video broadcast system**
where one Admin (Broadcaster) controls playback and multiple Users watch
the same video **in real time with perfect synchronization**.

The system will be deployed via **Docker**, pushed to **GitHub**, pulled
on a **cloud VM**, and exposed through a **Cloudflare subdomain**.

------------------------------------------------------------------------

# Core Concept

A web application where:

-   **Admin (Broadcaster)** controls the video
-   **Users (Listeners)** watch the video in sync
-   All clients receive **play, pause, and seek updates in real time**

Synchronization is achieved using **WebSockets (Socket.io)**.

------------------------------------------------------------------------

# Architecture

Users\
↓\
Cloudflare DNS / Subdomain\
↓\
Cloudflare Tunnel (optional)\
↓\
Cloud VM (Docker container)\
↓\
Node.js Server\
↓\
Socket.io Synchronization\
↓\
Frontend Video Player

Video is delivered using **HTTP video streaming** (HTML5 `<video>` with
range requests).

------------------------------------------------------------------------

# Technology Stack

Backend - Node.js - Express - Socket.io - SQLite

Frontend - HTML - CSS - Vanilla JavaScript - HTML5 video

Deployment - Docker - GitHub - Cloud VM - Cloudflare DNS

------------------------------------------------------------------------

# Roles

## Admin

Permissions: - Login as admin - Select video - Play / pause - Seek
timeline - Broadcast events to users - View connected users

## Users

Permissions: - Register/login - Receive a random username - Join player
page - Watch synchronized video - Change username

------------------------------------------------------------------------

# Random Username Generation

New users receive a random username such as:

hopper-421\
dustin-193\
vecna-551\
max-202\
eleven-912

Users can edit their username later.

------------------------------------------------------------------------

# Synchronization Logic

Admin actions emit events:

play\
pause\
seek\
video_change

Example event:

``` json
{
 "action": "play",
 "time": 123.4
}
```

Server broadcasts events to all clients.

Clients update the video player accordingly.

------------------------------------------------------------------------

# Admin Dashboard UI

Example layout:

HAWKINS LAB CONTROL TERMINAL

Select Video\
\[movie.mp4\]

\[PLAY\] \[PAUSE\]

Timeline\
\|------------------\|

Connected Agents\
hopper-221\
max-322\
lucas-111

------------------------------------------------------------------------

# User Player UI

UPSIDE DOWN BROADCAST

VIDEO PLAYER

STATUS: SYNCHRONIZED\
SYNC OFFSET: 0.02s

------------------------------------------------------------------------

# Project Folder Structure

    hawkins-sync/

    backend/
      server.js
      auth.js
      socket.js
      database.js

    frontend/
      index.html
      login.html
      admin.html
      player.html
      style.css
      player.js
      admin.js

    videos/
      sample.mp4

    docker/
      Dockerfile

    package.json
    README.md

------------------------------------------------------------------------

# Database Schema

SQLite table:

users

id\
username\
password_hash\
role

Roles:

admin\
user

------------------------------------------------------------------------

# Socket Events

Admin → Server

play\
pause\
seek\
video_change

Server → Clients

sync_play\
sync_pause\
sync_seek\
video_update

------------------------------------------------------------------------

# Video Streaming

Video is served using HTTP streaming.

HTML5 video example:

    <video src="/videos/movie.mp4" controls></video>

Browsers request video in chunks using **range requests**, enabling
efficient streaming.

------------------------------------------------------------------------

# Docker Deployment

Dockerfile:

    FROM node:20

    WORKDIR /app

    COPY package*.json ./
    RUN npm install

    COPY . .

    EXPOSE 3000

    CMD ["node", "backend/server.js"]

------------------------------------------------------------------------

# Deployment Workflow

## Local Development

Build container:

docker build -t hawkins-sync .

Run container:

docker run -p 3000:3000 hawkins-sync

Open:

http://localhost:3000

------------------------------------------------------------------------

# GitHub Deployment

Initialize repo:

git init\
git add .\
git commit -m "initial commit"

Push to GitHub.

------------------------------------------------------------------------

# Server Deployment

On VM:

git clone REPOSITORY_URL

cd hawkins-sync

docker build -t hawkins-sync .

docker run -p 3000:3000 hawkins-sync

------------------------------------------------------------------------

# Domain Setup

Create subdomain:

sync.yoursite.com

Add DNS record in Cloudflare pointing to the server.

Alternatively use Cloudflare Tunnel.

------------------------------------------------------------------------

# Master Prompt for AI Code Generation

Use the following prompt to generate the entire project.

------------------------------------------------------------------------

Create a complete full-stack project called **Hawkins Sync Broadcast**.

Goal: A Stranger Things themed synchronized video broadcast system where
one Admin (Broadcaster) controls playback and multiple Users watch the
same video in real time.

Tech stack: - Node.js - Express - Socket.io - SQLite database - HTML5
video player - Vanilla JavaScript - CSS retro Stranger Things theme -
Docker deployment

Features required:

Authentication: - Login and registration - Roles: admin and user -
SQLite database storing users - Password hashing - Random username
generation for new users

Admin features: - Admin dashboard page - Select video from server
folder - Play, pause, and seek controls - Broadcast playback events via
Socket.io - Show connected users list

User features: - Video player page - Watch synchronized playback -
Cannot control playback - Can change username

Synchronization logic: - Admin actions emit events: play, pause, seek,
video_change - Server broadcasts events to all connected clients -
Clients update HTML5 video player accordingly - Include a sync indicator
showing video time difference

UI design: - Retro Hawkins Lab terminal style - Dark background - Red
neon accents - CRT scanline effect - Monospace retro fonts - Terminal
style dashboard

Requirements: - Use Express static serving - WebSocket via Socket.io -
SQLite for user storage - Secure role validation - Prevent users from
sending admin events - Show connected users list - Random username
generator

Docker: Provide a working Dockerfile that runs the Node server and
exposes port 3000.

Output: Generate all code files with proper folder structure and
comments explaining the system.
