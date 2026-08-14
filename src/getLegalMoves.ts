import type { GameState, InvalidMoveReason, Move, PlayerId, RedistributeMove, TapMove } from "./types.js";
import {
  handValue,
  isHandAlive,
  livingHandCount,
  otherPlayer,
} from "./internal.js";

export function getLegalMoves(state: GameState): Move[] {
  if (state.status === "finished") return [];
  const mover = state.turn;
  const moverState = state.players[mover];
  const moves: Move[] = [];

  for (const source of ["left", "right"] as const) {
    if (!isHandAlive(moverState, source)) continue;
    const targets: Array<{ player: PlayerId; hand: "left" | "right" }> = [
      { player: "A", hand: "left" },
      { player: "A", hand: "right" },
      { player: "B", hand: "left" },
      { player: "B", hand: "right" },
    ];
    for (const t of targets) {
      if (t.player === mover && t.hand === source) continue;
      if (!isHandAlive(state.players[t.player], t.hand)) continue;
      moves.push({
        type: "tap",
        player: mover,
        source,
        targetPlayer: t.player,
        target: t.hand,
      });
    }
  }

  if (livingHandCount(moverState) === 1) {
    const livingHand = isHandAlive(moverState, "left") ? "left" : "right";
    const v = handValue(moverState, livingHand);
    for (let a = 1; a <= v - 1; a++) {
      const b = v - a;
      moves.push({ type: "redistribute", player: mover, right: a, left: b });
    }
  }

  return moves;
}

export function isLegalMove(state: GameState, move: Move): boolean {
  return validateMove(state, move) === null;
}

export function validateMove(state: GameState, move: Move): InvalidMoveReason | null {
  if (state.status === "finished") return "game-over";
  if ("player" in move && move.player !== state.turn) return "not-your-turn";
  if (move.type === "tap") return validateTap(state, move);
  if (move.type === "redistribute") return validateRedistribute(state, move);
  return "unknown-move-type";
}

function validateTap(state: GameState, move: TapMove): InvalidMoveReason | null {
  if (!isHandAlive(state.players[move.player], move.source)) return "tap-source-dead";
  const targetState = state.players[move.targetPlayer];
  if (!isHandAlive(targetState, move.target)) return "tap-target-dead";
  if (move.player === move.targetPlayer && move.source === move.target) {
    return "tap-target-is-source";
  }
  return null;
}

function validateRedistribute(state: GameState, move: RedistributeMove): InvalidMoveReason | null {
  const moverState = state.players[move.player];
  if (livingHandCount(moverState) !== 1) return "redistribute-when-both-living";
  const total = moverState.left + moverState.right;
  if (move.right + move.left !== total) return "redistribute-total-not-preserved";
  if (move.right < 1 || move.left < 1) return "redistribute-creates-dead-hand";
  if (move.right === moverState.right && move.left === moverState.left) {
    return "redistribute-no-change";
  }
  return null;
}