import {
  createRecord,
  replay,
  applyMoveToRecord,
  getLegalMoves,
  isLegalMove,
  getResult,
  applyMove,
  InvalidMoveError,
  type GameState,
  type Move,
  type PlayerId,
  type RulesetId,
} from "../src/index.js";
import { chooseAIMove } from "../ai/chooseMove.js";
import type { RoomStore } from "./persistence.js";

export type ClientId = string;
export type RoomCode = string;

export const ENGINE_VERSION = "0.1.0";
export const SUPPORTED_RULESETS: RulesetId[] = ["classic-v1", "classic-tournament-v1"];

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
  readonly isDraw: boolean;
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
  | "room-full"
  | "invalid-request"
  | "ai-host-not-allowed"
  | "payload-too-large"
  | "rate-limited";

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
  readonly isDraw: boolean;
  readonly accepted: boolean;
}

export interface MatchServerOptions {
  readonly moveTimeoutMs?: number | null;
  readonly abandonedAfterMs?: number;
  readonly sweepIntervalMs?: number | null;
  readonly roomTTLMs?: number | null;
  readonly store?: RoomStore;
}

export class MatchServer {
  private rooms = new Map<RoomCode, MatchRoom>();
  private codeCounter = 0;
  private readonly moveTimeoutMs: number | null;
  private readonly abandonedAfterMs: number;
  private readonly sweepIntervalMs: number | null;
  private readonly roomTTLMs: number | null;
  private readonly store: RoomStore | null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: MatchServerOptions = {}) {
    this.moveTimeoutMs = options.moveTimeoutMs ?? null;
    this.abandonedAfterMs = options.abandonedAfterMs ?? 60000;
    this.sweepIntervalMs = options.sweepIntervalMs ?? null;
    this.roomTTLMs = options.roomTTLMs ?? 24 * 60 * 60 * 1000;
    this.store = options.store ?? null;
    this.hydrate();
    this.startSweep();
  }

  close(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  private startSweep(): void {
    if (this.sweepIntervalMs === null || this.sweepIntervalMs <= 0) return;
    this.sweepTimer = setInterval(() => this.sweepStaleRooms(), this.sweepIntervalMs);
  }

  sweepStaleRooms(now = Date.now()): { abandoned: RoomCode[]; removed: RoomCode[] } {
    const abandoned: RoomCode[] = [];
    const removed: RoomCode[] = [];
    for (const code of this.rooms.keys()) {
      const room = this.rooms.get(code);
      if (!room) continue;
      if (this.roomTTLMs !== null && (room.phase === "finished" || room.phase === "abandoned") && now - room.createdAt >= this.roomTTLMs) {
        this.rooms.delete(code);
        this.persist(code);
        removed.push(code);
        continue;
      }
      if (this.abandonIfStale(code, now)) {
        abandoned.push(code);
      }
    }
    return { abandoned, removed };
  }

  private hydrate(): void {
    if (!this.store) return;
    const loaded = this.store.load();
    const data = loaded instanceof Promise ? (() => { throw new Error("Async stores are not yet supported"); })() : loaded;
    for (const [code, room] of Object.entries(data)) {
      this.rooms.set(code, room);
    }
    // Resume the counter above the highest loaded code number.
    for (const code of this.rooms.keys()) {
      const n = parseInt(code.replace(/^ROOM-/, ""), 36);
      if (!Number.isNaN(n)) this.codeCounter = Math.max(this.codeCounter, n);
    }
  }

  private persist(roomCode: RoomCode): void {
    if (!this.store) return;
    const room = this.rooms.get(roomCode);
    if (room) {
      this.store.save(roomCode, room);
    } else {
      this.store.remove(roomCode);
    }
  }

  createRoom(host: { clientId: ClientId; displayName: string; isAI?: boolean; aiDifficulty?: "random" | "heuristic" | "solved" }, options: { rulesetId?: RulesetId; moveTimeoutMs?: number } = {}): { roomCode: RoomCode; playerId: PlayerId; state: GameState } {
    if (host.isAI) {
      throw new MatchServerError("ai-host-not-allowed", "A human client must create the room; add an AI opponent after creation");
    }
    const rulesetId = options.rulesetId ?? "classic-v1";
    if (!SUPPORTED_RULESETS.includes(rulesetId)) {
      throw new MatchServerError("incompatible-ruleset", `Ruleset ${rulesetId} not supported`);
    }
    const roomCode = this.generateCode();
    const record = createRecord({ startingPlayer: "A", ruleset: rulesetId });
    const room: MatchRoom = {
      roomCode,
      rulesetId,
      engineVersion: ENGINE_VERSION,
      players: {
        A: { clientId: host.clientId, displayName: host.displayName, isAI: false },
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
      isDraw: false,
    };
    this.rooms.set(roomCode, room);
    this.persist(roomCode);
    return { roomCode, playerId: "A", state: replay(room.record) };
  }

  joinRoom(roomCode: RoomCode, clientId: ClientId, displayName: string): { playerId: PlayerId; state: GameState; history: Move[] } {
    const room = this.getRoom(roomCode);
    this.assertCanFillSeatB(room);
    const updated: MatchRoom = {
      ...room,
      players: { ...room.players, B: { clientId, displayName, isAI: false } },
      phase: "playing",
      lastActivityAt: Date.now(),
    };
    this.rooms.set(roomCode, updated);
    this.persist(roomCode);
    return { playerId: "B", state: replay(updated.record), history: [...updated.history] };
  }

  addAI(roomCode: RoomCode, difficulty: "random" | "heuristic" | "solved" = "random"): { playerId: PlayerId } {
    const room = this.getRoom(roomCode);
    this.assertCanFillSeatB(room);
    const updated: MatchRoom = {
      ...room,
      players: { ...room.players, B: { clientId: null, displayName: "CPU", isAI: true, aiDifficulty: difficulty } },
      phase: "playing",
      lastActivityAt: Date.now(),
    };
    this.rooms.set(roomCode, updated);
    this.persist(roomCode);
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
    const result = getResult(nextRecord);
    const updated: MatchRoom = {
      ...room,
      record: nextRecord,
      history: [...room.history, move],
      expectedTurn: room.expectedTurn === "A" ? "B" : "A",
      expectedMoveNumber: room.expectedMoveNumber + 1,
      phase: result.winner !== null || result.isDraw ? "finished" : "playing",
      isDraw: result.isDraw,
      lastActivityAt: Date.now(),
    };
    this.rooms.set(roomCode, updated);
    this.persist(roomCode);
    this.maybeAutoPlayAI(roomCode);
    return { state: nextState, moveNumber: updated.expectedMoveNumber, winner: result.winner, isDraw: result.isDraw, accepted: true };
  }

  sync(roomCode: RoomCode, clientId: ClientId): {
    state: GameState;
    history: Move[];
    expectedMoveNumber: number;
    expectedTurn: PlayerId;
    phase: MatchPhase;
    winner: PlayerId | null;
    isDraw: boolean;
  } {
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
      winner: getResult(room.record).winner,
      isDraw: room.isDraw,
    };
  }

  abandonIfStale(roomCode: RoomCode, now = Date.now()): boolean {
    const room = this.getRoom(roomCode);
    if (room.phase !== "playing") return false;
    if (now - room.lastActivityAt >= this.abandonedAfterMs) {
      this.rooms.set(roomCode, { ...room, phase: "abandoned", lastActivityAt: now });
      this.persist(roomCode);
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

  private assertCanFillSeatB(room: MatchRoom): void {
    if (room.phase !== "lobby") {
      throw new MatchServerError("room-full", "Match has already started");
    }
    if (room.players.B.clientId !== null || room.players.B.isAI) {
      throw new MatchServerError("room-full", "Seat B is already taken");
    }
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
      const result = getResult(nextRecord);
      this.rooms.set(roomCode, {
        ...room,
        record: nextRecord,
        history: [...room.history, move],
        expectedTurn: turn === "A" ? "B" : "A",
        expectedMoveNumber: room.expectedMoveNumber + 1,
        phase: result.winner !== null || result.isDraw ? "finished" : "playing",
        isDraw: result.isDraw,
        lastActivityAt: Date.now(),
      });
      this.persist(roomCode);
      if (result.winner !== null || result.isDraw) return;
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
