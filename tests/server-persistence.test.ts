import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MatchServer } from "../server/matchServer.js";
import { FileRoomStore, InMemoryRoomStore } from "../server/persistence.js";
import { getLegalMoves } from "../src/index.js";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "chopsticks-persistence-"));
}

describe("FileRoomStore persistence", () => {
  let dir: string;

  beforeEach(() => {
    dir = tempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("persists a created room to disk", () => {
    const path = join(dir, "rooms.json");
    const store = new FileRoomStore({ path });
    const server = new MatchServer({ abandonedAfterMs: 60_000, store });
    const room = server.createRoom({ clientId: "alice", displayName: "Alice" });

    expect(existsSync(path)).toBe(true);

    const server2 = new MatchServer({ abandonedAfterMs: 60_000, store });
    const synced = server2.sync(room.roomCode, "alice");
    expect(synced.state.turn).toBe("A");
    expect(synced.phase).toBe("lobby");
  });

  it("persists moves across server restarts", () => {
    const path = join(dir, "rooms.json");
    const store = new FileRoomStore({ path });
    const server = new MatchServer({ abandonedAfterMs: 60_000, store });
    const room = server.createRoom({ clientId: "alice", displayName: "Alice" });
    server.joinRoom(room.roomCode, "bob", "Bob");
    const sync = server.sync(room.roomCode, "alice");
    const move = getLegalMoves(sync.state)[0]!;
    server.submitMove(room.roomCode, "alice", move, 0);

    const server2 = new MatchServer({ abandonedAfterMs: 60_000, store });
    const synced = server2.sync(room.roomCode, "bob");
    expect(synced.history.length).toBe(1);
    expect(synced.expectedTurn).toBe("B");
  });

  it("removes abandoned rooms from the store", () => {
    const path = join(dir, "rooms.json");
    const store = new FileRoomStore({ path });
    const server = new MatchServer({ abandonedAfterMs: 10, store });
    const room = server.createRoom({ clientId: "alice", displayName: "Alice" });
    server.joinRoom(room.roomCode, "bob", "Bob");
    server.abandonIfStale(room.roomCode, Date.now() + 1000);

    const server2 = new MatchServer({ abandonedAfterMs: 10, store });
    expect(() => server2.sync(room.roomCode, "alice")).toThrow();
  });

  it("resumes the room code counter after restart", () => {
    const path = join(dir, "rooms.json");
    const store = new FileRoomStore({ path });
    const server = new MatchServer({ abandonedAfterMs: 60_000, store });
    const room1 = server.createRoom({ clientId: "alice", displayName: "Alice" });

    const server2 = new MatchServer({ abandonedAfterMs: 60_000, store });
    const room2 = server2.createRoom({ clientId: "bob", displayName: "Bob" });
    expect(room2.roomCode).not.toBe(room1.roomCode);
  });
});

describe("InMemoryRoomStore persistence", () => {
  it("shares rooms between MatchServer instances using the same store", () => {
    const store = new InMemoryRoomStore();
    const server = new MatchServer({ abandonedAfterMs: 60_000, store });
    const room = server.createRoom({ clientId: "alice", displayName: "Alice" });

    const server2 = new MatchServer({ abandonedAfterMs: 60_000, store });
    const synced = server2.sync(room.roomCode, "alice");
    expect(synced.state.turn).toBe("A");
  });
});
