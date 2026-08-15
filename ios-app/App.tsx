import React from "react";
import { AppRegistry } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GameScreen } from "./GameScreen";

export default function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <GameScreen />
    </SafeAreaProvider>
  );
}

// When embedded in a React Native project, register with:
//   AppRegistry.registerComponent("Chopsticks", () => App);
// This file is the TypeScript entry; the native Xcode project is set up separately.
void AppRegistry;