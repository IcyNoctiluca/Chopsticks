# iOS App (React Native)

The iOS app is the target native client for Chopsticks, built on **the same** `@chopsticks/engine` and `session/` APIs as the web MVP and the authoritative match server. It renders natively via React Native + `react-native-svg`.

## Status

**Builds and runs on the iOS Simulator as a playable local client.**

The app code (`ios-app/App.tsx`, `GameScreen.tsx`, `HandSVG.tsx`) consumes the shared engine/session layer and provides two-player local play, an optional AI opponent for Player B, undo, new game/new match, a rules modal, and reusable SVG hand assets. Verified on an iPhone 17 Pro simulator (iOS 26.5).

## What's portable from the web MVP

- **Engine and session code** — used verbatim (same imports, same APIs).
- **SVG hand geometry** — `ios-app/HandSVG.tsx` uses the identical finger/palm measurements as `web/handSVG.ts`; only the renderer differs (`react-native-svg` vs inline SVG strings). The hand asset is genuinely portable.
- **Move descriptions and accessibility cues** — shared logic.
- **UX flow** — the same start → play → finish → restart/undo loop as the web client.

What is **not** ported: DOM layout, CSS, `window`/`document`. The iOS app uses `<View>`/`StyleSheet` natively. See `DESIGN.md` → "Client portability".

## To build and run

1. **Install full Xcode** from the Mac App Store (one-time, ~7–12 GB), select it, and accept the license:
   ```sh
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -runFirstLaunch
   sudo xcodebuild -license accept
   xcrun simctl list devices available   # confirm a simulator exists
   ```
   If no iOS Simulator runtime is listed, run `xcodebuild -downloadPlatform iOS` (~8.5 GB).
2. **Install host tooling:** Node 22+ (`brew install node`) and CocoaPods (`brew install cocoapods`).
3. **Install JS and iOS dependencies:**
   ```sh
   cd ios-native
   npm install
   cd ios
   pod install          # NOT `bundle exec pod install`
   cd ..
   ```
4. **Boot a simulator and run the app:**
   ```sh
   xcrun simctl boot "iPhone 17 Pro"
   open -a Simulator
   npx react-native run-ios --simulator="iPhone 17 Pro"
   ```
   The first build takes several minutes. The app launches in the simulator using the shared engine/session code from `../src` and `../session`.

The iOS app is also verified by **typecheck** (`npx tsc --noEmit -p ios-app/tsconfig.json` from `ios-native/`) and the **engine/session integration tests** (`tests/ios-app.test.ts`).

## Why the iOS work is staged this way

The engine-first architecture means the hard part (rules, replay, AI, session, server) is done and tested once, in the container. The iOS UI is a thin native rendering layer on top. Writing it now, against a real Xcode environment, is where the remaining iOS effort should go — and where DOM/CSS work from the web would have been wasted.