import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { MatchServer, type ClientId, type RoomCode } from "./matchServer.js";
import type { Move } from "../src/index.js";
import { ChopsticksWSServer } from "./ws.js";
import { FileRoomStore } from "./persistence.js";

const ROOM_STORE_PATH = process.env.ROOM_STORE_PATH ?? "data/rooms.json";
const store = new FileRoomStore({ path: ROOM_STORE_PATH });
const server = new MatchServer({ moveTimeoutMs: null, abandonedAfterMs: 5 * 60_000, store });
const httpServer = createServer(handleRequest);
const wsServer = new ChopsticksWSServer({ server: httpServer, matchServer: server });
const PORT = Number(process.env.PORT ?? 3000);

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader("content-type", "application/json");
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { status: "ok", engine: "0.1.0", rulesets: ["classic-v1"] });
  }
  if (req.method === "POST" && req.url === "/rooms") {
    const body = await readJson<CreateRoomBody>(req);
    return guard(res, () => {
      const result = server.createRoom({ clientId: body.clientId, displayName: body.displayName, isAI: body.isAI, aiDifficulty: body.aiDifficulty }, { rulesetId: body.rulesetId, moveTimeoutMs: body.moveTimeoutMs });
      send(res, 200, result);
    });
  }
  if (req.method === "POST" && /^\/rooms\/[^/]+\/join$/.test(req.url ?? "")) {
    const roomCode = pathRoom(req.url!);
    const body = await readJson<{ clientId: ClientId; displayName: string }>(req);
    return guard(res, () => {
      const result = server.joinRoom(roomCode, body.clientId, body.displayName);
      send(res, 200, result);
    });
  }
  if (req.method === "POST" && /^\/rooms\/[^/]+\/ai$/.test(req.url ?? "")) {
    const roomCode = pathRoom(req.url!);
    const body = await readJson<{ difficulty?: "random" | "heuristic" | "solved" }>(req);
    return guard(res, () => {
      const result = server.addAI(roomCode, body.difficulty ?? "random");
      send(res, 200, result);
    });
  }
  if (req.method === "POST" && /^\/rooms\/[^/]+\/move$/.test(req.url ?? "")) {
    const roomCode = pathRoom(req.url!);
    const body = await readJson<{ clientId: ClientId; move: Move; expectedMoveNumber: number }>(req);
    return guard(res, () => {
      const result = server.submitMove(roomCode, body.clientId, body.move, body.expectedMoveNumber);
      send(res, 200, result);
    });
  }
  if (req.method === "GET" && /^\/rooms\/[^/]+\/sync$/.test(req.url ?? "")) {
    const roomCode = pathRoom(req.url!);
    const clientId = queryParam(req.url!, "clientId");
    return guard(res, () => {
      const result = server.sync(roomCode, clientId);
      send(res, 200, result);
    });
  }
  send(res, 404, { error: "not-found" });
}

interface CreateRoomBody {
  clientId: ClientId;
  displayName: string;
  isAI?: boolean;
  aiDifficulty?: "random" | "heuristic" | "solved";
  rulesetId?: "classic-v1";
  moveTimeoutMs?: number;
}

function pathRoom(url: string): RoomCode {
  const m = url.match(/^\/rooms\/([^/]+)/);
  return decodeURIComponent(m?.[1] ?? "");
}

function queryParam(url: string, key: string): string {
  const u = new URL(url, "http://localhost");
  return u.searchParams.get(key) ?? "";
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const text = await readBody(req);
  return (text ? JSON.parse(text) : {}) as T;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function guard(res: ServerResponse, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    const e = err as { name?: string; code?: string; message?: string };
    const status = e.name === "MatchServerError" ? 400 : 500;
    send(res, status, { error: e.code ?? e.name ?? "internal", message: e.message });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  httpServer.listen(PORT, () => {
    console.log(`Chopsticks match server listening on :${PORT}`);
  });
}

export { httpServer, server, wsServer };