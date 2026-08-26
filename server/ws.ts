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
import { validateCreateRoomBody, validateJoinBody, validateAddAIBody, validateMoveBody, requireString } from "./validation.js";

export interface WSServerOptions {
  readonly server: Server;
  readonly matchServer: MatchServer;
  readonly path?: string;
}

type ClientMessage =
  | { type: "create"; clientId: ClientId; displayName: string; rulesetId?: RulesetId; moveTimeoutMs?: number }
  | { type: "join"; roomCode: RoomCode; clientId: ClientId; displayName: string }
  | { type: "add-ai"; roomCode: RoomCode; difficulty?: "random" | "heuristic" | "solved" }
  | { type: "move"; roomCode: RoomCode; clientId: ClientId; move: Move; expectedMoveNumber: number }
  | { type: "sync"; roomCode: RoomCode; clientId: ClientId };

type ServerMessage =
  | { type: "created"; roomCode: RoomCode; playerId: PlayerId; state: GameState }
  | { type: "joined"; roomCode: RoomCode; playerId: PlayerId; state: GameState; history: Move[] }
  | { type: "ai-added"; roomCode: RoomCode; playerId: PlayerId }
  | { type: "move-accepted"; roomCode: RoomCode; state: GameState; moveNumber: number; winner: PlayerId | null; isDraw: boolean }
  | { type: "state"; roomCode: RoomCode; state: GameState; history: Move[]; expectedMoveNumber: number; expectedTurn: PlayerId; phase: MatchPhase; winner: PlayerId | null; isDraw: boolean }
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
        const params = validateCreateRoomBody(msg);
        const result = this.matchServer.createRoom(params.host, params.options);
        this.sockets.set(ws, { roomCode: result.roomCode, clientId: params.host.clientId });
        this.send(ws, { type: "created", roomCode: result.roomCode, playerId: result.playerId, state: result.state });
        this.broadcastState(result.roomCode);
        break;
      }
      case "join": {
        const params = validateJoinBody(msg);
        const result = this.matchServer.joinRoom(msg.roomCode, params.clientId, params.displayName);
        this.sockets.set(ws, { roomCode: msg.roomCode, clientId: params.clientId });
        this.send(ws, { type: "joined", roomCode: msg.roomCode, playerId: result.playerId, state: result.state, history: result.history });
        this.broadcastState(msg.roomCode);
        break;
      }
      case "add-ai": {
        const difficulty = validateAddAIBody(msg);
        const result = this.matchServer.addAI(msg.roomCode, difficulty);
        this.send(ws, { type: "ai-added", roomCode: msg.roomCode, playerId: result.playerId });
        this.broadcastState(msg.roomCode);
        break;
      }
      case "move": {
        const params = validateMoveBody(msg);
        const result = this.matchServer.submitMove(msg.roomCode, params.clientId, params.move, params.expectedMoveNumber);
        this.send(ws, {
          type: "move-accepted",
          roomCode: msg.roomCode,
          state: result.state,
          moveNumber: result.moveNumber,
          winner: result.winner,
          isDraw: result.isDraw,
        });
        this.broadcastState(msg.roomCode);
        break;
      }
      case "sync": {
        const result = this.matchServer.sync(msg.roomCode, requireString(msg.clientId, "clientId") as ClientId);
        this.send(ws, {
          type: "state",
          roomCode: msg.roomCode,
          state: result.state,
          history: result.history,
          expectedMoveNumber: result.expectedMoveNumber,
          expectedTurn: result.expectedTurn,
          phase: result.phase,
          winner: result.winner,
          isDraw: result.isDraw,
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
          winner: result.winner,
          isDraw: result.isDraw,
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
