# Continuous integration

Woodpecker at `ci.battlenet.internal` is the primary CI system. It builds the
Forgejo repository at `git.battlenet.internal`; Forgejo Actions is disabled on
that instance. The GitHub workflow remains available for the public mirror, but
it is not the working CI source of truth.

## Pipeline contract

`.woodpecker.yml` runs on branch pushes, pull requests, and manual runs. A green
pipeline proves:

- root TypeScript typecheck;
- engine and server builds;
- production web build before tests (the web artifact tests require it);
- the complete Vitest suite;
- shared iOS app typecheck; and
- production Docker image build plus a live `/health` smoke test.

The pipeline uses the same Node 25 base as the development and production
Dockerfiles. It requires no project secrets.

Validate pipeline syntax against the server's Woodpecker version before push:

```sh
docker run --rm -v "$PWD:/workspace" -w /workspace \
  woodpeckerci/woodpecker-cli:v3.17.0 lint .woodpecker.yml
```

## One-time Forgejo and Woodpecker setup

The working Git remote is:

```sh
git remote add battlenet ssh://git@git.battlenet.internal:30022/liamp/Chopsticks.git
```

Create the private Forgejo repository without initial files, push the existing
`main` baseline, then push this branch and activate the repository in
Woodpecker. The repository must have Woodpecker
`security` trust enabled because the production-image check starts a privileged
Docker-in-Docker service. Volume and host-network trust are not needed.

Both services can be managed from the CLI once their personal access tokens are
exported for the current shell. Do not commit either token:

```sh
# Forgejo CLI login can also be created interactively with: tea login add --oauth
tea repo create --login battlenet --name Chopsticks --private
git push battlenet main
git push -u battlenet HEAD
git config remote.pushDefault battlenet
git branch --set-upstream-to=battlenet/main main

# Find the Forgejo repository id, activate it, then enable only security trust.
FORGEJO_REPO_ID="$(tea api --login battlenet repos/liamp/Chopsticks | jq -r .id)"
docker run --rm \
  -e WOODPECKER_SERVER=https://ci.battlenet.internal \
  -e WOODPECKER_TOKEN \
  woodpeckerci/woodpecker-cli:v3.17.0 repo add "$FORGEJO_REPO_ID"
docker run --rm \
  -e WOODPECKER_SERVER=https://ci.battlenet.internal \
  -e WOODPECKER_TOKEN \
  woodpeckerci/woodpecker-cli:v3.17.0 repo update \
  --unsafe --trusted-security liamp/Chopsticks

# Trigger the first run after activation (the earlier push predates its webhook).
docker run --rm \
  -e WOODPECKER_SERVER=https://ci.battlenet.internal \
  -e WOODPECKER_TOKEN \
  woodpeckerci/woodpecker-cli:v3.17.0 pipeline start liamp/Chopsticks
```

The Woodpecker token is available from the user's Woodpecker profile. The
Forgejo token can be created through `tea login add --oauth` or Forgejo's
Applications settings. Keep tokens in a password manager or ephemeral shell
environment, never in Git configuration, pipeline YAML, or repository secrets.

## Branch and pull-request flow

Never push directly to `main`. Branch from the current Forgejo `main`, push the
phase branch, and open a Forgejo pull request:

```sh
git switch main
git pull --ff-only battlenet main
git switch -c codex/<topic>
# edit, verify, commit
git push -u battlenet HEAD
tea pr create --login battlenet --repo liamp/Chopsticks \
  --base main --head "$(git branch --show-current)" \
  --title "..." --description "..."
```

Require the Woodpecker pipeline to pass before merging. GitHub mirroring is a
separate milestone operation and must not bypass the Forgejo PR gate. The
authoritative mirror procedure is in `AGENTS.md`: push a temporary branch from
the exact green `battlenet/main` state, open a GitHub PR, wait for its checks,
and merge it with a merge commit. Never push `origin/main` directly or use
squash/rebase for mirror PRs.

## Local parity check

Run the same verification contract through the development container:

```sh
docker compose build
docker compose up -d
docker compose exec -T dev npm ci
docker compose exec -T dev npm run typecheck
docker compose exec -T dev npm run build
docker compose exec -T dev npm run build:server
docker compose exec -T dev npm run web:build
docker compose exec -T dev npm test
docker compose exec -T dev npm --prefix ios-app run typecheck
docker build -f Dockerfile.prod -t chopsticks/server:ci .
```
