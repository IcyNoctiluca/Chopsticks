# Development image for the Chopsticks engine.
# Keeps all tooling, dependencies, and build artefacts inside the container
# so nothing spills onto the host machine.
FROM node:25-slim

WORKDIR /app

# Copy manifests first for better layer caching.
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies) for typecheck/test/build.
RUN npm ci

# Copy the rest of the source. The host workspace is also bind-mounted
# in docker-compose for live editing; this COPY seeds the image for
# non-mounted runs (e.g. CI).
COPY . .

# Default command keeps the container alive so `docker compose exec` can
# run arbitrary commands against the isolated environment.
CMD ["sleep", "infinity"]