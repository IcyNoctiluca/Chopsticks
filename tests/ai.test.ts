import { describe, it, expect } from "vitest";
import { createGame, getLegalMoves, applyMove, getWinner } from "../src/index.js";
import { chooseAIMove, type Difficulty } from "../ai/chooseMove.js";

function playFullGame(aiA: Difficulty, aiB: Difficulty, seed = 0): { moves: number; winner: string | null } {
  let state = createGame();
  let moves = 0;
  let rng = seed;
  const difficulties: Record<"A" | "B", Difficulty> = { A: aiA, B: aiB };
  while (state.status !== "finished" && moves < 60) {
    const legal = getLegalMoves(state);
    if (legal.length === 0) break;
    const diff = difficulties[state.turn];
    let move;
    if (diff === "random" && seed === 0) {
      move = legal[Math.floor(Math.random() * legal.length)]!;
    } else if (diff === "random") {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      move = legal[rng % legal.length]!;
    } else {
      move = chooseAIMove(state, diff);
    }
    state = applyMove(state, move);
    moves++;
  }
  void rng;
  return { moves, winner: getWinner(state) };
}

describe("AI: random", () => {
  it("returns a legal move for any non-terminal state", () => {
    let state = createGame();
    for (let i = 0; i < 20 && state.status !== "finished"; i++) {
      const move = chooseAIMove(state, "random");
      expect(getLegalMoves(state).some((m) => JSON.stringify(m) === JSON.stringify(move))).toBe(true);
      state = applyMove(state, move);
    }
  });

  it("can complete a game through the engine API", () => {
    const result = playFullGame("random", "random", 1);
    expect(result.moves).toBeGreaterThan(0);
    expect(result.moves).toBeLessThanOrEqual(60);
  });
});

describe("AI: heuristic", () => {
  it("never plays an illegal move", () => {
    let state = createGame();
    for (let i = 0; i < 20 && state.status !== "finished"; i++) {
      const move = chooseAIMove(state, "heuristic");
      expect(getLegalMoves(state).some((m) => JSON.stringify(m) === JSON.stringify(move))).toBe(true);
      state = applyMove(state, move);
    }
  });

  it("beats the random AI more often than chance in a short sample", () => {
    let heuristicWins = 0;
    for (let g = 0; g < 10; g++) {
      const result = playFullGame("heuristic", "random", g);
      if (result.winner === "A") heuristicWins++;
    }
    expect(heuristicWins).toBeGreaterThan(4);
  });
});

describe("AI: solved", () => {
  it("never loses against random when moving first over several games", () => {
    let losses = 0;
    for (let g = 0; g < 10; g++) {
      const result = playFullGame("solved", "random", g);
      if (result.winner === "B") losses++;
    }
    expect(losses).toBe(0);
  });

  it("selects a winning move when one is available", () => {
    // Construct a state where A can immediately win: A:[4,4] B:[0,1] turn:A
    const state = {
      ...createGame(),
      players: {
        A: { left: 4, right: 4 },
        B: { left: 1, right: 0 },
      },
      turn: "A" as const,
    };
    const move = chooseAIMove(state, "solved");
    const next = applyMove(state, move);
    expect(getWinner(next)).toBe("A");
  });
});

describe("AI: throws on no moves", () => {
  it("throws when the game is finished", () => {
    const state = {
      ...createGame(),
      players: { A: { left: 0, right: 0 }, B: { left: 1, right: 1 } },
      status: "finished" as const,
      winner: "B" as const,
    };
    expect(() => chooseAIMove(state, "random")).toThrow();
  });
});