#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
BASE_REVISION="${2:-origin/main}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v bits >/dev/null 2>&1; then
  echo "bits is required. Install it with: cargo install --git https://github.com/12bitsD/bits-style --tag v0.3.5 --locked" >&2
  exit 2
fi

ROOT="$(cd "$ROOT" && pwd)"
cd "$ROOT"

if [ ! -f bits.toml ]; then
  cp "$SKILL_DIR/templates/bits.toml" bits.toml
fi

if [ ! -f AGENTS.md ]; then
  cp "$SKILL_DIR/templates/AGENTS.md" AGENTS.md
fi

mkdir -p .github/workflows
if [ ! -f .github/workflows/bits.yml ]; then
  cp "$SKILL_DIR/templates/ci.yml" .github/workflows/bits.yml
fi

if [ ! -f bits-baseline.json ]; then
  bits style report . --output bits-baseline.json
fi

printf 'Bits style initialized. Baseline revision for future checks: %s\n' "$BASE_REVISION"
printf 'Review: bits style check --diff --commit %s\n' "$BASE_REVISION"
