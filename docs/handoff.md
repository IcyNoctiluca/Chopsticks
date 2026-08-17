# Repository review and continuation handoff

This is the authoritative pickup document for the repository. It supersedes the
2026-08-16 review, whose blockers were fixed by PRs #15-#23.

- **Reviewed:** 2026-08-17 (Europe/Amsterdam)
- **Baseline reviewed:** `3cd4dea3e59a112098f4926765f8210241149fed`
  (`main`, merge commit for PR #23)
- **Review branch:** `codex/current-state-review-2026-08-17`
- **Working tree at review start:** clean and aligned with `origin/main`
- **Scope:** engine, session, server, local/online web clients, PWA, iOS
  integration, release documentation, automated checks, and rendered desktop and
  mobile web inspection
- **Nature of this branch:** documentation only; no implementation defect listed
  below has been fixed here

## Executive conclusion

The core implementation is substantially complete: the rules engine, replay,
session model, AI, authoritative server, persistence, production server build,
local web game, online protocol, tournament draw ruleset, and native iOS wiring
all exist. The containerised typecheck, all 135 automated tests, engine/server/web
builds, and the shared iOS-app typecheck pass.

The product is **not finished as a public online/PWA/App Store release**. More UI
work is needed, and some of it is functional correctness rather than aesthetic
polish:

1. A fresh online client silently drops the first Create/Join action while its
   WebSocket is connecting.
2. The web split control silently chooses the first legal redistribution even
   when hand identity makes multiple distinct redistributions legal.
3. The online lobby remains visible over the game after room creation, and the
   Add AI control remains available after the match starts.
4. Tournament draws are not transmitted/rendered clearly; a finished draw is
   displayed as though the client is waiting for another turn.
5. Drag-only hand controls do not have keyboard/button semantics, so Phase 06's
   accessibility exit evidence is still missing.

Use this release interpretation:

| Surface | Current assessment |
| --- | --- |
| Engine, replay, CLI, AI | Complete and well covered |
| Authoritative server module | MVP-complete; public-service hardening remains |
| Local web game | Visually coherent and playable, but split selection and accessibility must be fixed |
| Online web game | Not release-ready; P0/P1 defects below are user-visible |
| Installable PWA | Installable, but offline operation is not implemented reliably enough to claim |
| Native iOS app | Shared local game is wired; App Store preparation/runtime signoff is not complete |

Do not use the older “MVP shippable” statements in historical phase rows as a
current release signoff. The implementation milestones are real; this review
supersedes the release-readiness conclusion.

## Verification evidence

The repository was checked using the container workflow required by `AGENTS.md`.
The existing Colima runtime was started, the dev image built, the container
started, and the named dependency volume synchronised with `npm ci`.

| Check | Result |
| --- | --- |
| `docker compose build` | Pass; build context was about 500 MB (see follow-up below) |
| `docker compose exec -T dev npm run typecheck` | Pass |
| `docker compose exec -T dev npm test` | Pass: 16 files, 135/135 tests |
| `docker compose exec -T dev npm run build` | Pass |
| `docker compose exec -T dev npm run build:server` | Pass |
| `docker compose exec -T dev npm run web:build` | Pass |
| `docker compose exec -T dev npm --prefix ios-app run typecheck` | Pass |
| `docker compose exec -T dev npm audit --omit=dev` | Pass: 0 production vulnerabilities |
| Full `npm audit` during `npm ci` | 12 development-tool findings: 3 moderate, 8 high, 1 critical |

The local web UI was rendered and inspected at desktop and phone dimensions.
The local board is clear and responsive. A live WebSocket test against
`ws://localhost:3000/ws` reproduced the online first-click failure: the first
Create Room click did nothing, while a second click created `ROOM-0003`. The
resulting screen visibly retained all lobby controls over the game. Starting an
AI match left the Add AI button visible.

PR #23 is merged at the reviewed baseline. GitHub repository and PR REST access
worked with the active `gh` login, but GitHub's Actions/check-runs endpoints
returned 404 for the token during this review, so current remote CI was not used
as evidence. The local reproduction above is the review evidence.

## What is solid

- `classic-v1` remains frozen and deterministic. Do not change its gameplay as
  part of UI work.
- `classic-tournament-v1` adds threefold-repetition draws without modifying the
  frozen casual ruleset.
- Engine state and moves remain serialisable and immutable in practice. Clients,
  AI, and server consume the same public engine API.
- Game records replay deterministically and session scoring/terminal undo are
  protected by regression tests.
- The server validates authority, turn ownership, legal moves, expected move
  numbers, room transitions, and transport payload shapes.
- Compiled server output, a production Dockerfile, file persistence, room sweeps,
  and CI configuration are present.
- The React Native entry point is wired to the shared `ios-app/GameScreen.tsx`,
  and the shared iOS TypeScript surface now typechecks.
- The local and online web clients share the same board renderer.

## Prioritised findings

### P0 — Fix before describing the web product as finished

#### 1. Fresh Create/Join clicks are discarded

In `web/online.ts`, both lobby actions call `connect()` and immediately call
`send()`. `send()` transmits only when `readyState === WebSocket.OPEN`; a newly
created socket is still `CONNECTING`, so the message is silently dropped. The
client does not connect in its constructor and does not queue the pending
command. This was reproduced in the rendered client.

Fix by making connection establishment awaitable or by queueing commands until
`onopen`. The UI should disable or show progress while connecting and surface a
timeout/failure without requiring another click.

Acceptance checks:

- From a fresh page, one Create click creates exactly one room.
- From a fresh page, one Join click joins a valid room.
- Rapid repeated clicks cannot create multiple rooms or send duplicate joins.
- Connection failure restores usable controls and gives a clear retry message.

Relevant files: `web/online.ts`, `tests/web.test.ts` or a new browser-level test.

#### 2. Redistribution does not let the player choose a legal result

Both `web/client.ts` and `web/online.ts` filter the legal redistribution moves
and apply `moves[0]`. That is not a complete UI for the frozen rules: hands are
distinct, so a position such as `[3,0]` has distinct legal results `[2,1]` and
`[1,2]`. The current Split button makes an arbitrary game decision for the
player.

Render every legal redistribution as a labelled choice (modal, popover, or
inline picker), and submit the exact selected `Move`. Keep this in the UI; do not
duplicate legality rules outside `getLegalMoves()`.

Acceptance checks:

- A state with `[3,0]` offers both `[2,1]` and `[1,2]`.
- Selecting either option produces the corresponding hand identities.
- Local, online, and AI-enabled flows continue to use the same engine move.
- Add focused tests for multiple splits; do not only test that a split occurred.

Relevant files: `web/client.ts`, `web/online.ts`, `web/boardUI.ts`,
`tests/web.test.ts`, `tests/web-moves.test.ts`.

#### 3. Online lobby/game visibility is broken after creation

`showGame()` adds the `hidden` attribute to `#lobby`, but `.lobby { display:
grid; }` in `web/styles.css` overrides the browser's default hidden styling. The
rendered game therefore continues to show ruleset, create, join, and room-code
controls above the live board. `showGame()` also always unhides Add AI; the
button remains visible after an AI or human has filled seat B, and is also shown
to player B.

Add an explicit `[hidden] { display: none !important; }` rule (or equivalent
state classes), and derive control visibility from player identity, phase, and
seat availability. Add AI should be available only to host A while the room is
in the lobby and seat B is empty.

Acceptance checks:

- Game and lobby are mutually exclusive in the rendered DOM.
- Add AI is absent for player B and after the match starts.
- Clicking Add AI once cannot leave a stale action that returns `room-full`.
- Desktop and 390 px phone layouts are both checked.

Relevant files: `web/online.html`, `web/online.ts`, `web/styles.css`.

#### 4. Tournament draw completion is lost at the client boundary

`MatchRoom.isDraw` is set by `server/matchServer.ts`, but `sync()` omits it and
the WebSocket `state` message therefore omits it. `web/online.ts` handles a null
winner in phase `finished` through its generic waiting branch. A tournament draw
can consequently display “Waiting for player …” after the match is over.

Expose one authoritative result shape (`winner`, `isDraw`, and phase) in HTTP
sync and all relevant WebSocket messages. Render “Draw by threefold repetition”
and treat any `finished` phase as non-interactive.

Acceptance checks:

- The move that causes the third occurrence returns `isDraw: true`.
- Both participants receive and render the draw immediately.
- Reconnecting to a drawn room renders the same terminal result.
- No move/split control is interactive after a draw.

Relevant files: `server/matchServer.ts`, `server/ws.ts`, `web/online.ts`,
`tests/server.test.ts`, `tests/server-ws.test.ts`, `tests/web.test.ts`.

### P1 — Required UI refinement and usability work

#### 5. The online board is not player-relative

The shared HTML always places B in the rotated top row and A in the bottom row.
`web/online.ts` knows `playerId` but does not use it to map rows or orientation.
Player B therefore sees their own hands at the top/upside down and player A at
the bottom. In addition, only hand labels are counter-rotated; the numeric value
inside the opponent hand remains upside down.

Make online rendering player-relative: “you” at the bottom in normal
orientation, opponent at the top. Keep local pass-and-play orientation as a
separate explicit mode if desired.

#### 6. Drag-only hands are not accessible controls

Rendered hands are generic `div` elements with `aria-label`; they have no button
role, tab stop, keyboard action, or click/select fallback. Keyboard, switch, and
many assistive-technology users cannot make a move. Phase 06 required focus/touch
support and a manual accessibility check, but no such evidence is recorded.

Implement an accessible source-then-target interaction alongside pointer drag.
Use actual buttons where practical, expose selected/drop-target state, announce
illegal/cancelled actions, and verify keyboard-only play. Add disabled semantics
to Undo and native controls instead of visual classes alone.

#### 7. Turn and touch feedback need correction

`boardUI.ts` sets `active` on `.player-row`, while CSS styles `.hand.active`, so
the active turn has no visual hand highlight. The document uses `touch-action:
manipulation`, but draggable hands do not opt into `touch-action: none`; real
mobile browsers may interpret a drag as page manipulation or cancel it. There is
also no reduced-motion rule.

Use `.player-row.active .hand`, add a non-colour turn cue, set touch behaviour on
the drag surface, and perform a real-device Safari check. Keep a tap/keyboard
fallback even if touch drag works.

#### 8. Match-level completion is not presented

Local web and iOS sessions track scores and `gamesToWin`, but the clients do not
use `matchWinner()` to announce or lock a completed match. The rules copy says a
player wins by “winning the most games”, which does not describe first-to-N.

Define the finished-match screen, prevent accidental continuation, and make
“new game” versus “new match” terminology consistent. This is a product/session
presentation fix, not an engine-rule change.

#### 9. Online local-development defaults are incomplete

The online client defaults to same-origin `/ws`. Vite runs on port 5173, the
match server on 3000, and `web/vite.config.ts` has no `/ws` proxy. The Compose
comments imply that running both commands is sufficient, but it is not unless
`VITE_SERVER_URL=ws://localhost:3000/ws` is set before starting Vite.

Prefer a Vite WebSocket proxy for `/ws`, or document/inject the environment
variable in the container workflow. Add one local smoke test following exactly
the README commands.

### P1 — Release-surface gaps

#### 10. The service worker does not provide reliable offline play

`web/sw.js` pre-caches HTML and icons, but not the hashed JavaScript/CSS emitted
by Vite. Its fetch handler serves cached responses but never caches successful
runtime responses. After installation, cached HTML can therefore request missing
assets while offline. It also does not delete old cache versions. README and
`docs/app-store.md` previously overstated this as offline-capable.

Use Vite-integrated asset manifest generation or explicitly cache the complete
production bundle, clean old caches on activate, and test a production build by
loading once, disabling the network, and completing a local game.

#### 11. Native iOS is wired, not App Store finished

`ios-native/App.tsx` correctly renders the shared game screen and the shared code
typechecks. This review did not rerun an Xcode simulator/device build. Native UI
still uses a move-button list, has no active-player visual style, and has no
online client, haptics, or platform-specific accessibility verification.
`docs/app-store.md` also correctly requires replacement icons, launch screen,
bundle ID, signing, versions, screenshots, privacy details, archive, and upload.

Treat TestFlight/device verification and App Store assets/signing as a separate
release workstream. Do not call the native product published or store-ready yet.

### P2 — Production and maintenance follow-ups

- WebSocket payloads have no explicit `maxPayload` and no application-level rate
  limiting. HTTP rate limiting does not protect `/ws`.
- `x-forwarded-for` is trusted from any caller, allowing per-IP rate-limit
  spoofing unless a trusted reverse-proxy boundary is enforced.
- Room codes are sequential (`ROOM-0001`, etc.) and easily enumerable. Add-AI is
  not authorised specifically to host A. These are capability/security concerns
  for a public deployment.
- Finished/abandoned TTL uses `createdAt`, not terminal/last activity time; a
  long-running old room can be deleted immediately when it finishes.
- `FileRoomStore` is single-process, whole-file, synchronous storage. It remains
  unsuitable for horizontal scaling or high-value durability.
- `.dockerignore` does not exclude nested dependency directories robustly; the
  dev build sent roughly 500 MB of context, apparently including
  `ios-native/node_modules`.
- There is still no root lint script even though `AGENTS.md` calls for lint.
- Full `npm audit` reports 12 development dependency findings. Upgrade
  deliberately and retest; do not apply a blind force-fix.
- CI typechecks shared iOS code but does not run the React Native Jest suite or an
  Xcode build. A macOS runner is still required for native runtime evidence.

## Recommended work order

Each numbered group should be a focused branch/PR from current `main`. Do not
combine rule changes with UI work.

1. **Online lifecycle:** reliable connect/send queue, local Vite proxy/config,
   lobby/game hidden state, and phase/role-aware Add AI visibility. Add fresh-page
   create/join tests.
2. **Move completeness:** explicit redistribution picker with identity-aware
   tests in local and online flows.
3. **Terminal results:** carry `isDraw` through sync/WebSocket/client and present
   match-level completion through `matchWinner()`.
4. **Player-relative/accessibility UI:** orient online board around the local
   player; add button/keyboard/touch semantics and fix active-turn styling.
5. **PWA release claim:** cache the built asset graph and prove offline local
   play. Then update install copy.
6. **Native release work:** device/simulator runtime test, accessibility pass,
   icons/signing/store metadata, then TestFlight.
7. **Public-service hardening:** WebSocket limits/rate controls, trusted proxy
   configuration, unguessable room codes/host authorisation, TTL semantics, and
   production shared storage as deployment scale requires.

After groups 1-4, rerun the full container checks and perform a two-browser
human-v-human playthrough as A and B, including redistribution and a tournament
draw. That is the minimum credible web release signoff.

## Files to read first next session

1. `AGENTS.md` — branch/PR/container workflow.
2. `PROGRESS.md` — current status and decision log.
3. This file — release interpretation, reproductions, and acceptance criteria.
4. `DESIGN.md`, `docs/rules-v0.1.md`, and
   `docs/rules-tournament-v1.md` — boundaries and frozen behaviour.
5. `web/online.ts`, `web/online.html`, `web/client.ts`, `web/boardUI.ts`, and
   `web/styles.css` — first two work groups.
6. `server/matchServer.ts` and `server/ws.ts` — draw/result transport.
7. `web/sw.js`, `web/vite.config.ts`, and `docs/app-store.md` — PWA work.
8. `ios-app/GameScreen.tsx` and `ios-native/App.tsx` — native work.

## Handoff cautions

- This review intentionally changes documentation only. Reproduce a defect and
  add regression coverage before implementing its fix.
- Preserve `classic-v1`. Any gameplay behaviour change requires a new ruleset
  version and a recorded decision in `PROGRESS.md`.
- Run `docker compose exec -T dev npm ci` after lockfile changes because the
  named dependency volume can become stale.
- Use the branch/PR/merge/delete workflow in `AGENTS.md`; never commit directly
  to `main`.
- Preserve unrelated user changes if the working tree is no longer clean.
