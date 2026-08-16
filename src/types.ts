export type PlayerId = "A" | "B";

export type Hand = "left" | "right";

export type RulesetId = "classic-v1" | "classic-tournament-v1";

export interface Ruleset {
  readonly id: RulesetId;
  readonly eliminationThreshold: number;
  readonly startingHandValue: number;
}

export interface PlayerState {
  readonly left: number;
  readonly right: number;
}

export type GameStatus = "playing" | "finished";

export interface GameState {
  readonly ruleset: RulesetId;
  readonly players: Readonly<Record<PlayerId, PlayerState>>;
  readonly turn: PlayerId;
  readonly turnNumber: number;
  readonly status: GameStatus;
  readonly winner: PlayerId | null;
  readonly startingPlayer: PlayerId;
}

export interface TapMove {
  readonly type: "tap";
  readonly player: PlayerId;
  readonly source: Hand;
  readonly targetPlayer: PlayerId;
  readonly target: Hand;
}

export interface RedistributeMove {
  readonly type: "redistribute";
  readonly player: PlayerId;
  readonly right: number;
  readonly left: number;
}

export type Move = TapMove | RedistributeMove;

export type InvalidMoveReason =
  | "game-over"
  | "not-your-turn"
  | "unknown-move-type"
  | "tap-source-dead"
  | "tap-source-not-owned"
  | "tap-target-dead"
  | "tap-target-is-source"
  | "redistribute-when-both-living"
  | "redistribute-total-not-preserved"
  | "redistribute-creates-dead-hand"
  | "redistribute-no-change";

export class InvalidMoveError extends Error {
  readonly reason: InvalidMoveReason;
  constructor(reason: InvalidMoveReason, message: string) {
    super(message);
    this.name = "InvalidMoveError";
    this.reason = reason;
  }
}