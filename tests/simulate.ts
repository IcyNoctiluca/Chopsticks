import { createGame, getLegalMoves, applyMove, getWinner } from "../src/index.js";

let state = createGame();
let moves = 0;
while (state.status !== "finished" && moves < 100) {
  const legal = getLegalMoves(state);
  if (legal.length === 0) break;
  state = applyMove(state, legal[0]!);
  moves++;
}
console.log("Moves:", moves, "Winner:", getWinner(state));
console.log("Final A:", state.players.A, "B:", state.players.B);