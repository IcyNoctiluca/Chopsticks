import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  createGame,
  getLegalMoves,
  applyMove,
  getWinner,
  type GameState,
  type Move,
  type TapMove,
} from "../src/index.js";

function handLabel(hand: "left" | "right"): string {
  return hand === "left" ? "L" : "R";
}

function renderMove(idx: number, move: Move): string {
  if (move.type === "tap") {
    const target = move.targetPlayer === move.player ? "self" : move.targetPlayer;
    return `[${idx}] Tap ${handLabel(move.source)} -> ${target} ${handLabel(move.target)}`;
  }
  return `[${idx}] Split to R:${move.right} L:${move.left}`;
}

function renderState(state: GameState): string {
  const a = state.players.A;
  const b = state.players.B;
  const winner = getWinner(state);
  console.log();
  console.log("    Player A:  L:" + a.left + "  R:" + a.right);
  console.log("    Player B:  L:" + b.left + "  R:" + b.right);
  console.log("    Turn: " + state.turn + (state.turnNumber > 0 ? " (move #" + state.turnNumber + ")" : ""));
  if (winner) {
    console.log("    *** " + winner + " wins! ***");
  }
  console.log();
}

function describeTarget(move: TapMove): string {
  const whose = move.targetPlayer === move.player ? "your " + handLabel(move.target) : "opponent's " + handLabel(move.target);
  return "tap " + handLabel(move.source) + " -> " + whose;
}

function describeMove(move: Move): string {
  if (move.type === "tap") return describeTarget(move);
  return "split to R:" + move.right + " L:" + move.left;
}

async function main(): Promise<void> {
  console.log("=== Chopsticks CLI (classic-v1) ===");
  console.log("Enter 'q' to quit, 'h' for move legend.\n");

  const rl = createInterface({ input, output, terminal: false });
  let state = createGame();
  const startingPlayers = ["A", "B"] as const;
  let gameNumber = 0;

  outer: while (true) {
    renderState(state);
    const legal = getLegalMoves(state);
    const winner = getWinner(state);

    if (winner) {
      console.log("Game " + (gameNumber + 1) + " complete. Winner: " + winner);
      gameNumber++;
      const answer = await rl.question("Play again? (y/n) ");
      if (answer.trim().toLowerCase() !== "y") break;
      const nextStarter = startingPlayers[gameNumber % 2]!;
      state = createGame({ startingPlayer: nextStarter });
      continue;
    }

    if (legal.length === 0) {
      console.log("No legal moves. Player " + state.turn + " loses.");
      state = { ...state, status: "finished", winner: startingPlayers[0] === state.turn ? "B" : "A" };
      continue;
    }

    console.log("Legal moves:");
    legal.forEach((m, i) => console.log("  " + renderMove(i, m)));

    const answer = await rl.question("Player " + state.turn + ", choose move> ");
    const trimmed = answer.trim();

    if (trimmed.toLowerCase() === "q") break outer;
    if (trimmed.toLowerCase() === "h") {
      console.log("  Tap: [source hand] taps [target hand].");
      console.log("  Split: redistribute your total across both hands (revival only).");
      console.log("  Source/target hands: L = left, R = right.");
      console.log("  'self' means your other hand.\n");
      continue;
    }

    const idx = parseInt(trimmed, 10);
    if (isNaN(idx) || idx < 0 || idx >= legal.length) {
      console.log("Invalid selection. Enter a number 0-" + (legal.length - 1));
      continue;
    }

    const move = legal[idx]!;
    console.log("  " + state.turn + " plays: " + describeMove(move));
    state = applyMove(state, move);
  }

  console.log("\nThanks for playing!");
  rl.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});