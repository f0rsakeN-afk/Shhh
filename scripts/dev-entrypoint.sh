#!/bin/sh
# Dev container entrypoint: keep the dependency volume in sync with the
# lockfile, then hand the process over to Next so signals reach it directly.
set -eu

cd /app

# A bind mount hides the image's node_modules; the named volume at
# /app/node_modules is seeded from the image once. Reinstall only when the
# manifest or lockfile is newer than the stamp from the previous install, so a
# normal restart costs nothing while `bun add ...` still works out of the box.
STAMP=/app/node_modules/.shhh-install-stamp
if [ ! -f "$STAMP" ] ||
  [ /app/package.json -nt "$STAMP" ] ||
  [ /app/bun.lock -nt "$STAMP" ]; then
  if [ ! -w /app/node_modules ]; then
    echo "[dev] /app/node_modules is not writable by uid $(id -u)." >&2
    echo "[dev] Recreate the dev volumes after changing DOCKER_UID/DOCKER_GID:" >&2
    echo "[dev]   docker compose -f docker-compose.dev.yml down -v" >&2
    exit 1
  fi

  echo "[dev] package.json/bun.lock changed — installing dependencies"
  bun install --frozen-lockfile
  touch "$STAMP"
fi

# Writable, per-UID cache: the image's /tmp is not guaranteed to be owned by
# the UID compose maps in, and Bun must never fail because of a cache path.
CACHE_DIR="${TMPDIR:-/tmp}/bun-cache"
mkdir -p "$CACHE_DIR"
export BUN_INSTALL_CACHE_DIR="$CACHE_DIR"

# `bun run dev -- ...` forwards the flags to `next dev`; binding 0.0.0.0 is
# what makes the port reachable from outside the container.
exec bun run dev -- --hostname 0.0.0.0 --port 3000
