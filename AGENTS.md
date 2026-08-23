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

## Git workflow (per phase)

Each phase is delivered on its own branch, merged into `main` via a pull request, then cleaned up before the next phase begins.

1. **Branch from `main`.** Forgejo is the working forge. Ensure local `main` is up to date first (`git switch main && git pull --ff-only battlenet main`), then create a phase branch, e.g. `git switch -c phase-03-verification-and-cli`.
2. **Work on the branch.** Commit focused, conventional commits there. Run lint, typecheck (`npm run typecheck`), and tests (`npm test`) before considering the phase complete.
3. **Push the branch.** `git push -u battlenet <branch>`.
4. **Open a Forgejo PR to `main`.** Use `tea pr create --login battlenet --repo liamp/Chopsticks --base main --head <branch>` with a summary of the phase work and evidence of meeting the exit criteria.
5. **Wait for Woodpecker.** The `.woodpecker.yml` pipeline must pass before merge.
6. **Merge the PR.** Merge in Forgejo (or via `tea pr merge`).
7. **Delete the branches.** Delete the local and remote phase branches: `git push battlenet --delete <branch>` then `git branch -d <branch>`.
8. **Pull the latest `main`.** `git switch main && git pull --ff-only battlenet main`.
9. **Repeat from step 1** for the next phase, branching off the updated `main`.

Never commit directly to `main`. Keep `main` always green and deployable.

The `battlenet` remote is the working Forgejo repository watched by Woodpecker.
`origin` is the GitHub mirror and is updated separately at meaningful milestones;
do not use it to bypass the Forgejo PR and CI gate. See `docs/ci.md`.

## Containerised development

All tooling, dependencies, and environment variables stay inside a Docker container so nothing spills onto the host. Use the dev container for typecheck, tests, builds, and the CLI.

1. **Start the runtime** (once per boot, if not already running): `colima start`.
2. **Build the dev image** (after dependency or Dockerfile changes): `docker compose build`.
3. **Start the dev container** in the background: `docker compose up -d`.
4. **Run commands inside the container** via `docker compose exec dev <cmd>`:
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - `npm run play` (interactive CLI — use `docker compose run --rm -it dev npm run play` for a tty)
5. **Stop the container** when done: `docker compose down`.

The workspace is bind-mounted, so host edits are reflected live; `node_modules` is kept in a named volume to avoid host/architecture mismatch. Do not run `npm install` or engine commands directly on the host.

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
