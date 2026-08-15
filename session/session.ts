import type { Move, PlayerId } from "../src/index.js";
import {
  createRecord,
  replay,
  applyMoveToRecord,
  undo as undoRecord,
  canUndo,
  getWinner,
  type GameRecord,
} from "../src/index.js";
import { chooseAIMove, type Difficulty } from "../ai/chooseMove.js";

export type PlayerType = "human" | "ai";

export interface PlayerConfig {
  readonly name: string;
  readonly type: PlayerType;
  readonly aiDifficulty?: Difficulty;
}

export type UndoPolicy = "unlimited" | "none" | { max: number };

export interface MatchConfig {
  readonly playerA: PlayerConfig;
  readonly playerB: PlayerConfig;
  readonly undoPolicy: UndoPolicy;
  readonly moveTimerMs: number | null;
  readonly gamesToWin: number;
}

export interface MatchSession {
  readonly config: MatchConfig;
  readonly currentRecord: GameRecord;
  readonly scores: Record<PlayerId, number>;
  readonly gamesPlayed: number;
  readonly startingPlayerNext: PlayerId;
  readonly undoCount: number;
}

export function createSession(config: MatchConfig): MatchSession {
  const startingPlayer = config.playerA.type === "ai" ? "A" : "A";
  return {
    config,
    currentRecord: createRecord({ startingPlayer }),
    scores: { A: 0, B: 0 },
    gamesPlayed: 0,
    startingPlayerNext: startingPlayer === "A" ? "B" : "A",
    undoCount: 0,
  };
}

export function getState(session: MatchSession) {
  return replay(session.currentRecord);
}

export function isAITurn(session: MatchSession): boolean {
  const state = getState(session);
  if (state.status === "finished") return false;
  const cfg = session.config[state.turn === "A" ? "playerA" : "playerB"];
  return cfg.type === "ai";
}

export function playHumanMove(session: MatchSession, move: Move): MatchSession {
  if (isAITurn(session)) throw new Error("Cannot play a human move during an AI turn");
  const record = applyMoveToRecord(session.currentRecord, move);
  const next: MatchSession = { ...session, currentRecord: record };
  return advanceAITurns(next);
}

export function advanceAITurns(session: MatchSession): MatchSession {
  let current = session;
  while (isAITurn(current)) {
    const state = getState(current);
    const cfg = current.config[state.turn === "A" ? "playerA" : "playerB"];
    const move = chooseAIMove(state, cfg.aiDifficulty ?? "random");
    current = {
      ...current,
      currentRecord: applyMoveToRecord(current.currentRecord, move),
    };
  }
  const state = getState(current);
  if (state.status === "finished" && current.currentRecord.moves.length > 0 && session.gamesPlayed === current.gamesPlayed) {
    const winner = getWinner(state);
    if (winner !== null) {
      current = {
        ...current,
        scores: { ...current.scores, [winner]: current.scores[winner] + 1 },
        gamesPlayed: current.gamesPlayed + 1,
      };
    }
  }
  return current;
}

export function startNextGame(session: MatchSession): MatchSession {
  const startingPlayer = session.startingPlayerNext;
  return {
    ...session,
    currentRecord: createRecord({ startingPlayer }),
    startingPlayerNext: startingPlayer === "A" ? "B" : "A",
    undoCount: 0,
  };
}

export function canUndoInSession(session: MatchSession): boolean {
  if (!canUndo(session.currentRecord)) return false;
  if (session.config.undoPolicy === "none") return false;
  if (typeof session.config.undoPolicy === "object") {
    if (session.undoCount >= session.config.undoPolicy.max) return false;
  }
  return true;
}

export function undoInSession(session: MatchSession, steps = 1): MatchSession {
  if (!canUndoInSession(session)) throw new Error("Undo not allowed");
  const cfg = session.config;
  let actualSteps = steps;
  if (typeof cfg.undoPolicy === "object") {
    actualSteps = Math.min(steps, cfg.undoPolicy.max - session.undoCount);
    actualSteps = Math.max(0, actualSteps);
  }
  if (actualSteps < 1 && canUndo(session.currentRecord)) {
    actualSteps = 1;
  }
  return {
    ...session,
    currentRecord: undoRecord(session.currentRecord, actualSteps),
    undoCount: session.undoCount + actualSteps,
  };
}

export function matchWinner(session: MatchSession): PlayerId | null {
  const target = session.config.gamesToWin;
  if (session.scores.A >= target) return "A";
  if (session.scores.B >= target) return "B";
  return null;
}

const FORMAT_VERSION = 1;

export interface PersistedSession {
  readonly formatVersion: number;
  readonly session: MatchSession;
}

export function serializeSession(session: MatchSession): string {
  const data: PersistedSession = { formatVersion: FORMAT_VERSION, session };
  return JSON.stringify(data);
}

export function deserializeSession(json: string): MatchSession {
  const data = JSON.parse(json) as PersistedSession;
  if (data.formatVersion !== FORMAT_VERSION) {
    throw migrate(data);
  }
  return data.session;
}

class MigrationError extends Error {
  readonly data: PersistedSession;
  constructor(data: PersistedSession) {
    super(`Unsupported session format version: ${data.formatVersion}`);
    this.name = "MigrationError";
    this.data = data;
  }
}

function migrate(data: PersistedSession): MigrationError {
  return new MigrationError(data);
}