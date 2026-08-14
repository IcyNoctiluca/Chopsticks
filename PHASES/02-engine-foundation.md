# Phase 02 - Engine foundation

**Depends on:** Phase 01

**Status:** Complete

**Outcome:** A framework-free deterministic engine with an intentionally small public API.

## Work

- Choose and initialise the engine package/tooling; TypeScript with Vitest is the default proposed stack.
- Define serialisable `GameState`, `PlayerState`, `Move`, and ruleset types.
- Implement `createGame`, `getLegalMoves`, `isLegalMove`, `applyMove`, and `getWinner`.
- Implement individual rule helpers for tap resolution, redistribution, loss detection, and next player.
- Make state transitions immutable and keep all clients out of engine imports.

## Exit criteria

- A programmatic game can start, enumerate moves, apply a move, and finish.
- The engine contains no UI, persistence, platform, networking, or timer dependencies.
- The complete API and invalid-move contract are documented.
- Unit tests cover each accepted rule and worked example from the specification.
