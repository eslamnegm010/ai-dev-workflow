#!/usr/bin/env bash
# Scaffolds the ai-dev-workflow files into the current git repo. Never overwrites an existing file.
# Usage: init.sh [--project <Name>] [--implementer-model opus|sonnet|haiku|inherit] [--reviewer-model opus|sonnet|haiku|inherit]
#                [--gate-name <name>] [--design] [--flutter] [--no-attribution]
#   --design          copy capture/compare/PDF tools to tool/design and a capture config + design README
#   --flutter         copy the Flutter golden helpers (prints where they go)
#   --no-attribution  commits/PRs carry no AI attribution trailer (.claude/settings.json)
set -euo pipefail
skill="$(cd "$(dirname "$0")/.." && pwd)"
root="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "not a git repo (run git init first)" >&2; exit 2; }
project="$(basename "$root")" impl=opus rev=opus gate="" design=0 flutter=0 noattr=0
while [[ $# -gt 0 ]]; do case "$1" in
  --project) project="$2"; shift 2 ;;
  --implementer-model) impl="$2"; shift 2 ;;
  --reviewer-model) rev="$2"; shift 2 ;;
  --gate-name) gate="$2"; shift 2 ;;
  --design) design=1; shift ;;
  --flutter) flutter=1; shift ;;
  --no-attribution) noattr=1; shift ;;
  -h|--help) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "unknown option $1" >&2; exit 2 ;;
esac; done
slug="$(tr '[:upper:] ' '[:lower:]-' <<<"$project")"
gate="${gate:-$slug-quality-gate}"
today="$(date +%Y-%m-%d)"
attr_note=""; (( noattr )) && attr_note=" with no attribution trailer"

render() { sed -e "s|{{PROJECT}}|$project|g" -e "s|{{GATE_NAME}}|$gate|g" -e "s|{{DATE}}|$today|g" \
  -e "s|{{IMPLEMENTER_MODEL}}|$impl|g" -e "s|{{REVIEWER_MODEL}}|$rev|g" -e "s|{{ATTRIBUTION_NOTE}}|$attr_note|g" "$1"; }
put() { # put <source> <target-relative-to-root> [mode]
  local target="$root/$2"
  if [[ -e "$target" ]]; then echo "kept     $2"; return 1; fi
  mkdir -p "$(dirname "$target")"; render "$1" >"$target"; [[ -n "${3:-}" ]] && chmod "$3" "$target"
  echo "created  $2"
}

if [[ -e "$root/CLAUDE.md" ]]; then
  render "$skill/templates/CLAUDE.md" >"$root/CLAUDE.workflow.md"
  echo "exists   CLAUDE.md → wrote CLAUDE.workflow.md: merge its sections (§6–§8, Roles, compaction) by hand, then delete it"
else put "$skill/templates/CLAUDE.md" CLAUDE.md || true; fi
put "$skill/references/workflow.md" docs/WORKFLOW.md || true
put "$skill/templates/agents/implementer.md" .claude/agents/implementer.md || true
put "$skill/templates/agents/reviewer.md" .claude/agents/reviewer.md || true
put "$skill/templates/gate-skill.md" ".claude/skills/$gate/SKILL.md" || true
put "$skill/templates/gate-steps.txt" tool/gate/steps.txt || true
put "$skill/scripts/gate/run-gate.sh" tool/gate/run-gate.sh 755 || true
put "$skill/templates/docs/plan.md" docs/plans/_template.md || true
put "$skill/templates/docs/adr.md" docs/adr/0000-template.md || true
put "$skill/templates/docs/discrepancies.md" docs/discrepancies.md || true
put "$skill/templates/docs/traceability.md" docs/traceability/phase-1.md || true
put "$skill/templates/docs/reference-doc.md" docs/reference/_template.md || true
put "$skill/templates/docs/research-note.md" docs/research/_template.md || true
put "$skill/templates/docs/pr-body.md" .github/pull_request_template.md || true

if (( design )); then
  for f in capture.mjs compare.mjs md_to_pdf.mjs package.json; do put "$skill/scripts/design/$f" "tool/design/$f" || true; done
  put "$skill/templates/design/capture.config.json" design/capture.config.json || true
  put "$skill/templates/design/README.md" design/README.md || true
  mkdir -p "$root/design/prototype" "$root/design/reference" "$root/design/annotations"
fi
if (( flutter )); then
  mkdir -p "$root/tool/flutter-goldens"
  for f in "$skill"/scripts/flutter-goldens/*; do put "$f" "tool/flutter-goldens/$(basename "$f")" || true; done
  echo "         → copy tool/flutter-goldens/* into each package's test/ as its README says, then delete the folder"
fi
if (( noattr )) && [[ ! -e "$root/.claude/settings.json" ]]; then
  printf '{\n  "attribution": { "commit": "", "pr": "", "sessionUrl": false }\n}\n' >"$root/.claude/settings.json"
  echo "created  .claude/settings.json (no attribution)"
fi

for ignore in build/gate build/design-compare '**/failures/'; do
  grep -qxF "$ignore" "$root/.gitignore" 2>/dev/null || { echo "$ignore" >>"$root/.gitignore"; echo "ignored  $ignore"; }
done

cat <<EOF

Next (the main session, see SKILL.md "Setup"):
  1. Record the roles in CLAUDE.md §8 (implementer: $impl, reviewer: $rev) — already filled; adjust notes.
  2. Fill CLAUDE.md §1–§5 with this project's facts; copy project rules into .claude/agents/*.md.
  3. Put the real commands in tool/gate/steps.txt and run: tool/gate/run-gate.sh --all
  4. Commit on a branch, open a PR, merge.
EOF
