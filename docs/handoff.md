# Handoff — iOS native shell (completed)

> **Status:** The handoff is complete. The iOS native shell now builds, launches, and renders on the iOS Simulator. This document is preserved as a record of the setup steps and gotchas encountered along the way. For the current build instructions, see `docs/ios-app.md`.

This document was a clean handoff for an agent picking up the Chopsticks project on a different machine. It records where the work stopped, what was verified working, and the precise next steps.

**Last updated:** 2026-08-15
**Last commit on `main`:** `6f1b637` (Merge PR #7)
**Active branch:** `ios-native-shell`

---

## 1. Repository state

| Branch | Purpose | Status |
| --- | --- | --- |
| `main` | All phases 00–07 + web polish merged | Clean, in sync with `origin/main` at `6f1b637` |
| `ios-native-shell` | Current in-progress work: wiring the RN iOS shell to the shared engine | **Uncommitted/unpushed** — see §3 |

PRs #1–#7 are merged. Roadmap phases 00–07 complete. Post-roadmap polish (SVG hand assets) merged in PR #7. The iOS native shell work is the active post-roadmap follow-up.

## 2. What's verified working (do not re-verify unless you change it)

- **Engine** (`src/`) — `classic-v1`, frozen v1.0, engine 0.1.0. Deterministic, framework-free, immutable, zero runtime deps. 92 tests.
- **Web MVP** (`web/`) — Vite + vanilla TS, runs at `http://localhost:5173` via `docker compose exec -d dev npm run web`. Builds (`web:build`).
- **Authoritative match server** (`server/`) — `MatchServer` authoritative module + `node:http` wrapper. 18 server tests incl. HTTP `/health` smoke.
- **AI** (`ai/`) — random / heuristic / solved, all via engine API only.
- **Session** (`session/`) — GameRecord, replay, undo, match scoring, versioned persistence.
- **Containerised dev** — Docker + colima. `docker compose up -d` then `docker compose exec dev npm <cmd>`. **Note:** iOS builds cannot run in the container (no Xcode); iOS work happens on the host.

All of the above is on `main` and merged. The handoff branch only adds the native iOS shell wiring.

## 3. What's on the `ios-native-shell` branch (uncommitted at handoff)

Two things:

### 3.1 `ios-app/` — TypeScript RN components (already committed via PR #7, on `main`)
- `ios-app/App.tsx` — RN entry, renders `<GameScreen />`.
- `ios-app/GameScreen.tsx` — full game UI using the **shared** `@chopsticks/engine` and `session/` APIs (same code as the web client).
- `ios-app/HandSVG.tsx` — hand asset via `react-native-svg`, identical geometry to `web/handSVG.ts`.
- `ios-app/tsconfig.json` — typecheck config (no `rootDir`, so it can import `../src` and `../session`).
- Verification: `docker compose exec dev npx tsc --noEmit -p ios-app/tsconfig.json` (clean) and `tests/ios-app.test.ts` (3 integration tests passing).

### 3.2 `ios-native/` — React Native 0.87 project scaffold, WIRED UP (the new uncommitted work)
A full `npx @react-native-community/cli init` scaffold that has been modified to use the shared engine code.

**Modifications made on this branch (already applied in the working tree, about to be committed):**
- `ios-native/index.js` — entry now imports `App` from `../ios-app/App` (not the default `./App`).
- `ios-native/metro.config.js` — `watchFolders: [workspaceRoot]` and `nodeModulesPaths` for both `ios-native/node_modules` and `../node_modules`, so Metro can resolve the shared engine/session/ai code.
- `ios-native/package.json` — `react-native-svg` added as a dependency (needed by `HandSVG.tsx`).
- `ios-native/ios/Podfile.lock` — `pod install` completed (87 pods installed), so `react-native-svg` native pod is wired.
- **The embedded `.git` directory that `npx react-native init` creates inside `ios-native/` has been removed** so the project tracks as plain files in the parent repo. If you re-init a fresh RN scaffold, remove `ios-native/.git` again before committing.

**Completed on this branch:**
- `npx react-native run-ios --simulator="iPhone 17 Pro"` now succeeds end-to-end. The app renders the Chopsticks game UI in the simulator using the shared engine/session code.
- Two Metro wiring fixes were required beyond the original handoff; see §5.5.

## 4. iOS / Xcode / Simulator setup

This is the part that was fragile and is worth documenting carefully.

### 4.1 Tooling that IS installed on this machine
- **Xcode 26.6** at `/Applications/Xcode.app`, selected via `xcode-select` at `/Applications/Xcode.app/Contents/Developer`.
- **iOS 26.5 Simulator runtime** (build 23F77) — downloaded via `xcodebuild -downloadPlatform iOS` (8.5 GB). Registered and Ready.
- **CocoaPods 1.17.0** via `brew install cocoapods`.
- **Node 25.9.0**, **npm 11.12.1**, Ruby 4.0.6 (homebrew), `pod` on PATH.

### 4.2 Gotchas encountered (and how they were resolved)

1. **Missing simulator runtime.** Xcode was installed but `simctl` showed zero runtimes/devices. Fix: `xcodebuild -downloadPlatform iOS`. The runtime is a separate ~8.5 GB download on recent Xcode.

2. **"Duplicate" / "Unusable" runtime entries after manual `simctl runtime add`.** Do NOT manually call `xcrun simctl runtime add` on the DMG — it creates duplicate unusable entries. If you get into this state:
   ```sh
   xcrun simctl runtime list                       # note the IDs
   xcrun simctl runtime delete <each-unusable-id>  # delete duplicates
   xcrun simctl runtime delete <ready-id>          # delete the Ready one too
   killall -9 com.apple.CoreSimulator.CoreSimulatorService
   xcodebuild -downloadPlatform iOS                # re-download cleanly (~10–15 min)
   ```
   After the clean re-download, `xcrun simctl list runtimes` should show `iOS 26.5 (... com.apple.CoreSimulator.SimRuntime.iOS-26-5)`.

3. **Deleting all simulator devices via `simctl delete unavailable` left no devices.** After the runtime was re-registered cleanly, devices had to be recreated:
   ```sh
   xcrun simctl create "iPhone 17 Pro" "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro" "com.apple.CoreSimulator.SimRuntime.iOS-26-5"
   xcrun simctl boot <device-udid>
   open -a Simulator
   ```
   On a fresh machine with a clean Xcode install + runtime download, the default simulator devices should already exist — you likely won't need to `simctl create`.

4. **`bundle exec pod install` failed** (Gemfile pins older cocoapods). Fix: run `pod install` directly with the system-installed CocoaPods, not `bundle exec`. RN prints a deprecation warning but it works.

5. **`npx react-native run-ios` initially failed with "no terminal app was specified" and "iOS devices or simulators not detected".** This is because the simulator wasn't booted at the time. Always boot a simulator first (`xcrun simctl boot <udid>` then `open -a Simulator`) before `run-ios`.

### 4.3 Verified simulator state at handoff
```sh
xcrun simctl list runtimes
# iOS 26.5 (26.5 - 23F77) - com.apple.CoreSimulator.SimRuntime.iOS-26-5

xcrun simctl list devices booted
# iPhone 17 Pro (<udid>) (Booted)
```

## 5. Exact next steps on the new machine

### 5.1 Environment prerequisites
1. macOS with **full Xcode** installed (not just Command Line Tools).
2. `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
3. `sudo xcodebuild -runFirstLaunch` and accept the license (`sudo xcodebuild -license`).
4. Verify the iOS Simulator runtime is present: `xcrun simctl list runtimes`. If empty, run `xcodebuild -downloadPlatform iOS` (8.5 GB).
5. Install **CocoaPods**: `brew install cocoapods`.
6. Install **Node 22+** and npm (the RN template requires `node >= 22.11.0`).

### 5.2 Get the code
```sh
git clone <repo-url> Chopsticks
cd Chopsticks
git fetch origin
git checkout ios-native-shell        # the active handoff branch
```
If the branch wasn't pushed before the move, the receiving agent needs the committed `ios-native/` tree from the handoff commit (see §7 — the branch will be pushed as part of handoff).

### 5.3 Install iOS dependencies (idempotent — safe to re-run)
```sh
cd ios-native
npm install                          # installs react-native-svg etc.
cd ios
pod install                          # NOT `bundle exec pod install`
```

### 5.4 Boot a simulator and run the app (the resume point)
```sh
# Boot a simulator
xcrun simctl create "iPhone 17 Pro" "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro" "com.apple.CoreSimulator.SimRuntime.iOS-26-5"  # only if no devices exist
xcrun simctl boot "iPhone 17 Pro"    # or by UDID
open -a Simulator

# Build and launch
cd ios-native
npx react-native run-ios --simulator="iPhone 17 Pro"
```
This command now completes successfully; expect a first build of several minutes (Hermes compile + Xcode build). On success the Chopsticks app renders in the simulator using the shared engine/session code from `../src` and `../session`.

### 5.5 Metro wiring fixes applied after the handoff

The first successful simulator build required two changes to `ios-native/metro.config.js`:

1. **TypeScript `.js` extension imports.** The shared engine/session/ai code uses Node16/Bundler style imports with explicit `.js` extensions (e.g. `./applyMove.js`). Metro does not map these to `.ts`/`.tsx` by default, so `resolveRequest` tries `.ts`, then `.tsx`, then `.js`.
2. **Prefer `ios-native/node_modules` for package imports.** Because `ios-app/` lives outside `ios-native/`, Metro resolved `react-native` from the workspace root's `node_modules`. The root dev dependency is a different RN version than the shell runtime, which broke asset resolution. The custom resolver now pretends package requests originate inside `ios-native/` so the shell's dependencies win.

These fixes are committed on `ios-native-shell`; no local workaround is needed.

### 5.6 Start Metro separately if needed
`run-ios` starts Metro automatically. If it complains about a terminal, run `npm start` in one terminal then `npx react-native run-ios --no-packager` in another.

## 6. How the native app reuses the shared engine

The single-engine principle (see `DESIGN.md` → "Client portability" and "Layer responsibilities") is preserved: `ios-app/GameScreen.tsx` imports from `../src/index.js` and `../session/session.js` directly. Metro's `watchFolders: [workspaceRoot]` and the `nodeModulesPaths` in `ios-native/metro.config.js` make this resolve. There is **no separate engine implementation** in the iOS app.

## 7. Handoff actions taken by the previous agent

1. Removed `ios-native/.git` (embedded repo) so the scaffold tracks in the parent repo.
2. Committed the wired `ios-native/` tree on branch `ios-native-shell`.
3. Pushed `ios-native-shell` to `origin` so a fresh checkout on the new machine gets it.
4. Wrote this document (`docs/handoff.md`).
5. Updated `PROGRESS.md` with the in-progress iOS shell state.

## 8. Other follow-ups (non-blocking, logged in `PROGRESS.md`)

- Persistent room store across server restarts (Redis/DB) — Phase 07 follow-up.
- WebSocket real-time transport wrapping `MatchServer` — Phase 07 follow-up.
- Tournament draw rule (`classic-tournament-v1`) for ranked online play — Phase 04 follow-up.

These are independent of the iOS work and can be picked up later.

## 9. Key files and docs

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Working agreement: source of truth, git workflow (per-phase branch→PR→merge→delete), containerised dev, engine boundaries, rule-change policy, completion standard. **Read this first.** |
| `DESIGN.md` | Architecture, layer responsibilities, client portability. |
| `PROGRESS.md` | Decision log, phase tracker, blockers, playtest findings. Updated continuously. |
| `docs/rules-v0.1.md` | `classic-v1` rules spec (frozen v1.0). |
| `docs/api.md` | Engine public API + invalid-move contract. |
| `docs/analysis.md` | Phase 04 game-theoretic analysis (1142 states, opening = DRAW). |
| `docs/release.md` | Release ops: privacy, failure handling, deployment, support, release criteria, planned metrics. |
| `docs/ios-app.md` | Earlier iOS app doc (scaffold status, portability notes, build path). Some of this is now superseded by `docs/handoff.md`. |
| `docs/handoff.md` | This file. |
| `src/` | The engine (public API in `src/index.ts`). |
| `session/` | Session layer (match config, AI turns, undo policy, persistence). |
| `ai/` | AI opponents (random / heuristic / solved). |
| `server/` | Authoritative `MatchServer` + `node:http` wrapper. |
| `web/` | Vite web MVP client. |
| `cli/` | Terminal CLI (`npm run play`). |
| `ios-app/` | TypeScript RN components (UI logic, shared-engine-dependent). |
| `ios-native/` | The native RN 0.87 project shell (Xcode workspace, Pods, Metro config) — the active handoff work. |
| `tests/` | 92 passing tests (engine, invariants, record, AI, session, server, analysis, CLI, web, ios-app). |

## 10. Resume checklist for the receiving agent

- [ ] Read `AGENTS.md` and `PROGRESS.md` first (per the working agreement).
- [ ] Read this handoff doc in full.
- [ ] Clone/fetch and check out `ios-native-shell`.
- [ ] Confirm Xcode + iOS Simulator runtime are installed on the new machine (§5.1).
- [ ] `npm install` + `pod install` in `ios-native/` (§5.3).
- [ ] Boot a simulator (§5.4).
- [ ] Run `npx react-native run-ios --simulator="iPhone 17 Pro"` to completion (§5.4) — this is the exact resume point.
- [ ] If the build succeeds, play the game in the simulator, then iterate on the native UI (animations, accessibility, polish per Phase 06 exit criteria for the native client).
- [ ] If the build fails, capture the error, update `PROGRESS.md`, and either resolve or log as a blocker per the working agreement.
- [ ] When the iOS shell is shippable, follow the standard git workflow in `AGENTS.md` (branch → PR → merge → delete → pull `main`).