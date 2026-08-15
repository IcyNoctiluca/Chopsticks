import React from "react";
import { AppRegistry } from "react-native";
import { GameScreen } from "./GameScreen.js";

export default function App(): React.ReactElement {
  return <GameScreen />;
}

// When embedded in a React Native project, register with:
//   AppRegistry.registerComponent("Chopsticks", () => App);
// This file is the TypeScript entry; the native Xcode project is set up separately.
void AppRegistry;