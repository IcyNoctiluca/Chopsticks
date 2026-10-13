# Continuous integration

Woodpecker at `ci.battlenet.l-p.dev` is the only CI system. It builds the
canonical Forgejo repository at `git.battlenet.l-p.dev`; Forgejo Actions is
disabled on that instance. GitHub `IcyNoctiluca/Chopsticks` is a read-only push
mirror that Forgejo updates on every commit (Battlenet progress 0274). GitHub
Actions is disabled there, so `.github/workflows/ci.yml` no longer runs.

## Pipeline contract

`.woodpecker.yml` runs for Forgejo pull requests, pushes to `main`, and manual
runs. Feature-branch pushes are deliberately excluded because Forgejo also
sends a pull-request event for each PR update; running both would queue the same
verification twice on the wake-on-demand, single-workflow runner. A green
pipeline proves:

- root TypeScript typecheck;
- engine and server builds;
- production web build before tests (the web artifact tests require it);
- the complete Vitest suite;
- shared iOS app typecheck; and
- production Docker image build plus a live `/health` smoke test.

The pipeline uses the same Node 25 base as the development and production
Dockerfiles. The image smoke step waits for its Docker-in-Docker service to be
ready, which is necessary even when a warm dependency cache makes the verify
step finish quickly. It requires no project secrets.

On `main`, `publish` builds with a layer cache carried in Zot (Battlenet
progress 0385). `Dockerfile.prod`'s `deps` stage (`package.json` and the
lockfile, `npm ci`) is listed in `cache_stages` and cached as
`buildcache-deps-<arch>`; `builder` starts from it and adds the source. Keep
the source out of `deps`, or every commit reinstalls every dependency.

Validate pipeline syntax against the server's Woodpecker version before push:

```sh
docker run --rm -v "$PWD:/workspace" -w /workspace \
  woodpeckerci/woodpecker-cli:v3.17.0 lint .woodpecker.yml
```

## One-time Forgejo and Woodpecker setup

The working Git remote is:

```sh
git remote add origin ssh://git@git.battlenet.l-p.dev:30022/liamp/Chopsticks.git
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
tea repo create --login battlenet-lp --name Chopsticks --private
git push origin main
git push -u origin HEAD
git branch --set-upstream-to=origin/main main

# GitHub is not configured here: Forgejo's push mirror (Battlenet
# `forgejo_push_mirrors`) replicates to it. Keep a fetch-only copy of it:
git remote add github git@github.com:IcyNoctiluca/Chopsticks.git
git remote set-url --push github DISABLED-mirror-only-see-AGENTS.md

# Find the Forgejo repository id, activate it, then enable only security trust.
FORGEJO_REPO_ID="$(tea api --login battlenet-lp repos/liamp/Chopsticks | jq -r .id)"
WOODPECKER_REPO="$(curl -fsS -X POST \
  -H "Authorization: Bearer $WOODPECKER_TOKEN" \
  "https://ci.battlenet.l-p.dev/api/repos?forge_remote_id=$FORGEJO_REPO_ID")"
WOODPECKER_REPO_ID="$(printf '%s' "$WOODPECKER_REPO" | jq -r .id)"
curl -fsS -X PATCH \
  -H "Authorization: Bearer $WOODPECKER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"trusted":{"security":true,"volumes":false,"network":false}}' \
  "https://ci.battlenet.l-p.dev/api/repos/$WOODPECKER_REPO_ID" | \
  jq '{id,full_name,active,trusted}'

# Trigger the first run after activation (the earlier push predates its webhook).
CURRENT_BRANCH="$(git branch --show-current)"
jq -n --arg branch "$CURRENT_BRANCH" '{branch:$branch,variables:{}}' | \
  curl -fsS -X POST \
    -H "Authorization: Bearer $WOODPECKER_TOKEN" \
    -H 'Content-Type: application/json' \
    -d @- \
    "https://ci.battlenet.l-p.dev/api/repos/$WOODPECKER_REPO_ID/pipelines" | \
  jq '{id,number,status,event,branch,commit}'
unset WOODPECKER_TOKEN
```

The Woodpecker token is available from the user's Woodpecker profile. The
Forgejo token can be created through `tea login add --oauth` or Forgejo's
Applications settings. Keep tokens in a password manager or ephemeral shell
environment, never in Git configuration, pipeline YAML, or repository secrets.
Rotate any token disclosed outside that boundary.

## Branch and pull-request flow

Never push directly to `main`. Branch from the current Forgejo `main`, push the
phase branch, and open a Forgejo pull request:

```sh
git switch main
git pull --ff-only origin main
git switch -c codex/<topic>
# edit, verify, commit
git push -u origin HEAD
tea pr create --login battlenet-lp --repo liamp/Chopsticks \
  --base main --head "$(git branch --show-current)" \
  --title "..." --description "..."
```

Require the Woodpecker pipeline to pass before merging. There is no mirror
step: Forgejo pushes every ref to GitHub itself, and never push to GitHub
directly (the next sync overwrites it). After merging a Forgejo PR, run
`git switch main && git pull --ff-only origin main`. See `AGENTS.md` for the
remote layout.

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
