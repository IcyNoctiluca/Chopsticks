import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import WebSocket from "ws";
import { MatchServer } from "../server/matchServer.js";
import { ChopsticksWSServer } from "../server/ws.js";
import { getLegalMoves, type Move } from "../src/index.js";

interface WSEvent {
  type: string;
  [key: string]: unknown;
}

function createMessageQueue(ws: WebSocket): { waitFor: (type?: string, timeoutMs?: number) => Promise<WSEvent> } {
  const queue: WSEvent[] = [];
  let pending: { resolve: (msg: WSEvent) => void; reject: (err: Error) => void; type?: string; timer: ReturnType<typeof setTimeout> } | null = null;

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString("utf8")) as WSEvent;
    if (pending && (!pending.type || msg.type === pending.type)) {
      clearTimeout(pending.timer);
      const resolve = pending.resolve;
      pending = null;
      resolve(msg);
    } else {
      queue.push(msg);
    }
  });

  return {
    waitFor(type?: string, timeoutMs = 2000): Promise<WSEvent> {
      return new Promise((resolve, reject) => {
        // Check already-queued messages first.
        for (let i = 0; i < queue.length; i++) {
          const msg = queue[i]!;
          if (!type || msg.type === type) {
            queue.splice(i, 1);
            resolve(msg);
            return;
          }
        }
        const timer = setTimeout(() => {
          pending = null;
          reject(new Error(`Timeout waiting for ${type ?? "any"} message`));
        }, timeoutMs);
        pending = { resolve, reject, type, timer };
      });
    },
  };
}

function send(ws: WebSocket, msg: Record<string, unknown>): void {
  ws.send(JSON.stringify(msg));
}

function setup(): { http: Server; ws: ChopsticksWSServer; matchServer: MatchServer; close: () => Promise<void>; url: string } {
  const matchServer = new MatchServer({ moveTimeoutMs: null, abandonedAfterMs: 60_000 });
  const http = createServer();
  const ws = new ChopsticksWSServer({ server: http, matchServer });
  return {
    http,
    ws,
    matchServer,
    close: () =>
      new Promise((resolve) => {
        ws.close();
        http.close(() => resolve());
      }),
    url: `ws://127.0.0.1:0/ws`,
  };
}

describe("Chopsticks WebSocket transport", () => {
  let env: ReturnType<typeof setup>;

  beforeEach(async () => {
    env = setup();
    await new Promise<void>((resolve) => env.http.listen(0, "127.0.0.1", () => resolve()));
    const address = env.http.address() as { port: number };
    env.url = `ws://127.0.0.1:${address.port}/ws`;
  });

  afterEach(async () => {
    await env.close();
  });

  it("creates a room and broadcasts state", async () => {
    const ws = new WebSocket(env.url);
    const q = createMessageQueue(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    send(ws, { type: "create", clientId: "alice", displayName: "Alice" });
    const created = await q.waitFor("created");
    expect(created.playerId).toBe("A");
    expect(created.roomCode).toBeTruthy();

    const state = await q.waitFor("state");
    expect(state.phase).toBe("lobby");
    ws.close();
  });

  it("two clients can join and play a move over WS", async () => {
    const alice = new WebSocket(env.url);
    const bob = new WebSocket(env.url);
    const aliceQ = createMessageQueue(alice);
    const bobQ = createMessageQueue(bob);
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        alice.once("open", resolve);
        alice.once("error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        bob.once("open", resolve);
        bob.once("error", reject);
      }),
    ]);

    send(alice, { type: "create", clientId: "alice", displayName: "Alice" });
    const created = await aliceQ.waitFor("created");
    const roomCode = created.roomCode as string;
    await aliceQ.waitFor("state");

    send(bob, { type: "join", roomCode, clientId: "bob", displayName: "Bob" });
    const joined = await bobQ.waitFor("joined");
    expect(joined.playerId).toBe("B");

    // Both clients should receive the updated playing state.
    const [aliceState, bobState] = await Promise.all([aliceQ.waitFor("state"), bobQ.waitFor("state")]);
    expect(aliceState.phase).toBe("playing");
    expect(bobState.phase).toBe("playing");

    const move = getLegalMoves(bobState.state as never)[0]!;
    send(alice, { type: "move", roomCode, clientId: "alice", move, expectedMoveNumber: 0 });

    const accepted = await aliceQ.waitFor("move-accepted");
    expect(accepted.moveNumber).toBe(1);

    const [aliceAfter, bobAfter] = await Promise.all([aliceQ.waitFor("state"), bobQ.waitFor("state")]);
    expect(aliceAfter.expectedTurn).toBe("B");
    expect(bobAfter.expectedTurn).toBe("B");

    alice.close();
    bob.close();
  });

  it("rejects an illegal move with an error message", async () => {
    const ws = new WebSocket(env.url);
    const q = createMessageQueue(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    send(ws, { type: "create", clientId: "alice", displayName: "Alice" });
    const created = await q.waitFor("created");
    await q.waitFor("state");

    send(ws, { type: "add-ai", roomCode: created.roomCode, difficulty: "random" });
    await q.waitFor("ai-added");
    await q.waitFor("state");

    const bogus: Move = { type: "tap", player: "A", source: "left", targetPlayer: "A", target: "left" };
    send(ws, { type: "move", roomCode: created.roomCode, clientId: "alice", move: bogus, expectedMoveNumber: 0 });
    const err = await q.waitFor("error");
    expect(err.code).toBe("illegal-move");
    ws.close();
  });

  it("a reconnecting client can sync to the current state", async () => {
    const ws = new WebSocket(env.url);
    const q = createMessageQueue(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    send(ws, { type: "create", clientId: "alice", displayName: "Alice" });
    const created = await q.waitFor("created");
    const roomCode = created.roomCode as string;
    await q.waitFor("state");

    send(ws, { type: "sync", roomCode, clientId: "alice" });
    const synced = await q.waitFor("state");
    expect(synced.roomCode).toBe(roomCode);
    expect(synced.phase).toBe("lobby");
    ws.close();
  });
});
