# Contributing

Thanks for helping improve Advaita Unplayed.

## Before you start

- Read the README to understand the runtime, routes, and deployment model.
- Keep changes focused and avoid unrelated refactors.
- Follow the existing vanilla JS, Express, and SQLite patterns already in the repo.

## Local development

1. Install dependencies with `npm install`.
2. Start the app with `npm start`.
3. Open `http://localhost:3000` in your browser.

## Coding guidelines

- Preserve the current API contracts unless a change requires a break.
- Prefer small, reviewable patches.
- Update docs when behavior or deployment changes.
- Do not commit generated data, uploads, or secrets.

## Pull requests

- Describe what changed and why.
- Call out any deployment or migration steps.
- Include screenshots or short clips for UI changes when useful.

## Security

- Never commit `.env` values, database files, uploaded videos, or Cloudflare credentials.
- If you add a deployment helper, use least-privilege credentials and document the required permissions.