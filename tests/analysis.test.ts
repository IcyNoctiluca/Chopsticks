import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function runAnalysis(): string {
  return execFileSync("npx", ["tsx", "analysis/enumerate.ts"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });
}

describe("analysis regression (classic-v1 game-theoretic profile)", () => {
  it("matches the frozen analysis report", () => {
    const out = runAnalysis();

    // Reachable state counts
    expect(out).toContain("Total reachable states: 1142");
    expect(out).toContain("Terminal: 48");

    // Opening value: DRAW, no first-player advantage
    expect(out).toContain("(from start, player to move = A): DRAW");
    expect(out).toContain("is NOT a forced win for the first player");

    // Value distribution
    expect(out).toContain("Value distribution: WIN=510 LOSS=136 DRAW=496");

    // Game length
    expect(out).toContain("Min: 5 moves");
    expect(out).toContain("Max (shortest): 8 moves");

    // All opening moves lead to DRAW for the first player
    const openingLines = out.split("\n").filter((l) => l.includes("-> DRAW (for A)"));
    expect(openingLines.length).toBe(6);
  });
});