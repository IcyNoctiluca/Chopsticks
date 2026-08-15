import { describe, it, expect } from "vitest";
import {
  createSession,
  playHumanMove,
  isAITurn,
  getState,
  startNextGame,
  canUndoInSession,
  undoInSession,
  advanceAITurns,
  matchWinner,
  serializeSession,
  deserializeSession,
  type MatchConfig,
} from "../session/session.js";
import { getLegalMoves, getWinner } from "../src/index.js";

const humanHuman: MatchConfig = {
  playerA: { name: "Alice", type: "human" },
  playerB: { name: "Bob", type: "human" },
  undoPolicy: "unlimited",
  moveTimerMs: null,
  gamesToWin: 3,
};

const humanVsAi: MatchConfig = {
  playerA: { name: "Alice", type: "human" },
  playerB: { name: "CPU", type: "ai", aiDifficulty: "random" },
  undoPolicy: "none",
  moveTimerMs: null,
  gamesToWin: 2,
};

describe("MatchSession: human vs human", () => {
  it("starts at the opening", () => {
    const s = createSession(humanHuman);
    expect(getState(s).turn).toBe("A");
    expect(s.scores).toEqual({ A: 0, B: 0 });
  });

  it("records a human move and advances turn", () => {
    const s0 = createSession(humanHuman);
    const m = getLegalMoves(getState(s0))[0]!;
    const s1 = playHumanMove(s0, m);
    expect(getState(s1).turn).toBe("B");
    expect(s1.currentRecord.moves.length).toBe(1);
  });

  it("undo restores the previous state", () => {
    const s0 = createSession(humanHuman);
    const m = getLegalMoves(getState(s0))[0]!;
    const s1 = playHumanMove(s0, m);
    const s2 = undoInSession(s1, 1);
    expect(getState(s2).turn).toBe("A");
    expect(s2.currentRecord.moves.length).toBe(0);
  });

  it("undo policy none blocks undo", () => {
    const s0 = createSession({ ...humanHuman, undoPolicy: "none" });
    const m = getLegalMoves(getState(s0))[0]!;
    const s1 = playHumanMove(s0, m);
    expect(canUndoInSession(s1)).toBe(false);
    expect(() => undoInSession(s1)).toThrow();
  });

  it("undo policy max limits undo count", () => {
    const s0 = createSession({ ...humanHuman, undoPolicy: { max: 1 } });
    const m1 = getLegalMoves(getState(s0))[0]!;
    const s1 = playHumanMove(s0, m1);
    expect(canUndoInSession(s1)).toBe(true);
    const s2 = undoInSession(s1, 1);
    expect(canUndoInSession(s2)).toBe(false);
    const m2 = getLegalMoves(getState(s2))[0]!;
    const s3 = playHumanMove(s2, m2);
    expect(canUndoInSession(s3)).toBe(false);
  });

  it("completes a game and updates scores", () => {
    let s = createSession(humanHuman);
    let moves = 0;
    while (getState(s).status !== "finished" && moves < 60) {
      const m = getLegalMoves(getState(s))[0]!;
      s = playHumanMove(s, m);
      moves++;
    }
    expect(getState(s).status).toBe("finished");
    expect(s.gamesPlayed).toBe(1);
    const winner = getWinner(getState(s));
    if (winner) expect(s.scores[winner]).toBe(1);
  });
});

describe("MatchSession: human vs AI", () => {
  it("does not start with an AI turn flagged for human A", () => {
    const s = createSession(humanVsAi);
    expect(isAITurn(s)).toBe(false);
  });

  it("plays an AI turn automatically after the human moves", () => {
    const s0 = createSession(humanVsAi);
    const m = getLegalMoves(getState(s0))[0]!;
    const s1 = playHumanMove(s0, m);
    expect(getState(s1).turn).toBe("A");
    expect(getState(s1).turnNumber).toBe(2);
  });

  it("advanceAITurns runs until it's a human turn or game over", () => {
    const aiVsAi: MatchConfig = {
      playerA: { name: "CPU1", type: "ai", aiDifficulty: "random" },
      playerB: { name: "CPU2", type: "ai", aiDifficulty: "random" },
      undoPolicy: "none",
      moveTimerMs: null,
      gamesToWin: 1,
    };
    const s0 = createSession(aiVsAi);
    const s1 = advanceAITurns(s0);
    expect(isAITurn(s1)).toBe(false);
    expect(getState(s1).status).toBe("finished");
    expect(s1.gamesPlayed).toBe(1);
  });

  it("startNextGame alternates starting player", () => {
    let s = createSession(humanVsAi);
    const firstStarter = s.startingPlayerNext;
    s = startNextGame(s);
    expect(s.startingPlayerNext).toBe(firstStarter === "A" ? "B" : "A");
  });
});

describe("MatchSession: match winner", () => {
  it("declares a winner once a player reaches gamesToWin", () => {
    const config: MatchConfig = { ...humanVsAi, gamesToWin: 1 };
    let s = createSession(config);
    let moves = 0;
    while (matchWinner(s) === null && moves < 60) {
      if (isAITurn(s)) {
        s = advanceAITurns(s);
        if (getState(s).status === "finished") break;
      } else {
        const m = getLegalMoves(getState(s))[0]!;
        s = playHumanMove(s, m);
      }
      moves++;
    }
    expect(matchWinner(s)).not.toBeNull();
  });
});

describe("MatchSession: persistence", () => {
  it("serialises and deserialises a session", () => {
    const s0 = createSession(humanHuman);
    const m = getLegalMoves(getState(s0))[0]!;
    const s1 = playHumanMove(s0, m);
    const json = serializeSession(s1);
    const restored = deserializeSession(json);
    expect(restored.currentRecord.moves.length).toBe(1);
    expect(getState(restored).turn).toBe("B");
  });

  it("rejects an unknown format version", () => {
    const bad = JSON.stringify({ formatVersion: 999, session: createSession(humanHuman) });
    expect(() => deserializeSession(bad)).toThrow();
  });
});

describe("Session does not leak into engine", () => {
  it("session module imports the engine, not vice versa", async () => {
    const engineSrc = await import("../src/index.js");
    expect(engineSrc.createGame).toBeDefined();
    expect((engineSrc as unknown as { session?: unknown }).session).toBeUndefined();
  });
});