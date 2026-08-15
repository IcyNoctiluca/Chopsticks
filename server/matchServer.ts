import {
  createRecord,
  replay,
  applyMoveToRecord,
  getLegalMoves,
  isLegalMove,
  getWinner,
  applyMove,
  InvalidMoveError,
  type GameState,
  type Move,
  type PlayerId,
  type RulesetId,
} from "../src/index.js";
import { chooseAIMove } from "../ai/chooseMove.js";

export type ClientId = string;
export type RoomCode = string;

export const ENGINE_VERSION = "0.1.0";
export const SUPPORTED_RULESETS: RulesetId[] = ["classic-v1"];

export type MatchPhase = "lobby" | "playing" | "finished" | "abandoned";

export interface MatchPlayer {
  readonly clientId: ClientId | null;
  readonly displayName: string;
  readonly isAI: boolean;
  readonly aiDifficulty?: "random" | "heuristic" | "solved";
}

export interface MatchRoom {
  readonly roomCode: RoomCode;
  readonly rulesetId: RulesetId;
  readonly engineVersion: string;
  readonly players: Record<PlayerId, MatchPlayer>;
  readonly record: ReturnType<typeof createRecord>;
  readonly expectedTurn: PlayerId;
  readonly expectedMoveNumber: number;
  readonly phase: MatchPhase;
  readonly createdAt: number;
  readonly lastActivityAt: number;
  readonly moveDeadlineMs: number | null;
  readonly history: Move[];
}

export type ServerError =
  | "room-not-found"
  | "not-a-participant"
  | "not-your-turn"
  | "stale-move"
  | "illegal-move"
  | "match-finished"
  | "match-abandoned"
  | "incompatible-ruleset"
  | "incompatible-engine-version"
  | "room-full";

export class MatchServerError extends Error {
  readonly code: ServerError;
  constructor(code: ServerError, message: string) {
    super(message);
    this.name = "MatchServerError";
    this.code = code;
  }
}

export interface SubmitMoveResult {
  readonly state: GameState;
  readonly moveNumber: number;
  readonly winner: PlayerId | null;
  readonly accepted: boolean;
}

export interface MatchServerOptions {
  readonly moveTimeoutMs?: number | null;
  readonly abandonedAfterMs?: number;
}

export class MatchServer {
  private rooms = new Map<RoomCode, MatchRoom>();
  private codeCounter = 0;
  private readonly moveTimeoutMs: number | null;
  private readonly abandonedAfterMs: number;

  constructor(options: MatchServerOptions = {}) {
    this.moveTimeoutMs = options.moveTimeoutMs ?? null;
    this.abandonedAfterMs = options.abandonedAfterMs ?? 60000;
  }

  createRoom(host: { clientId: ClientId; displayName: string; isAI?: boolean; aiDifficulty?: "random" | "heuristic" | "solved" }, options: { rulesetId?: RulesetId; moveTimeoutMs?: number } = {}): { roomCode: RoomCode; playerId: PlayerId; state: GameState } {
    const rulesetId = options.rulesetId ?? "classic-v1";
    if (!SUPPORTED_RULESETS.includes(rulesetId)) {
      throw new MatchServerError("incompatible-ruleset", `Ruleset ${rulesetId} not supported`);
    }
    const roomCode = this.generateCode();
    const record = createRecord({ startingPlayer: "A" });
    const isAI = host.isAI ?? false;
    const room: MatchRoom = {
      roomCode,
      rulesetId,
      engineVersion: ENGINE_VERSION,
      players: {
        A: { clientId: isAI ? null : host.clientId, displayName: host.displayName, isAI, aiDifficulty: host.aiDifficulty },
        B: { clientId: null, displayName: "(empty)", isAI: false },
      },
      record,
      expectedTurn: "A",
      expectedMoveNumber: 0,
      phase: "lobby",
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      moveDeadlineMs: options.moveTimeoutMs ?? this.moveTimeoutMs ?? null,
      history: [],
    };
    this.rooms.set(roomCode, room);
    if (isAI) this.maybeAutoPlayAI(roomCode);
    return { roomCode, playerId: "A", state: replay(room.record) };
  }

  joinRoom(roomCode: RoomCode, clientId: ClientId, displayName: string): { playerId: PlayerId; state: GameState; history: Move[] } {
    const room = this.getRoom(roomCode);
    if (room.players.B.clientId !== null && !room.players.B.isAI) {
      throw new MatchServerError("room-full", "Room is full");
    }
    const updated: MatchRoom = {
      ...room,
      players: { ...room.players, B: { clientId, displayName, isAI: false } },
      phase: "playing",
      lastActivityAt: Date.now(),
    };
    this.rooms.set(roomCode, updated);
    return { playerId: "B", state: replay(updated.record), history: [...updated.history] };
  }

  addAI(roomCode: RoomCode, difficulty: "random" | "heuristic" | "solved" = "random"): { playerId: PlayerId } {
    const room = this.getRoom(roomCode);
    if (room.players.B.clientId !== null) throw new MatchServerError("room-full", "Room already has player B");
    const updated: MatchRoom = {
      ...room,
      players: { ...room.players, B: { clientId: null, displayName: "CPU", isAI: true, aiDifficulty: difficulty } },
      phase: "playing",
      lastActivityAt: Date.now(),
    };
    this.rooms.set(roomCode, updated);
    this.maybeAutoPlayAI(roomCode);
    return { playerId: "B" };
  }

  submitMove(roomCode: RoomCode, clientId: ClientId, move: Move, expectedMoveNumber: number): SubmitMoveResult {
    const room = this.getRoom(roomCode);
    if (room.phase === "finished") throw new MatchServerError("match-finished", "Match already finished");
    if (room.phase === "abandoned") throw new MatchServerError("match-abandoned", "Match was abandoned");
    if (room.phase === "lobby") throw new MatchServerError("room-not-found", "Match has not started");
    const mover = this.playerForClient(room, clientId);
    if (mover === null) throw new MatchServerError("not-a-participant", "Client is not a participant");
    if (mover !== room.expectedTurn) throw new MatchServerError("not-your-turn", `It is player ${room.expectedTurn}'s turn`);
    if (!room.players[mover].isAI && room.players[mover].clientId !== clientId) {
      throw new MatchServerError("not-a-participant", "Client identity mismatch");
    }
    if (expectedMoveNumber !== room.expectedMoveNumber) {
      throw new MatchServerError("stale-move", `Expected move #${room.expectedMoveNumber}, got #${expectedMoveNumber}`);
    }
    const state = replay(room.record);
    if (state.ruleset !== room.rulesetId) throw new MatchServerError("incompatible-ruleset", "Ruleset mismatch");
    if (!isLegalMove(state, move)) throw new MatchServerError("illegal-move", "Move is not legal");

    const nextRecord = applyMoveToRecord(room.record, move);
    const nextState = replay(nextRecord);
    const winner = getWinner(nextState);
    const updated: MatchRoom = {
      ...room,
      record: nextRecord,
      history: [...room.history, move],
      expectedTurn: room.expectedTurn === "A" ? "B" : "A",
      expectedMoveNumber: room.expectedMoveNumber + 1,
      phase: winner !== null ? "finished" : "playing",
      lastActivityAt: Date.now(),
    };
    this.rooms.set(roomCode, updated);
    this.maybeAutoPlayAI(roomCode);
    return { state: nextState, moveNumber: updated.expectedMoveNumber, winner, accepted: true };
  }

  sync(roomCode: RoomCode, clientId: ClientId): { state: GameState; history: Move[]; expectedMoveNumber: number; expectedTurn: PlayerId; phase: MatchPhase } {
    const room = this.getRoom(roomCode);
    if (room.phase === "abandoned") throw new MatchServerError("match-abandoned", "Match was abandoned");
    const _ = this.playerForClient(room, clientId);
    if (_ === null) throw new MatchServerError("not-a-participant", "Client is not a participant");
    return {
      state: replay(room.record),
      history: [...room.history],
      expectedMoveNumber: room.expectedMoveNumber,
      expectedTurn: room.expectedTurn,
      phase: room.phase,
    };
  }

  abandonIfStale(roomCode: RoomCode, now = Date.now()): boolean {
    const room = this.getRoom(roomCode);
    if (room.phase !== "playing") return false;
    if (now - room.lastActivityAt >= this.abandonedAfterMs) {
      this.rooms.set(roomCode, { ...room, phase: "abandoned", lastActivityAt: now });
      return true;
    }
    return false;
  }

  listRooms(): RoomCode[] {
    return Array.from(this.rooms.keys());
  }

  private getRoom(roomCode: RoomCode): MatchRoom {
    const room = this.rooms.get(roomCode);
    if (!room) throw new MatchServerError("room-not-found", `Room ${roomCode} not found`);
    return room;
  }

  private playerForClient(room: MatchRoom, clientId: ClientId): PlayerId | null {
    if (!room.players.A.isAI && room.players.A.clientId === clientId) return "A";
    if (!room.players.B.isAI && room.players.B.clientId === clientId) return "B";
    return null;
  }

  private maybeAutoPlayAI(roomCode: RoomCode): void {
    let guard = 0;
    while (guard++ < 200) {
      const room = this.rooms.get(roomCode);
      if (!room) return;
      if (room.phase !== "playing") return;
      const turn = room.expectedTurn;
      const player = room.players[turn];
      if (!player.isAI) return;
      const state = replay(room.record);
      if (!player.aiDifficulty) return;
      const move = chooseAIMove(state, player.aiDifficulty);
      const nextRecord = applyMoveToRecord(room.record, move);
      const nextState = replay(nextRecord);
      const winner = getWinner(nextState);
      this.rooms.set(roomCode, {
        ...room,
        record: nextRecord,
        history: [...room.history, move],
        expectedTurn: turn === "A" ? "B" : "A",
        expectedMoveNumber: room.expectedMoveNumber + 1,
        phase: winner !== null ? "finished" : "playing",
        lastActivityAt: Date.now(),
      });
      if (winner !== null) return;
    }
  }

  private generateCode(): RoomCode {
    this.codeCounter += 1;
    return `ROOM-${this.codeCounter.toString(36).toUpperCase().padStart(4, "0")}`;
  }
}

void getLegalMoves;
void applyMove;
void InvalidMoveError;