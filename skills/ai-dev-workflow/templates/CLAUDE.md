# {{PROJECT}} — agent context

> **Living document.** The single hand-off between sessions: a new session must be able to continue from this file
> alone, without the owner re-explaining anything. **Update it at the end of every completed unit of work** (merged
> PR, decision, step) — see "Keeping this file current" at the bottom.

## 1. The product in 60 seconds
<!-- What it is, for whom, its core promise, the scope model, where the invariants live, the phases. -->

## 2. Where the truth lives (precedence: top wins, conflicts are logged)
| Rank | Source | For |
|---|---|---|
| 1 | `docs/adr/` | Decisions (see §4) |
| 2 | `docs/product/01-RULES.md` | Invariants |
| 3 | `design/prototype/` + `design/reference/` | Visual truth (prototype outranks docs for visuals) |
| 4 | `docs/product/` | Screens, tokens, components, states, l10n, permissions |
| 5 | `docs/blueprint.md` | Architecture and engineering standards |
| — | `docs/WORKFLOW.md` | **The process for every stage, feature and PR. Follow it.** |
| — | `docs/traceability/` | Per-screen checklist with acceptance criteria |
| — | `docs/discrepancies.md` | Conflicts between sources and their decisions |
| — | `docs/reference/` | Binding references for third-party packages we build on |

## 3. Engineering decisions (locked)
<!-- Feature anatomy · DI · state management · l10n · UI fidelity (tokens → components → screens, goldens) · lints · CI state · pinned SDK + exact path. -->

## 4. Product decisions (ADRs)
| ADR | Decision |
|---|---|

## 5. Layout
```
<!-- folder tree, one line per package/folder -->
```

## 6. Progress log
| Date | What | Where |
|---|---|---|
| {{DATE}} | Workflow set up (ai-dev-workflow): agents, gate, docs skeleton | — |

## 7. Current state and next step
- **RESUME HERE:** <!-- the next task, its plan file, what is blocking -->
- Pending owner decisions:
- Follow-ups (non-blocking):
- How to run: <!-- exact command, devices, flavours -->

## 8. Working agreements
- **Language:** talk to the owner in <!-- language -->; code, docs, commits and PRs in English.
- 🚫 **Never push with errors.** Before every push, PR and merge: `tool/gate/run-gate.sh` green for the whole repo
  (steps in `tool/gate/steps.txt`). Review findings fixed before pushing.
- **Roles** (asked {{DATE}}; a change is a new dated row):

  | Role | Who | Model | Since | Notes |
  |---|---|---|---|---|
  | Planner / integrator | main session | — | {{DATE}} | plans, gate re-run, git, records |
  | Implementer | `implementer` agent, fresh per task | {{IMPLEMENTER_MODEL}} | {{DATE}} | |
  | Reviewer | `reviewer` agent, one per PR | {{REVIEWER_MODEL}} | {{DATE}} | |
- 📝 **Plan as a file, self-reviewed, before delegating** (`docs/plans/<stage>-<step>.md`, nothing left open). Show
  the owner only decisions that need them.
- ⚖️ **Scale the process:** substantive code = plan → implementer → reviewer; small/mechanical = direct + gate +
  self-review.
- 🔁 **Take over after a second failed round.**
- 🔍 **Review procedure:** gate green → push → `gh pr create` → reviewer reads `gh pr diff` and posts one review →
  fixes → gate → push → checks green → squash merge → delete branch.
- 🧪 **Never edit a test just to make it pass**; mutation-check key tests; never regenerate a golden without opening
  the diff.
- 🧹 **Zero analyzer hints, ever.** No scattered ignore comments.
- ✂️ **No comments by default** (only a non-obvious why).
- **Git:** the main session owns it end to end; never push to the base branch; ask before destructive actions.
- **Product gaps:** small technical gaps → decide, record a "delegated" D-entry; anything touching rules, privacy,
  permissions, copy, visuals or scope → the owner, with a recommendation.
- **Technical decisions are the agent's** (architecture, libraries, tests, CI); record why in the plan or an ADR.
<!-- Every further owner rule: what · owner + date · why · how to apply. -->

## Context compaction priority
If the conversation is compacted, preserve first, in this order: 1. the workflow (`docs/WORKFLOW.md`); 2. the working
method (§8: roles, gate, comments, git); 3. the last completed task (what, PR, what was verified); 4. the next task
and its plan (§7). Keep §6 and §7 current *before* long runs.

## Keeping this file current
At the end of every completed unit of work: 1. add a §6 row; 2. rewrite §7; 3. new ADR → §4, new owner rule → §8;
4. commit it in the same PR as the work (or a follow-up PR immediately after).
