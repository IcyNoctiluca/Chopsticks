# Phase 01 - Rules specification

**Depends on:** Phase 00

**Outcome:** A versioned rules document that two independent implementations would interpret the same way.

## Work

- Create `docs/rules-v0.1.md` with a ruleset identifier and a changelog.
- Define the starting state, player order, hand value range, tap arithmetic, elimination, redistribution, victory, repetition, and invalid-move behaviour.
- State every target/source restriction plainly.
- Include worked examples for a normal tap, an elimination, a legal redistribution, an illegal redistribution, and game completion.
- Define a compact state notation such as `A:[1,1] B:[1,1] turn:A`.

## Exit criteria

- The document answers every Phase 00 question.
- Examples are internally consistent with the rules.
- A reviewer can determine legal moves from representative states without additional explanation.
- The document is linked from `README.md` and its version is recorded in `PROGRESS.md`.
