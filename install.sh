#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Installing dependencies for all packages..."

npm i --prefix "$ROOT/mobile" &
npm i --prefix "$ROOT/admin" &
npm i --prefix "$ROOT/backend" &

wait

echo "All done!"
