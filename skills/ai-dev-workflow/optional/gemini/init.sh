#!/usr/bin/env bash
# Scaffolds the per-project files of the Gemini implementer workflow. Run from inside the project repo.
# Usage: ~/.claude/skills/ai-dev-workflow/optional/gemini/init.sh [gate-name]
# Never overwrites an existing file. The scripts themselves stay in the skill folder: nothing is copied.
set -euo pipefail
skill_dir="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "not a git repo: run git init and make a first commit" >&2; exit 2; }
git -C "$root" rev-parse --verify -q HEAD >/dev/null || { echo "no commits yet: worktrees need a first commit" >&2; exit 2; }
repo_name="$(basename "$root")"
gate="${1:-$repo_name-quality-gate}"
agy="${AGY:-$HOME/.local/bin/agy}"
[[ -x "$agy" ]] || echo "warning: agy not found at $agy (install Antigravity CLI or set AGY)" >&2

put() { # put <template> <target>
  local target="$root/$2"
  if [[ -e "$target" ]]; then echo "kept     $2"; return; fi
  mkdir -p "$(dirname "$target")"
  sed -e "s|{{GATE_NAME}}|$gate|g" -e "s|{{REPO_NAME}}|$repo_name|g" "$skill_dir/templates/$1" >"$target"
  echo "created  $2"
}
put implementer.env.template .claude/implementer.env
put AGENTS.md.template AGENTS.md
put quality-gate.SKILL.md.template ".agents/skills/$gate/SKILL.md"
put gemini-implement.SKILL.md.template .claude/skills/gemini-implement/SKILL.md
put implementer-log.md.template docs/agents/implementer-log.md
put gemini-settings.json.template .gemini/settings.json
mkdir -p "$root/docs/plans"

# A directory symlink only matches a gitignore pattern that has no trailing slash.
source "$root/.claude/implementer.env"
if [[ -f "$root/.gitignore" ]]; then
  for link in ${SYMLINKS:-node_modules .venv}; do
    if grep -qxE "/?$link/" "$root/.gitignore"; then
      sed -i '' -E "s|^(/?$link)/$|\1|" "$root/.gitignore"
      echo "fixed    .gitignore: $link/ -> $link"
    fi
  done
fi

cat <<EOF

Next (the main session does this, see SKILL.md "Adapt to the project"):
  1. Fill AGENTS.md with this project's rules (from CLAUDE.md, README, package scripts, lint config).
  2. Put the project's real commands in .agents/skills/$gate/SKILL.md and run each one once.
  3. Check SYMLINKS / BASE_BRANCH in .claude/implementer.env.
  4. Commit these files: a worktree only contains what is committed.
EOF
