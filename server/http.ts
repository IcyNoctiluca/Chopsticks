import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { MatchServer, MatchServerError, type RoomCode } from "./matchServer.js";
import { ChopsticksWSServer } from "./ws.js";
import { FileRoomStore } from "./persistence.js";
import { validateCreateRoomBody, validateJoinBody, validateAddAIBody, validateMoveBody } from "./validation.js";

const ROOM_STORE_PATH = process.env.ROOM_STORE_PATH ?? "data/rooms.json";
const SWEEP_INTERVAL_MS = process.env.SWEEP_INTERVAL_MS ? Number(process.env.SWEEP_INTERVAL_MS) : 30_000;
const store = new FileRoomStore({ path: ROOM_STORE_PATH });
const server = new MatchServer({ moveTimeoutMs: null, abandonedAfterMs: 5 * 60_000, sweepIntervalMs: SWEEP_INTERVAL_MS, store });
const httpServer = createServer(handleRequest);
const wsServer = new ChopsticksWSServer({ server: httpServer, matchServer: server });
const PORT = Number(process.env.PORT ?? 3000);

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader("content-type", "application/json");
  const path = requestPath(req.url);
  if (req.method === "GET" && path === "/health") {
    return send(res, 200, { status: "ok", engine: "0.1.0", rulesets: ["classic-v1"] });
  }
  if (req.method === "POST" && path === "/rooms") {
    const body = await readJson<unknown>(req);
    return guard(res, () => {
      const params = validateCreateRoomBody(body);
      const result = server.createRoom(params.host, params.options);
      send(res, 200, result);
    });
  }
  if (req.method === "POST" && /^\/rooms\/[^/]+\/join$/.test(path)) {
    const roomCode = pathRoom(path);
    const body = await readJson<unknown>(req);
    return guard(res, () => {
      const params = validateJoinBody(body);
      const result = server.joinRoom(roomCode, params.clientId, params.displayName);
      send(res, 200, result);
    });
  }
  if (req.method === "POST" && /^\/rooms\/[^/]+\/ai$/.test(path)) {
    const roomCode = pathRoom(path);
    const body = await readJson<unknown>(req);
    return guard(res, () => {
      const difficulty = validateAddAIBody(body);
      const result = server.addAI(roomCode, difficulty);
      send(res, 200, result);
    });
  }
  if (req.method === "POST" && /^\/rooms\/[^/]+\/move$/.test(path)) {
    const roomCode = pathRoom(path);
    const body = await readJson<unknown>(req);
    return guard(res, () => {
      const params = validateMoveBody(body);
      const result = server.submitMove(roomCode, params.clientId, params.move, params.expectedMoveNumber);
      send(res, 200, result);
    });
  }
  if (req.method === "GET" && /^\/rooms\/[^/]+\/sync$/.test(path)) {
    const roomCode = pathRoom(path);
    const clientId = queryParam(req.url ?? "", "clientId");
    return guard(res, () => {
      const result = server.sync(roomCode, clientId);
      send(res, 200, result);
    });
  }
  send(res, 404, { error: "not-found" });
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

function requestPath(url: string | undefined): string {
  return (url ?? "").split("?")[0]!;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  httpServer.listen(PORT, () => {
    console.log(`Chopsticks match server listening on :${PORT}`);
  });

  function shutdown(): void {
    console.log("Shutting down...");
    wsServer.close();
    httpServer.close(() => {
      server.close();
      process.exit(0);
    });
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

export { httpServer, server, wsServer };