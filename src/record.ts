import type { GameState, Move, PlayerId } from "./types.js";
import { applyMove } from "./applyMove.js";
import { createGame, type CreateGameOptions } from "./createGame.js";
import { getWinner } from "./getWinner.js";

export interface GameRecord {
  readonly ruleset: GameState["ruleset"];
  readonly initialState: GameState;
  readonly moves: Move[];
  readonly startingPlayer: PlayerId;
}

export function createRecord(options: CreateGameOptions = {}): GameRecord {
  const initialState = createGame(options);
  return {
    ruleset: initialState.ruleset,
    initialState,
    moves: [],
    startingPlayer: initialState.startingPlayer,
  };
}

export function replayTo(record: GameRecord, upTo: number): GameState {
  const n = Math.max(0, Math.min(upTo, record.moves.length));
  let state = record.initialState;
  for (let i = 0; i < n; i++) {
    state = applyMove(state, record.moves[i]!);
  }
  return state;
}

export function replay(record: GameRecord): GameState {
  return replayTo(record, record.moves.length);
}

export function applyMoveToRecord(record: GameRecord, move: Move): GameRecord {
  const state = replay(record);
  const next = applyMove(state, move);
  void next;
  return { ...record, moves: [...record.moves, move] };
}

export function undo(record: GameRecord, steps = 1): GameRecord {
  const n = Math.max(0, Math.min(steps, record.moves.length));
  return { ...record, moves: record.moves.slice(0, record.moves.length - n) };
}

export function canUndo(record: GameRecord): boolean {
  return record.moves.length > 0;
}

export function recordWinner(record: GameRecord): PlayerId | null {
  return getWinner(replay(record));
}

export function recordLength(record: GameRecord): number {
  return record.moves.length;
}