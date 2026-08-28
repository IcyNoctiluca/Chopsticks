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

### Standard workflow when the user asks to merge changes

Treat requests such as "merge this", "commit and merge", or "create a PR and
merge it" as authorization for the complete Forgejo delivery workflow below:

1. **Protect the primary checkout.** Inspect its status and preserve all user
   changes. Do not edit, stash, discard, or commit unrelated work there.
2. **Start from current Forgejo `main`.** Fetch `battlenet/main`, then create a
   focused `codex/<topic>` branch in a new isolated worktree based on that
   commit. Apply or reproduce only the requested changes in the worktree.
3. **Reconcile concurrent changes.** Fetch `battlenet/main` again before
   opening the PR. If it advanced, merge it into the worktree branch, resolve
   every conflict deliberately, and rerun the relevant checks. Never resolve a
   conflict by silently discarding either side.
4. **Commit and open a Forgejo PR.** Use focused conventional commits, push the
   branch to `battlenet`, and open the PR with `tea`. Do not push directly to
   `main`.
5. **Require CI before merge.** Wait for the current PR commit's Woodpecker
   pipeline to pass. Fix failures on the same worktree branch and repeat until
   green; never bypass or merge around the gate.
6. **Merge and prove `main`.** Merge the Forgejo PR with a merge commit, then
   wait for the resulting `battlenet/main` Woodpecker pipeline to pass.
7. **Clean up.** Remove the remote feature branch, isolated worktree, local
   feature branch, and temporary worktree directory. Finally fast-forward the
   primary checkout's `main` from `battlenet/main` without disturbing unrelated
   user work, then `git push` so GitHub `main` fast-forwards too.

GitHub is mirrored automatically on every push (see the remotes section below);
there is no separate mirror step.

1. **Branch from `main`.** Forgejo is the working forge. Ensure local `main` is up to date first (`git switch main && git pull --ff-only battlenet main`), then create a phase branch, e.g. `git switch -c phase-03-verification-and-cli`.
2. **Work on the branch.** Commit focused, conventional commits there. Run lint, typecheck (`npm run typecheck`), and tests (`npm test`) before considering the phase complete.
3. **Push the branch.** `git push -u battlenet <branch>`.
4. **Open a Forgejo PR to `main`.** Use `tea pr create --login battlenet --repo liamp/Chopsticks --base main --head <branch>` with a summary of the phase work and evidence of meeting the exit criteria.
5. **Wait for Woodpecker.** The `.woodpecker.yml` pipeline must pass before merge.
6. **Merge the PR.** Merge in Forgejo (or via `tea pr merge`).
7. **Delete the branches.** Delete the local and remote phase branches: `git push battlenet --delete <branch>` (the delete fans out to both push URLs, so it also removes the branch from GitHub) then `git branch -d <branch>`.
8. **Pull the latest `main`.** `git switch main && git pull --ff-only battlenet main && git push` (the final push fast-forwards GitHub `main`).
9. **Repeat from step 1** for the next phase, branching off the updated `main`.

Never commit directly to `main`. Keep `main` always green and deployable.

### Git remotes and GitHub mirroring

Forgejo is the working forge. GitHub is a continuously updated public copy, so a
`git.battlenet.internal` outage never puts the code or its history at risk while
keeping the hosting burden on GitHub.

- `battlenet` is the working Forgejo remote watched by Woodpecker. `main` tracks
  `battlenet/main` and `remote.pushDefault` is `battlenet`. It has **two push
  URLs** — the Forgejo repo and `git@github.com:IcyNoctiluca/Chopsticks.git` — so
  a single `git push` (feature branches and `main`) lands on both forges.
- `origin` (`git@github.com:IcyNoctiluca/Chopsticks.git`) is GitHub-only. Use it
  for `git fetch`, `gh`, and any deliberate GitHub-only push.

Rules that still hold:

- Do implementation work on Forgejo branches and gate every change through a
  Forgejo PR plus a green Woodpecker pipeline. Do not open the PR on GitHub, and
  never use GitHub to bypass the CI gate.
- After a Forgejo PR merges, run
  `git switch main && git pull --ff-only battlenet main && git push`. The push
  fast-forwards `battlenet/main` (already current) and GitHub `main`.
- GitHub `main` only ever fast-forwards from `battlenet/main`. If the two
  diverge, realign GitHub with a one-time
  `git push origin battlenet/main:main --force` — GitHub's content is always a
  subset of Forgejo history.

One-time configuration (already applied in this checkout):

```sh
git remote set-url --add --push battlenet ssh://git@git.battlenet.internal:30022/liamp/Chopsticks.git
git remote set-url --add --push battlenet git@github.com:IcyNoctiluca/Chopsticks.git
```

The first line re-adds the Forgejo URL because setting an explicit push URL
otherwise replaces the implicit one. See `docs/ci.md`.

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
