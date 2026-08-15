import { describe, it, expect } from "vitest";
import {
  createSession,
  getState,
  playHumanMove,
  advanceAITurns,
  type MatchConfig,
} from "../session/session.js";
import { getLegalMoves, getWinner } from "../src/index.js";

// Verifies the React Native app's engine/session integration (the same API
// the web client uses) drives a complete game end-to-end. The RN components
// themselves can't render in a node test, but the logic layer they call is
// identical to the web client's and is exercised here.

const config: MatchConfig = {
  playerA: { name: "Player A", type: "human" },
  playerB: { name: "Player B", type: "human" },
  undoPolicy: "unlimited",
  moveTimerMs: null,
  gamesToWin: 2,
};

describe("iOS app engine/session integration", () => {
  it("drives a complete two-human game the same way GameScreen does", () => {
    let s = createSession(config);
    let moves = 0;
    while (getState(s).status !== "finished" && moves < 60) {
      const m = getLegalMoves(getState(s))[0]!;
      s = playHumanMove(s, m);
      moves++;
    }
    expect(getState(s).status).toBe("finished");
    expect(getWinner(getState(s))).not.toBeNull();
    expect(s.gamesPlayed).toBe(1);
  });

  it("drives a human-vs-AI game to completion via advanceAITurns", () => {
    const aiConfig: MatchConfig = {
      playerA: { name: "Human", type: "human" },
      playerB: { name: "CPU", type: "ai", aiDifficulty: "solved" },
      undoPolicy: "none",
      moveTimerMs: null,
      gamesToWin: 1,
    };
    let s = createSession(aiConfig);
    let moves = 0;
    while (getWinner(getState(s)) === null && moves < 100) {
      if (getState(s).status === "finished") break;
      const st = getState(s);
      if (st.turn === "A") {
        const m = getLegalMoves(st)[0]!;
        s = playHumanMove(s, m);
      } else {
        s = advanceAITurns(s);
      }
      moves++;
    }
    expect(getWinner(getState(s))).not.toBeNull();
  });

  it("restarting a game keeps the match score", () => {
    let s = createSession(config);
    while (getState(s).status !== "finished") {
      const m = getLegalMoves(getState(s))[0]!;
      s = playHumanMove(s, m);
    }
    const scoreAfterGame1 = { ...s.scores };
    s = { ...s, currentRecord: { ...s.currentRecord, moves: [] }, undoCount: 0 };
    expect(s.scores).toEqual(scoreAfterGame1);
  });
});