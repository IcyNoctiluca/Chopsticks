import { createSession, getState, playHumanMove, advanceAITurns, undoInSession, canUndoInSession, startNextGame } from "../session/session.js";
import { getLegalMoves, getWinner, type Move } from "../src/index.js";
import { bindBoard } from "./boardUI.js";
import { movesEqual } from "./moves.js";
import { renderSplitPicker } from "./splitPicker.js";

let session = createSession({
  playerA: { name: "Player A", type: "human" },
  playerB: { name: "Player B", type: "human" },
  undoPolicy: "unlimited",
  moveTimerMs: null,
  gamesToWin: 3,
});

let aiForB = false;

window.addEventListener("DOMContentLoaded", main);

function main(): void {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => void 0);
  }
  render();
  document.getElementById("btn-undo")!.addEventListener("click", onUndo);
  document.getElementById("btn-restart")!.addEventListener("click", onRestart);
  document.getElementById("btn-newmatch")!.addEventListener("click", onNewMatch);
  document.getElementById("ai-toggle")!.addEventListener("change", onAIToggle);
  document.getElementById("btn-rules")!.addEventListener("click", toggleRules);
  document.getElementById("btn-close-rules")!.addEventListener("click", toggleRules);
}

function onAIToggle(e: Event): void {
  const checked = (e.target as HTMLInputElement).checked;
  aiForB = checked;
  session = { ...session, config: { ...session.config, playerB: { ...session.config.playerB, type: checked ? "ai" : "human", aiDifficulty: "random" } } };
  session = advanceAITurns(session);
  render();
}

function onUndo(): void {
  if (!canUndoInSession(session)) return;
  try {
    session = undoInSession(session, 1);
  } catch {
    void 0;
  }
  render();
}

function onRestart(): void {
  session = startNextGame(session);
  session = advanceAITurns(session);
  render();
}

function onNewMatch(): void {
  session = createSession({
    playerA: { name: "Player A", type: "human" },
    playerB: { name: aiForB ? "CPU" : "Player B", type: aiForB ? "ai" : "human", aiDifficulty: "random" },
    undoPolicy: "unlimited",
    moveTimerMs: null,
    gamesToWin: 3,
  });
  session = advanceAITurns(session);
  render();
}

function toggleRules(): void {
  const rules = document.getElementById("rules")!;
  const close = document.getElementById("btn-close-rules")!;
  rules.hidden = !rules.hidden;
  close.hidden = !rules.hidden;
}

function governorIsAITurn(s: typeof session, aiForB: boolean): boolean {
  const state = getState(s);
  if (state.status === "finished") return false;
  if (state.turn === "A") return s.config.playerA.type === "ai";
  if (state.turn === "B") return aiForB || s.config.playerB.type === "ai";
  return false;
}

function submitMove(move: Move): void {
  const state = getState(session);
  if (state.status === "finished") return;
  if (governorIsAITurn(session, aiForB)) return;
  if (!getLegalMoves(state).some((m) => movesEqual(m, move))) return;
  session = playHumanMove(session, move);
  session = advanceAITurns(session);
  render();
}

function render(): void {
  const state = getState(session);
  const winner = getWinner(state);
  const active = state.turn;

  const statusEl = document.getElementById("status")!;
  if (winner) {
    statusEl.innerHTML = `<span class="winner-banner">Player ${winner} wins! Score: A ${session.scores.A} – B ${session.scores.B}</span>`;
  } else if (governorIsAITurn(session, aiForB)) {
    statusEl.textContent = `Player ${active} (AI) is thinking…`;
    setTimeout(() => {
      session = advanceAITurns(session);
      render();
    }, 200);
    return;
  } else {
    statusEl.textContent = `Player ${active}'s turn — drag a hand onto another to tap`;
  }

  bindBoard({
    state,
    turn: active,
    finished: winner !== null,
    interactive: !governorIsAITurn(session, aiForB),
    onMove: submitMove,
  });

  const splitControl = document.getElementById("split-control")!;
  renderSplitPicker(splitControl, {
    state,
    interactive: !winner && !governorIsAITurn(session, aiForB),
    onMove: submitMove,
  });

  const undoBtn = document.getElementById("btn-undo")!;
  undoBtn.classList.toggle("disabled", !canUndoInSession(session));
}
