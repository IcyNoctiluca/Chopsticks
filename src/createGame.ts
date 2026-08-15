import type { RulesetId, GameState, PlayerId } from "./types.js";
import { CLASSIC_V1 } from "./internal.js";

export interface CreateGameOptions {
  readonly ruleset?: RulesetId;
  readonly startingPlayer?: PlayerId;
}

export function createGame(options: CreateGameOptions = {}): GameState {
  const rulesetId = options.ruleset ?? CLASSIC_V1.id;
  if (rulesetId !== CLASSIC_V1.id) {
    throw new Error(`Unknown ruleset: ${rulesetId}`);
  }
  const startingPlayer: PlayerId = options.startingPlayer ?? "A";
  return {
    ruleset: CLASSIC_V1.id,
    players: {
      A: { left: CLASSIC_V1.startingHandValue, right: CLASSIC_V1.startingHandValue },
      B: { left: CLASSIC_V1.startingHandValue, right: CLASSIC_V1.startingHandValue },
    },
    turn: startingPlayer,
    turnNumber: 0,
    status: "playing",
    winner: null,
    startingPlayer,
  };
}