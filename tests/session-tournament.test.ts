import { describe, it, expect } from "vitest";
import { createSession, playHumanMove, advanceAITurns, getState } from "../session/session.js";
import { getLegalMoves } from "../src/index.js";
import type { Move } from "../src/index.js";

const SIX_MOVE_CYCLE: Move[] = [
  { type: "tap", player: "A", source: "left", targetPlayer: "B", target: "left" },
  { type: "tap", player: "B", source: "right", targetPlayer: "B", target: "left" },
  { type: "tap", player: "A", source: "left", targetPlayer: "B", target: "left" },
  { type: "tap", player: "B", source: "right", targetPlayer: "B", target: "left" },
  { type: "tap", player: "A", source: "left", targetPlayer: "B", target: "right" },
  { type: "redistribute", player: "B", right: 1, left: 1 },
];

describe("Session tournament draw handling", () => {
  it("awards half a point to each player on a threefold-repetition draw", () => {
    const session = createSession({
      playerA: { name: "A", type: "human" },
      playerB: { name: "B", type: "human" },
      undoPolicy: "unlimited",
      moveTimerMs: null,
      gamesToWin: 2,
      ruleset: "classic-tournament-v1",
    });

    let s = session;
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < SIX_MOVE_CYCLE.length; i++) {
        const state = getState(s);
        if (state.status === "finished") break;
        const moves = getLegalMoves(state);
        const move = moves.find((m) => JSON.stringify(m) === JSON.stringify(SIX_MOVE_CYCLE[i]));
        if (!move) throw new Error("Expected move not legal");
        s = playHumanMove(s, move);
      }
    }

    expect(s.scores.A).toBe(0.5);
    expect(s.scores.B).toBe(0.5);
    expect(s.gamesPlayed).toBe(1);
  });
});
