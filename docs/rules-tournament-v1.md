# Chopsticks Tournament Rules Specification

## Ruleset identifier

**`classic-tournament-v1`**

This ruleset is identical to the frozen `classic-v1` ruleset in every way except for one addition: a **threefold-repetition draw rule** to prevent infinite loops in competitive/ranked play.

## Differences from `classic-v1`

| Aspect | `classic-v1` | `classic-tournament-v1` |
| --- | --- | --- |
| Taps | Additive; target dies at 5+ | Same as `classic-v1` |
| Redistribution | Same restrictions | Same as `classic-v1` |
| Winning | Kill both opponent hands | Kill both opponent hands |
| **Draws** | **None** — loops are allowed | **Threefold repetition** ends the game in a draw |

## Threefold-repetition draw rule

A game is declared a **draw** if the same full game state occurs for the **third time**. The compared state includes:

- Player A's left and right hand values.
- Player B's left and right hand values.
- The player whose turn it is.

The initial state counts as the first occurrence. If a sequence of moves returns the game to the initial state, that is the second occurrence. Returning again makes it the third occurrence, and the game ends immediately in a draw.

A draw awards **half a point** to each player in a match.

## Rationale

`classic-v1` deliberately allows repetition loops. This is acceptable for casual play. Tournament and ranked online play needs a guaranteed termination policy; the threefold-repetition rule is a standard, easy-to-explain solution that does not change any other rule.

## Example loop

The following legal sequence returns to the opening position `A:[1,1] B:[1,1] turn:A` after six moves. Repeating the loop a second time (12 moves total) causes the opening position to appear for the third time, ending the game in a draw.

```text
1. A L taps B L
2. B R self-taps B L
3. A L taps B L
4. B R self-taps B L
5. A L taps B R
6. B redistributes to [1,1]
   -> back to A:[1,1] B:[1,1] turn:A
```

## Status

Document version `v1.0`, frozen 2026-08-15 alongside the `classic-tournament-v1` engine implementation.
