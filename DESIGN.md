# Design

## Product shape

Chopsticks is a two-player, turn-based hand game. The implementation is deliberately split into a rules engine and the clients that use it.

```text
CLI ──────────────┐
Web / mobile UI ──┼──> Engine <── Solver / AI
Game server ──────┘
                       ^
                       │
                Versioned ruleset
```

Dependencies point towards the engine only. The engine must not import from clients, networking, persistence, or rendering.

## Core model

The final type names may change, but the engine should have equivalents of:

- `GameState`: players' hand values, active player, game status, winner, turn number, and ruleset identity.
- `Move`: a player intent, such as `tap` or `redistribute`.
- `Ruleset`: the explicit configuration that gives those moves their meaning.
- `GameRecord`: initial state plus an ordered list of accepted moves.

All should be plain serialisable data. That makes saving, replaying, synchronising, debugging, solver analysis, and testing straightforward.

## Engine API

The minimum public API is:

```ts
createGame(ruleset): GameState
getLegalMoves(state): Move[]
isLegalMove(state, move): boolean
applyMove(state, move): GameState
getWinner(state): PlayerId | null
```

`applyMove` validates the move, produces a new state, resolves eliminations, determines completion, and advances the turn only when appropriate. Invalid-move behaviour must be specified rather than left to the caller.

## Ruleset versioning

The first official ruleset should be explicitly named (for example, `classic-v1`) and remain reproducible. New gameplay variants must be a new ruleset version, not a silent change to old games.

## Layer responsibilities

| Layer | Owns | Must not own |
| --- | --- | --- |
| Engine | state transitions, legality, victory, legal moves | UI, I/O, storage, network protocol |
| Solver / AI | search and move selection through engine API | alternate rules logic |
| Session service | history, undo policy, settings, timers, player names | changing engine results |
| Client | interaction, presentation, animation, accessibility | rules validation or outcome calculation |
| Server | authoritative move submission and state distribution | a separate engine implementation |

## Compatibility and trust

For online play, the client submits intended moves. The server loads the authoritative state, checks the expected turn/version, validates and applies the move through the engine, then broadcasts the resulting state. Clients never authoritatively calculate outcomes.
