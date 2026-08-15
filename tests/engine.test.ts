import { describe, it, expect } from "vitest";
import {
  createGame,
  getLegalMoves,
  isLegalMove,
  applyMove,
  getWinner,
  validateMove,
  InvalidMoveError,
  type GameState,
  type Move,
  type TapMove,
  type RedistributeMove,
} from "../src/index.js";

function state(players: { A: [number, number]; B: [number, number] }, turn: "A" | "B", extra: Partial<GameState> = {}): GameState {
  return {
    ruleset: "classic-v1",
    players: { A: { right: players.A[0], left: players.A[1] }, B: { right: players.B[0], left: players.B[1] } },
    turn,
    turnNumber: 0,
    status: "playing",
    winner: null,
    startingPlayer: "A",
    ...extra,
  };
}
// notation helper A:[right,left]
function s(notation: string): GameState {
  const m = notation.match(/A:\[(\d),(\d)\]\s*B:\[(\d),(\d)\]\s*turn:([AB])/);
  if (!m) throw new Error(`bad notation ${notation}`);
  return state(
    { A: [+m[1]!, +m[2]!], B: [+m[3]!, +m[4]!] },
    m[5]! as "A" | "B",
  );
}

function tap(player: "A" | "B", source: "left" | "right", targetPlayer: "A" | "B", target: "left" | "right"): TapMove {
  return { type: "tap", player, source, targetPlayer, target };
}
function redist(player: "A" | "B", right: number, left: number): RedistributeMove {
  return { type: "redistribute", player, right, left };
}

describe("createGame", () => {
  it("starts at classic-v1 opening", () => {
    const g = createGame();
    expect(g).toEqual({
      ruleset: "classic-v1",
      players: { A: { left: 1, right: 1 }, B: { left: 1, right: 1 } },
      turn: "A",
      turnNumber: 0,
      status: "playing",
      winner: null,
      startingPlayer: "A",
    });
  });
  it("respects startingPlayer option", () => {
    expect(createGame({ startingPlayer: "B" }).turn).toBe("B");
  });
  it("rejects unknown ruleset", () => {
    expect(() => createGame({ ruleset: "nope" as never })).toThrow();
  });
});

describe("immutability", () => {
  it("applyMove does not mutate input", () => {
    const g = s("A:[1,1] B:[1,1] turn:A");
    const snapshot = JSON.parse(JSON.stringify(g));
    applyMove(g, tap("A", "left", "B", "left"));
    expect(g).toEqual(snapshot);
  });
});

describe("getLegalMoves / isLegalMove - taps", () => {
  it("opening has 6 taps (2 sources x 3 living targets, self-same excluded)", () => {
    const moves = getLegalMoves(s("A:[1,1] B:[1,1] turn:A"));
    expect(moves.length).toBe(6);
    expect(moves.every((m) => m.type === "tap")).toBe(true);
  });
  it("self-tap is legal", () => {
    const g = s("A:[3,1] B:[2,2] turn:A");
    expect(isLegalMove(g, tap("A", "left", "A", "right"))).toBe(true);
  });
  it("cannot tap a dead source", () => {
    const g = s("A:[0,3] B:[1,1] turn:A");
    expect(isLegalMove(g, tap("A", "right", "B", "left"))).toBe(false);
  });
  it("cannot target a dead hand", () => {
    const g = s("A:[1,1] B:[0,1] turn:A"); // B right=0 (dead), left=1 (alive)
    expect(isLegalMove(g, tap("A", "left", "B", "right"))).toBe(false);
    expect(isLegalMove(g, tap("A", "left", "B", "left"))).toBe(true);
  });
  it("cannot tap the same hand (self same)", () => {
    const g = s("A:[1,1] B:[1,1] turn:A");
    expect(isLegalMove(g, tap("A", "left", "A", "left"))).toBe(false);
  });
  it("not your turn", () => {
    const g = s("A:[1,1] B:[1,1] turn:A");
    expect(validateMove(g, tap("B", "left", "A", "left"))).toBe("not-your-turn");
  });
  it("no legal moves when finished", () => {
    const g = state({ A: [1, 1], B: [0, 0] }, "A", { status: "finished", winner: "A" });
    expect(getLegalMoves(g)).toEqual([]);
  });
});

describe("tap arithmetic and elimination", () => {
  it("13.1 normal tap", () => {
    const after = applyMove(s("A:[1,1] B:[1,1] turn:A"), tap("A", "right", "B", "left"));
    expect(after.players.B).toEqual({ right: 1, left: 2 });
    expect(after.turn).toBe("B");
    expect(after.turnNumber).toBe(1);
  });
  it("13.2 elimination by tap to exactly 5", () => {
    const after = applyMove(s("A:[1,1] B:[0,4] turn:A"), tap("A", "left", "B", "left"));
    expect(after.players.B).toEqual({ right: 0, left: 0 });
    expect(after.status).toBe("finished");
    expect(getWinner(after)).toBe("A");
    expect(after.turn).toBe("B");
  });
  it("tap reaching 6 also kills (>=5 rule)", () => {
    const after = applyMove(s("A:[2,1] B:[1,4] turn:A"), tap("A", "right", "B", "left"));
    expect(after.players.B.left).toBe(0);
    expect(after.players.B.right).toBe(1);
  });
  it("self-tap adds source value", () => {
    const after = applyMove(s("A:[3,1] B:[2,2] turn:A"), tap("A", "right", "A", "left"));
    expect(after.players.A).toEqual({ right: 3, left: 4 });
    expect(after.turn).toBe("B");
  });
});

describe("redistribution", () => {
  it("allowed only when one hand dead", () => {
    expect(isLegalMove(s("A:[0,3] B:[2,2] turn:A"), redist("A", 1, 2))).toBe(true);
    expect(isLegalMove(s("A:[2,3] B:[2,2] turn:A"), redist("A", 3, 2))).toBe(false);
  });
  it("13.3 legal redistribution preserves total, both alive", () => {
    const after = applyMove(s("A:[0,3] B:[2,2] turn:A"), redist("A", 1, 2));
    expect(after.players.A).toEqual({ right: 1, left: 2 });
    expect(after.turn).toBe("B");
  });
  it("generates split moves when one hand dead", () => {
    const moves = getLegalMoves(s("A:[0,3] B:[2,2] turn:A")).filter((m) => m.type === "redistribute");
    expect(moves).toEqual([
      redist("A", 1, 2),
      redist("A", 2, 1),
    ]);
  });
  it("no redistribute moves when both living", () => {
    const moves = getLegalMoves(s("A:[1,1] B:[1,1] turn:A")).filter((m) => m.type === "redistribute");
    expect(moves).toEqual([]);
  });
  it("13.4 illegal: creates a dead hand (zero)", () => {
    expect(validateMove(s("A:[0,3] B:[2,2] turn:A"), redist("A", 0, 3))).toBe("redistribute-creates-dead-hand");
    expect(validateMove(s("A:[0,3] B:[2,2] turn:A"), redist("A", 3, 0))).toBe("redistribute-creates-dead-hand");
  });
  it("13.4 illegal: total not preserved", () => {
    expect(validateMove(s("A:[0,3] B:[2,2] turn:A"), redist("A", 1, 3))).toBe("redistribute-total-not-preserved");
  });
  it("illegal: creates a dead hand is caught before no-change guard (dead-hand precondition)", () => {
    // current has a 0; any both-alive split must differ, so no-change is unreachable in classic-v1
    expect(validateMove(s("A:[0,3] B:[2,2] turn:A"), redist("A", 0, 3))).toBe("redistribute-creates-dead-hand");
  });
});

describe("game completion", () => {
  it("13.5 game completion", () => {
    const after = applyMove(s("A:[4,4] B:[0,1] turn:A"), tap("A", "right", "B", "left"));
    expect(after.players.B).toEqual({ right: 0, left: 0 });
    expect(after.status).toBe("finished");
    expect(getWinner(after)).toBe("A");
  });
  it("applyMove rejects moves after game over", () => {
    const g = state({ A: [1, 1], B: [0, 0] }, "A", { status: "finished", winner: "A" });
    expect(() => applyMove(g, tap("A", "left", "B", "left"))).toThrow(InvalidMoveError);
  });
});

describe("full game round-trip", () => {
  it("can start, enumerate, apply, finish serialisably", () => {
    let g = createGame();
    const legal = getLegalMoves(g);
    expect(legal.length).toBeGreaterThan(0);
    g = applyMove(g, legal[0]!);
    expect(g.turn).toBe("B");
    expect(typeof JSON.stringify(g)).toBe("string");
  });
});