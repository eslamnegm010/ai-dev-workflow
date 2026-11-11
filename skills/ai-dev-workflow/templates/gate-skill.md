---
name: {{GATE_NAME}}
description: The full {{PROJECT}} quality gate (analyze, format, guards, every package's tests). Use before finishing any code change, before every push, PR and merge.
---

# {{PROJECT}} quality gate

Run from the repo root: `tool/gate/run-gate.sh` (steps in `tool/gate/steps.txt`).
Conditional steps: `--only "<name>"` when their area changed (platform goldens, project-specific checks) — or `--all`.

Every step must pass. Fix the cause and re-run; never weaken a test, a lint or a guard to make it pass.
A golden failure is not fixed by regenerating unless the plan changes that screen: open the failure images first.

Report the printed table (pass/fail, time, last line per step) as is.
