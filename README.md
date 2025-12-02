# cred-assignment

Local web app with an AI copilot that builds and validates decision trees (segments + attributes) against the provided APIs. The UI is at `http://localhost:3000` with chat, live tree preview, and “Validate & Submit”.

## Prerequisites
- Node.js 20+
- npm (bundled with Node)
- SQLite (repo includes `dev.db`)
- API tokens: `BEARER_TOKEN`, `ANTHROPIC_API_KEY`

## Setup
1) Install dependencies
```bash
make install
```

2) Configure environment
```bash
cp .env.example .env.local
# fill in API_BASE_URL, BEARER_TOKEN, ANTHROPIC_API_KEY (DATABASE_URL already points to dev.db)
```



## Running
- Dev (hot reload): `make dev` then open http://localhost:3000
- Prod build: `make build`
- Start prod: `make start` (after build)
- **Run a segment/attribute sync (required before meaningful chat):** `make sync-now` (server must be running)
- One-shot setup flows:
  - Dev: `make setup-dev` (install, prisma generate, migrate, sync, start dev server)
  - Prod: `make setup-build` (install, prisma generate, migrate, sync, build, start prod server)

## Database
- Default SQLite file: `dev.db`
- Apply migrations (if you add any): `make prisma-migrate`

## Notes
- Chat/validation rely on the env tokens; ensure `.env` is set.
- Suggestions in chat can be clicked to fill the input; validated trees are stored with version history.
