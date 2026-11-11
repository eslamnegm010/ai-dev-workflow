# Implementer review, worktree isolation, and fault ratchets

## Worktree gitignore gotchas

- Git worktrees require an initial commit on the base repository before creation.
- Heavy directories (e.g. `node_modules`, `.venv`) and private directories linked into worktrees must be gitignored **without a trailing slash** (`node_modules` instead of `node_modules/`). A trailing slash causes git to treat symlinks pointing to directories as untracked files, crashing `agy-run.mjs` file scanning.
- Anchor root-level patterns with leading slashes (e.g. `/qa` rather than `qa/`) so subdirectories like `tools/qa/` are not accidentally ignored.
- Prevent external pushes by disabling worktree remote push URLs: `git config --worktree remote.origin.pushurl "no-push://reviewer-owns-git"`.

## The fault ratchet pattern

When adopting strict quality gates on an existing repository, existing flaws would normally break the gate immediately.
Instead of weakening checks or ignoring failures:
1. Measure baseline faults across the codebase and record numbers in a JSON file (e.g. `tools/qa/known.json`).
2. The gate script checks current counts against the recorded numbers:
   - If current count > recorded count: Gate fails (new regression introduced).
   - If current count <= recorded count: Gate passes.
3. The recorded numbers are a ratchet that **may only shrink**: when a task fixes faults, lower the numbers in the JSON file. Never raise them.

## Review discipline

Implementer agents can provide false positive summaries (e.g. reporting "colors unchanged" or "all models verified" when visual checks failed or were viewed at misleading camera angles).
- Never trust the agent's self-reported gate pass: re-run the gate independently.
- For visual tasks, demand objective numerical metrics (such as color measurements per band against reference images) and review angles that actually show the subject clearly.
- Structure review findings as numbered actionable items in a findings brief, then invoke `--brief <file> --resume`.
