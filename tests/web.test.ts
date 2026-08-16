import { describe, it, expect } from "vitest";
import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  createSession,
  getState,
  playHumanMove,
  advanceAITurns,
  undoInSession,
  canUndoInSession,
  matchWinner,
} from "../session/session.js";
import { getLegalMoves, getWinner } from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distWeb = resolve(root, "dist-web");

describe("web build artifact", () => {
  it("dist-web exists after build with index.html and assets", () => {
    expect(existsSync(distWeb)).toBe(true);
    const entries = readdirSync(distWeb);
    expect(entries).toContain("index.html");
    const assets = resolve(distWeb, "assets");
    expect(existsSync(assets)).toBe(true);
    const assetFiles = readdirSync(assets);
    expect(assetFiles.some((f) => f.endsWith(".js"))).toBe(true);
    expect(assetFiles.some((f) => f.endsWith(".css"))).toBe(true);
  });

  it("index.html references the bundled script and styles", () => {
    const html = readFileSync(resolve(distWeb, "index.html"), "utf8");
    expect(html).toContain("Chopsticks");
    expect(html).toMatch(/assets\/main-.*\.js/);
  });

  it("dist-web contains the online client entry", () => {
    expect(existsSync(resolve(distWeb, "online.html"))).toBe(true);
    const html = readFileSync(resolve(distWeb, "online.html"), "utf8");
    expect(html).toContain("Chopsticks Online");
    expect(html).toMatch(/assets\/online-.*\.js/);
  });

  it("dist-web contains PWA manifest, service worker, and icons", () => {
    expect(existsSync(resolve(distWeb, "manifest.json"))).toBe(true);
    expect(existsSync(resolve(distWeb, "sw.js"))).toBe(true);
    expect(existsSync(resolve(distWeb, "icon-192.png"))).toBe(true);
    expect(existsSync(resolve(distWeb, "icon-512.png"))).toBe(true);
    const html = readFileSync(resolve(distWeb, "index.html"), "utf8");
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('name="theme-color"');
  });
});

describe("web client local game flow (two humans via session API)", () => {
  it("start → play → finish → restart works end-to-end", () => {
    const config = {
      playerA: { name: "Alice", type: "human" as const },
      playerB: { name: "Bob", type: "human" as const },
      undoPolicy: "unlimited" as const,
      moveTimerMs: null,
      gamesToWin: 2,
    };
    let s = createSession(config);
    expect(getState(s).turn).toBe("A");

    let moves = 0;
    while (getState(s).status !== "finished" && moves < 60) {
      const m = getLegalMoves(getState(s))[0]!;
      s = playHumanMove(s, m);
      moves++;
    }
    expect(getState(s).status).toBe("finished");
    expect(s.gamesPlayed).toBe(1);
    const winner = getWinner(getState(s));
    expect(winner).not.toBeNull();
    expect(s.scores[winner!]).toBe(1);

    const size = statSync(resolve(distWeb, "index.html")).size;
    expect(size).toBeGreaterThan(0);
  });

  it("undo within a local game restores the prior state", () => {
    const config = {
      playerA: { name: "Alice", type: "human" as const },
      playerB: { name: "Bob", type: "human" as const },
      undoPolicy: "unlimited" as const,
      moveTimerMs: null,
      gamesToWin: 2,
    };
    let s = createSession(config);
    const m = getLegalMoves(getState(s))[0]!;
    s = playHumanMove(s, m);
    const before = getState(s).turn;
    expect(before).toBe("B");
    expect(canUndoInSession(s)).toBe(true);
    s = undoInSession(s, 1);
    expect(getState(s).turn).toBe("A");
    expect(s.currentRecord.moves.length).toBe(0);
  });

  it("can play a full human-vs-AI match to a match winner", () => {
    const config = {
      playerA: { name: "Alice", type: "human" as const },
      playerB: { name: "CPU", type: "ai" as const, aiDifficulty: "random" as const },
      undoPolicy: "none" as const,
      moveTimerMs: null,
      gamesToWin: 1,
    };
    let s = createSession(config);
    let moves = 0;
    while (matchWinner(s) === null && moves < 200) {
      if (getState(s).status === "finished") break;
      const m = getLegalMoves(getState(s))[0]!;
      s = playHumanMove(s, m);
      s = advanceAITurns(s);
      moves++;
    }
    expect(matchWinner(s)).not.toBeNull();
  });
});