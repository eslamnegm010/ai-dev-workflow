#!/usr/bin/env bash
# Opens the live view of the most recent implementer run (or replays a finished one).
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
repo_name="$(basename "$repo_root")"
[[ -f "$repo_root/.claude/implementer.env" ]] && source "$repo_root/.claude/implementer.env"
worktrees_base="${WORKTREES_BASE:-$HOME/.worktrees/$repo_name}"
logs_dir="${WORKTREES_LOGS_DIR:-$worktrees_base/_logs}"
latest="$(ls -t "$logs_dir"/*.jsonl 2>/dev/null | head -1)"
[[ -n "$latest" ]] || { echo "no runs yet in $logs_dir" >&2; exit 1; }
name="$(basename "$latest" .jsonl)"
WORKTREES_LOGS_DIR="$logs_dir" exec node "$script_dir/watch.mjs" --branch "${name%-*-*}"
