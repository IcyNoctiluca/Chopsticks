# Phase 04 - Analysis and rules freeze

**Depends on:** Phase 03

**Status:** Complete

**Outcome:** Evidence that the ruleset is viable, or a documented revision loop.

## Work

- Enumerate reachable states and legal transitions.
- Identify terminal positions, forced wins/losses, draws, and cycles.
- Measure opening advantage, dominant openings, average game length, and repeated positions.
- Compare playtest observations with solver results.
- Revise the draft ruleset if necessary, then repeat affected engine tests and analysis.
- Freeze the first official version with a ruleset ID and engine semantic version.

## Exit criteria

- A reproducible analysis report exists.
- The team has decided whether the starting position is acceptably balanced.
- Known cycles and draw handling have defined behaviour.
- The v1 rules document and engine version are recorded in `PROGRESS.md`.
