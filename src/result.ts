import { replayTo, type GameRecord } from "./record.js";
import { getWinner } from "./getWinner.js";
import type { GameState, PlayerId } from "./types.js";

export interface GameResult {
  readonly winner: PlayerId | null;
  readonly isDraw: boolean;
}

export function getResult(record: GameRecord): GameResult {
  const state = replayTo(record, record.moves.length);
  const winner = getWinner(state);
  if (winner !== null) return { winner, isDraw: false };
  if (state.ruleset === "classic-tournament-v1") {
    return { winner: null, isDraw: isThreefoldRepetition(record) };
  }
  return { winner: null, isDraw: false };
}

function isThreefoldRepetition(record: GameRecord): boolean {
  const states: GameState[] = [];
  for (let i = 0; i <= record.moves.length; i++) {
    states.push(replayTo(record, i));
  }
  const current = states[states.length - 1];
  if (!current) return false;
  const key = stateFingerprint(current);
  let count = 0;
  for (const s of states) {
    if (stateFingerprint(s) === key) count++;
    if (count >= 3) return true;
  }
  return false;
}

function stateFingerprint(state: GameState): string {
  return `${state.players.A.left},${state.players.A.right},${state.players.B.left},${state.players.B.right},${state.turn}`;
}
