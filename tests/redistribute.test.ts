import { describe, it, expect } from "vitest";
import { getRedistributionMoves, describeRedistribution } from "../web/redistribute.js";
import type { GameState } from "../src/index.js";

function state(hands: { left: number; right: number }, turn: "A" | "B" = "A"): GameState {
  return {
    ruleset: "classic-v1",
    players: turn === "A"
      ? { A: hands, B: { left: 1, right: 1 } }
      : { A: { left: 1, right: 1 }, B: hands },
    turn,
    turnNumber: 0,
    status: "playing",
    winner: null,
    startingPlayer: "A",
  };
}

describe("getRedistributionMoves", () => {
  it("offers every distinct split of a single living hand", () => {
    const moves = getRedistributionMoves(state({ left: 3, right: 0 }));
    const pairs = moves.map((m) => [m.left, m.right]).sort((a, b) => a[0]! - b[0]!);
    expect(pairs).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it("returns no redistribution when both hands are living", () => {
    const moves = getRedistributionMoves(state({ left: 1, right: 1 }));
    expect(moves).toEqual([]);
  });

  it("returns no redistribution for a finished game", () => {
    const finished = { ...state({ left: 3, right: 0 }), status: "finished" as const, winner: "A" as const };
    expect(getRedistributionMoves(finished)).toEqual([]);
  });
});

describe("describeRedistribution", () => {
  it("labels a split by left and right values", () => {
    expect(describeRedistribution({ type: "redistribute", player: "A", right: 2, left: 1 })).toBe("Left 1 · Right 2");
  });
});
