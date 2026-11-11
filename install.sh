#!/usr/bin/env bash
# Installs the ai-dev-workflow skill into Claude Code (~/.claude/skills) as a symlink, so an update is one command.
#
#   curl -fsSL https://raw.githubusercontent.com/eslamnegm010/ai-dev-workflow/main/install.sh | bash
#   ~/.ai-dev-workflow/install.sh             install (or relink)
#   ~/.ai-dev-workflow/install.sh --update    git pull, then relink
#   ~/.ai-dev-workflow/install.sh --remove    uninstall
#   ~/.ai-dev-workflow/install.sh --status    show what is installed
# Options: --copy (copy instead of symlink) · --force (replace a same-named skill from elsewhere; the old one is moved
# to ~/.claude/skills-backup/<time>/) · CLAUDE_SKILLS_DIR=<dir> (another target) · AI_DEV_WORKFLOW_HOME=<dir> (clone dir)
set -euo pipefail
url="https://github.com/eslamnegm010/ai-dev-workflow.git"
home="${AI_DEV_WORKFLOW_HOME:-$HOME/.ai-dev-workflow}"
target="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

# Piped from curl (no file on disk) or run outside a clone: clone first, then hand over to the cloned script.
self="${BASH_SOURCE[0]:-}"
if [[ -z "$self" || ! -f "$self" || ! -d "$(dirname "$self")/skills" ]]; then
  command -v git >/dev/null || { echo "git is required" >&2; exit 2; }
  if [[ -d "$home/.git" ]]; then git -C "$home" pull --ff-only -q; else git clone -q "$url" "$home"; fi
  echo "cloned     $home"
  exec bash "$home/install.sh" "$@"
fi
repo="$(cd "$(dirname "$self")" && pwd)"

mode=install copy=0 force=0
while [[ $# -gt 0 ]]; do case "$1" in
  --update) mode=update; shift ;;
  --remove) mode=remove; shift ;;
  --status) mode=status; shift ;;
  --copy) copy=1; shift ;;
  --force) force=1; shift ;;
  -h|--help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "unknown option $1 (see --help)" >&2; exit 2 ;;
esac; done

skills=(); for d in "$repo"/skills/*/; do [[ -f "$d/SKILL.md" ]] && skills+=("$(basename "$d")"); done
from_here() { [[ -L "$target/$1" && "$(readlink "$target/$1")" == "$repo/skills/$1" ]] ||
  [[ -f "$target/$1/.installed-from" && "$(cat "$target/$1/.installed-from")" == "$repo" ]]; }

case $mode in
  status)
    for n in "${skills[@]}"; do
      if from_here "$n"; then s="installed"; elif [[ -e "$target/$n" ]]; then s="other copy"; else s="-"; fi
      printf '  %-20s %s\n' "$n" "$s"
    done
    exit 0 ;;
  remove)
    for n in "${skills[@]}"; do
      if from_here "$n"; then rm -rf "${target:?}/$n"; echo "removed    $n"; else echo "skipped    $n (not installed from here)"; fi
    done
    exit 0 ;;
  update) git -C "$repo" pull --ff-only; echo "updated    $(git -C "$repo" log -1 --format='%h %s')" ;;
esac

mkdir -p "$target"; backup=""
for n in "${skills[@]}"; do
  dest="$target/$n"
  if [[ -e "$dest" || -L "$dest" ]] && ! from_here "$n"; then
    if (( !force )); then echo "skipped    $n (another copy exists at $dest; --force replaces it, keeping a backup)"; continue; fi
    backup="${backup:-$HOME/.claude/skills-backup/$(date +%Y%m%d-%H%M%S)}"; mkdir -p "$backup"; mv "$dest" "$backup/$n"
    echo "backed up  $n -> $backup/$n"
  fi
  rm -rf "$dest"
  if (( copy )); then cp -R "$repo/skills/$n" "$dest"; echo "$repo" >"$dest/.installed-from"; echo "copied     $n -> $dest"
  else ln -s "$repo/skills/$n" "$dest"; echo "linked     $n -> $dest"; fi
done
echo "Start a new Claude Code session to load it. Then, in any repo: \"set up the AI dev workflow here\"."
