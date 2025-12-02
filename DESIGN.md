# DESIGN

## Goals
- Enable an AI copilot to build/validate decision trees against a known API surface.
- Zero API calls on the chat hot path after initial sync (segments/attributes cached locally).
- Resilient persistence: conversations, trees, and versions stored in SQLite via Prisma.

## Architecture Overview
- **Frontend (Next.js app)**: Chat UI with tool output visibility, suggestion chips, live tree preview, and sidebar controls.
- **API routes**:
  - `/api/chat`: Streams AI responses (Anthropic via Vercel AI SDK), injects tools, persists conversation state, autogenerates titles.
  - `/api/sync-segments`: Triggers segment/attribute sync from upstream APIs into SQLite.
  - `/api/segments`, `/api/attributes`: Serve cached data to the UI/tools.
  - `/api/conversations/*`: CRUD for conversations, messages, titles, and tree versions.
- **AI agent**:
  - System prompt enforces validation-first behavior and emits structured `<SUGGESTIONS>` blocks (grouped segments/attributes/other) for clickable UI chips.
  - Tools: `get_segments`, `get_attributes`, `update_tree` (calls external Validator API, persists validated trees with versioning).
  - Config: `claude-sonnet-4-20250514`, max steps 10.
- **Data layer (Prisma/SQLite)**:
  - Core tables: Segment, Attribute, SyncMetadata, Conversation, ChatMessage, TreeVersion.
  - SyncMetadata tracks cache timestamp to gate Validator calls.
- **Sync service** (`src/lib/segment-sync-service.js`):
  - `syncSegments` chooses initial vs incremental.
  - Initial sync: fetch users pages, extract unique segments, sync attributes (list + details), set `lastSyncAt`.
  - Incremental: `/v1/users/changes` since `lastSyncAt`, upsert new segments, resync attributes, update totals.
  - Used by `/api/sync-segments` and the UI “Sync Segments Now” button; Make targets call it (`sync-now` via HTTP, `sync-direct` via direct import).
  - Background scheduler (`src/lib/sync-scheduler.js`) starts on server boot and runs sync hourly (configurable via `SYNC_INTERVAL_MS`); guarded to avoid overlap/hot reload duplication.

## Key Flows
### Chat flow
1. User creates/loads a conversation (quick create API or sidebar).
2. `useChat` posts to `/api/chat` with `conversationId`.
3. Route checks conversation exists, optionally generates a title, wires tools (auto-injects `conversationId` into `update_tree`).
4. Agent streams text + tool calls; suggestion blocks are parsed into chips at the bottom of assistant messages.
5. Messages persist incrementally; tree updates trigger version history and emit `tree-updated` events.

### Validation flow
1. Agent proposes tree and calls `update_tree`.
2. Tool fetches `lastSyncAt` from SyncMetadata and POSTs to Validator API with `segments_cache_timestamp`.
3. On success, conversation tree is upserted and a `TreeVersion` is recorded; on failure, errors/warnings returned to the model for self-correction.

### Sync flow
1. Manual: user clicks “Sync Segments Now” or runs `make sync-now` (dev server must be running).
2. Server executes `syncSegments` to refresh segments/attributes and update `lastSyncAt`.



## Configuration & Env
- `.env.local` (from `.env.example`): `API_BASE_URL`, `BEARER_TOKEN`, `ANTHROPIC_API_KEY`, `DATABASE_URL`.
- Make targets: install, dev, build, start, lint, prisma-generate, prisma-migrate, sync-now.

## Future Improvements
- Add server-side scheduler to run `syncSegments` periodically with mutex and backoff.
- Rate limiting/TTL for sync per the architecture doc.
- Observability: emit JSON-L to `events.log` with trace/latency/cache-hit fields.
