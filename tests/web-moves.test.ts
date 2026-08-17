import { describe, it, expect } from "vitest";
import { movesEqual } from "../web/moves.js";
import type { Move } from "../src/index.js";

describe("movesEqual", () => {
  it("returns true for identical tap moves", () => {
    const a: Move = { type: "tap", player: "A", source: "left", targetPlayer: "B", target: "right" };
    const b: Move = { type: "tap", player: "A", source: "left", targetPlayer: "B", target: "right" };
    expect(movesEqual(a, b)).toBe(true);
  });

  it("returns false when tap source differs", () => {
    const a: Move = { type: "tap", player: "A", source: "left", targetPlayer: "B", target: "right" };
    const b: Move = { type: "tap", player: "A", source: "right", targetPlayer: "B", target: "right" };
    expect(movesEqual(a, b)).toBe(false);
  });

  it("returns false when tap target player differs", () => {
    const a: Move = { type: "tap", player: "A", source: "left", targetPlayer: "B", target: "right" };
    const b: Move = { type: "tap", player: "A", source: "left", targetPlayer: "A", target: "right" };
    expect(movesEqual(a, b)).toBe(false);
  });

  it("returns true for identical redistribute moves", () => {
    const a: Move = { type: "redistribute", player: "B", left: 2, right: 2 };
    const b: Move = { type: "redistribute", player: "B", left: 2, right: 2 };
    expect(movesEqual(a, b)).toBe(true);
  });

  it("returns false when redistribute values differ", () => {
    const a: Move = { type: "redistribute", player: "B", left: 1, right: 3 };
    const b: Move = { type: "redistribute", player: "B", left: 2, right: 2 };
    expect(movesEqual(a, b)).toBe(false);
  });

  it("returns false across move types", () => {
    const tap: Move = { type: "tap", player: "A", source: "left", targetPlayer: "B", target: "right" };
    const split: Move = { type: "redistribute", player: "A", left: 1, right: 1 };
    expect(movesEqual(tap, split)).toBe(false);
  });
});
