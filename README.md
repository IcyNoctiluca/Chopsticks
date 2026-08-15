# Chopsticks

An engine-first implementation of a two-player hand game. The core game rules and transitions are built and proved before any graphical interface, networking, or platform-specific work.

## Project goal

Deliver a well-balanced, replayable game that works locally first and can later support AI opponents, a graphical app, and online play without rewriting the rules engine.

## Workflow

Work through the phase files in order. A phase is complete only when its exit criteria are met and its progress entry has been updated.

1. [Phase 00 - Rules decision](PHASES/00-rules-decision.md)
2. [Phase 01 - Rules specification](PHASES/01-rules-specification.md)
3. [Phase 02 - Engine foundation](PHASES/02-engine-foundation.md)
4. [Phase 03 - Verification and CLI](PHASES/03-verification-and-cli.md)
5. [Phase 04 - Analysis and rules freeze](PHASES/04-analysis-and-rules-freeze.md)
6. [Phase 05 - Product foundation](PHASES/05-product-foundation.md)
7. [Phase 06 - Local app](PHASES/06-local-app.md)
8. [Phase 07 - Online play and release](PHASES/07-online-play-and-release.md)

The current ruleset is specified in [docs/rules-v0.1.md](docs/rules-v0.1.md) (`classic-v1`, frozen v1.0; see [docs/analysis.md](docs/analysis.md) for the game-theoretic profile). The engine API is documented in [docs/api.md](docs/api.md). Release operations are documented in [docs/release.md](docs/release.md).

## How to run

Containerised development keeps tooling off your host. Start the runtime once, then use the dev container:

```sh
colima start                 # start the container runtime
docker compose up -d         # start the dev container
docker compose exec dev npm test          # 71 tests
docker compose exec dev npm run typecheck
docker compose exec dev npm run web       # local web app at http://localhost:5173
docker compose run --rm -it dev npm run play   # interactive CLI
```

See [AGENTS.md](AGENTS.md) for the per-phase branch/PR workflow and container usage.

See [DESIGN.md](DESIGN.md) for architecture and [PROGRESS.md](PROGRESS.md) for the current project state.

## Guiding principle

The engine is the single authority on legal moves and game results. Interfaces request moves and render the resulting state; they never implement game rules themselves.
