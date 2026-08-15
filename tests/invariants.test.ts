import { describe, it, expect } from "vitest";
import {
  createGame,
  getLegalMoves,
  isLegalMove,
  applyMove,
  getWinner,
  validateMove,
  type GameState,
  type Move,
} from "../src/index.js";

const PLAYER_IDS = ["A", "B"] as const;
const HANDS = ["left", "right"] as const;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function genRandomLivingValue(): number {
  return randomInt(0, 4);
}

function genRandomState(): GameState {
  const turn = PLAYER_IDS[randomInt(0, 1)]!;
  const ar = genRandomLivingValue();
  const al = genRandomLivingValue();
  const br = genRandomLivingValue();
  const bl = genRandomLivingValue();
  let status: "playing" | "finished" = "playing";
  let winner: "A" | "B" | null = null;
  if (ar === 0 && al === 0) {
    status = "finished";
    winner = "B";
  } else if (br === 0 && bl === 0) {
    status = "finished";
    winner = "A";
  }
  return {
    ruleset: "classic-v1",
    players: {
      A: { right: ar, left: al },
      B: { right: br, left: bl },
    },
    turn,
    turnNumber: randomInt(0, 20),
    status,
    winner,
    startingPlayer: "A",
  };
}

function genRandomMove(state: GameState): Move {
  const legal = getLegalMoves(state);
  if (legal.length > 0 && Math.random() < 0.6) {
    return legal[randomInt(0, legal.length - 1)]!;
  }
  const player = state.turn;
  if (Math.random() < 0.5) {
    return {
      type: "tap",
      player,
      source: HANDS[randomInt(0, 1)]!,
      targetPlayer: PLAYER_IDS[randomInt(0, 1)]!,
      target: HANDS[randomInt(0, 1)]!,
    };
  }
  const right = randomInt(0, 5);
  const left = randomInt(0, 5);
  return { type: "redistribute", player, right, left };
}

function genReachableState(maxDepth: number): GameState {
  let state = createGame();
  for (let i = 0; i < randomInt(0, maxDepth); i++) {
    if (state.status === "finished") break;
    const legal = getLegalMoves(state);
    if (legal.length === 0) break;
    state = applyMove(state, legal[randomInt(0, legal.length - 1)]!);
  }
  return state;
}

describe("invariant: getLegalMoves / applyMove agreement", () => {
  const N = 2000;
  it(`every legal move from generated positions applies without throwing (${N} cases)`, () => {
    for (let i = 0; i < N; i++) {
      const state = Math.random() < 0.5 ? genRandomState() : genReachableState(15);
      const legal = getLegalMoves(state);
      for (const move of legal) {
        expect(() => applyMove(state, move)).not.toThrow();
      }
    }
  });

  it(`every illegal move is rejected by applyMove (${N} cases)`, () => {
    for (let i = 0; i < N; i++) {
      const state = genRandomState();
      const move = genRandomMove(state);
      if (!isLegalMove(state, move)) {
        expect(() => applyMove(state, move)).toThrow();
        expect(validateMove(state, move)).not.toBeNull();
      }
    }
  });

  it("isLegalMove agrees with getLegalMoves membership", () => {
    for (let i = 0; i < N; i++) {
      const state = genReachableState(12);
      const legal = getLegalMoves(state);
      const legalSet = new Set(legal.map((m) => JSON.stringify(m)));
      for (const move of legal) {
        expect(isLegalMove(state, move)).toBe(true);
      }
      void legalSet;
    }
  });
});

describe("invariant: immutability", () => {
  const N = 1000;
  it(`applyMove never mutates its input state (${N} cases)`, () => {
    for (let i = 0; i < N; i++) {
      const state = genReachableState(12);
      const snapshot = clone(state);
      const legal = getLegalMoves(state);
      if (legal.length > 0) applyMove(state, legal[0]!);
      expect(state).toEqual(snapshot);
    }
  });
});

describe("invariant: terminal states reject moves", () => {
  it("finished games have no legal moves and applyMove throws", () => {
    for (let i = 0; i < 500; i++) {
      const state = genRandomState();
      if (state.status === "finished") {
        expect(getLegalMoves(state)).toEqual([]);
        const move = genRandomMove(state);
        expect(() => applyMove(state, move)).toThrow();
      }
    }
  });
});

describe("invariant: hand values are 0..4 only", () => {
  const N = 1000;
  it(`all reachable states have hand values in {0,1,2,3,4} (${N} cases)`, () => {
    for (let i = 0; i < N; i++) {
      const state = genReachableState(20);
      for (const pid of PLAYER_IDS) {
        const p = state.players[pid];
        for (const v of [p.left, p.right]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(4);
        }
      }
    }
  });
});

describe("invariant: turn ownership", () => {
  const N = 500;
  it(`legal moves all belong to the player to move (${N} cases)`, () => {
    for (let i = 0; i < N; i++) {
      const state = genReachableState(15);
      const legal = getLegalMoves(state);
      for (const move of legal) {
        expect(move.player).toBe(state.turn);
      }
    }
  });
});

describe("invariant: redistribution totals", () => {
  const N = 500;
  it(`redistribution legal moves preserve the mover's hand total (${N} cases)`, () => {
    for (let i = 0; i < N; i++) {
      const state = genReachableState(15);
      const legal = getLegalMoves(state).filter((m) => m.type === "redistribute");
      for (const move of legal) {
        if (move.type === "redistribute") {
          const p = state.players[move.player];
          expect(move.right + move.left).toBe(p.right + p.left);
          expect(move.right).toBeGreaterThanOrEqual(1);
          expect(move.left).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});