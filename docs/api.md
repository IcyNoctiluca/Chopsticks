# Engine API

The engine is the single authority on legal moves and game results. It is framework-free, deterministic, and operates only on serialisable data. It has no UI, persistence, platform, networking, or timer dependencies.

## Types

```ts
type PlayerId = "A" | "B";
type Hand = "left" | "right";
type RulesetId = "classic-v1";

interface PlayerState { left: number; right: number; }   // 0 == dead
type GameStatus = "playing" | "finished";

interface GameState {
  ruleset: RulesetId;
  players: Record<PlayerId, PlayerState>;
  turn: PlayerId;            // player to move
  turnNumber: number;        // number of moves applied
  status: GameStatus;
  winner: PlayerId | null;
  startingPlayer: PlayerId;  // alternates per game of a match (caller-supplied)
}

interface TapMove {
  type: "tap";
  player: PlayerId;        // tapper (must equal state.turn)
  source: Hand;            // a living hand of `player`
  targetPlayer: PlayerId;  // mover or opponent
  target: Hand;            // a living hand, not the same as source
}

interface RedistributeMove {
  type: "redistribute";
  player: PlayerId;
  right: number;            // resulting right-hand value (>= 1)
  left: number;            // resulting left-hand value (>= 1), right + left == total
}

type Move = TapMove | RedistributeMove;
```

All of the above are plain JSON-serialisable values.

## Public API

```ts
createGame(options?): GameState
getLegalMoves(state): Move[]
isLegalMove(state, move): boolean
applyMove(state, move): GameState
getWinner(state): PlayerId | null
validateMove(state, move): InvalidMoveReason | null
```

| Function | Behaviour |
| --- | --- |
| `createGame` | Returns the `classic-v1` opening: both players `[right=1, left=1]`. `options.startingPlayer` defaults to `"A"`; alternation across a match is the caller's responsibility. |
| `getLegalMoves` | Returns every legal move for the player to move. Empty when `status === "finished"`. Never throws. |
| `isLegalMove` | `validateMove(state, move) === null`. Never throws. |
| `validateMove` | Returns the reason a move is illegal, or `null` if legal. Never throws. |
| `applyMove` | Validates the move; on an illegal move it **throws `InvalidMoveError`** (the input state is never mutated). On a legal move it returns a **new** `GameState` with the move applied, eliminations resolved, completion determined, and the turn advanced. |
| `getWinner` | Returns `state.winner` (or `null` while playing). |

### Immutability

`applyMove` does not mutate its input. `GameState` and `Move` are treated as immutable values; rebuild a new state on every transition. A game can be replayed from its initial state plus the ordered list of accepted moves.

## Invalid-move contract

`applyMove` is the authority: an invalid move is **never applied**. It throws `InvalidMoveError` with a typed `reason`. Callers should use `getLegalMoves` / `isLegalMove` to choose moves and must not implement their own rule checks.

| `InvalidMoveReason` | Trigger |
| --- | --- |
| `game-over` | A `winner` is already recorded. |
| `not-your-turn` | `move.player !== state.turn`. |
| `unknown-move-type` | `move.type` is neither `"tap"` nor `"redistribute"`. |
| `tap-source-dead` | The tapping hand is dead. |
| `tap-target-dead` | The target hand is dead. |
| `tap-target-is-source` | Source and target are the same player's same hand. |
| `redistribute-when-both-living` | Redistribution attempted with no dead hand. |
| `redistribute-total-not-preserved` | `right + left` != current total of the mover's hands. |
| `redistribute-creates-dead-hand` | Either resulting value is `< 1`. |
| `redistribute-no-change` | The split reproduces the current position (defensive; unreachable under the dead-hand precondition in `classic-v1`). |

## Rule helpers (internal)

Tap resolution, redistribution, loss detection, and turn advancement live in `src/internal.ts` and `src/applyMove.ts`. There is exactly one engine implementation; clients consume this API and never recompute results.

See [`docs/rules-v0.1.md`](./rules-v0.1.md) (`classic-v1`) for the rules these functions implement.