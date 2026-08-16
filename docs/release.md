# Release Operations — Chopsticks

This document covers privacy, failure handling, deployment, support expectations, release criteria, and post-launch metrics. It satisfies Phase 07's release-readiness exit criteria for the MVP.

## Architecture recap

```
Client (web app / iOS RN) ── intended move ──> Match Server ──> Engine (only authority)
       ^        (HTTP or WebSocket)          validates turn + version + legality
       └────── authoritative state ────────── applies via engine, broadcasts state
```

The server is the single authority. Clients submit intended moves; the server loads authoritative state, checks the expected turn/move-number, validates and applies the move through the engine, then returns/broadcasts the resulting state. Clients never compute authoritative outcomes. The engine is unchanged from Phase 02 and is consumed verbatim by the server (`server/matchServer.ts`).

## API

`server/http.ts` exposes a small JSON API over `node:http` and a WebSocket endpoint at `/ws` for real-time play.

## Clients

- **Local web client** (`web/index.html`): two-player or human-vs-AI matches running entirely in the browser using the shared engine/session APIs. Build with `npm run web:build`.
- **Online web client** (`web/online.html`): connects to the match server over WebSocket to create/join rooms and play human-vs-human or human-vs-AI matches. Set `VITE_SERVER_URL=wss://your-server/ws` at build time to point to a remote server; defaults to the same-origin `/ws`.
- **iOS React Native app** (`ios-app/`): shares the engine/session APIs and typechecks; requires a macOS/Xcode environment for device/simulator builds.

### HTTP endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness + supported rulesets/engine version |
| POST | `/rooms` | Create a room (host becomes player A) |
| POST | `/rooms/{code}/join` | A second human joins as player B; match starts |
| POST | `/rooms/{code}/ai` | Add an AI opponent as player B |
| POST | `/rooms/{code}/move` | Submit an intended move (authoritative validation) |
| GET | `/rooms/{code}/sync?clientId=...` | Reconnect: fetch authoritative state + history + expected turn/move number |

### WebSocket messages

Connect to `ws://host:port/ws`. All messages are JSON.

Client → server:

| Type | Fields | Purpose |
| --- | --- | --- |
| `create` | `clientId`, `displayName`, optional `rulesetId`, `moveTimeoutMs` | Create a room (host must be human) |
| `join` | `roomCode`, `clientId`, `displayName` | Join a room as player B |
| `add-ai` | `roomCode`, optional `difficulty` | Add an AI opponent as player B |
| `move` | `roomCode`, `clientId`, `move`, `expectedMoveNumber` | Submit an intended move |
| `sync` | `roomCode`, `clientId` | Fetch current authoritative state |

Server → client:

| Type | Notes |
| --- | --- |
| `created` | `roomCode`, `playerId`, `state` |
| `joined` | `roomCode`, `playerId`, `state`, `history` |
| `ai-added` | `roomCode`, `playerId` |
| `move-accepted` | `roomCode`, `state`, `moveNumber`, `winner` |
| `state` | Broadcast to all room participants after any change |
| `error` | `code` matches `MatchServerError` codes (`illegal-move`, `stale-move`, etc.) |

Run locally: `docker compose exec dev npm run serve` (defaults to `PORT=3000`).

## Rulesets

The server supports `classic-v1` (frozen casual ruleset) and `classic-tournament-v1` (adds the threefold-repetition draw rule for ranked/competitive play). See `docs/rules-v0.1.md` and `docs/rules-tournament-v1.md`.

## Persistence

Rooms survive server restarts via a file-backed `RoomStore` (`server/persistence.ts`). By default the server writes to `data/rooms.json`; set `ROOM_STORE_PATH` to use a different location. The store is loaded when `MatchServer` starts and updated after every room mutation.

**Retention semantics (MVP):**
- Room data is kept until the process removes the room or the store file is deleted.
- No automatic expiration of the store file itself; abandoned rooms remain in the file until an operator deletes it or a future cleanup policy is added.
- `displayName` values are persisted alongside room state; they are not personal data but are written to disk.
- For production at scale, swap `FileRoomStore` for a Redis/DB-backed implementation behind the same `RoomStore` interface and add an explicit retention/TTL policy.

## Server-authoritative guarantees (client cannot alter state)

- Every move is validated by the engine's `isLegalMove` against the authoritative state before `applyMoveToRecord`.
- Turn ownership is enforced server-side (`not-your-turn`).
- Optimistic concurrency / stale-move rejection: clients must send the `expectedMoveNumber` they saw; a mismatch returns `stale-move` so a delayed or replayed submit is rejected.
- Ruleset and engine-version compatibility are recorded per room; a move is rejected if the room's ruleset doesn't match the authoritative state's ruleset (`incompatible-ruleset`).
- Finished and abandoned matches reject all further submissions (`match-finished`, `match-abandoned`).

These are covered by integration tests in `tests/server.test.ts`, `tests/server-ws.test.ts`, and `tests/server-persistence.test.ts` (101 tests passing across all suites).

## Reconnect and stale-move behaviour

- **Reconnect:** a dropped client calls `/sync` to receive the full authoritative `state`, `history`, and the current `expectedMoveNumber`/`expectedTurn`. They then resume submitting moves with the correct move number. Tested in `MatchServer: reconnect / sync > replay of server history reproduces the authoritative state`.
- **Stale-move:** a submit with the wrong `expectedMoveNumber` is rejected with `stale-move` and the move is **not** applied. Tested in `MatchServer: stale-move rejection`.
- **Timeouts / abandoned games:** the server tracks `lastActivityAt` per room; `abandonIfStale(code, now)` transitions an inactive room to `abandoned`, after which sync and moves are rejected. A periodic sweep (deployment responsibility) calls `abandonIfStale` for each room. Tested in `MatchServer: AI and abandoned games > abandons a stale match`.

## Privacy

- The MVP collects **no personal data** beyond the optional `displayName` a player provides when creating/joining a room. Display names are written to the configured `RoomStore` (default `data/rooms.json`) for the lifetime of the room; see the Persistence section for retention semantics.
- **No accounts, no email, no device identifiers, no tracking, no advertising SDKs.** The `clientId` is an opaque token the client generates locally; it is never linked to an identity.
- **No analytics are shipped in the MVP.** The metrics section below describes optional, opt-in analytics planned for a later release; none are emitted by this version.
- Move history is game state only (hand taps/redistributions) and contains nothing personal. Rooms are persisted to the configured store and survive process restarts; delete the store file (or replace the store implementation) to remove retained data.
- **Transport:** deploy behind HTTPS (TLS termination at the load balancer/reverse proxy) so display names and game traffic are encrypted in transit. The MVP server itself is HTTP-only and must never be exposed directly to the public internet unencrypted.

## Failure handling

| Failure | MVP behaviour |
| --- | --- |
| Client disconnects mid-game | Room stays open; other player may wait. On reconnect, `/sync` resynchronises. |
| Server process restarts | Rooms are reloaded from the configured `RoomStore`; in-progress matches resume. Clients reconnect with `/sync`. |
| Illegal/stale/not-your-turn submit | Server returns a `MatchServerError` with a `code`; client re-syncs via `/sync` and retries. No state changes. |
| Room not found / full / finished / abandoned | Server returns a typed error; client surfaces an appropriate message. |
| AI opponent | Runs server-side via the engine's `getLegalMoves`/`applyMove`; deterministic difficulty; failure is impossible (always a legal move while the game is non-terminal). |
| Unhandled exception in handler | `guard()` returns a generic `500` and the server keeps running. |

The server is a standalone `node:http` process with no external dependencies, which keeps the failure surface small.

## Deployment

**Container image (recommended):**
1. Build the production image: `docker build -f Dockerfile.prod -t chopsticks/server:latest .`
2. Run with `PORT` environment variable: `docker run -e PORT=3000 -p 3000:3000 chopsticks/server:latest`.
3. Place behind a TLS-terminating reverse proxy (e.g. Caddy, nginx, or a cloud load balancer). `FileRoomStore` is single-node only; for MVP run a single replica or swap to a shared `RoomStore` implementation (Redis/DB) before scaling horizontally.

**Manual / development server:**
- Dev: `npm run serve` (uses `tsx` and auto-reloads on source changes).
- Compiled production server: `npm run build:server && npm run serve:prod`.

**Environment variables:**
- `PORT` (default `3000`) — listen port.
- `ROOM_STORE_PATH` (default `data/rooms.json`) — path to the file-backed room store.
- `SWEEP_INTERVAL_MS` (default `30000`) — interval at which stale rooms are checked; set to `0` to disable automatic sweeps.
- No secrets are required by the MVP. No API keys or credentials are read.

**Health check:** `GET /health` returns `200` `{ status: "ok", engine, rulesets }`. Configure the orchestrator's readiness/liveness probe against it.

**CI:** GitHub Actions runs typecheck, tests, engine build, server build, web build, iOS-app typecheck, and a production-image smoke test on every push/PR to `main` (`.github/workflows/ci.yml`).

## Support expectations (MVP)

- **Scope:** the MVP supports two-player online matches (human vs human, human vs AI) with reconnect, stale-move rejection, and abandonment. Tournaments, accounts, leaderboards, and persistent history are **not** in scope.
- **Support channel:** bug reports via the repository issues (`https://github.com/IcyNoctiluca/Chopsticks/issues`).
- **Compatibility:** the server advertises its engine version (`0.1.0`) and supported rulesets (`classic-v1`, `classic-tournament-v1`) on `/health`. Clients should consult this and refuse to join rooms whose engine version differs. A future client/server version mismatch will be surfaced as `incompatible-engine-version`.
- **No SLA** is offered for the MVP; availability is best-effort.

## Release criteria (MVP — shippable)

- [x] Engine frozen at `classic-v1` v1.0 and `classic-tournament-v1` v1.0, engine `0.1.0`, with deterministic replay (Phase 04/05).
- [x] Clients cannot authoritatively alter state (server validates every move via the engine) — integration tested.
- [x] Reconnect and stale-move behaviour exercised by automated tests (`tests/server.test.ts`, `tests/server-ws.test.ts`).
- [x] A local web app lets two people start, finish, restart, and undo a game without developer tools (Phase 06).
- [x] An online web client consumes the server protocol to create/join rooms and play human vs human or human vs AI.
- [x] At least one AI difficulty completes a game through the engine API (Phase 05, random/heuristic/solved).
- [x] Privacy, failure handling, deployment, and support documented (this file).
- [x] Containerised development; reproducible builds; 113 automated tests passing; CI covers typecheck, tests, engine/server/web builds, iOS-app typecheck, and production Docker image smoke test.

**Known limitations / follow-ups (out of MVP scope):**
- iOS React Native app requires a macOS build environment to produce a signed build; the web client and shared TypeScript code typecheck.
- Rate limiting / abuse protection at the edge.
- Production-grade shared room state: `FileRoomStore` is single-node; horizontal scaling needs a Redis/DB-backed `RoomStore`.
- Automated iOS runtime test in CI (requires macOS/Xcode runner).

## Post-launch metrics (opt-in, planned — NOT active in MVP)

No analytics ship in the MVP. If a future release adds opt-in analytics, it should answer exactly these product questions and nothing else:

| Question | Metric |
| --- | --- |
| How long do games actually last? | Distribution of moves-per-game (server-side, already authoritative). |
| Is there an opening advantage in real play? | Win rate by starting player; win rate per opening move. |
| Is redistribution used? | % of moves that are redistributions; by game length. |
| Do games cycle/stall? | % of games reaching a repetition threshold (informs the tournament draw rule). |
| Do players finish games? | % of started matches that reach a terminal vs abandoned. |
| Are AI opponents fun? | Win rate of human vs each AI difficulty; rematch rate. |

All collected metrics would be aggregate counts only (no user-level data), opt-in, and documented in this file before activation.