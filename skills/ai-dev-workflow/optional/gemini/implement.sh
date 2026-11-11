#!/usr/bin/env bash
# Runs an external implementer (Antigravity CLI by default) on a plan file in its own git worktree.
#
# Usage (from inside the project repo): ~/.claude/skills/ai-dev-workflow/optional/gemini/implement.sh <plan-file> <branch> [options]
#   --model <name>   agy model label (default gemini-3.8-flash-high; `agy models` lists them)
#   --brief <file>   extra notes appended to the brief (a fix round's findings with --resume)
#   --resume         continue the agent's last conversation on this branch (fix rounds keep its context)
#   --read-only      second-opinion review: agy's sandbox + plan mode, no edits survive
#   --no-watch       do not open the live Terminal window or the worktree in an editor window
#   --cli gemini     use Gemini CLI instead (needs a paid GEMINI_API_KEY)
#
# Exit: 0 success · 3 the agent reported a failure · 4 no changes · 5 read-only run changed files · 124 timeout · 125 stalled.
set -euo pipefail

# --- Settings: defaults here, overridden by <repo>/.claude/implementer.env ---
script_dir="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
repo_name="$(basename "$root")"
# Per-project settings live in the repo, the scripts stay in the skill folder (nothing is copied).
[[ -f "$root/.claude/implementer.env" ]] && source "$root/.claude/implementer.env"
WORKTREES_BASE="${WORKTREES_BASE:-$HOME/.worktrees/$repo_name}"
BASE_BRANCH="${BASE_BRANCH:-HEAD}"
GATE_NAME="${GATE_NAME:-quality-gate}"
DEFAULT_MODEL="${DEFAULT_MODEL:-gemini-3.8-flash-high}"
SYMLINKS="${SYMLINKS:-node_modules .venv}"

plan="${1:?plan file}"
branch="${2:?branch}"
shift 2
model=""
cli="agy"
brief=""
resume=0
watch=1
read_only=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --model) model="$2"; shift 2 ;;
    --cli) cli="$2"; shift 2 ;;
    --brief) brief="$2"; shift 2 ;;
    --resume) resume=1; shift ;;
    --read-only) read_only=1; shift ;;
    --no-watch) watch=0; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
if [[ -n "$brief" && "$brief" != /* ]]; then brief="$root/$brief"; fi
[[ -z "$brief" || -f "$brief" ]] || { echo "brief not found: $brief" >&2; exit 2; }
[[ -n "$model" ]] || { [[ "$cli" == "agy" ]] && model="$DEFAULT_MODEL" || model="gemini-3.1-pro-preview"; }

base="$WORKTREES_BASE"
name="${branch//\//-}"
wt="$base/$name"
[[ -f "$root/$plan" || -f "$wt/$plan" ]] || { echo "plan not found: $plan" >&2; exit 2; }
logs="$base/_logs"
log="$logs/$name-$(date +%Y%m%d-%H%M%S)"
conv_file="$logs/$name.conversation"
mkdir -p "$logs"

new_worktree=0
if [[ ! -d "$wt" ]]; then
  new_worktree=1
  if git -C "$root" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$root" worktree add -q "$wt" "$branch"
  else
    git -C "$root" worktree add -q -b "$branch" "$wt" "$BASE_BRANCH"
  fi
fi

# Parallel runs collide on the .git/config lock: write it only once.
[[ "$(git -C "$root" config --get extensions.worktreeConfig)" == true ]] || git -C "$root" config extensions.worktreeConfig true
git -C "$wt" config --worktree remote.origin.pushurl "no-push://the-main-session-owns-git"
if [[ ! -f "$wt/$plan" ]]; then
  mkdir -p "$(dirname "$wt/$plan")"
  cp "$root/$plan" "$wt/$plan"
fi

for link in $SYMLINKS; do
  if [[ -e "$root/$link" ]]; then
    mkdir -p "$(dirname "$wt/$link")"
    ln -sfn "$root/$link" "$wt/$link"
  fi
done

if [[ $resume -eq 1 ]]; then
  [[ -n "$brief" && -f "$conv_file" ]] || { echo "--resume needs --brief and an earlier run on this branch" >&2; exit 2; }
  prompt="<task>
Fix round on the plan $plan. Apply the findings below to your work in this worktree and keep everything else.
</task>

<findings>
$(cat "$brief")
</findings>

<verification_loop>
Run the full ${GATE_NAME} again, in the foreground, and make every step green before finishing.
</verification_loop>

<structured_output_contract>
End with an updated report: each finding and how you fixed it, files touched, the gate result per step.
</structured_output_contract>"
elif [[ $read_only -eq 1 ]]; then
  prompt="<task>
Read-only review. Review the uncommitted changes in this worktree (git diff, new files) against the plan $plan,
AGENTS.md and the project's sources of truth. Change nothing.
</task>

<structured_output_contract>
Report: (1) Must fix — defects or plan violations with file:line, (2) Should fix, (3) what is correct. Be concrete.
</structured_output_contract>"
else
  prompt="<task>
You are the implementer described in AGENTS.md. Implement the plan in $plan exactly, in this worktree, on branch
$branch. Read AGENTS.md and the plan first, then the files the plan names. Touch only what the plan lists.
</task>

<verification_loop>
Run the full gate from the ${GATE_NAME} skill and make every step green before finishing; fix what it
surfaces instead of reporting it. Run every command in the foreground and wait for it to finish: never start a
background task and never end your reply while a command is still running. Afterwards confirm that git status shows
only the intended changes.
</verification_loop>

<action_safety>
Keep changes scoped to the plan: no unrelated refactors, renames or cleanup. Do NOT git add, commit or push; leave
the work uncommitted in the worktree for review.
</action_safety>

<structured_output_contract>
End with the report AGENTS.md describes: (1) what changed per plan section, (2) files touched with line counts,
(3) each gate step with its last output line and test counts, (4) deviations, open points or decisions needed.
</structured_output_contract>"
  if [[ -n "$brief" ]]; then
    prompt="$prompt

<extra_notes>
$(cat "$brief")
</extra_notes>"
  fi
fi
printf '%s\n' "$prompt" >"$log.prompt.md"
printf '{"plan":"%s","branch":"%s","model":"%s","worktree":"%s","readOnly":%s}\n' \
  "$plan" "$branch" "$model" "$wt" "$([[ $read_only -eq 1 ]] && echo true || echo false)" >"$log.meta.json"

if [[ $watch -eq 1 && $new_worktree -eq 1 ]] && command -v code >/dev/null; then
  code -n "$wt" >/dev/null 2>&1 || true
fi

echo "worktree: $wt"
echo "log:      $log.*"
echo "model:    $cli · $model"

status=0
gh_config="$(mktemp -d)"
case "$cli" in
  agy)
    : >"$log.jsonl"
    if [[ $watch -eq 1 ]] && ! pgrep -f "watch.mjs --branch $name\$" >/dev/null; then
      osascript -e "tell application \"Terminal\" to do script \"clear; WORKTREES_LOGS_DIR='$logs' node '$script_dir/watch.mjs' --branch $name\"" \
        -e 'tell application "Terminal" to activate' >/dev/null 2>&1 || true
    fi
    run_args=(--cwd "$wt" --prompt-file "$log.prompt.md" --jsonl "$log.jsonl" --result "$log.json" --model "$model")
    [[ $resume -eq 1 ]] && run_args+=(--conversation "$(cat "$conv_file")")
    [[ $read_only -eq 1 ]] && run_args+=(--read-only)
    GH_CONFIG_DIR="$gh_config" GIT_TERMINAL_PROMPT=0 node "$script_dir/agy-run.mjs" "${run_args[@]}" \
      2>"$log.err" || status=$?
    ;;
  gemini)
    (cd "$wt" && GH_CONFIG_DIR="$gh_config" GIT_TERMINAL_PROMPT=0 gemini \
      -p "$prompt" -m "$model" --approval-mode yolo --skip-trust \
      --admin-policy "$script_dir/gemini-policy.toml" \
      -o json >"$log.json" 2>"$log.err") || status=$?
    ;;
  *) echo "unknown cli: $cli" >&2; exit 2 ;;
esac

node - "$log.json" "$log.md" "$conv_file" <<'NODE' || true
const fs = require('fs');
const [jsonPath, mdPath, convPath] = process.argv.slice(2);
let r = {};
try { r = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch {}
const id = r.conversationId ?? r.session_id;
if (id && r.readOnly !== true) fs.writeFileSync(convPath, id);
const files = (r.touchedFiles ?? []).map((f) => `| ${f.state} | \`${f.path}\` | +${f.added} −${f.removed} |`);
const report = String(r.finalMessage ?? r.response ?? '').replace(/\[([^\]]+)\]\(file:\/\/[^)]+\)/g, '$1');
fs.writeFileSync(mdPath, [
  `# Implementer run — ${r.status ?? 'unknown'}`,
  '',
  `- Model: ${r.model ?? '—'} · ${r.durationSeconds ?? '?'} s · tokens ${r.usage?.total_tokens ?? '—'}`,
  `- Agent status: ${r.agyStatus ?? '—'}${r.error ? ` · error: ${JSON.stringify(r.error)}` : ''}`,
  '',
  '## Changed files',
  '| State | File | Lines |',
  '|---|---|---|',
  ...files,
  '',
  '## Agent report',
  report,
].join('\n'));
NODE

echo "status:   $(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).status)}catch{console.log("unknown")}' "$log.json")"
echo "exit:     $status"
echo "report:   $log.md"
exit "$status"
