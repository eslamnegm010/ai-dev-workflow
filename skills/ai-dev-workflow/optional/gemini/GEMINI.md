> **Opt-in only** — use when the user asks for Gemini as the implementer. The `reviewer` agent still reviews every PR.


# Gemini implementer setup

Claude plans and reviews; Gemini (`gemini-3.8-flash-high` via `agy`) writes the code in an isolated git worktree; Sonnet at medium effort is the fallback when Gemini's limit runs out.

**Nothing is copied into projects.** The scripts run from this folder for every repo:

| File (here) | Role |
| --- | --- |
| `init.sh` | Scaffolds the per-project files from `templates/` (never overwrites). |
| `implement.sh` | Dispatch: worktree, symlinks, prompt, run, report. Reads `<repo>/.claude/implementer.env`. |
| `agy-run.mjs` | Headless `agy` runner: timeout and stall watchdogs, diff fingerprint, changed-file list. |
| `watch.mjs`, `watch-latest.sh` | Live Terminal view of a run. |
| `gemini-policy.toml` | Denies git mutations (used with `--cli gemini`). |
| `review-and-ratchet.md` | Review discipline and the fault ratchet pattern: read before the first review. |

Per project (committed in the repo):

| File | Content |
| --- | --- |
| `.claude/implementer.env` | `GATE_NAME`, `BASE_BRANCH`, `SYMLINKS`, optional `WORKTREES_BASE`, `DEFAULT_MODEL`. |
| `AGENTS.md` | The implementer's brief: generic rules plus this project's rules. |
| `.agents/skills/<gate>/SKILL.md` | The quality gate. Must be under `.agents/skills/`: that is where `agy` finds skills. |
| `.claude/skills/gemini-implement/SKILL.md` | The dispatch steps for the main session. |
| `docs/agents/implementer-log.md`, `docs/plans/` | Run log and plans. |
| `.gemini/settings.json` | Only used with `--cli gemini`. |

## Set up a project

1. From the repo root: `~/.claude/skills/ai-dev-workflow/optional/gemini/init.sh [gate-name]` (default gate name `<repo>-quality-gate`). It needs a git repo with at least one commit, and fixes `node_modules/` style gitignore entries (see gotchas).
2. **Adapt to the project** (this is the part that needs judgment):
   - Read the project's `CLAUDE.md`, README, `package.json` scripts (or the equivalent build file), lint and format config, test setup, and the folder layout.
   - Fill `AGENTS.md` → "Project rules": stack and versions, where each kind of code lives, invariants, what must not be touched, style rules. Copy rules, don't link: the implementer reads only the worktree. Remove generic rules that don't apply.
   - Write the gate with the project's real commands, in order, and **run every command once yourself**. A check that already fails on the base branch can't be in the gate as is: fix it first, or use the fault ratchet (`review-and-ratchet.md`), or leave it out and tell the owner.
   - Set `SYMLINKS` to the untracked folders the gate needs (`node_modules`, `.venv`, big asset folders).
3. Add a short "Implementer" section to the project's `CLAUDE.md` pointing at the `gemini-implement` skill, if the owner wants Gemini as the default implementer.
4. Commit the new files (a worktree only contains committed files).
5. Smoke test with a tiny plan: dispatch, check the watch window opens, the report is written, the gate passes when you re-run it.

## Daily use

From the repo root (details in the project's `gemini-implement` skill):

```
~/.claude/skills/ai-dev-workflow/optional/gemini/implement.sh docs/plans/<NAME>.md <branch>            # dispatch
~/.claude/skills/ai-dev-workflow/optional/gemini/implement.sh docs/plans/<NAME>.md <branch> --brief <findings.md> --resume   # fix round
~/.claude/skills/ai-dev-workflow/optional/gemini/watch-latest.sh                                        # reopen live view
```

Exit codes: `0` success, `3` agent failure, `4` no changes, `5` read-only run changed files, `124` timeout, `125` stalled (15 min without events). Worktrees: `~/.worktrees/<repo>/<branch>`, logs in `~/.worktrees/<repo>/_logs/`.

## Gotchas

- **Run the dispatch outside the command sandbox** (it needs the network and the login keychain). Inside the sandbox, or with the network down, `agy` asks for a Google login and the run ends after ~75 s with exit 3 and `authentication failed or timed out`. Check first with `agy models`.
- **First commit required:** worktrees can't be created on an empty repo.
- **No trailing slash on symlinked ignores:** `node_modules`, not `node_modules/`. With the slash git lists the symlink as untracked and `agy-run.mjs` crashes reading it.
- **Anchor root patterns** (`/qa`), so `tools/qa/` isn't ignored by accident.
- **Private files:** keep them out by gitignore, never by prompt. Implementers get no MCP tools or connected accounts.
- **Parallel runs** only with disjoint file scopes; merge one at a time.
- **Stall after completion:** Gemini sometimes stalls or hits a transport error after the work is done: inspect the worktree before calling a run failed.
- **Fallback:** on `AI credits balance too low` or a quota error, give the same plan to an `Agent` with `model: sonnet`, `effort: medium`, `isolation: worktree`.
- **Projects set up before the scripts were shared** carry their own copies under `tools/agents/`; they keep working. To move one over: add `.claude/implementer.env` with its `WORKTREES_BASE`, gate name and symlinks, point its `gemini-implement` skill at this folder, delete `tools/agents/`.

## Review protocol

- Never trust the agent's report: re-run the gate yourself, in the foreground.
- For visual work ask for numbers and for views that show the subject; open the images.
- Fix rounds: numbered findings in a separate file, then `--brief <file> --resume`.

## Updating

This skill lives in a skills repository and is linked into `~/.claude/skills/`. After changing a script, commit and push there; every project uses the new version at once (`install.sh --update` on other machines).
