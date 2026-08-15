import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { Server } from "node:http";
import {
  MatchServer,
  MatchServerError,
  type ClientId,
  type RoomCode,
  type MatchPhase,
} from "./matchServer.js";
import type { GameState, Move, PlayerId, RulesetId } from "../src/index.js";

export interface WSServerOptions {
  readonly server: Server;
  readonly matchServer: MatchServer;
  readonly path?: string;
}

type ClientMessage =
  | { type: "create"; clientId: ClientId; displayName: string; rulesetId?: RulesetId; moveTimeoutMs?: number; isAI?: boolean; aiDifficulty?: "random" | "heuristic" | "solved" }
  | { type: "join"; roomCode: RoomCode; clientId: ClientId; displayName: string }
  | { type: "add-ai"; roomCode: RoomCode; difficulty?: "random" | "heuristic" | "solved" }
  | { type: "move"; roomCode: RoomCode; clientId: ClientId; move: Move; expectedMoveNumber: number }
  | { type: "sync"; roomCode: RoomCode; clientId: ClientId };

type ServerMessage =
  | { type: "created"; roomCode: RoomCode; playerId: PlayerId; state: GameState }
  | { type: "joined"; roomCode: RoomCode; playerId: PlayerId; state: GameState; history: Move[] }
  | { type: "ai-added"; roomCode: RoomCode; playerId: PlayerId }
  | { type: "move-accepted"; roomCode: RoomCode; state: GameState; moveNumber: number; winner: PlayerId | null }
  | { type: "state"; roomCode: RoomCode; state: GameState; history: Move[]; expectedMoveNumber: number; expectedTurn: PlayerId; phase: MatchPhase }
  | { type: "error"; code: string; message: string };

interface SocketMeta {
  roomCode: RoomCode | null;
  clientId: ClientId | null;
}

export class ChopsticksWSServer {
  private wss: WebSocketServer;
  private matchServer: MatchServer;
  private sockets = new Map<WebSocket, SocketMeta>();

  constructor(options: WSServerOptions) {
    this.matchServer = options.matchServer;
    this.wss = new WebSocketServer({ server: options.server, path: options.path ?? "/ws" });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
  }

  close(): void {
    this.wss.close();
    for (const ws of this.sockets.keys()) {
      ws.terminate();
    }
    this.sockets.clear();
  }

  private handleConnection(ws: WebSocket): void {
    this.sockets.set(ws, { roomCode: null, clientId: null });

    ws.on("message", (data) => {
      try {
        const msg = parseMessage(data);
        if (!msg) {
          this.send(ws, { type: "error", code: "invalid-message", message: "Message must be JSON" });
          return;
        }
        this.handleMessage(ws, msg);
      } catch (err) {
        const code = err instanceof MatchServerError ? err.code : "internal";
        const message = err instanceof Error ? err.message : String(err);
        this.send(ws, { type: "error", code, message });
      }
    });

    ws.on("close", () => {
      this.sockets.delete(ws);
    });

    ws.on("error", () => {
      this.sockets.delete(ws);
    });
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case "create": {
        const result = this.matchServer.createRoom(
          { clientId: msg.clientId, displayName: msg.displayName, isAI: msg.isAI, aiDifficulty: msg.aiDifficulty },
          { rulesetId: msg.rulesetId, moveTimeoutMs: msg.moveTimeoutMs },
        );
        this.sockets.set(ws, { roomCode: result.roomCode, clientId: msg.clientId });
        this.send(ws, { type: "created", roomCode: result.roomCode, playerId: result.playerId, state: result.state });
        this.broadcastState(result.roomCode);
        break;
      }
      case "join": {
        const result = this.matchServer.joinRoom(msg.roomCode, msg.clientId, msg.displayName);
        this.sockets.set(ws, { roomCode: msg.roomCode, clientId: msg.clientId });
        this.send(ws, { type: "joined", roomCode: msg.roomCode, playerId: result.playerId, state: result.state, history: result.history });
        this.broadcastState(msg.roomCode);
        break;
      }
      case "add-ai": {
        const result = this.matchServer.addAI(msg.roomCode, msg.difficulty ?? "random");
        this.send(ws, { type: "ai-added", roomCode: msg.roomCode, playerId: result.playerId });
        this.broadcastState(msg.roomCode);
        break;
      }
      case "move": {
        const result = this.matchServer.submitMove(msg.roomCode, msg.clientId, msg.move, msg.expectedMoveNumber);
        this.send(ws, { type: "move-accepted", roomCode: msg.roomCode, state: result.state, moveNumber: result.moveNumber, winner: result.winner });
        this.broadcastState(msg.roomCode);
        break;
      }
      case "sync": {
        const result = this.matchServer.sync(msg.roomCode, msg.clientId);
        this.send(ws, {
          type: "state",
          roomCode: msg.roomCode,
          state: result.state,
          history: result.history,
          expectedMoveNumber: result.expectedMoveNumber,
          expectedTurn: result.expectedTurn,
          phase: result.phase,
        });
        break;
      }
      default: {
        this.send(ws, { type: "error", code: "unknown-type", message: `Unknown message type` });
      }
    }
  }

  private broadcastState(roomCode: RoomCode): void {
    let result: ReturnType<MatchServer["sync"]> | null = null;
    for (const [ws, meta] of this.sockets) {
      if (meta.roomCode !== roomCode || meta.clientId === null) continue;
      try {
        if (!result) {
          // Use the first participant's identity to read the room state.
          result = this.matchServer.sync(roomCode, meta.clientId);
        }
        this.send(ws, {
          type: "state",
          roomCode,
          state: result.state,
          history: result.history,
          expectedMoveNumber: result.expectedMoveNumber,
          expectedTurn: result.expectedTurn,
          phase: result.phase,
        });
      } catch {
        // Room may have been abandoned; stop broadcasting.
        return;
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

function parseMessage(data: RawData): ClientMessage | null {
  try {
    const text = Buffer.isBuffer(data) ? data.toString("utf8") : Array.isArray(data) ? Buffer.concat(data).toString("utf8") : data.toString();
    return JSON.parse(text) as ClientMessage;
  } catch {
    return null;
  }
}

export { MatchServerError };
