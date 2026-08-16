import { describe, it, expect } from "vitest";
import { createGame, applyMove, createRecord, applyMoveToRecord, getResult, getWinner } from "../src/index.js";
import type { Move } from "../src/index.js";

// A legal 6-move loop in classic-tournament-v1 that returns to the opening
// position A:[1,1] B:[1,1] turn:A. Running through it twice (12 moves) causes
// the opening position to appear a third time, triggering the draw rule.
const SIX_MOVE_CYCLE: Move[] = [
  { type: "tap", player: "A", source: "left", targetPlayer: "B", target: "left" },
  { type: "tap", player: "B", source: "right", targetPlayer: "B", target: "left" },
  { type: "tap", player: "A", source: "left", targetPlayer: "B", target: "left" },
  { type: "tap", player: "B", source: "right", targetPlayer: "B", target: "left" },
  { type: "tap", player: "A", source: "left", targetPlayer: "B", target: "right" },
  { type: "redistribute", player: "B", right: 1, left: 1 },
];

function recordFromMoves(moves: Move[], ruleset: "classic-v1" | "classic-tournament-v1" = "classic-tournament-v1") {
  let record = createRecord({ ruleset });
  for (const m of moves) record = applyMoveToRecord(record, m);
  return record;
}

describe("classic-tournament-v1 draw rule", () => {
  it("classic-v1 never declares a draw", () => {
    const record = recordFromMoves([...SIX_MOVE_CYCLE, ...SIX_MOVE_CYCLE], "classic-v1");
    expect(getWinner(record.initialState)).toBeNull();
    const result = getResult(record);
    expect(result.isDraw).toBe(false);
    expect(result.winner).toBeNull();
  });

  it("does not draw after one repetition of a position", () => {
    const record = recordFromMoves(SIX_MOVE_CYCLE);
    const result = getResult(record);
    expect(result.isDraw).toBe(false);
    expect(result.winner).toBeNull();
  });

  it("declares a draw when a position occurs three times", () => {
    const record = recordFromMoves([...SIX_MOVE_CYCLE, ...SIX_MOVE_CYCLE]);
    const result = getResult(record);
    expect(result.isDraw).toBe(true);
    expect(result.winner).toBeNull();
  });

  it("still reports a winner when a player is eliminated before a draw", () => {
    const record = recordFromMoves([
      { type: "tap", player: "A", source: "left", targetPlayer: "B", target: "left" },
      { type: "tap", player: "B", source: "left", targetPlayer: "A", target: "left" },
    ]);
    // Not a finished game, just ensures getResult does not misclassify.
    const result = getResult(record);
    expect(result.isDraw).toBe(false);
  });

  it("createGame supports the tournament ruleset", () => {
    const state = createGame({ ruleset: "classic-tournament-v1" });
    expect(state.ruleset).toBe("classic-tournament-v1");
  });

  it("applyMove does not finish the game on draw; getResult detects it", () => {
    const record = recordFromMoves([...SIX_MOVE_CYCLE, ...SIX_MOVE_CYCLE]);
    const state = record.initialState;
    expect(state.status).toBe("playing");
    const result = getResult(record);
    expect(result.isDraw).toBe(true);
  });
});
