import { createSession, getState, playHumanMove, advanceAITurns, undoInSession, canUndoInSession, startNextGame } from "../session/session.js";
import { getWinner, getLegalMoves, type Move } from "../src/index.js";

const HANDS = ["left", "right"] as const;

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
  session = { ...session, currentRecord: startNextGame(session).currentRecord, undoCount: 0 };
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

export function onMove(idx: number): void {
  const state = getState(session);
  if (state.status === "finished") return;
  const all = governorLegalMoves(session, aiForB);
  if (idx >= all.length) return;
  const move = all[idx]!;
  if (governorIsAITurn(session, aiForB)) return;
  session = playHumanMove(session, move);
  session = advanceAITurns(session);
  render();
}

function governorLegalMoves(_session: typeof session, _aiForB: boolean): Move[] {
  return getLegalMoves(getState(_session));
}

function governorIsAITurn(s: typeof session, aiForB: boolean): boolean {
  const state = getState(s);
  if (state.status === "finished") return false;
  if (state.turn === "A") return s.config.playerA.type === "ai";
  if (state.turn === "B") return aiForB || s.config.playerB.type === "ai";
  return false;
}

function render(): void {
  const state = getState(session);
  const winner = getWinner(state);
  const active = state.turn;

  const statusEl = document.getElementById("status")!;
  if (winner) {
    statusEl.innerHTML = `<span class="winner-banner">🏆 Player ${winner} wins! Score: A ${session.scores.A} – B ${session.scores.B}</span>`;
  } else if (governorIsAITurn(session, aiForB)) {
    statusEl.textContent = `Player ${active} (AI) is thinking...`;
    setTimeout(() => {
      session = advanceAITurns(session);
      render();
    }, 200);
    return;
  } else {
    statusEl.textContent = `Player ${active}'s turn — Score: A ${session.scores.A} – B ${session.scores.B}`;
  }

  renderHands("hands-a", state.players.A, active === "A");
  renderHands("hands-b", state.players.B, active === "B");

  const movesEl = document.getElementById("moves")!;
  movesEl.innerHTML = "";
  if (winner) {
    movesEl.innerHTML = `<p class="muted">Game over. Use “Restart game” to play another.</p>`;
  } else {
    const moves = governorLegalMoves(session, aiForB);
    if (governorIsAITurn(session, aiForB)) {
      movesEl.innerHTML = `<p class="muted">AI is selecting a move...</p>`;
    } else {
      moves.forEach((m, i) => {
        const btn = document.createElement("button");
        btn.className = "move";
        btn.type = "button";
        btn.setAttribute("aria-label", describeMove(m));
        btn.innerHTML = `<span class="tag">#${i + 1}</span> ${describeMove(m)}`;
        btn.addEventListener("click", () => onMove(i));
        movesEl.appendChild(btn);
      });
    }
  }

  const undoBtn = document.getElementById("btn-undo")!;
  undoBtn.classList.toggle("disabled", !canUndoInSession(session));
}

function renderHands(elId: string, player: { left: number; right: number }, active: boolean): void {
  const el = document.getElementById(elId)!;
  el.classList.toggle("active", active);
  el.innerHTML = "";
  for (const hand of HANDS) {
    const value = hand === "left" ? player.left : player.right;
    const handDiv = document.createElement("div");
    handDiv.className = "hand" + (value === 0 ? " dead" : "");
    handDiv.setAttribute("aria-label", `${elId.endsWith("a") ? "A" : "B"} ${hand} ${value}`);
    handDiv.innerHTML = `<span class="label">${elId.endsWith("a") ? "A" : "B"} ${hand[0].toUpperCase()}</span><span class="value">${value}</span>`;
    el.appendChild(handDiv);
  }
}

function describeMove(move: Move): string {
  if (move.type === "tap") {
    const sh = move.source === "left" ? "L" : "R";
    const th = move.target === "left" ? "L" : "R";
    const whose = move.targetPlayer === move.player ? "your" : "opponent's";
    return `Tap ${sh} → ${whose} ${th}`;
  }
  return `Split to R:${move.right} L:${move.left}`;
}