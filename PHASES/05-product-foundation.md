# Phase 05 - Product foundation

**Depends on:** Phase 04

**Outcome:** Full game functionality that is independent of a graphical client.

## Work

- Add `GameRecord` as initial state plus accepted move history.
- Implement deterministic replay and an explicit undo policy.
- Add AI opponents that call the engine API: random first, then heuristic or solved-state levels.
- Create a session layer for local saves, player names, settings, timers, AI turns, and match scoring.
- Define a versioned persistence format and migration policy.

## Exit criteria

- Any completed record reproduces its current state exactly.
- Undo and replay have tests for normal and terminal games.
- At least one AI difficulty can complete a game through the shared engine API.
- Session concerns do not leak into the engine.
