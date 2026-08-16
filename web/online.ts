import { handSVG } from "./handSVG.js";
import { getLegalMoves } from "../src/index.js";
import type { GameState, Move, PlayerId } from "../src/index.js";

type ServerMessage =
  | { type: "created"; roomCode: string; playerId: PlayerId; state: GameState }
  | { type: "joined"; roomCode: string; playerId: PlayerId; state: GameState; history: Move[] }
  | { type: "ai-added"; roomCode: string; playerId: PlayerId }
  | { type: "move-accepted"; roomCode: string; state: GameState; moveNumber: number; winner: PlayerId | null }
  | { type: "state"; roomCode: string; state: GameState; history: Move[]; expectedMoveNumber: number; expectedTurn: PlayerId; phase: "lobby" | "playing" | "finished" | "abandoned" }
  | { type: "error"; code: string; message: string };

type ClientMessage =
  | { type: "create"; clientId: string; displayName: string; rulesetId?: "classic-v1" | "classic-tournament-v1" }
  | { type: "join"; roomCode: string; clientId: string; displayName: string }
  | { type: "add-ai"; roomCode: string; difficulty?: "random" | "heuristic" | "solved" }
  | { type: "move"; roomCode: string; clientId: string; move: Move; expectedMoveNumber: number }
  | { type: "sync"; roomCode: string; clientId: string };

const HANDS = ["left", "right"] as const;

function getClientId(): string {
  let id = localStorage.getItem("chopsticks-client-id");
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("chopsticks-client-id", id);
  }
  return id;
}

function getServerUrl(): string {
  return import.meta.env.VITE_SERVER_URL ?? window.location.origin.replace(/^http/, "ws") + "/ws";
}

class OnlineClient {
  private ws: WebSocket | null = null;
  private clientId = getClientId();
  private displayName = "Web Player";
  private roomCode: string | null = null;
  private playerId: PlayerId | null = null;
  private expectedMoveNumber = 0;
  private state: GameState | null = null;
  private phase: ServerMessage["phase"] = "lobby";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.bindLobby();
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    const url = getServerUrl();
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.clearReconnect();
      if (this.roomCode && this.playerId) {
        this.send({ type: "sync", roomCode: this.roomCode, clientId: this.clientId });
      }
    };
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        this.handleMessage(msg);
      } catch {
        this.setStatus("Received invalid message from server");
      }
    };
    this.ws.onclose = () => {
      this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      this.setStatus("Connection error");
    };
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => this.connect(), 2000);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "created":
        this.roomCode = msg.roomCode;
        this.playerId = msg.playerId;
        this.state = msg.state;
        this.expectedMoveNumber = 0;
        this.phase = "lobby";
        this.showGame();
        this.render();
        break;
      case "joined":
        this.roomCode = msg.roomCode;
        this.playerId = msg.playerId;
        this.state = msg.state;
        this.expectedMoveNumber = msg.history.length;
        this.phase = "playing";
        this.showGame();
        this.render();
        break;
      case "ai-added":
        break;
      case "move-accepted":
        this.state = msg.state;
        this.expectedMoveNumber = msg.moveNumber;
        this.render();
        break;
      case "state":
        this.state = msg.state;
        this.expectedMoveNumber = msg.expectedMoveNumber;
        this.phase = msg.phase;
        if (!this.playerId) {
          this.playerId = this.inferPlayerId();
        }
        this.render();
        break;
      case "error":
        this.setStatus(`Error: ${msg.message}`);
        break;
    }
  }

  private inferPlayerId(): PlayerId | null {
    if (!this.state || !this.roomCode) return null;
    // Try to infer from localStorage room mapping; otherwise fall back to current turn.
    const stored = localStorage.getItem(`chopsticks-room-${this.roomCode}`);
    if (stored === "A" || stored === "B") return stored;
    return null;
  }

  private bindLobby(): void {
    const createBtn = document.getElementById("btn-create") as HTMLButtonElement | null;
    const joinBtn = document.getElementById("btn-join") as HTMLButtonElement | null;
    const aiBtn = document.getElementById("btn-add-ai") as HTMLButtonElement | null;
    const codeInput = document.getElementById("room-code") as HTMLInputElement | null;
    const rulesetSelect = document.getElementById("ruleset") as HTMLSelectElement | null;

    createBtn?.addEventListener("click", () => {
      this.connect();
      const rulesetId = rulesetSelect?.value as "classic-v1" | "classic-tournament-v1";
      this.send({ type: "create", clientId: this.clientId, displayName: this.displayName, rulesetId });
    });

    joinBtn?.addEventListener("click", () => {
      const code = codeInput?.value.trim();
      if (!code) return;
      this.connect();
      this.roomCode = code;
      this.send({ type: "join", roomCode: code, clientId: this.clientId, displayName: this.displayName });
    });

    aiBtn?.addEventListener("click", () => {
      if (!this.roomCode) return;
      this.send({ type: "add-ai", roomCode: this.roomCode, difficulty: "random" });
    });
  }

  private showGame(): void {
    document.getElementById("lobby")?.setAttribute("hidden", "");
    document.getElementById("game")?.removeAttribute("hidden");
    document.getElementById("btn-add-ai")?.removeAttribute("hidden");
    const codeDisplay = document.getElementById("room-code-display");
    if (codeDisplay && this.roomCode) {
      codeDisplay.textContent = `Room: ${this.roomCode}`;
    }
    const copyBtn = document.getElementById("btn-copy-code");
    copyBtn?.removeEventListener("click", this.copyCode);
    copyBtn?.addEventListener("click", this.copyCode);
    document.getElementById("btn-leave")?.removeEventListener("click", this.leave);
    document.getElementById("btn-leave")?.addEventListener("click", this.leave);
  }

  private copyCode = (): void => {
    if (!this.roomCode) return;
    navigator.clipboard.writeText(this.roomCode).then(
      () => this.setStatus("Room code copied!"),
      () => this.setStatus("Failed to copy room code"),
    );
  };

  private leave = (): void => {
    this.ws?.close();
    window.location.reload();
  };

  private render(): void {
    if (!this.state) return;
    const state = this.state;
    const winner = state.winner;
    const active = state.turn;
    const myTurn = this.playerId === active && this.phase === "playing";

    const statusEl = document.getElementById("status")!;
    if (winner) {
      statusEl.textContent = `Player ${winner} wins!`;
    } else if (this.phase === "lobby") {
      statusEl.textContent = `Room ${this.roomCode} — waiting for opponent…`;
    } else if (this.phase === "abandoned") {
      statusEl.textContent = "Match abandoned.";
    } else {
      statusEl.textContent = myTurn ? "Your turn" : `Waiting for player ${active}…`;
    }

    renderHands("hands-a", state.players.A, active === "A");
    renderHands("hands-b", state.players.B, active === "B");

    const movesEl = document.getElementById("moves")!;
    movesEl.innerHTML = "";
    if (winner || this.phase !== "playing" || !myTurn) {
      const hint = winner ? "Game over." : this.phase === "lobby" ? "Waiting for opponent…" : "Waiting…";
      movesEl.innerHTML = `<p class="muted">${hint}</p>`;
      return;
    }

    const moves = getLegalMoves(state);
    moves.forEach((m, i) => {
      const btn = document.createElement("button");
      btn.className = "move";
      btn.type = "button";
      btn.setAttribute("aria-label", describeMove(m));
      btn.innerHTML = `<span class="tag">#${i + 1}</span> ${describeMove(m)}`;
      btn.addEventListener("click", () => this.onMove(i, moves));
      movesEl.appendChild(btn);
    });
  }

  private onMove(idx: number, moves: Move[]): void {
    if (!this.roomCode || !this.playerId) return;
    const move = moves[idx];
    if (!move) return;
    this.send({
      type: "move",
      roomCode: this.roomCode,
      clientId: this.clientId,
      move,
      expectedMoveNumber: this.expectedMoveNumber,
    });
  }

  private setStatus(text: string): void {
    const el = document.getElementById("status");
    if (el) el.textContent = text;
  }
}

function renderHands(elId: string, player: { left: number; right: number }, active: boolean): void {
  const el = document.getElementById(elId)!;
  const playerLabel = elId.endsWith("a") ? "A" : "B";
  el.classList.toggle("active", active);
  el.innerHTML = "";
  for (const hand of HANDS) {
    const value = hand === "left" ? player.left : player.right;
    const isDead = value === 0;
    const handDiv = document.createElement("div");
    handDiv.className = "hand" + (isDead ? " dead" : "");
    handDiv.setAttribute("aria-label", `${playerLabel} ${hand} ${value}`);
    handDiv.innerHTML = `
      <span class="label">${playerLabel} ${hand[0]!.toUpperCase()}</span>
      <span class="hand-art">${handSVG({ value, side: hand, dead: isDead })}</span>
      <span class="value">${value}</span>
    `;
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

new OnlineClient();
