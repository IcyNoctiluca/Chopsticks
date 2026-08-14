import type { GameState, PlayerId } from "./types.js";

export function getWinner(state: GameState): PlayerId | null {
  return state.winner;
}