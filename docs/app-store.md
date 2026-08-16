# Publishing Chopsticks for iOS

There are two ways to get Chopsticks on an iPhone: the quickest is to add the web app to the home screen, and the App Store route gives a native React Native build.

## Option 1: Web app / Progressive Web App (quickest)

The web client is a PWA. Anyone with a modern iPhone can install it without the App Store:

1. Open Safari and navigate to the deployed web URL (e.g. `https://your-server.example.com`).
2. Tap the Share button.
3. Scroll down and tap **Add to Home Screen**.
4. The app launches full-screen, offline-capable, and works for local or online play.

To deploy the web client, run `npm run web:build` and serve the `dist-web/` directory behind HTTPS (e.g. with Caddy, nginx, or a static host like Vercel/Netlify).

## Option 2: App Store via the React Native project

The native iOS project lives in `ios-native/`. It is already wired to the shared game screen in `ios-app/GameScreen.tsx` via Metro configuration (`ios-native/metro.config.js`).

### Requirements

- macOS with Xcode 15+ installed.
- An Apple Developer account (paid membership required for App Store distribution).
- CocoaPods (`sudo gem install cocoapods`).
- Node.js >= 22.11.

### Build locally

```bash
cd ios-native
npm install
cd ios
pod install
cd ..
npm run ios
```

This opens the app in the iOS Simulator. To run on a physical iPhone, connect the device, select it in Xcode, and trust the developer certificate in **Settings → General → VPN & Device Management**.

### Prepare for App Store distribution

1. **Bundle identifier**: open `ios-native/ios/Chopsticks.xcodeproj` in Xcode and set a unique bundle ID (e.g. `com.yourdomain.chopsticks`).
2. **Signing & capabilities**: in Xcode, select the project, go to **Signing & Capabilities**, choose your Apple Developer team, and enable automatic signing.
3. **App icon**: replace the placeholder icons in `ios-native/ios/Chopsticks/Images.xcassets/AppIcon.appiconset/` with your own. Use a tool like `appicon.co` to generate all required sizes.
4. **Launch screen**: customize `ios-native/ios/Chopsticks/LaunchScreen.storyboard`.
5. **Display name**: edit `CFBundleDisplayName` in `ios-native/ios/Chopsticks/Info.plist` if desired.
6. **Versioning**: bump `version` in `ios-native/package.json` and the marketing/build versions in Xcode before each release.

### Archive and upload

1. In Xcode, set the scheme destination to **Any iOS Device (arm64)**.
2. Choose **Product → Archive**.
3. In the Organizer window, click **Distribute App → App Store Connect → Upload**.
4. Follow the prompts; Xcode validates, signs, and uploads the build.
5. In [App Store Connect](https://appstoreconnect.apple.com), create or update the app record, fill in app information, screenshots, privacy details, and pricing.
6. Select the uploaded build, submit for review, and once approved the app will be available on the App Store.

### Notes

- The native app currently uses the same local-only `GameScreen` as the web client. Online play via the server is implemented in the web client only; adding server connectivity to the native app is a future enhancement.
- TestFlight is the recommended way to distribute beta builds to your own iPhone before public release.
