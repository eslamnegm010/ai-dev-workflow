# ai-dev-workflow

A Claude Code skill that runs software projects the way a careful team would: **plan file → separate implementer
agent → hard quality gate → separate reviewer agent on the pushed PR → merge → status files updated**, with UI
fidelity checked by golden tests against the design.

## What you get

- **The workflow** — stages and exit gates, sources-of-truth precedence, a discrepancy protocol (never guess), the
  feature loop with Definition of Ready / Done, PR sizing, the pre-push checklist, and change management.
- **Roles you choose once** — who implements (Opus / Sonnet / by complexity / the main session) and who reviews. The
  skill asks, then records the answer in `CLAUDE.md` and in the agent files so every later session follows it.
- **Standing agents** — `implementer` (fresh per task, never pushes) and `reviewer` (one per PR, reads only the pushed
  diff, posts one review: verdict, Must fix, Follow-up). Take-over rule after a second failed round.
- **Quality gate** — `run-gate.sh` runs your steps and prints a pass/fail Markdown table for the PR; guidance for
  guard scripts (architecture, design tokens, strings), zero analyzer hints, mutation-checked tests, a fault ratchet
  for legacy repos.
- **Golden tests against the design** — `capture.mjs` screenshots every frame of an HTML prototype (and scroll pages)
  into `design/reference/`; tolerant CI goldens + exact platform goldens; `compare.mjs` writes reference | golden |
  diff images and a similarity table. Flutter (alchemist) helpers included; notes for web, Android, iOS, React Native.
- **Status and hand-off files** — a living `CLAUDE.md` (progress log, **RESUME HERE** current state, working
  agreements, compaction priority), plans, ADRs, discrepancy log, traceability matrix, binding reference docs for
  key dependencies, research notes, PR template; `md_to_pdf.mjs` turns any Markdown hand-off into a branded A4 PDF.
- **Optional modules (only when needed or asked):** `backend-contract` (API schema, example responses, local
  stand-in, backend hand-off + PDF — for when the backend does not exist yet) and `gemini` (Gemini via Antigravity
  CLI as an external implementer in an isolated worktree, with a live view).

## Install

```bash
git clone https://github.com/eslamnegm010/ai-dev-workflow.git
cd ai-dev-workflow && ./install.sh        # symlinks skills/ai-dev-workflow into ~/.claude/skills
```
`./install.sh --copy` copies instead; `./install.sh --remove` uninstalls. Requires `git`, `gh` (for PRs), and Node 18+
for the design tools (`npm install && npx playwright install chromium` in `tool/design` after scaffolding).

## Use

In any repo, ask Claude Code: *"set up the AI dev workflow here"*. It reads the repo, asks who implements and who
reviews, runs:

```bash
~/.claude/skills/ai-dev-workflow/scripts/init.sh --implementer-model opus --reviewer-model opus [--design] [--flutter] [--no-attribution]
```

then fills the project facts and the real gate commands. After that, every task — *"build the settings screen"*,
*"fix the login bug"* — follows the loop, and `CLAUDE.md` always says where to resume.

## Layout

```
skills/ai-dev-workflow/
  SKILL.md                    entry point (modes, setup, task loop, non-negotiables)
  references/                 workflow · roles-and-agents · quality-gate · golden-tests · handoff-and-docs · reporting
  templates/                  CLAUDE.md · agents/ · docs/ (plan, adr, discrepancies, traceability, reference, research, PR) · gate · design
  scripts/                    init.sh · gate/run-gate.sh · design/{capture,compare,md_to_pdf}.mjs · flutter-goldens/
  optional/                   backend-contract/ · gemini/
```

## License

MIT
