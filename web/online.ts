import { bindBoard } from "./boardUI.js";
import { movesEqual } from "./moves.js";
import { renderRedistributionChoices } from "./splitPicker.js";
import { getLegalMoves } from "../src/index.js";
import type { GameState, Move, PlayerId, RedistributeMove } from "../src/index.js";

type MatchPhase = "lobby" | "playing" | "finished" | "abandoned";

type ServerMessage =
  | { type: "created"; roomCode: string; playerId: PlayerId; state: GameState }
  | { type: "joined"; roomCode: string; playerId: PlayerId; state: GameState; history: Move[] }
  | { type: "ai-added"; roomCode: string; playerId: PlayerId }
  | { type: "move-accepted"; roomCode: string; state: GameState; moveNumber: number; winner: PlayerId | null; isDraw: boolean }
  | { type: "state"; roomCode: string; state: GameState; history: Move[]; expectedMoveNumber: number; expectedTurn: PlayerId; phase: MatchPhase; winner: PlayerId | null; isDraw: boolean }
  | { type: "error"; code: string; message: string };

type ClientMessage =
  | { type: "create"; clientId: string; displayName: string; rulesetId?: "classic-v1" | "classic-tournament-v1" }
  | { type: "join"; roomCode: string; clientId: string; displayName: string }
  | { type: "add-ai"; roomCode: string; difficulty?: "random" | "heuristic" | "solved" }
  | { type: "move"; roomCode: string; clientId: string; move: Move; expectedMoveNumber: number }
  | { type: "sync"; roomCode: string; clientId: string };

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
  private phase: MatchPhase = "lobby";
  private isDraw = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connecting: Promise<void> | null = null;
  private lobbyActionInFlight = false;
  private aiActionInFlight = false;

  constructor() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => void 0);
    }
    this.bindLobby();
  }

  private connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connecting) return this.connecting;

    const socket = new WebSocket(getServerUrl());
    this.ws = socket;
    this.connecting = new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => fail(new Error("Connection timed out")), 8_000);
      const succeed = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        this.connecting = null;
        resolve();
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        this.connecting = null;
        if (socket.readyState === WebSocket.CONNECTING) socket.close();
        reject(error);
      };

      socket.onopen = () => {
        this.clearReconnect();
        succeed();
        if (this.roomCode && this.playerId) {
          this.send({ type: "sync", roomCode: this.roomCode, clientId: this.clientId });
        }
      };
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage;
          this.handleMessage(msg);
        } catch {
          this.setStatus("Received invalid message from server");
        }
      };
      socket.onclose = () => {
        fail(new Error("Connection closed"));
        if (this.ws === socket && this.roomCode && this.playerId) this.scheduleReconnect();
      };
      socket.onerror = () => {
        fail(new Error("Connection error"));
      };
    });
    return this.connecting;
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      void this.connect().catch(() => void 0);
    }, 2000);
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
      return;
    }
    this.setStatus("Connection is not ready. Retrying…");
    void this.connect().catch(() => void 0);
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "created":
        this.roomCode = msg.roomCode;
        this.playerId = msg.playerId;
        this.state = msg.state;
        this.expectedMoveNumber = 0;
        this.phase = "lobby";
        this.isDraw = false;
        localStorage.setItem(`chopsticks-room-${msg.roomCode}`, msg.playerId);
        this.finishLobbyAction();
        this.showGame();
        this.render();
        break;
      case "joined":
        this.roomCode = msg.roomCode;
        this.playerId = msg.playerId;
        this.state = msg.state;
        this.expectedMoveNumber = msg.history.length;
        this.phase = "playing";
        this.isDraw = false;
        localStorage.setItem(`chopsticks-room-${msg.roomCode}`, msg.playerId);
        this.finishLobbyAction();
        this.showGame();
        this.render();
        break;
      case "ai-added":
        this.aiActionInFlight = false;
        break;
      case "move-accepted":
        this.state = msg.state;
        this.expectedMoveNumber = msg.moveNumber;
        this.isDraw = msg.isDraw;
        this.render();
        break;
      case "state":
        this.state = msg.state;
        this.expectedMoveNumber = msg.expectedMoveNumber;
        this.phase = msg.phase;
        this.isDraw = msg.isDraw;
        if (!this.playerId) {
          this.playerId = this.inferPlayerId();
        }
        this.render();
        break;
      case "error":
        this.aiActionInFlight = false;
        this.finishLobbyAction();
        this.setStatus(`Error: ${msg.message}`);
        break;
    }
  }

  private inferPlayerId(): PlayerId | null {
    if (!this.state || !this.roomCode) return null;
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
      const rulesetId = rulesetSelect?.value as "classic-v1" | "classic-tournament-v1";
      void this.sendLobbyAction({ type: "create", clientId: this.clientId, displayName: this.displayName, rulesetId });
    });

    joinBtn?.addEventListener("click", () => {
      const code = codeInput?.value.trim();
      if (!code) return;
      void this.sendLobbyAction({ type: "join", roomCode: code, clientId: this.clientId, displayName: this.displayName });
    });

    aiBtn?.addEventListener("click", () => {
      if (!this.roomCode || this.aiActionInFlight) return;
      this.aiActionInFlight = true;
      aiBtn.disabled = true;
      this.send({ type: "add-ai", roomCode: this.roomCode, difficulty: "random" });
    });

  }

  private async sendLobbyAction(message: Extract<ClientMessage, { type: "create" | "join" }>): Promise<void> {
    if (this.lobbyActionInFlight) return;
    this.lobbyActionInFlight = true;
    this.setLobbyBusy(true);
    this.setStatus("Connecting to match server…");
    try {
      await this.connect();
      this.send(message);
    } catch {
      this.finishLobbyAction();
      this.setStatus("Could not connect. Check the server and try again.");
    }
  }

  private setLobbyBusy(busy: boolean): void {
    for (const id of ["btn-create", "btn-join"]) {
      const button = document.getElementById(id) as HTMLButtonElement | null;
      if (button) button.disabled = busy;
    }
  }

  private finishLobbyAction(): void {
    this.lobbyActionInFlight = false;
    this.setLobbyBusy(false);
  }

  private showGame(): void {
    document.getElementById("lobby")?.setAttribute("hidden", "");
    document.getElementById("game")?.removeAttribute("hidden");
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
    const finished = this.phase === "finished" || this.phase === "abandoned";
    const myTurn = this.playerId === active && this.phase === "playing" && !this.isDraw;

    const statusEl = document.getElementById("status")!;
    if (this.phase === "finished" && this.isDraw) {
      statusEl.textContent = "Draw by threefold repetition.";
    } else if (winner) {
      statusEl.textContent = `Player ${winner} wins!`;
    } else if (this.phase === "lobby") {
      statusEl.textContent = `Room ${this.roomCode} — waiting for opponent…`;
    } else if (this.phase === "abandoned") {
      statusEl.textContent = "Match abandoned.";
    } else {
      statusEl.textContent = myTurn ? "Your turn — drag a hand onto another to tap" : `Waiting for player ${active}…`;
    }

    bindBoard({
      state,
      turn: active,
      finished,
      interactive: myTurn,
      bottomPlayer: this.playerId ?? "A",
      onMove: (move) => this.submitMove(move),
      onInteractionStatus: (message) => this.setStatus(message),
    });

    const splitControl = document.getElementById("split-control")!;
    const splitMoves = myTurn ? getLegalMoves(state).filter((m): m is RedistributeMove => m.type === "redistribute") : [];
    splitControl.hidden = splitMoves.length === 0;
    const splitOptions = document.getElementById("split-options");
    if (splitOptions) renderRedistributionChoices(splitOptions, splitMoves, (move) => this.submitMove(move));

    const addAi = document.getElementById("btn-add-ai") as HTMLButtonElement | null;
    if (addAi) {
      addAi.hidden = !(this.phase === "lobby" && this.playerId === "A");
      addAi.disabled = this.aiActionInFlight;
    }
  }

  private submitMove(move: Move): void {
    if (!this.roomCode || !this.state) return;
    if (!getLegalMoves(this.state).some((m) => movesEqual(m, move))) return;
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

new OnlineClient();
