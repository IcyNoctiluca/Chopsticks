import { describe, it, expect } from "vitest";
import {
  createRecord,
  replay,
  replayTo,
  applyMoveToRecord,
  undo,
  canUndo,
  recordWinner,
  createGame,
  getLegalMoves,
  applyMove,
  getWinner,
  type GameRecord,
} from "../src/index.js";

describe("GameRecord / replay / undo", () => {
  it("createRecord starts empty and reproduces the opening", () => {
    const r = createRecord();
    expect(r.moves).toEqual([]);
    const s = replay(r);
    expect(s.players.A).toEqual({ left: 1, right: 1 });
    expect(s.players.B).toEqual({ left: 1, right: 1 });
    expect(s.turn).toBe("A");
  });

  it("applyMoveToRecord appends a move and replay reproduces current state exactly", () => {
    let state = createGame();
    let r = createRecord();
    for (let i = 0; i < 5 && state.status !== "finished"; i++) {
      const m = getLegalMoves(state)[0]!;
      state = applyMove(state, m);
      r = applyMoveToRecord(r, m);
    }
    expect(replay(r)).toEqual(state);
  });

  it("replayTo stops at the requested index", () => {
    let state = createGame();
    const r0 = createRecord();
    const m1 = getLegalMoves(state)[0]!;
    state = applyMove(state, m1);
    const r1 = applyMoveToRecord(r0, m1);
    const m2 = getLegalMoves(state)[0]!;
    state = applyMove(state, m2);
    const r2 = applyMoveToRecord(r1, m2);
    expect(replayTo(r2, 0).turn).toBe("A");
    expect(replayTo(r2, 1).turn).toBe("B");
    expect(replayTo(r2, 2)).toEqual(state);
    expect(replayTo(r2, 99)).toEqual(state);
  });

  it("replay of a completed record is terminal and recordWinner matches", () => {
    let state = createGame();
    let r: GameRecord = createRecord();
    let moves = 0;
    while (state.status !== "finished" && moves < 100) {
      const legal = getLegalMoves(state);
      if (legal.length === 0) break;
      const m = legal[0]!;
      state = applyMove(state, m);
      r = applyMoveToRecord(r, m);
      moves++;
    }
    const finalState = replay(r);
    expect(finalState.status).toBe("finished");
    expect(recordWinner(r)).toBe(getWinner(finalState));
  });

  it("undo removes the last move", () => {
    let state = createGame();
    let r = createRecord();
    const before = [...Array(5)].reduce<GameRecord>((acc) => {
      const s = replay(acc);
      if (s.status === "finished") return acc;
      const m = getLegalMoves(s)[0]!;
      return applyMoveToRecord(acc, m);
    }, r);
    r = before;
    state = replay(r);
    const r1 = undo(r, 1);
    expect(r1.moves.length).toBe(r.moves.length - 1);
    expect(replay(r1)).toEqual(applyUndoState(r));
  });

  it("undo on empty record is a no-op", () => {
    const r = createRecord();
    expect(canUndo(r)).toBe(false);
    expect(undo(r, 1).moves.length).toBe(0);
  });

  it("undo steps are clamped", () => {
    const r = createRecord();
    const m = getLegalMoves(createGame())[0]!;
    const r1 = applyMoveToRecord(r, m);
    expect(undo(r1, 5).moves.length).toBe(0);
  });

  it("a record is plain serialisable data", () => {
    const r = applyMoveToRecord(createRecord(), getLegalMoves(createGame())[0]!);
    const json = JSON.stringify(r);
    const parsed = JSON.parse(json) as GameRecord;
    expect(replay(parsed)).toEqual(replay(r));
  });
});

function applyUndoState(r: GameRecord) {
  return replayTo(r, r.moves.length - 1);
}