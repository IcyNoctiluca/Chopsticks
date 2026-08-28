import { getLegalMoves } from "../src/index.js";
import type { GameState, RedistributeMove } from "../src/index.js";

export function getRedistributionMoves(state: GameState): RedistributeMove[] {
  return getLegalMoves(state).filter((m): m is RedistributeMove => m.type === "redistribute");
}

export function describeRedistribution(move: RedistributeMove): string {
  return `Left ${move.left} · Right ${move.right}`;
}
