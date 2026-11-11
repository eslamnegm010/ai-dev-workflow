#!/usr/bin/env bash
# Installs the skills in this repo into Claude Code as symlinks (git pull updates them).
# Usage: ./install.sh [--copy] [--remove]   ·   CLAUDE_SKILLS_DIR=<dir> for another target
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
mode=link; [[ "${1:-}" == --copy ]] && mode=copy; [[ "${1:-}" == --remove ]] && mode=remove
mkdir -p "$target"
for dir in "$repo"/skills/*/; do
  name="$(basename "$dir")"; dest="$target/$name"
  if [[ $mode == remove ]]; then rm -rf "$dest"; echo "removed  $name"; continue; fi
  if [[ -e "$dest" && ! -L "$dest" ]]; then echo "skipped  $name (a non-symlink already exists at $dest)"; continue; fi
  rm -f "$dest"
  if [[ $mode == copy ]]; then cp -R "$dir" "$dest"; else ln -s "${dir%/}" "$dest"; fi
  echo "installed $name → $dest"
done
