# Working agreement

## Source of truth

- `PHASES/` defines the delivery workflow and phase exit criteria.
- `DESIGN.md` defines stable architectural boundaries.
- `PROGRESS.md` records decisions, current work, and evidence of completion.
- The versioned rules specification (created in Phase 01) is the source of truth for gameplay behaviour.

## How to work

1. Read the current phase and `PROGRESS.md` before changing code.
2. Resolve or explicitly defer rule questions before encoding them.
3. Keep changes focused on the active phase; update `PROGRESS.md` when a decision, milestone, or blocker changes.
4. Add tests alongside every engine rule or bug fix.
5. Run the relevant checks before declaring a phase item complete.

## Engine boundaries

- Keep the engine deterministic, pure where practical, framework-free, and serialisable.
- Treat `GameState` and `Move` as immutable values. `applyMove` returns a new state and does not mutate its input.
- Derive legal moves in the engine. UI, CLI, AI, and server code must consume the same public engine API.
- Keep platform concerns out of the engine: no React, browser APIs, Node I/O, database calls, timers, animations, or networking.
- Store moves as the durable game history so a game can be replayed from its initial state.

## Rule changes

Do not change gameplay behaviour as an incidental refactor. Record the proposed change, its rationale, compatibility impact, and test coverage in `PROGRESS.md`. Once a ruleset is frozen, give later behavioural changes a new ruleset version.

## Completion standard

Do not mark work complete based only on visual or manual testing. Meet the phase exit criteria, record the evidence, and note remaining risks or follow-ups.
