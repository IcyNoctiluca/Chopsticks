import { describe, it, expect } from "vitest";
import { MatchServer, MatchServerError, ENGINE_VERSION, SUPPORTED_RULESETS } from "../server/matchServer.js";
import { getWinner, getLegalMoves, replay, createRecord, type Move } from "../src/index.js";

function newServer(): MatchServer {
  return new MatchServer({ moveTimeoutMs: null, abandonedAfterMs: 1000 });
}

describe("MatchServer: room create and join", () => {
  it("creates a room in lobby phase with host as A", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    expect(r.playerId).toBe("A");
    expect(r.state.players.A).toEqual({ left: 1, right: 1 });
  });

  it("player B joins and the match starts", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    const join = s.joinRoom(r.roomCode, "bob", "Bob");
    expect(join.playerId).toBe("B");
    const sync = s.sync(r.roomCode, "alice");
    expect(sync.phase).toBe("playing");
  });

  it("rejects joining a full room", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    expect(() => s.joinRoom(r.roomCode, "carol", "Carol")).toThrow(MatchServerError);
  });
});

describe("MatchServer: authoritative move submission", () => {
  it("accepts a legal move from the player whose turn it is", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    const state = s.sync(r.roomCode, "alice").state;
    const move = getLegalMoves(state)[0]!;
    const result = s.submitMove(r.roomCode, "alice", move, 0);
    expect(result.accepted).toBe(true);
    expect(result.moveNumber).toBe(1);
    expect(result.state.turn).toBe("B");
  });

  it("clients cannot authoritatively alter state: illegal moves are rejected", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    const bogus: Move = { type: "tap", player: "A", source: "left", targetPlayer: "A", target: "left" };
    expect(() => s.submitMove(r.roomCode, "alice", bogus, 0)).toThrow(MatchServerError);
  });

  it("rejects not-your-turn", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    const state = s.sync(r.roomCode, "alice").state;
    const move = getLegalMoves(state)[0]!;
    expect(() => s.submitMove(r.roomCode, "bob", move, 0)).toThrow(MatchServerError);
  });

  it("rejects a non-participant", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    const state = s.sync(r.roomCode, "alice").state;
    const move = getLegalMoves(state)[0]!;
    expect(() => s.submitMove(r.roomCode, "eve", move, 0)).toThrow(MatchServerError);
  });
});

describe("MatchServer: stale-move rejection", () => {
  it("rejects a move with the wrong expected move number", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    const state = s.sync(r.roomCode, "alice").state;
    const move = getLegalMoves(state)[0]!;
    expect(() => s.submitMove(r.roomCode, "alice", move, 5)).toThrow(MatchServerError);
    const err = (() => {
      try { s.submitMove(r.roomCode, "alice", move, 5); return null; }
      catch (e) { return e as MatchServerError; }
    })()!;
    expect(err.code).toBe("stale-move");
  });

  it("accepts the correct move number after a successful move", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    const state = s.sync(r.roomCode, "alice").state;
    const move = getLegalMoves(state)[0]!;
    s.submitMove(r.roomCode, "alice", move, 0);
    const state2 = s.sync(r.roomCode, "bob").state;
    const move2 = getLegalMoves(state2)[0]!;
    const result = s.submitMove(r.roomCode, "bob", move2, 1);
    expect(result.moveNumber).toBe(2);
  });
});

describe("MatchServer: reconnect / sync", () => {
  it("a reconnecting client receives the full state and history", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    const state = s.sync(r.roomCode, "alice").state;
    const move = getLegalMoves(state)[0]!;
    s.submitMove(r.roomCode, "alice", move, 0);
    const sync = s.sync(r.roomCode, "bob");
    expect(sync.history.length).toBe(1);
    expect(sync.expectedMoveNumber).toBe(1);
    expect(sync.expectedTurn).toBe("B");
    expect(sync.state.turn).toBe("B");
  });

  it("replay of server history reproduces the authoritative state", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    let history: Move[] = [];
    for (let i = 0; i < 4; i++) {
      const sync = s.sync(r.roomCode, i % 2 === 0 ? "alice" : "bob");
      if (sync.phase === "finished") break;
      const move = getLegalMoves(sync.state)[0]!;
      const who = sync.expectedTurn === "A" ? "alice" : "bob";
      s.submitMove(r.roomCode, who, move, sync.expectedMoveNumber);
      history = s.sync(r.roomCode, "alice").history;
    }
    const base = createRecord();
    let state = replay(base);
    for (const m of history) state = applyMoveForTest(state, m);
    const authoritative = s.sync(r.roomCode, "alice").state;
    expect(state).toEqual(authoritative);
  });
});

import { applyMove } from "../src/index.js";
function applyMoveForTest(state: ReturnType<typeof replay>, move: Move) {
  return applyMove(state, move);
}

describe("MatchServer: ruleset / engine version compatibility", () => {
  it("rejects an unsupported ruleset at room creation", () => {
    const s = newServer();
    expect(() => s.createRoom({ clientId: "alice", displayName: "Alice" }, { rulesetId: "nope" as never })).toThrow(MatchServerError);
  });
  it("exposes supported rulesets and engine version", () => {
    expect(SUPPORTED_RULESETS).toContain("classic-v1");
    expect(ENGINE_VERSION).toBe("0.1.0");
  });
  it("a room records its ruleset and engine version", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    const code = r.roomCode;
    expect((s as unknown as { rooms: Map<string, { rulesetId: string; engineVersion: string }> }).rooms.get(code)?.rulesetId).toBe("classic-v1");
    expect((s as unknown as { rooms: Map<string, { rulesetId: string; engineVersion: string }> }).rooms.get(code)?.engineVersion).toBe("0.1.0");
  });
});

describe("MatchServer: AI and abandoned games", () => {
  it("auto-plays AI moves and can finish a game", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.addAI(r.roomCode, "random");
    let moves = 0;
    let guard = 0;
    while (guard++ < 100) {
      const sync = s.sync(r.roomCode, "alice");
      if (sync.phase === "finished") break;
      if (sync.expectedTurn === "A") {
        const move = getLegalMoves(sync.state)[0]!;
        s.submitMove(r.roomCode, "alice", move, sync.expectedMoveNumber);
        moves++;
      }
    }
    const sync = s.sync(r.roomCode, "alice");
    expect(["finished"]).toContain(sync.phase);
  });

  it("abandons a stale match", () => {
    const s = new MatchServer({ moveTimeoutMs: null, abandonedAfterMs: 10 });
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    expect(s.sync(r.roomCode, "alice").phase).toBe("playing");
    const abandoned = s.abandonIfStale(r.roomCode, Date.now() + 1000);
    expect(abandoned).toBe(true);
    expect(() => s.sync(r.roomCode, "alice")).toThrow(MatchServerError);
  });

  it("sweepStaleRooms abandons all stale matches", () => {
    const s = new MatchServer({ moveTimeoutMs: null, abandonedAfterMs: 10, sweepIntervalMs: null });
    const r1 = s.createRoom({ clientId: "alice", displayName: "Alice" });
    const r2 = s.createRoom({ clientId: "carol", displayName: "Carol" });
    s.joinRoom(r1.roomCode, "bob", "Bob");
    s.joinRoom(r2.roomCode, "dave", "Dave");
    const abandoned = s.sweepStaleRooms(Date.now() + 1000);
    expect(abandoned.sort()).toEqual([r1.roomCode, r2.roomCode].sort());
    expect(() => s.sync(r1.roomCode, "alice")).toThrow(MatchServerError);
    expect(() => s.sync(r2.roomCode, "carol")).toThrow(MatchServerError);
  });
});

describe("MatchServer: finished matches reject moves", () => {
  it("a finished match rejects further submissions", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    let guard = 0;
    while (guard++ < 100) {
      const sync = s.sync(r.roomCode, guard % 2 === 0 ? "alice" : "bob");
      if (sync.phase === "finished") break;
      const move = getLegalMoves(sync.state)[0]!;
      const who = sync.expectedTurn === "A" ? "alice" : "bob";
      s.submitMove(r.roomCode, who, move, sync.expectedMoveNumber);
    }
    const sync = s.sync(r.roomCode, "alice");
    expect(sync.phase).toBe("finished");
    const winner = getWinner(sync.state);
    expect(winner).not.toBeNull();
    expect(() => s.submitMove(r.roomCode, "alice", getLegalMoves(replay(createRecord()))[0]!, sync.expectedMoveNumber)).toThrow(MatchServerError);
  });
});

describe("MatchServer: room phase / seat transitions", () => {
  it("rejects an AI host", () => {
    const s = newServer();
    expect(() => s.createRoom({ clientId: "alice", displayName: "Alice", isAI: true })).toThrow(MatchServerError);
  });

  it("does not allow joining after an AI has been added", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.addAI(r.roomCode, "random");
    expect(() => s.joinRoom(r.roomCode, "bob", "Bob")).toThrow(MatchServerError);
  });

  it("does not allow adding a second AI", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.addAI(r.roomCode, "random");
    expect(() => s.addAI(r.roomCode, "random")).toThrow(MatchServerError);
  });

  it("does not allow joining after a human has joined", () => {
    const s = newServer();
    const r = s.createRoom({ clientId: "alice", displayName: "Alice" });
    s.joinRoom(r.roomCode, "bob", "Bob");
    expect(() => s.joinRoom(r.roomCode, "carol", "Carol")).toThrow(MatchServerError);
  });
});

describe("MatchServer HTTP wrapper", () => {
  it("health endpoint returns ok", async () => {
    const { httpServer, server } = await import("../server/http.js");
    void server;
    const port = await new Promise<number>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve((httpServer.address() as { port: number }).port));
    });
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const body = (await res.json()) as { status: string; engine: string; rulesets: string[] };
    expect(body.status).toBe("ok");
    expect(body.engine).toBe("0.1.0");
    expect(body.rulesets).toContain("classic-v1");
    await new Promise<void>((r) => httpServer.close(() => r()));
  });

  it("sync endpoint accepts query parameters", async () => {
    const { httpServer, server } = await import("../server/http.js");
    void server;
    const port = await new Promise<number>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve((httpServer.address() as { port: number }).port));
    });
    const createRes = await fetch(`http://127.0.0.1:${port}/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "alice", displayName: "Alice" }),
    });
    const createBody = (await createRes.json()) as { roomCode: string };
    const syncRes = await fetch(`http://127.0.0.1:${port}/rooms/${createBody.roomCode}/sync?clientId=alice`);
    expect(syncRes.status).toBe(200);
    const syncBody = (await syncRes.json()) as { phase: string };
    expect(syncBody.phase).toBe("lobby");
    await new Promise<void>((r) => httpServer.close(() => r()));
  });

  it("rejects malformed moves at the transport boundary", async () => {
    const { httpServer, server } = await import("../server/http.js");
    void server;
    const port = await new Promise<number>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve((httpServer.address() as { port: number }).port));
    });
    const createRes = await fetch(`http://127.0.0.1:${port}/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "alice", displayName: "Alice" }),
    });
    const createBody = (await createRes.json()) as { roomCode: string };
    await fetch(`http://127.0.0.1:${port}/rooms/${createBody.roomCode}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "bob", displayName: "Bob" }),
    });
    const moveRes = await fetch(`http://127.0.0.1:${port}/rooms/${createBody.roomCode}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "alice", move: { type: "tap", player: "A" }, expectedMoveNumber: 0 }),
    });
    expect(moveRes.status).toBe(400);
    await new Promise<void>((r) => httpServer.close(() => r()));
  });
});