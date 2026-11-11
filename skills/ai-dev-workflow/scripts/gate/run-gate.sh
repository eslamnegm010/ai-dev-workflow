#!/usr/bin/env bash
# Runs the project's quality gate from tool/gate/steps.txt and prints a Markdown result table.
# steps.txt: one step per line, "name | command" (runs from the repo root through bash -c). Lines starting with # and
# blank lines are skipped. A name starting with "?" is conditional: it runs only with --all or when named in --only.
#
# Usage: run-gate.sh [--only a,b] [--from <name>] [--all] [--keep-going] [--md <file>] [--steps <file>]
# Exit: 0 all passed · 1 a step failed · 2 usage error. Per-step logs: build/gate/<step>.log
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
steps_file="$root/tool/gate/steps.txt"
only="" from="" all=0 keep=0 md=""
while [[ $# -gt 0 ]]; do case "$1" in
  --only) only=",$2,"; shift 2 ;;
  --from) from="$2"; shift 2 ;;
  --all) all=1; shift ;;
  --keep-going) keep=1; shift ;;
  --md) md="$2"; shift 2 ;;
  --steps) steps_file="$2"; shift 2 ;;
  -h|--help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "unknown option $1" >&2; exit 2 ;;
esac; done
[[ -f "$steps_file" ]] || { echo "no steps file: $steps_file" >&2; exit 2; }

logs="$root/build/gate"; mkdir -p "$logs"
rows=() failed=0 started=$([[ -z "$from" ]] && echo 1 || echo 0)
fmt() { local s=$1; if (( s >= 60 )); then printf '%dm%02ds' $((s/60)) $((s%60)); else printf '%ds' "$s"; fi; }

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]] && continue
  name="$(sed -E 's/^[[:space:]]*([^|]*[^|[:space:]])[[:space:]]*\|.*/\1/' <<<"$line")"
  cmd="$(sed -E 's/^[^|]*\|[[:space:]]*//' <<<"$line")"
  conditional=0; [[ "$name" == \?* ]] && { conditional=1; name="${name#\?}"; }
  [[ "$name" == "$from" ]] && started=1
  (( started )) || continue
  if [[ -n "$only" ]]; then [[ "$only" == *",$name,"* ]] || continue
  elif (( conditional && !all )); then rows+=("| $name | ⏭ skipped | — | conditional (run with --only $name) |"); continue; fi

  log="$logs/$(tr ' /' '__' <<<"$name").log"
  printf '▶ %s\n' "$name" >&2
  t0=$SECONDS
  (cd "$root" && bash -c "$cmd") >"$log" 2>&1; code=$?
  dt=$(fmt $((SECONDS - t0)))
  last="$(grep -v '^[[:space:]]*$' "$log" | tail -n 1 | sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g; s/\|/\\|/g' | cut -c1-110)"
  if (( code == 0 )); then rows+=("| $name | ✅ pass | $dt | ${last:-—} |")
  else
    rows+=("| $name | ❌ fail ($code) | $dt | ${last:-—} |"); failed=1
    printf '  failed — log: %s\n' "${log#$root/}" >&2
    (( keep )) || break
  fi
done <"$steps_file"

sha="$(git -C "$root" rev-parse --short HEAD 2>/dev/null || echo '?')"
dirty="$([[ -n "$(git -C "$root" status --porcelain 2>/dev/null)" ]] && echo ' + uncommitted changes')"
table="Gate on \`$sha\`$dirty — $([[ $failed == 0 ]] && echo '**green**' || echo '**red**')

| Step | Result | Time | Last line |
|---|---|---|---|
$(printf '%s\n' "${rows[@]}")"
echo "$table"
[[ -n "$md" ]] && echo "$table" >"$md"
exit $failed
