import type { RulesetId, GameState, PlayerId } from "./types.js";
import { CLASSIC_V1, CLASSIC_TOURNAMENT_V1 } from "./internal.js";

export interface CreateGameOptions {
  readonly ruleset?: RulesetId;
  readonly startingPlayer?: PlayerId;
}

export function createGame(options: CreateGameOptions = {}): GameState {
  const rulesetId = options.ruleset ?? CLASSIC_V1.id;
  const ruleset = rulesetId === CLASSIC_TOURNAMENT_V1.id ? CLASSIC_TOURNAMENT_V1 : CLASSIC_V1;
  if (rulesetId !== CLASSIC_V1.id && rulesetId !== CLASSIC_TOURNAMENT_V1.id) {
    throw new Error(`Unknown ruleset: ${rulesetId}`);
  }
  const startingPlayer: PlayerId = options.startingPlayer ?? "A";
  return {
    ruleset: ruleset.id,
    players: {
      A: { left: ruleset.startingHandValue, right: ruleset.startingHandValue },
      B: { left: ruleset.startingHandValue, right: ruleset.startingHandValue },
    },
    turn: startingPlayer,
    turnNumber: 0,
    status: "playing",
    winner: null,
    startingPlayer,
  };
}