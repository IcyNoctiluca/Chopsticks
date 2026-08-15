# Chopsticks Rules Specification

## Ruleset identifier

**`classic-v1`**

This is the first official ruleset. Its behaviour is fixed and reproducible: any future gameplay change must be published as a new ruleset version, not a silent edit to `classic-v1`. The ruleset is frozen at the end of Phase 04; until then this document is a draft labelled `v0.1`.

### Document changelog

| Version | Date | Change |
| --- | --- | --- |
| v0.1 | 2026-08-14 | Initial draft from the Phase 00 decisions. |

---

## 1. Overview

Chopsticks is a two-player, turn-based hand game. Each player has two hands, left and right. A hand carries an integer value. Players alternate turns, performing exactly one action per turn: a **tap** or a **redistribution**. A hand whose value reaches 5 or more is dead (0) and cannot act or be acted upon. A player loses when both their hands are dead.

## 2. State notation

A compact notation is used throughout:

```text
A:[ar,al] B:[br,bl] turn:P
```

- `A` and `B` are the players. `P` in `turn:P` is the player to move (`A` or `B`).
- Each player's bracket lists `[right, left]` hand values, in that fixed order. Right comes first, left second.
- A dead hand is written `0`.
- Example: `A:[1,1] B:[1,1] turn:A` is the standard opening.

When a winner exists, append ` winner:W`, e.g. `A:[1,1] B:[0,0] turn:B winner:A`.

## 3. Starting state and player order

- Each player starts with both hands at value `1`: `A:[1,1] B:[1,1]`.
- The starting player is recorded in the game state and **alternates each game of a match**. Within a single game the turn simply passes back and forth.
- The opening state always admits legal moves (any living hand can tap any living hand).

## 4. Hand value range

- A living hand has a value in `{1, 2, 3, 4}`.
- A dead hand has value `0`.
- Values arise only by taps (addition) and redistributions (splitting); there is no other way to change a hand's value.

## 5. Tap (attack)

### 5.1 Arithmetic

Tapping is **additive**: the target hand's new value is `target + source`.

### 5.2 Source restrictions

- The source hand must belong to the player to move.
- The source hand must be **living** (value >= 1). Dead hands cannot tap.

### 5.3 Target restrictions

- The target hand must be **living**. Dead hands cannot be targeted.
- The target may be **any** living hand on the board: either of the opponent's living hands, **or** the mover's own other living hand (self-tap).
- You cannot target the same hand you are tapping from (a hand cannot tap itself).

### 5.4 Effect

- Compute `new = target + source`.
- If `new >= 5`, the target hand **dies** and becomes `0`.
- Otherwise the target hand becomes `new` (a living value in `{2,3,4}`).
- The source hand is unchanged.
- Turn passes to the other player.

## 6. Elimination

A hand is eliminated (dies) exactly when a tap brings its total to **5 or more**; the value becomes `0` and the hand is dead. There is no "exactly 5 only" rule and no ceiling above which a hand survives. Dead hands stay dead until and unless revived by a redistribution.

## 7. Redistribution (split)

### 7.1 When allowed

Redistribution is allowed **only when one of the mover's own hands is dead** (i.e. it is a revival move). It is not available when both your hands are living.

### 7.2 What it does

The mover relocates value between their two hands so that the **total is preserved**. Let the living hand's value be `v`; the mover chooses a pair `(x, y)` with:

- `x + y = v` (total preserved),
- `x >= 1` and `y >= 1` (both hands must end alive — see 7.3),
- `(x, y) != (v, 0)` and `(x, y) != (0, v)` already follows from the >=1 rule; additionally the resulting position must **differ** from the starting position (the split must change something).

Because both results must be `>= 1`, each must also be `<= v - 1`; combined with the elimination rules this means valid splits place `1..v-1` on the previously-dead hand and the remainder on the other.

### 7.3 Intentional closure — banned

A redistribution may **not** create a dead hand. Both of the mover's hands must be living (`>= 1`) after the split. You cannot voluntarily zero one of your own hands via redistribution, and because redistribution is already restricted to revival-only, you cannot close a living hand this way either.

### 7.4 Examples (mover A, dead right hand, `A:[0,v] B:[...] turn:A`)

For `v = 3` (`A:[0,3]`), valid splits are `(1,2)` and `(2,1)` -> resulting `A:[1,2]` or `A:[2,1]`. The split `(0,3)` is banned (creates a dead hand); `(3,0)` is also banned (same reason).

For `v = 5` is impossible because a living hand can never hold 5 (it would have died).

## 8. Victory and end of game

- A player **loses** when both their hands are dead (`[0,0]`).
- The other player wins immediately; the game state records `winner` and no further moves are legal.
- **Non-terminal deadlock:** if a non-terminal position has no legal move for the player to move, that player loses. (Under these rules a non-terminal deadlock is unreachable — see §12 — but the behaviour is specified for completeness.)
- The game cannot end in a draw under `classic-v1`.

## 9. Repetition

Repeated positions are **allowed**; there is no special loop rule, no draw by repetition, and no cap on visits. Play continues under the normal tap/redistribution/victory rules. (See §12 for why infinite loops do not undermine termination of victory.)

## 10. Invalid-move behaviour

The engine is the single authority on legality. An invalid move is **never applied**; `applyMove` rejects it and leaves the state unchanged. A move is invalid if any of the following hold:

- It is not the mover's turn.
- The game is already over (a `winner` is recorded).
- Tap: the source hand is dead; or the source does not belong to the mover; or the target is dead; or the target is the same as the source; or the target is a hand that does not exist.
- Redistribution: attempted when both mover's hands are living; or the resulting pair does not preserve the total; or either result is `0`; or the result does not change the position.
- The move is not a recognised move type.

Callers must use `getLegalMoves` / `isLegalMove` to determine what is playable; they must not implement their own rule checks.

## 11. Legal-move determination from a state

For any state, the legal moves are the union of:

1. **Taps.** For each living hand of the player to move (the source), for each living hand on the board that is not the source (the target — opponent's living hands or the mover's other living hand): a tap move is legal.
2. **Redistributions.** Only if the mover has exactly one dead hand. For each `(x, y)` with `x + y = living value`, `x >= 1`, `y >= 1`, and `(x, y)` differing from the current arrangement: a redistribution move is legal.

If the game is over (a `winner` is set), there are no legal moves.

## 12. Termination note

This section is explanatory, not a rule. Under `classic-v1` the only way a hand dies is by tap, and a hand dies only when a tap reaches `>= 5`. A non-terminal position always has both players with at least one living hand; therefore the player to move always has at least one legal tap. Consequently the "non-terminal deadlock" branch of §8 does not occur in normal play, and the rules do not require a repetition/loop rule to determine a winner.

## 13. Worked examples

Notation: moves are written as `A L->B L` meaning "player A, left hand taps B's left hand"; redistributions as `A split (x,y)` meaning A's hands go to right=`x`, left=`y`.

### 13.1 Normal tap

State: `A:[1,1] B:[1,1] turn:A`.
Move: `A R->B L` (A's right, value 1, taps B's left, value 1).
Result: B's left becomes `1 + 1 = 2` (< 5, living).
Final: `A:[1,1] B:[1,2] turn:B`.
Legal? Yes.

### 13.2 Elimination

State: `A:[1,1] B:[0,4] turn:A`.
Move: `A L->B L` (A's left, value 1, taps B's left, value 4).
Result: B's left becomes `4 + 1 = 5` (>= 5) -> dies -> 0.
Final: `A:[1,1] B:[0,0] turn:B winner:A`.
B has both hands dead; A wins.
Legal? Yes.

### 13.3 Legal redistribution

State: `A:[0,3] B:[2,2] turn:A`.
A has one dead hand, so redistribution is allowed. Living value is 3.
Move: `A split (1,2)` -> A's hands become right=1, left=2.
Check: `1+2 = 3`, both `>= 1`, differs from `(0,3)`.
Final: `A:[1,2] B:[2,2] turn:B`.
Legal? Yes.

### 13.4 Illegal redistribution

State: `A:[0,3] B:[2,2] turn:A`.

- `A split (0,3)`: creates a dead hand (right=0). **Illegal** (§7.3).
- `A split (3,0)`: left becomes 0. **Illegal** (§7.3).
- `A split (1,2)` performed from `A:[1,2] B:[...] turn:A` (both living): redistribution when both hands living. **Illegal** (§7.1).
- `A split (1,2)` resulting in the same position as before (no change): **Illegal** (§7.2).

### 13.5 Game completion

State: `A:[4,4] B:[0,1] turn:A`.
Move: `A R->B L` (A's right, value 4, taps B's left, value 1).
Result: B's left becomes `1 + 4 = 5` (>= 5) -> dies -> 0.
Final: `A:[4,4] B:[0,0] turn:B winner:A`.
Both B hands dead; A wins.
Legal? Yes.

## 14. Phase 00 question coverage

| Phase 00 question | Answered in |
| --- | --- |
| Tap mode (add source vs add one) | §5.1 |
| Elimination (5 vs >=5) | §6 |
| Attacking hands (source living, self/opponent, dead targets) | §5.2, §5.3 |
| Redistribution (revival only vs any time, total-preserving splits) | §7.1, §7.2 |
| Intentional closure (create zero) | §7.3 |
| Hand identity (distinct L/R) | §2 |
| End of game (both-dead, no-legal-move) | §8 |
| Repetition | §9 |
| Opening fairness (alternating starter) | §3 |