import { MatchServerError, type ClientId } from "./matchServer.js";
import type { Move } from "../src/index.js";

export type RulesetId = "classic-v1" | "classic-tournament-v1";

export type CreateRoomParams = {
  readonly host: { readonly clientId: ClientId; readonly displayName: string };
  readonly options: { readonly rulesetId?: RulesetId; readonly moveTimeoutMs?: number };
};

export type JoinParams = { readonly clientId: ClientId; readonly displayName: string };

export type MoveParams = { readonly clientId: ClientId; readonly move: Move; readonly expectedMoveNumber: number };

export function validateCreateRoomBody(body: unknown): CreateRoomParams {
  if (typeof body !== "object" || body === null) invalidRequest("Request body must be an object");
  const b = body as Record<string, unknown>;
  const host = {
    clientId: requireString(b.clientId, "clientId") as ClientId,
    displayName: requireString(b.displayName, "displayName"),
  };
  const options: { rulesetId?: RulesetId; moveTimeoutMs?: number } = {};
  if (b.rulesetId !== undefined) {
    if (b.rulesetId !== "classic-v1" && b.rulesetId !== "classic-tournament-v1") invalidRequest("Unsupported rulesetId");
    options.rulesetId = b.rulesetId;
  }
  if (b.moveTimeoutMs !== undefined) {
    if (typeof b.moveTimeoutMs !== "number" || !Number.isFinite(b.moveTimeoutMs)) invalidRequest("moveTimeoutMs must be a number");
    options.moveTimeoutMs = b.moveTimeoutMs;
  }
  return { host, options };
}

export function validateJoinBody(body: unknown): JoinParams {
  if (typeof body !== "object" || body === null) invalidRequest("Request body must be an object");
  const b = body as Record<string, unknown>;
  return {
    clientId: requireString(b.clientId, "clientId") as ClientId,
    displayName: requireString(b.displayName, "displayName"),
  };
}

export function validateAddAIBody(body: unknown): "random" | "heuristic" | "solved" {
  if (body === null || typeof body !== "object") return "random";
  const difficulty = (body as Record<string, unknown>).difficulty;
  if (difficulty === undefined) return "random";
  if (difficulty === "random" || difficulty === "heuristic" || difficulty === "solved") return difficulty;
  invalidRequest("difficulty must be random, heuristic, or solved");
}

export function validateMoveBody(body: unknown): MoveParams {
  if (typeof body !== "object" || body === null) invalidRequest("Request body must be an object");
  const b = body as Record<string, unknown>;
  return {
    clientId: requireString(b.clientId, "clientId") as ClientId,
    move: validateMove(b.move),
    expectedMoveNumber: requireFiniteNumber(b.expectedMoveNumber, "expectedMoveNumber"),
  };
}

export function validateMove(value: unknown): Move {
  if (typeof value !== "object" || value === null) invalidRequest("move must be an object");
  const m = value as Record<string, unknown>;
  const player = requirePlayerId(m.player, "player");
  const type = requireString(m.type, "type");
  if (type === "tap") {
    return {
      type: "tap",
      player,
      source: requireHand(m.source, "source"),
      targetPlayer: requirePlayerId(m.targetPlayer, "targetPlayer"),
      target: requireHand(m.target, "target"),
    };
  }
  if (type === "redistribute") {
    return {
      type: "redistribute",
      player,
      left: requireFingerCount(m.left, "left"),
      right: requireFingerCount(m.right, "right"),
    };
  }
  invalidRequest("move.type must be tap or redistribute");
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    invalidRequest(`${field} must be a non-empty string`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) invalidRequest(`${field} must be a finite number`);
  return value;
}

function requirePlayerId(value: unknown, field: string): "A" | "B" {
  if (value === "A" || value === "B") return value;
  invalidRequest(`${field} must be A or B`);
}

function requireHand(value: unknown, field: string): "left" | "right" {
  if (value === "left" || value === "right") return value;
  invalidRequest(`${field} must be left or right`);
}

function requireFingerCount(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 4) {
    invalidRequest(`${field} must be an integer between 0 and 4`);
  }
  return value;
}

function invalidRequest(message: string): never {
  throw new MatchServerError("invalid-request", message);
}
