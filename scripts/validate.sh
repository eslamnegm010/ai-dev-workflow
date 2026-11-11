#!/usr/bin/env bash
# Checks the repo before a push: skill front matter, shell and Node syntax, no leftover placeholders in scripts.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"; fail=0
for skill in "$repo"/skills/*/SKILL.md; do
  head -1 "$skill" | grep -qx -- '---' || { echo "✗ $skill: no front matter"; fail=1; }
  grep -q '^name: ' "$skill" && grep -q '^description: ' "$skill" || { echo "✗ $skill: name/description missing"; fail=1; }
done
while IFS= read -r f; do bash -n "$f" || { echo "✗ $f"; fail=1; }; done < <(find "$repo" -name '*.sh' -not -path '*/node_modules/*' -not -path '*/.git/*')
while IFS= read -r f; do node --check "$f" 2>/dev/null || { echo "✗ $f"; fail=1; }; done < <(find "$repo" -name '*.mjs' -not -path '*/node_modules/*')
(( fail )) && exit 1; echo "✓ valid"
