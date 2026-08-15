# iOS App (React Native)

The iOS app is the target native client for Chopsticks, built on **the same** `@chopsticks/engine` and `session/` APIs as the web MVP and the authoritative match server. It renders natively via React Native + `react-native-svg`.

## Status

**Scaffolded, typechecks, not yet built/run on a simulator.**

The app code (`ios-app/App.tsx`, `GameScreen.tsx`, `HandSVG.tsx`) is complete and consumes the shared engine/session layer. It cannot be built or run for iOS from this machine because **full Xcode is not installed** (only the Command Line Tools are present — `xcrun simctl` is unavailable). This is logged as a blocker in `PROGRESS.md`.

## What's portable from the web MVP

- **Engine and session code** — used verbatim (same imports, same APIs).
- **SVG hand geometry** — `ios-app/HandSVG.tsx` uses the identical finger/palm measurements as `web/handSVG.ts`; only the renderer differs (`react-native-svg` vs inline SVG strings). The hand asset is genuinely portable.
- **Move descriptions and accessibility cues** — shared logic.
- **UX flow** — the same start → play → finish → restart/undo loop as the web client.

What is **not** ported: DOM layout, CSS, `window`/`document`. The iOS app uses `<View>`/`StyleSheet` natively. See `DESIGN.md` → "Client portability".

## To build and run (once Xcode is installed)

1. **Install full Xcode** from the Mac App Store (one-time, ~7–12 GB). Then:
   ```sh
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -runFirstLaunch
   xcrun simctl list devices available   # confirm a simulator exists
   ```
2. **Create a native RN project shell** that points at this app. The recommended path is to use the React Native Community CLI outside the container (the container has no Xcode):
   ```sh
   npx @react-native-community/cli@latest init Chopsticks --directory ios-native \
     --skip-install
   ```
   Then wire `ios-app/App.tsx` as the bundle entry (Metro `entryFile`) and install the shared engine/session packages. A minimal `metro.config.js` that resolves `../src` and `../session` as source roots is required.
3. **Install `react-native-svg`** in the native project (it's already a devDependency here for typecheck).
4. **Run the app:**
   ```sh
   npx react-native run-ios
   ```
   This launches the iOS Simulator, builds the native shell, loads the JS bundle via Metro, and renders `App`.

Until full Xcode is installed, the iOS app is verified by **typecheck** (`npx tsc --noEmit -p ios-app/tsconfig.json`) and the **engine/session integration tests** (`tests/ios-app.test.ts`) — these prove the logic layer the UI renders is correct, even though the native render path is unexercised.

## Why the iOS work is staged this way

The engine-first architecture means the hard part (rules, replay, AI, session, server) is done and tested once, in the container. The iOS UI is a thin native rendering layer on top. Writing it now, against a real Xcode environment, is where the remaining iOS effort should go — and where DOM/CSS work from the web would have been wasted.