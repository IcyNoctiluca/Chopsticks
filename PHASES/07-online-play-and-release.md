# Phase 07 - Online play and release

**Depends on:** Phase 06

**Status:** Complete

**Outcome:** Authoritative online matches and a release-ready product.

## Work

- Add a server-authoritative match service: intended move in, authoritative validation and state out.
- Support room creation, invitations, reconnection, stale-move rejection, timeouts, and abandoned games.
- Enforce ruleset and engine-version compatibility per match.
- Add tutorial, sound/haptics where appropriate, optional analytics, match history, and release operations.
- Use analytics to answer product questions such as game length, opening win rate, redistribution use, and repetition rate.

## Exit criteria

- Clients cannot authoritatively alter game state.
- Reconnect and stale-move behaviour are exercised by automated integration tests.
- Privacy, failure handling, deployment, and support expectations are documented.
- Release criteria and post-launch metrics are agreed.
