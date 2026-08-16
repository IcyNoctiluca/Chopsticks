# Repository review and handoff

This is the current pickup document for the repository. It supersedes the former iOS-shell handoff. Historical iOS setup details that are still useful are retained in `docs/ios-app.md` and in commit `d3f55f4`.

- **Reviewed:** 2026-08-16 (Europe/Amsterdam)
- **Reviewed commit:** `17f98ed3759918bff8077905b5f6a3d9fa6a3b4c`
- **Branch at review start:** `main`, exactly aligned with `origin/main`
- **Working tree at review start:** clean
- **Review scope:** source, tests, architecture, phase evidence, release documentation, dependency state, and targeted runtime reproductions

## Bottom line

The frozen `classic-v1` engine and local-play foundation are healthy. After synchronising the container's dependency volume with `package-lock.json`, root typecheck, all 101 Vitest tests, the engine build, and the web build pass.

The repository should not currently be described as production-ready or as an end-to-end online product. There are release-blocking defects in HTTP reconnect, session scoring/undo, client game rotation, and room-seat state transitions. The privacy and failure-handling documentation also describes the pre-persistence system and is materially false for the current server. The iOS app has historical simulator-build evidence, but its documented TypeScript verification is not reproducible and its native Jest test targets the unused template app.

Treat `PROGRESS.md`'s older phase rows as historical evidence. This document and the 2026-08-16 current-state block at the top of `PROGRESS.md` supersede their “shippable” wording.

## Verified repository state

- `main` and `origin/main` were both at `17f98ed`; there were no uncommitted files before this documentation review.
- `origin` is the current authoritative remote. Local `ios-native-shell` and `origin/ios-native-shell` remain at `d3f55f4`, but that work is already merged into `main` by PR #8; do not resume that branch.
- `upstream/main` is stale at `6f1b637` and should not be treated as the current baseline.
- The implementation is split cleanly into `src/` (engine), `ai/`, `session/`, `server/`, `web/`, `ios-app/`, and `ios-native/`. Imports point toward the engine; no engine file imports client, network, storage, or platform code.
- The online server supports HTTP, WebSocket, authoritative engine validation, AI seats, and synchronous JSON-file persistence at the module level. The web and iOS clients are local-play clients only; neither consumes the online protocol.

## Verification evidence

All commands were run through the dev container as required by `AGENTS.md`.

The existing named `node_modules` volume was stale: it contained `ws@7.5.13` and no `@types/ws`, while the lockfile requires `ws@8.21.3` and `@types/ws@8.18.1`. That initially caused five WebSocket-related test failures and root typecheck failures. Running this inside the container corrected the environment without changing tracked files:

```sh
docker compose exec -T dev npm ci
```

Results after that clean install:

| Check | Result |
| --- | --- |
| `docker compose exec -T dev npm run typecheck` | Pass |
| `docker compose exec -T dev npm test` | Pass: 12 files, 101/101 tests |
| `docker compose exec -T dev npm run build` | Pass; this builds `src/` only |
| `docker compose exec -T dev npm run web:build` | Pass; 11.47 kB JS, 2.75 kB CSS |
| `docker compose exec -T dev npx tsc --noEmit -p ios-app/tsconfig.json` | Fail: root environment cannot resolve `react-native-safe-area-context` |
| From `/app/ios-native`, `npx tsc --noEmit -p ../ios-app/tsconfig.json` | Fail under TypeScript 6: deprecated `baseUrl` is an error without `ignoreDeprecations` |
| From `/app/ios-native`, `npx tsc --noEmit -p tsconfig.json` | Pass, but it does not include `../ios-app/`; it checks the unused template `ios-native/App.tsx` |
| `npm audit` | 12 dev-tool findings: 1 critical, 8 high, 3 moderate |
| `npm audit --omit=dev` | 0 production dependency findings |

The native Xcode/simulator build was not rerun during this review. The latest evidence is the successful 2026-08-15 simulator build recorded in commit `8e7d5f3` and `docs/ios-app.md`.

Important environment note: rebuilding/restarting Compose does not necessarily refresh the named `chopsticks_node_modules` volume after manifest changes. Run `npm ci` inside the container after `package.json` or `package-lock.json` changes. Do not install root dependencies on the host.

## What is solid

- `classic-v1` is frozen and explicitly specified in `docs/rules-v0.1.md`; rules behavior should not be changed during stabilization.
- The engine is deterministic, serialisable, immutable in practice, and framework-free. Rule examples, invalid moves, immutability, invariants, replay, and solver counts are covered.
- The analysis regression still reports 1,142 reachable states and protects the frozen game-theoretic profile.
- Root typecheck and all 101 tests pass from a lockfile-synchronised container.
- The engine package and web client build successfully.
- Server tests cover the happy paths for authority, stale moves, module-level sync, WebSocket play, and file persistence.
- Git history is phase/PR based and `main` was clean and aligned with `origin/main` before this review.

## Prioritised findings

### P0 — Stabilise before calling the product shippable

#### 1. The documented HTTP reconnect endpoint always returns 404

`server/http.ts` tests `req.url` against `^/rooms/[^/]+/sync$`. A real request includes `?clientId=...`, so it cannot match. A live reproduction against an isolated store returned:

```json
{"status":404,"body":{"error":"not-found"}}
```

The module-level `MatchServer.sync()` and WebSocket `sync` message work; only the documented HTTP route is broken. Parse the URL pathname before route matching, and add an HTTP integration test for the exact URL shown in `docs/release.md`.

Relevant files: `server/http.ts`, `tests/server.test.ts`, `docs/release.md`.

#### 2. Undo after game completion corrupts match scoring

`advanceAITurns()` awards a game whenever it receives a finished record and `session.gamesPlayed === current.gamesPlayed`. `undoInSession()` rewinds only the record; it does not reverse `scores` or `gamesPlayed`. Replaying the final move awards the same game again.

Reproduction:

```json
{"scored":{"A":0,"B":1},"afterUndo":{"A":0,"B":1},"rescored":{"A":0,"B":2},"gamesPlayed":2}
```

Calling `advanceAITurns()` repeatedly on an already-finished session can also award repeatedly. Both clients expose Undo after game completion, and toggling AI calls `advanceAITurns()`, so this is user-reachable.

Define the intended terminal-undo policy before changing code: either prohibit terminal undo after a score is committed, or make score commitment reversible/idempotent. Add session tests for terminal undo, repeated `advanceAITurns()`, and AI toggling on a finished game.

Relevant files: `session/session.ts`, `web/client.ts`, `ios-app/GameScreen.tsx`, `tests/session.test.ts`.

#### 3. Web and iOS clients break alternating starters

`startNextGame()` correctly returns a session with both a new record and an advanced `startingPlayerNext`. Both clients keep only `.currentRecord`, discarding the returned `startingPlayerNext`. After the first restart, subsequent games continue to start with the same player instead of alternating.

Use the complete session returned by `startNextGame()` and then apply only the intended config changes. Add client-flow tests covering at least three consecutive games. Also decide whether “New game” is allowed before the current game finishes.

Relevant files: `web/client.ts` (`onRestart`), `ios-app/GameScreen.tsx` (`onRestart`), `tests/web.test.ts`, `tests/ios-app.test.ts`.

#### 4. Room/seat transitions do not preserve match invariants

Verified defects:

- After `addAI()`, `joinRoom()` accepts a human because an AI has `clientId: null`; the human silently replaces the AI during an active match.
- A room created with an AI host (`isAI: true`) starts playing when B joins, but `joinRoom()` does not call `maybeAutoPlayAI()`. The room remains on A's turn with zero moves and no human able to act.

Related untested risks: `joinRoom()` and `addAI()` do not require `phase === "lobby"`; repeated or late calls can reset a room to `playing` in AI-seat cases. Define an explicit transition table for lobby/playing/finished/abandoned and empty/human/AI seats, enforce it in one place, and test every rejected transition.

Relevant files: `server/matchServer.ts`, `tests/server.test.ts`, `tests/server-ws.test.ts`.

#### 5. Privacy/release documentation is false after persistence was added

`server/persistence.ts` writes the entire `MatchRoom` to `data/rooms.json`, including display names, client IDs, timestamps, and move history. `docs/release.md` still says display names are memory-only, rooms disappear on restart, and no persistent user storage exists. Its failure table, deployment section, release checklist, limitations, and test counts also describe the old in-memory/HTTP-only server.

Do not ship a privacy statement until it reflects actual retention and deletion behavior. Decide retention, cleanup, file permissions, corruption recovery, and whether client IDs/display names need to be persisted. Then update `docs/release.md`, `PROGRESS.md`, and `README.md` together.

### P1 — Required for a credible public server/release

#### 6. HTTP and WebSocket inputs are trusted TypeScript casts at runtime

There is no schema validation for message shapes, strings, move discriminants, hand names, numeric bounds, or body size. Malformed JSON is parsed before `guard()` in `server/http.ts`, so its rejection is not converted into the documented JSON error. Some malformed move objects can reach engine helpers as `undefined` and produce internal errors rather than a typed `illegal-move` response. Request bodies are accumulated without a size limit.

Add transport-boundary validation, body/message limits, consistent 4xx mappings, and negative tests for malformed JSON and structurally invalid moves. Keep the engine API typed; validate untrusted data before casting it to `Move`.

#### 7. The repository has no runnable production artifact

`npm run build` compiles only `src/`. `server/`, `session/`, and `ai/` are not emitted. `npm run serve` relies on the dev dependency `tsx`. The Dockerfile is explicitly a development image and its command is `sleep infinity`. `docs/release.md` describes a production multistage image as future work rather than providing one.

Add a production server build/entry point and a runtime container or document another concrete deployment target. Test the built artifact, not only TypeScript execution through `tsx`.

#### 8. Timeouts and abandonment are configuration without runtime enforcement

`MatchConfig.moveTimerMs` is unused. Server `moveDeadlineMs` is stored but never evaluated. `abandonIfStale()` works only when called explicitly; `server/http.ts` has no periodic sweep, so deployed rooms are never abandoned automatically. The persistence `remove()` path is unreachable and abandoned rooms remain stored.

Resolve whether these are gameplay features or deployment policies, then implement one authoritative behavior and integration-test the running server.

#### 9. Persistence is a synchronous prototype, not production-safe storage

Every mutation synchronously rereads and rewrites the entire JSON file. Writes are non-atomic, there is no schema/version validation, corrupt JSON prevents startup, records have no cleanup policy, and multiple processes would race. `RoomStore` advertises async methods, but `MatchServer` explicitly rejects async `load()` and does not await async `save()`/`remove()`.

Either narrow the interface/documentation to a single-process synchronous development store or implement an actually async, durable store and lifecycle.

#### 10. There is no end-to-end online client

The web and iOS apps use local `session/` state only. They do not call HTTP or WebSocket APIs. Phase 07's server protocol exists, but “authoritative online matches” are currently exercisable only through tests or a custom protocol client. Keep client-side online play as a required product milestone, not a cosmetic follow-up, if the release is advertised as online.

### P2 — Quality, verification, and documentation debt

- The documented iOS typecheck fails, and `ios-native/__tests__/App.test.tsx` renders the unused template `ios-native/App.tsx`, not the registered `ios-app/App.tsx`. Make one native command typecheck and test the actual entry component. Preserve the Metro resolver behavior when doing so.
- No CI workflow is tracked, so the “main always green” policy is manual. There is also no root lint script even though `AGENTS.md` requires lint before phase completion.
- The root package is named `@chopsticks/engine` but now declares `ws` as a runtime dependency. The `src/` engine code remains dependency-free, but publishing this package would pull `ws`, contradicting the “zero runtime deps” claim. Split package boundaries or adjust claims.
- The clean-install audit reports 12 vulnerabilities in dev tooling, including a critical Vitest advisory and high-severity Vite/Metro/React Native chains. Production dependencies report zero. Upgrade deliberately and rerun all build/native checks; do not use `npm audit fix --force` blindly.
- Before this review, `README.md` said 71 tests; it now says 101. Historical sections of `PROGRESS.md` and the still-stale `docs/release.md` contain 89/92/101 counts and mutually contradictory statements about WebSockets and persistence. The previous handoff was also stale; this file now replaces it.
- Phase 06 completion lacks recorded evidence of the required new-player playtest and manual accessibility check. Existing tests exercise session flows, not DOM/native rendering or assistive technology.
- `classic-v1` deliberately has no repetition draw. This remains an accepted local-play rule but a blocker for ranked/automated online matches unless a separate tournament ruleset or server match policy is defined.
- Match configuration says `gamesToWin`, but clients do not call `matchWinner()` or stop/announce a completed match. The rules modal says “win the match by winning the most games,” which does not describe first-to-N behavior.

## Recommended implementation order

1. Create a stabilization branch from updated `main`; do not commit this review directly to `main`.
2. Fix session scoring idempotency/terminal undo and client starter rotation, with regression tests.
3. Define and enforce the room phase/seat transition table; fix AI-host startup; add negative tests.
4. Fix HTTP routing and add transport-boundary validation plus exact HTTP integration tests.
5. Decide persistence/retention semantics and reconcile privacy, failure, deployment, and support documentation.
6. Make the actual iOS entry typecheck/test reproducibly.
7. Add a built production server artifact, runtime image, cleanup/timeout behavior, and CI.
8. Only then choose between online-client work, tournament draw rules, and native polish.

Do not change `classic-v1` gameplay as part of these fixes. Any draw behavior must be a new ruleset version or a clearly separate server policy and must be recorded in `PROGRESS.md` with tests.

## Regression tests the next agent should add

- HTTP `GET /rooms/{code}/sync?clientId=...` returns authoritative state.
- Malformed JSON, oversized bodies/messages, missing fields, invalid enums, and malformed moves return stable 4xx/WS error codes without state changes.
- A human cannot replace an AI; join/add-AI are rejected outside valid lobby transitions.
- An AI host makes its opening move immediately after the human joins.
- Terminal scoring is committed exactly once; terminal undo follows the chosen policy; repeated AI advancement/toggling cannot inflate scores.
- Three consecutive client games alternate A/B/A starters.
- Runtime abandonment/cleanup occurs without calling a private/module-only helper from the test.
- The actual `ios-app/App.tsx` entry typechecks and renders in the native test harness.
- A production-built server starts and passes health, HTTP sync, and WebSocket smoke tests without `tsx`.

## Files to read first in the next session

1. `AGENTS.md` — workflow and non-negotiable engine/container rules.
2. `PROGRESS.md` — current state at the top; lower phase rows are historical.
3. This file — verified defects, evidence, and order of work.
4. `DESIGN.md` and `docs/rules-v0.1.md` — architecture and frozen behavior.
5. `session/session.ts`, `web/client.ts`, `ios-app/GameScreen.tsx` — first stabilization cluster.
6. `server/matchServer.ts`, `server/http.ts`, `server/ws.ts`, `server/persistence.ts` — second stabilization cluster.
7. `docs/release.md` — currently stale; update only after persistence/retention decisions.

## Handoff cautions

- This review intentionally changed documentation only; no implementation fix has been attempted.
- The Compose container's dependency volume is now synchronised to the committed root lockfile. That is local runtime state, not a tracked repository change.
- Preserve all unrelated user changes if the working tree is no longer clean when work resumes.
- Follow the branch/PR/merge/delete workflow in `AGENTS.md`; never commit directly to `main`.
