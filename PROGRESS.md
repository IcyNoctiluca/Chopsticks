# Progress

## Current state

**Active phase:** All phases complete — MVP shippable

**Status:** Phase 07 complete; authoritative online match service + release docs shipped
**Last updated:** 2026-08-15

## Next action

The phase roadmap (00–07) is complete and the MVP is shippable. Suggested follow-ups (logged below as non-blocking): iOS React Native app (needs macOS build env), persistent room storage across server restarts, WebSocket real-time transport, and a tournament draw rule (`classic-tournament-v1`).

## Decision log

| Date | Decision | Status | Notes |
| --- | --- | --- | --- |
| 2026-08-10 | Use an engine-first workflow | Accepted | Interfaces will depend on one deterministic rules engine. |
| 2026-08-14 | Initial ruleset choices | Accepted | All nine Phase 00 questions answered; none postponed. See "Ruleset decisions (Phase 00)" below. |
| 2026-08-14 | Ruleset specification `classic-v1` (doc v0.1) | Accepted | `docs/rules-v0.1.md` answers all Phase 00 questions; linked from README. Draft pending freeze in Phase 04. |
| 2026-08-14 | Engine tooling: TypeScript + Vitest, shared via React Native for iOS | Accepted | One engine across web/server/CLI/iOS; matches DESIGN.md single-engine rule. Zero runtime deps. |
| 2026-08-15 | Freeze `classic-v1` at doc v1.0, engine 0.1.0 | Accepted | Phase 04 retrograde analysis (`docs/analysis.md`): opening value DRAW, no first-player advantage, 1142 reachable states. Behaviour unchanged from v0.1 draft. No draw rule; cycles allowed (Phase 00 decision 8). |
| 2026-08-15 | Draw mechanism deferred to a future ruleset / online match policy | Accepted | classic-v1 has no automatic draw; online play can lock into infinite loops. A `classic-tournament` variant or server-side move cap will be added in Phase 07. Owner: this project. |
| 2026-08-15 | Phase 06 local app = web client (Vite, vanilla TS) instead of React Native/iOS | Accepted | Engine is TS shared via RN for iOS per the tooling decision, but iOS RN cannot build/test inside the Linux dev container (no Xcode/simulator). MVP local app shipped as a browser web client using the same engine/session APIs; genuinely two-player and shippable. React Native iOS app is a follow-up once a macOS/iOS build environment is available. Logged as a worked-around blocker below. |
| 2026-08-15 | Phase 07 transport = HTTP request/response (not WebSocket) for MVP | Accepted | A framework-free `MatchServer` authoritative module + thin `node:http` wrapper. WS real-time transport wraps the same `MatchServer` later; HTTP MVP keeps the failure surface small and is fully testable. |

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

**Working ruleset identifier:** `classic-v1` (to be confirmed in Phase 01).

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
| 07 - Online play and release | Complete | `server/matchServer.ts` authoritative service (rooms, turn/move-number/stale-move rejection, illegal-move + ruleset/version compatibility, reconnect/sync, AI auto-play, stale abandonment) + `server/http.ts` JSON API w/ `/health`. 18 server tests incl. HTTP health smoke. `docs/release.md` covers privacy, failure handling, deployment, support, release criteria, planned opt-in metrics. 89 tests total. **MVP shippable — all phases complete.** |
| — | Follow-ups (non-blocking) | Scheduled | iOS RN app (needs macOS env); persistent room store across restarts (Redis/DB); WebSocket real-time transport wrapping `MatchServer`; tournament draw rule (`classic-tournament-v1`) for ranked online play. |

## Blockers

- None blocking the MVP. **All phases 00–07 complete.**
- **Worked around:** React Native / iOS cannot be built or tested inside the Linux dev container (no Xcode, no iOS simulator). Phase 06 local app shipped as a browser web client instead; the iOS RN app is a follow-up requiring a macOS build environment. Owner: this project.
- **Deferred (non-blocking):** WebSocket real-time transport and persistent room storage are post-MVP; HTTP request/response + in-memory rooms ship for the MVP.

## Playtest findings (Phase 03)

- CLI is usable for two-human play: renders both players' hands, active player, lists numbered legal moves, accepts selection by index, supports self-tap and redistribution.
- Redistributed moves are shown as "Split to R:x L:y"; taps show "Tap [source] -> [target]".
- Alternating starting player across games works via `createGame({ startingPlayer })`.
- No rule issues found during scripted playtest; game terminates deterministically.