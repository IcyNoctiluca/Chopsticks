import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("CLI smoke test", () => {
  it("starts a game, accepts moves, and quits cleanly", () => {
    const input = "q\n";
    const stdout = execFileSync("npx", ["tsx", "cli/main.ts"], {
      cwd: root,
      input,
      encoding: "utf8",
      timeout: 15000,
    });
    expect(stdout).toContain("Chopsticks CLI");
    expect(stdout).toContain("Player A");
    expect(stdout).toContain("Legal moves");
    expect(stdout).toContain("Thanks for playing");
  });

  it("plays move 0 and renders the updated state", () => {
    const input = "0\nq\n";
    const stdout = execFileSync("npx", ["tsx", "cli/main.ts"], {
      cwd: root,
      input,
      encoding: "utf8",
      timeout: 15000,
    });
    expect(stdout).toContain("A plays:");
  });

  it("handles invalid input gracefully", () => {
    const input = "xyz\nq\n";
    const stdout = execFileSync("npx", ["tsx", "cli/main.ts"], {
      cwd: root,
      input,
      encoding: "utf8",
      timeout: 15000,
    });
    expect(stdout).toContain("Invalid selection");
  });
});