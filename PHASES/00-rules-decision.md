# Phase 00 - Rules decision

**Status:** Complete

**Outcome:** A chosen, internally consistent initial ruleset ready to be specified.

## Decisions required

Record each answer in `PROGRESS.md` before starting Phase 01.

| Topic | Decision to make |
| --- | --- |
| Tap mode | Does a tap add the source hand's value, or always add one? |
| Elimination | Does a target at exactly five die, or does any total at or above five die? |
| Attacking hands | Must a source hand be living? Can it tap its own hand or the opponent only? Can it target a dead hand? |
| Redistribution | Is it allowed only to revive a dead hand or whenever both hands are living? Which total-preserving splits are allowed? |
| Intentional closure | May redistribution create a zero-valued hand? |
| Hand identity | Are left and right distinct for rules and history, or merely display positions? |
| End of game | Does a player lose when both hands are dead? What happens if a non-terminal state has no legal moves? |
| Repetition | Are repeated states allowed, declared a draw, limited, or resolved by another rule? |
| Opening fairness | Does starting player alternate between games or matches? |

## Recommended starting hypothesis

Use Chopsticks-style addition, eliminate at five or above, require living source and target hands, permit redistribution only when reviving a dead hand, preserve the total, require a changed position, and treat both-dead as a loss. These are proposals, not accepted rules.

## Exit criteria

- Every decision above has a recorded answer.
- The answers admit at least one legal move from the starting state.
- At least five worked positions have been manually checked for consistency.
- Any deliberately postponed decision has a named owner and a deadline.
