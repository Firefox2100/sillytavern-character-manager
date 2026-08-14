#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly NODE_IMAGE="node:22-alpine"

if ! command -v docker >/dev/null 2>&1; then
    echo "Error: Docker is not installed or is not available in PATH." >&2
    exit 1
fi

DOCKER=(docker)

if ! docker info >/dev/null 2>&1; then
    if ! command -v sudo >/dev/null 2>&1; then
        echo "Error: Docker is not usable by the current user and sudo is unavailable." >&2
        exit 1
    fi

    echo "Docker requires elevated privileges; sudo may ask for your password."
    sudo -v
    DOCKER=(sudo docker)

    if ! "${DOCKER[@]}" info >/dev/null 2>&1; then
        echo "Error: unable to connect to the Docker daemon, including with sudo." >&2
        exit 1
    fi
fi

if ! "${DOCKER[@]}" compose version >/dev/null 2>&1; then
    echo "Error: the Docker Compose plugin ('docker compose') is not installed." >&2
    exit 1
fi

cd "$SCRIPT_DIR"

if [[ ! -f "$SCRIPT_DIR/directus-snapshot.json" ]]; then
    echo "Error: directus-snapshot.json was not found in the project root." >&2
    exit 1
fi

echo "Pulling application and Directus images..."
"${DOCKER[@]}" compose pull

echo "Pulling the Node.js extension builder image..."
"${DOCKER[@]}" pull "$NODE_IMAGE"

echo "Building Directus extensions..."
extension_count=0
while IFS= read -r -d '' extension_dir; do
    if [[ ! -f "$extension_dir/package.json" ]]; then
        continue
    fi

    extension_count=$((extension_count + 1))
    extension_name="$(basename -- "$extension_dir")"
    echo "Building extension: $extension_name"

    "${DOCKER[@]}" run --rm \
        --user "$(id -u):$(id -g)" \
        --mount "type=bind,src=$extension_dir,dst=/extension" \
        --mount "type=volume,dst=/extension/node_modules" \
        --workdir /extension \
        --env HOME=/tmp \
        --env npm_config_cache=/tmp/npm-cache \
        "$NODE_IMAGE" \
        sh -c 'npm ci && npm run build'
done < <(find "$SCRIPT_DIR/extensions" -mindepth 1 -maxdepth 1 -type d -print0)

if (( extension_count == 0 )); then
    echo "No Directus extensions with a package.json were found."
fi

echo "Bootstrapping Directus and applying the schema snapshot..."
"${DOCKER[@]}" compose run --rm --no-deps directus \
    sh -c 'npx directus bootstrap && npx directus schema apply --yes /directus/directus-snapshot.json'

echo "Starting services..."
"${DOCKER[@]}" compose up -d

echo "Services are running at http://localhost:8769"
