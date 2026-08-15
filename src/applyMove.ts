import type { GameState, Move, PlayerId, PlayerState, RedistributeMove, TapMove } from "./types.js";
import { InvalidMoveError } from "./types.js";
import {
  CLASSIC_V1,
  handValue,
  bothHandsDead,
  otherPlayer,
  withHand,
} from "./internal.js";
import { validateMove } from "./getLegalMoves.js";

export function applyMove(state: GameState, move: Move): GameState {
  const reason = validateMove(state, move);
  if (reason !== null) {
    throw new InvalidMoveError(reason, `Invalid move: ${reason}`);
  }
  const players = move.type === "tap" ? applyTap(state, move) : applyRedistribute(state, move);
  return advanceAndResolve(state, players, move.player);
}

function applyTap(state: GameState, move: TapMove): Record<PlayerId, PlayerState> {
  const sourceValue = handValue(state.players[move.player], move.source);
  const targetValue = handValue(state.players[move.targetPlayer], move.target);
  const sum = targetValue + sourceValue;
  const newTargetValue = sum >= CLASSIC_V1.eliminationThreshold ? 0 : sum;
  const updatedTarget = withHand(state.players[move.targetPlayer], move.target, newTargetValue);
  return { ...state.players, [move.targetPlayer]: updatedTarget };
}

function applyRedistribute(state: GameState, move: RedistributeMove): Record<PlayerId, PlayerState> {
  const updated = { left: move.left, right: move.right };
  return { ...state.players, [move.player]: updated };
}

function advanceAndResolve(
  state: GameState,
  players: Record<PlayerId, PlayerState>,
  mover: PlayerId,
): GameState {
  let winner: PlayerId | null = null;
  if (bothHandsDead(players.A)) winner = "B";
  else if (bothHandsDead(players.B)) winner = "A";
  const finished = winner !== null;
  return {
    ...state,
    players,
    turn: otherPlayer(mover),
    turnNumber: state.turnNumber + 1,
    status: finished ? "finished" : "playing",
    winner,
  };
}