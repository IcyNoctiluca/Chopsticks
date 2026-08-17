import type { Move } from "../src/index.js";

export function movesEqual(a: Move, b: Move): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "tap" && b.type === "tap") {
    return a.player === b.player && a.source === b.source && a.targetPlayer === b.targetPlayer && a.target === b.target;
  }
  if (a.type === "redistribute" && b.type === "redistribute") {
    return a.player === b.player && a.left === b.left && a.right === b.right;
  }
  return false;
}
