import {
  createGame,
  getLegalMoves,
  applyMove,
  getWinner,
  type GameState,
  type Move,
} from "../src/index.js";

export type Difficulty = "random" | "heuristic" | "solved";

export interface AI {
  readonly difficulty: Difficulty;
  chooseMove(state: GameState): Move;
}

export function chooseAIMove(state: GameState, difficulty: Difficulty): Move {
  const legal = getLegalMoves(state);
  if (legal.length === 0) {
    throw new Error("No legal moves to choose from");
  }
  if (difficulty === "random") return randomMove(state, legal);
  if (difficulty === "heuristic") return heuristicMove(state, legal);
  return solvedMove(state, legal);
}

function randomMove(_state: GameState, legal: Move[]): Move {
  return legal[Math.floor(Math.random() * legal.length)]!;
}

function heuristicMove(state: GameState, legal: Move[]): Move {
  const mover = state.turn;
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const move of legal) {
    const next = applyMove(state, move);
    const winner = getWinner(next);
    let score = 0;
    if (winner === mover) score = 1000;
    else if (winner !== null) score = -1000;
    else {
      const me = next.players[mover];
      const foe = next.players[next.turn];
      score += (me.left + me.right) - (foe.left + foe.right);
      score += (me.left > 0 ? 1 : 0) + (me.right > 0 ? 1 : 0);
      score -= (foe.left > 0 ? 1 : 0) + (foe.right > 0 ? 1 : 0);
      score += Math.random() * 0.01;
    }
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best!;
}

function solvedMove(state: GameState, legal: Move[]): Move {
  const values = precomputeValues(state);
  const mover = state.turn;
  let best: Move | null = null;
  let bestVal = -Infinity;
  for (const move of legal) {
    const next = applyMove(state, move);
    const nextVal = values.get(stateKey(next));
    const opponentVal = nextVal ?? "DRAW";
    const ourVal =
      opponentVal === "LOSS" ? 2 : opponentVal === "DRAW" ? 1 : 0;
    if (ourVal > bestVal) {
      bestVal = ourVal;
      best = move;
    }
  }
  return best ?? legal[0]!;
}

function stateKey(state: GameState): string {
  const a = state.players.A;
  const b = state.players.B;
  return `${a.right},${a.left}|${b.right},${b.left}|${state.turn}|${state.status}`;
}

const valueCache = new Map<string, Map<string, "WIN" | "LOSS" | "DRAW">>();

function precomputeValues(_seed: GameState): Map<string, "WIN" | "LOSS" | "DRAW"> {
  if (valueCache.has("v1")) return valueCache.get("v1")!;
  const start = createGame();
  const nodes = new Map<string, GameState>();
  const successors = new Map<string, string[]>();
  const queue: GameState[] = [start];
  while (queue.length > 0) {
    const state = queue.pop()!;
    const key = stateKey(state);
    if (nodes.has(key)) continue;
    nodes.set(key, state);
    const legal = getLegalMoves(state);
    const succ: string[] = [];
    for (const m of legal) {
      const n = applyMove(state, m);
      succ.push(stateKey(n));
      if (!nodes.has(stateKey(n))) queue.push(n);
    }
    successors.set(key, succ);
  }
  const keys = Array.from(nodes.keys());
  const value = new Map<string, "WIN" | "LOSS" | "DRAW">();
  for (const k of keys) {
    if (nodes.get(k)!.status === "finished") value.set(k, "LOSS");
  }
  const winCount = new Map<string, number>();
  const totalCount = new Map<string, number>();
  for (const k of keys) {
    if (value.get(k) === undefined) {
      totalCount.set(k, successors.get(k)!.length);
      winCount.set(k, 0);
    }
  }
  const reverse = new Map<string, Set<string>>();
  for (const k of keys) {
    for (const s of successors.get(k)!) {
      if (!reverse.has(s)) reverse.set(s, new Set());
      reverse.get(s)!.add(k);
    }
  }
  const worklist: string[] = [...value.entries()].filter(([, v]) => v === "LOSS").map(([k]) => k);
  while (worklist.length > 0) {
    const loss = worklist.pop()!;
    for (const pred of reverse.get(loss) ?? new Set<string>()) {
      if (value.get(pred) !== undefined) continue;
      value.set(pred, "WIN");
      for (const gp of reverse.get(pred) ?? new Set<string>()) {
        if (value.get(gp) !== undefined) continue;
        winCount.set(gp, (winCount.get(gp) ?? 0) + 1);
        if (winCount.get(gp) === (totalCount.get(gp) ?? 0)) {
          value.set(gp, "LOSS");
          worklist.push(gp);
        }
      }
    }
  }
  for (const k of keys) if (value.get(k) === undefined) value.set(k, "DRAW");
  valueCache.set("v1", value);
  return value;
}