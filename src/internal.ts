import type { GameState, Hand, PlayerId, PlayerState, Ruleset, RulesetId } from "./types.js";

export const CLASSIC_V1: Ruleset = Object.freeze({
  id: "classic-v1",
  eliminationThreshold: 5,
  startingHandValue: 1,
}) as Ruleset;

export const CLASSIC_TOURNAMENT_V1: Ruleset = Object.freeze({
  id: "classic-tournament-v1",
  eliminationThreshold: 5,
  startingHandValue: 1,
}) as Ruleset;

export function otherPlayer(player: PlayerId): PlayerId {
  return player === "A" ? "B" : "A";
}

export function handValue(player: PlayerState, hand: Hand): number {
  return hand === "left" ? player.left : player.right;
}

export function isAlive(value: number): boolean {
  return value > 0;
}

export function isHandAlive(player: PlayerState, hand: Hand): boolean {
  return isAlive(handValue(player, hand));
}

export function bothHandsDead(player: PlayerState): boolean {
  return !isAlive(player.left) && !isAlive(player.right);
}

export function livingHandCount(player: PlayerState): number {
  return (isAlive(player.left) ? 1 : 0) + (isAlive(player.right) ? 1 : 0);
}

export function withHand(player: PlayerState, hand: Hand, value: number): PlayerState {
  return hand === "left" ? { ...player, left: value } : { ...player, right: value };
}