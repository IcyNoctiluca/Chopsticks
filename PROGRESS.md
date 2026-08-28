# Progress

## Current state

**Active phase:** Post-roadmap release-blocker implementation

**Status:** CI-first continuation enablement is complete. Forgejo PR #1 merged as `695a42f`, and Woodpecker `main` pipeline #8 passed the full root typecheck, engine/server/web builds, 135 tests, shared iOS-app typecheck, and production-image health smoke test. Private repository `liamp/Chopsticks` is active as Woodpecker repository 7 with trust limited to `security: true` (`volumes` and `network` remain false); this checkout uses `battlenet` as its `main` upstream and default push remote. GitHub was updated separately through green mirror PR #25, merged as `8b64116`. Pipeline triggers are limited to pull requests, `main` pushes, and manual runs so a PR update does not queue duplicate push and pull-request workflows on the single-workflow runner. GitHub is now a continuous mirror: `battlenet` has a second push URL for `git@github.com:IcyNoctiluca/Chopsticks.git`, so every `git push` updates both forges and the periodic milestone-mirror step is retired (2026-08-28 decision). Remaining implementation blockers from the 2026-08-17 review are detailed in `docs/handoff.md`.
**Last updated:** 2026-08-28

## Next action

1. Fix the online connection/lobby lifecycle and local Vite WebSocket configuration, with fresh-page create/join tests.
2. Add an explicit identity-aware redistribution picker in both web clients.
3. Carry tournament draw results through sync/WebSocket/client rendering.
4. Make the online board player-relative and add keyboard/touch accessibility.
5. Only after those items pass CI and a two-browser playthrough should the web product be called release-ready. PWA offline proof, native App Store work, and public-service hardening remain separate follow-ups.

## Decision log

| Date | Decision | Status | Notes |
| --- | --- | --- | --- |
| 2026-08-10 | Use an engine-first workflow | Accepted | Interfaces will depend on one deterministic rules engine. |
| 2026-08-14 | Initial ruleset choices | Accepted | All nine Phase 00 questions answered; none postponed. See "Ruleset decisions (Phase 00)" below. |
| 2026-08-14 | Ruleset specification `classic-v1` (doc v0.1) | Accepted | `docs/rules-v0.1.md` answers all Phase 00 questions; linked from README. Draft pending freeze in Phase 04. |
| 2026-08-14 | Engine tooling: TypeScript + Vitest, shared via React Native for iOS | Accepted | One engine across web/server/CLI/iOS; matches DESIGN.md single-engine rule. Zero runtime deps. |
| 2026-08-15 | Freeze `classic-v1` at doc v1.0, engine 0.1.0 | Accepted | Phase 04 retrograde analysis (`docs/analysis.md`): opening value DRAW, no first-player advantage, 1142 reachable states. Behaviour unchanged from v0.1 draft. No draw rule; cycles allowed (Phase 00 decision 8). |
| 2026-08-15 | Draw mechanism deferred to a future ruleset / online match policy | Accepted | `classic-v1` has no automatic draw; online play can lock into infinite loops. The planned Phase 07 follow-up was not implemented and remains required before ranked/automated online play. Owner: this project. |
| 2026-08-15 | Phase 06 local app = web client (Vite, vanilla TS) instead of React Native/iOS | Accepted | Engine is TS shared via RN for iOS per the tooling decision, but iOS RN cannot build/test inside the Linux dev container (no Xcode/simulator). MVP local app shipped as a browser web client using the same engine/session APIs; genuinely two-player and shippable. React Native iOS app is a follow-up once a macOS/iOS build environment is available. Logged as a worked-around blocker below. |
| 2026-08-15 | Phase 07 transport = HTTP request/response (not WebSocket) for MVP | Accepted | A framework-free `MatchServer` authoritative module + thin `node:http` wrapper. WS real-time transport wraps the same `MatchServer` later; HTTP MVP keeps the failure surface small and is fully testable. |
| 2026-08-15 | Web UI polish scope: reusable SVG hand assets only, no DOM/CSS animation rigging | Accepted | Most realistic-UI code (DOM layout, CSS transitions, `window`/`document`) won't port to React Native and would be rebuilt. SVG hand assets transfer to RN via `react-native-svg`, so those are a worthwhile investment; animation and layout rigging are deferred to the native app. Lowest-waste path to a nicer-looking web MVP while keeping the real iOS target in view. |
| 2026-08-16 | Terminal undo policy: undo is disallowed after a game is finished and scored | Accepted | Prevents double-scoring and score-reversal bugs. The session gains a `scored` flag; `startNextGame` resets it. This keeps scoring idempotent even if `advanceAITurns` is called again. |
| 2026-08-16 | Room/seat transition table | Accepted | `createRoom` always creates a human host in seat A; `joinRoom` and `addAI` may fill seat B only from `lobby`; neither can replace an existing B. This removes the broken AI-host path and prevents seat takeover races. |
| 2026-08-16 | Docker Compose plugin unavailable in this environment | Worked around | `docker compose` and `docker-compose` are not present, so verification runs on host tooling (`npm run typecheck`, `npm test`, `npm run web:build`, `cd ios-app && npm run typecheck`). Dependencies were installed with `npm install` on the host. This is a local-environment deviation from `AGENTS.md`; the branch still passes all checks. |
| 2026-08-16 | Release engineering: compiled server artifact | Accepted | `tsconfig.server.json` + `npm run build:server` produces `dist-server/`. Production runtime uses `node dist-server/server/http.js` (`npm run serve:prod`); `npm run serve` remains the dev path via `tsx`. |
| 2026-08-16 | Release engineering: production container image | Accepted | `Dockerfile.prod` is a slim multistage image that builds the server and runs it with production dependencies only. Verified by building and health-check smoke test. |
| 2026-08-16 | Release engineering: stale-room sweep | Accepted | `MatchServer` supports an optional `sweepIntervalMs`. The production server defaults to 30s sweeps; set `SWEEP_INTERVAL_MS=0` to disable. Tests use `sweepIntervalMs: null` to avoid background timers. |
| 2026-08-16 | Release engineering: CI | Accepted | `.github/workflows/ci.yml` runs typecheck, tests, engine/server/web builds, iOS-app typecheck, and a Docker production-image smoke test on pushes/PRs to `main`. |
| 2026-08-16 | Online web client | Accepted | A separate `web/online.html` + `web/online.ts` uses WebSocket to consume the server protocol. It reuses hand SVG/styles, supports create/join/add-ai/move, and auto-reconnects. The Vite build produces both `index.html` and `online.html` entries. |
| 2026-08-16 | Tournament ruleset `classic-tournament-v1` | Accepted | Separate ruleset from frozen `classic-v1`; adds threefold-repetition draw, half-point match scoring, and is selectable in online play. Implemented in `src/result.ts`; server and online client support it. |
| 2026-08-16 | Production hardening | Accepted | Add `MAX_BODY_BYTES`, per-IP rate limiting (`RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`), `ROOM_TTL_MS` cleanup of finished/abandoned rooms, and room-code copy in the online client. All configurable via environment variables. |
| 2026-08-16 | CI failure root cause | Resolved | `tests/web.test.ts` checks `dist-web/` but CI ran `npm test` before `npm run web:build`. Reordered CI so the web client builds before tests. |
| 2026-08-16 | Phone install path | Accepted | Ship PWA support (manifest, service worker, icons) for immediate home-screen installation. Keep the React Native `ios-native/` project wired to the shared game screen and document App Store upload steps. |
| 2026-08-17 | Drag-and-drop web UI | Accepted | Replace numbered move buttons with pointer-event drag between hand circles. Shared `web/boardUI.ts` renders both local and online boards; `web/moves.ts` provides move equality. Split moves use a dedicated button. |
| 2026-08-17 | Release-readiness claim superseded by current-state review | Accepted | Implementation milestones remain complete, but the product is not yet signed off for public online/PWA/App Store release. Functional UI blockers and exact acceptance checks are recorded in `docs/handoff.md`. |
| 2026-08-23 | Forgejo/Woodpecker is the working CI path | Accepted | `git.battlenet.internal` becomes the working forge and `ci.battlenet.internal` the primary CI gate. `.woodpecker.yml` mirrors the established verification contract and adds a production-image health smoke test. GitHub is updated only periodically through a merge-commit PR from green Forgejo `main`; direct pushes to `origin/main` and GitHub-first implementation are prohibited. Nested dependencies and native build outputs are excluded from Docker context, reducing the production build context from about 1.35 GB to 1.36 MB. |
| 2026-08-25 | Merge requests use isolated worktrees | Accepted | When the user asks to merge changes, preserve the primary checkout, create a fresh branch and worktree from `battlenet/main`, reconcile concurrent changes and conflicts, deliver through a green Forgejo PR, prove merged `main`, then clean up the branch and worktree. GitHub mirroring remains a separate milestone operation. |
| 2026-08-28 | GitHub is a continuous mirror, not a periodic one | Accepted | Supersedes the periodic milestone-mirror policy from 2026-08-23/25. `battlenet` carries a second push URL for `git@github.com:IcyNoctiluca/Chopsticks.git`, so every `git push` updates both forges. Forgejo stays the working forge and Woodpecker the CI gate; GitHub carries the full history at all times so a `git.battlenet.internal` outage risks nothing. GitHub `main` only fast-forwards from `battlenet/main`; realign with `git push origin battlenet/main:main --force` if they ever diverge. One-time realignment force-pushed `battlenet/main` over GitHub's divergent mirror-merge commit `8b64116`. |

## Ruleset decisions (Phase 00)

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Tap mode | Additive: new target value = target + source hand value. |
| 2 | Elimination | A hand dies (becomes 0) when its value reaches 5 or more. |
| 3 | Attacking hands | Source must be living. May tap any living hand, including your own other living hand (self-tap). Dead hands cannot be targeted. |
| 4 | Redistribution | Allowed only when one of your hands is dead (revival). Must preserve the total of your two hands. Must change the position. |
| 5 | Intentional closure | No: a redistribution must leave both hands alive (>=1). You cannot voluntarily zero one of your own hands. |
| 6 | Hand identity | Left and right are distinct and tracked separately; they matter for rules and history. |
| 7 | End of game | A player loses when both their hands are dead. A non-terminal position with no legal moves means the player to move loses. |
| 8 | Repetition | Allowed; no special loop rule. Relies on normal play / deadlock handling. |
| 9 | Opening fairness | Starting player alternates each game of a match; recorded in the game state. |

**Frozen ruleset identifier:** `classic-v1` (confirmed in Phase 01 and frozen in Phase 04).

### Notes on consistency

- From the start `A:[1,1] B:[1,1] turn:A`, taps (including self-tap) are legal, so the game admits at least one legal move.
- A non-terminal deadlock is effectively unreachable: whenever the game is non-terminal, both players have at least one living hand, so the player to move always has at least one legal tap. Decision 7 is therefore a defensive specification that does not trigger in normal play.

### Worked positions (manually checked)

1. **Normal tap.** `A:[1,1] B:[1,1] turn:A`. A taps B-left: 1+1=2 < 5 -> `A:[1,1] B:[1,2] turn:B`. Legal.
2. **Elimination.** `A:[1,1] B:[1,4] turn:A`. A-left(1) taps B-left(4): 4+1=5 >= 5 -> B-left dies -> `A:[1,1] B:[1,0] turn:B`. Legal.
3. **Revival redistribution.** `A:[3,0] B:[1,1] turn:A`. A has a dead hand (right=3, left=0); redistribution allowed, total 3, both results must be 1..4 and differ from (3,0). Valid splits: (2,1) and (1,2). Transferring all 3 (-> 0,3) is banned by intentional-closure. -> `A:[2,1] B:[1,1] turn:B`. Legal.
4. **Self-tap.** `A:[3,1] B:[2,2] turn:A`. A-right(3) taps A-left(1): 1+3=4 < 5 -> `A:[3,4] B:[2,2] turn:B`. Additive; not a redistribution. Legal.
5. **Game completion.** `A:[4,4] B:[1,0] turn:A`. A-left(4) taps B-right(1): 1+4=5 >= 5 -> B-right dies -> `B:[0,0]`. Both B hands dead -> A wins. Legal.

## Phase tracker

| Phase | Status | Evidence / next step |
| --- | --- | --- |
| 00 - Rules decision | Complete | All 9 decisions recorded above; 5 worked positions checked; none postponed. |
| 01 - Rules specification | Complete | `docs/rules-v0.1.md` written (`classic-v1`, doc v0.1); answers all Phase 00 questions; linked from README; 5 worked examples included. |
| 02 - Engine foundation | Complete | TS+Vitest engine; `createGame`/`getLegalMoves`/`isLegalMove`/`applyMove`/`getWinner` complete; immutable; zero runtime deps; API + invalid-move contract in `docs/api.md`; 25 tests pass (all rules + worked examples 13.1-13.5). |
| 03 - Verification and CLI | Complete | 36 tests pass (25 engine + 8 invariant/property + 3 CLI smoke). Invariants cover move legality agreement, immutability, terminal rejection, value range, turn ownership, redistribution totals. CLI (`npm run play`) renders state, lists legal moves, accepts selections, handles redistribution and game-over. Playtest via scripted simulation: game completes in 8 moves, B wins. |
| 04 - Analysis and rules freeze | Complete | `analysis/enumerate.ts` + `docs/analysis.md`: 1142 reachable states, opening value DRAW, no first-player advantage, 510 WIN / 136 LOSS / 496 DRAW states, min 5 / max-shortest 8 moves. `classic-v1` frozen at doc v1.0, engine 0.1.0. Analysis regression test in `tests/analysis.test.ts`. |
| 05 - Product foundation | Complete | `src/record.ts` (GameRecord, replay/replayTo, undo, applyMoveToRecord, recordWinner). `ai/chooseMove.ts`: random + heuristic + solved AIs (all use engine API only; solved reuses Phase 04 retrograde values). `session/session.ts`: match config, human/AI turns, undo policy (unlimited/none/max), match scoring, alternating starter, versioned persistence (format v1) + migration error. 66 tests pass. Session imports engine; engine has no session dep (verified by test). |
| 06 - Local app | Complete | Web client (`web/`, Vite + vanilla TS) using engine/session APIs only; renders hands/active player/legal moves/redistribution/result; restart/undo/rules; optional AI for Player B. `npm run web` (dev) / `npm run web:build` (10.5KB JS). 5 web flow tests (build artifact + start/play/finish/restart, undo, human-vs-AI match). 71 tests total. |
| 07 - Online play and release | Complete (historical phase status; release claim superseded) | The authoritative module and HTTP happy paths originally met the recorded phase evidence. WebSocket and file persistence were later merged. The 2026-08-16 review found a broken HTTP sync route, room-transition gaps, no online client, and stale release/privacy claims; see `docs/handoff.md`. These are now fixed on `phase-10-stabilization`. |
| — | Post-roadmap stabilization | Complete | Merged via PR #15. HTTP sync, terminal scoring/undo, client starter rotation, room/AI transitions, transport validation, iOS typecheck, and release/privacy docs fixed. Evidence: 113 tests pass, root + ios-app typecheck pass, web build passes. |
| — | Release engineering | Complete | Merged via PR #16. Compiled server artifact, production Dockerfile, stale-room sweeps, GitHub Actions CI. |
| — | Online client | Complete | Merged via PR #17. web/online.html + web/online.ts connects via WebSocket to create/join rooms and play. |
| — | Tournament ruleset | Complete | Merged via PR #18. Adds `classic-tournament-v1` threefold-repetition draw rule, server/online-client support, and half-point scoring. |
| — | MVP implementation | Complete; release signoff pending | All blockers from the 2026-08-16 review were resolved. The 2026-08-17 review found new online UI, redistribution, draw-result, accessibility, and offline-claim gaps; see `docs/handoff.md`. |
| — | Production hardening | Complete | Merged via PR #20. Request size limits, rate limiting, room TTL cleanup, room-code copy. |
| — | Phone install & CI fix | Complete | CI reordered to build web before tests; PWA support added; native iOS app wired to GameScreen; App Store guide written. Evidence: 128 tests pass, CI green. Merged via PR #22. |
| — | Drag-and-drop UI | Merged; follow-up required | PR #23 merged shared `web/boardUI.ts`/`web/moves.ts` and pointer drag. Review found that split choice is incomplete, active-turn styling is mismatched, and hands lack keyboard semantics. Evidence: typecheck, 135 tests, web build green. |
| — | CI-first continuation | Complete | `.woodpecker.yml`, Forgejo-primary/GitHub-mirror workflow, and `docs/ci.md` merged through Forgejo PR #1 as `695a42f`; Woodpecker `main` pipeline #8 passed. Repository 7 has security-only trust. Local parity passes and production build context is down from about 1.35 GB to 1.36 MB. GitHub mirror PR #25 passed both Actions checks and merged as `8b64116`. |

## Blockers

- **Resolved in stabilization (#15):** terminal undo double-score; web/iOS starter rotation loss; HTTP sync 404 on query strings; room/AI transition gaps; transport input validation; iOS entry typecheck; stale release/privacy docs.
- **Resolved in release engineering (#16):** compiled server artifact; production Docker image; stale-room sweep; GitHub Actions CI.
- **Resolved in online client (#17):** a shipped web client consumes the server protocol.
- **Resolved in tournament ruleset (#18):** `classic-tournament-v1` provides a repetition draw for ranked/automated matches.
- **Resolved in production hardening (#20):** rate limiting/abuse protection; request size limits; room TTL cleanup; room-code copy UX.
- **Resolved in phone install/CI fix (#22):** CI build order fixed; PWA install path; native iOS app wired to shared GameScreen; App Store upload guide.
- **Current web release blockers:** reliable first-click create/join; explicit redistribution selection; correct lobby/game and Add-AI visibility; tournament draw rendering; keyboard/touch accessibility. Full detail is in `docs/handoff.md`.
- **Release-surface follow-ups:** prove the full built PWA works offline before claiming it; complete native device/TestFlight/App Store verification; add WebSocket/public-service hardening.
- **Scale/maintenance follow-ups:** production-grade shared room store for horizontal scaling, macOS iOS runtime CI, and a root lint command.
- **Environment status:** Docker Compose is available in the current environment and all review checks ran in the container. The 2026-08-16 worked-around decision remains historical context only.

## Playtest findings (Phase 03)

- CLI is usable for two-human play: renders both players' hands, active player, lists numbered legal moves, accepts selection by index, supports self-tap and redistribution.
- Redistributed moves are shown as "Split to R:x L:y"; taps show "Tap [source] -> [target]".
- Alternating starting player across games works via `createGame({ startingPlayer })`.
- No rule issues found during scripted playtest; game terminates deterministically.
