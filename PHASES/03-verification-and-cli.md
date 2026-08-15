# Phase 03 - Verification and CLI

**Depends on:** Phase 02

**Status:** Complete

**Outcome:** A trustworthy engine and a cheap, playable two-human prototype.

## Work

- Add unit tests for every rule boundary and invalid action.
- Add invariant/property tests over generated legal positions and moves.
- Verify that `getLegalMoves` and `applyMove` agree, state inputs are not mutated, and terminal states reject moves.
- Build a terminal interface that displays state, offers legal moves, accepts a selection, and handles redistribution.
- Playtest locally; capture usability and rule issues in `PROGRESS.md`.

## Exit criteria

- The automated suite passes and includes invariants for values, turn ownership, terminal state, and redistribution totals.
- Two people can complete a game through the CLI without manually editing state.
- Playtest findings are recorded and either resolved or scheduled.
