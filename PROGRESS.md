# Progress

## Current state

**Active phase:** Phase 00 - Rules decision

**Status:** Not started
**Last updated:** 2026-08-10

## Next action

Choose the initial ruleset decisions in [Phase 00](PHASES/00-rules-decision.md), then turn them into a versioned specification in Phase 01.

## Decision log

| Date | Decision | Status | Notes |
| --- | --- | --- | --- |
| 2026-08-10 | Use an engine-first workflow | Accepted | Interfaces will depend on one deterministic rules engine. |
| 2026-08-10 | Initial ruleset choices | Pending | Tap mode, elimination behaviour, self-taps, redistribution, and loop handling need explicit decisions. |

## Phase tracker

| Phase | Status | Evidence / next step |
| --- | --- | --- |
| 00 - Rules decision | In progress | Make the choices listed in `PHASES/00-rules-decision.md`. |
| 01 - Rules specification | Not started | Write and review the versioned rules document. |
| 02 - Engine foundation | Not started | Create the framework-free core API and tests. |
| 03 - Verification and CLI | Not started | Achieve strong automated coverage and a playable terminal prototype. |
| 04 - Analysis and rules freeze | Not started | Enumerate states, assess balance, and freeze v1. |
| 05 - Product foundation | Not started | Add history, replay, AI, and session orchestration. |
| 06 - Local app | Not started | Build the first player-facing interface. |
| 07 - Online play and release | Not started | Add authoritative multiplayer and polish for release. |

## Blockers

- No technical blocker. Phase 00 requires product decisions from the game designer.
