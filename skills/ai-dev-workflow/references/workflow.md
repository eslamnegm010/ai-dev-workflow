# The workflow

The job is to translate the specs and the design faithfully, not to reinvent them. Every step below keeps that
translation exact and repeatable. It works for any app, whatever its backend: the workflow does not assume a fake
backend, a contract or any data layer of its own. (If the backend does not exist yet, or the user asks for it, use
`optional/backend-contract/` — a separate module.)

## 0. Principles

| # | Principle | In practice |
|---|---|---|
| P1 | Translate, don't invent | No behaviour, pixel or string without a source (spec, design, ADR). A missing source is a discrepancy (§2.2), not an invitation to improvise |
| P2 | Traceability over memory | Every screen is a row in a traceability matrix linking its references, components, states, strings, rules and acceptance criteria. Done = the row is green, not "looks done" |
| P3 | Build the UI once, bottom up | Tokens → primitives → components → patterns → screens. A screen is assembled from catalogue components and styles nothing itself |
| P4 | Machines verify fidelity | Screens and components are compared with captured design references by golden tests, not by eye alone |
| P5 | One vertical slice at a time | A feature is finished through every layer before the next starts |
| P6 | Gates, not good intentions | Every stage and every push has a gate; scripts enforce what can be automated, checklists cover the rest |
| P7 | Status lives in files | Where we are, what is next and what was decided is written in the repo (`CLAUDE.md` §6/§7, plans, matrix, discrepancies), never only in a conversation |
| P8 | Performance first | Every plan has a Performance section (cache first, sized/precached images, prefetch, minimal rebuilds, nothing slow at startup) |

## 1. Stages

```
Stage 0 Alignment ─► Gate 0 ─► Stage 1 Foundation ─► Stage 2 Design system ─► Gate 1
   ─► Stage 3 Feature loop (repeat) ─► Stage 4 Hardening ─► Phase gate ─► Stage 5 Release
```

| Stage | Output | Gate |
|---|---|---|
| 0 Alignment | Design + specs in the repo, reference screenshots captured, traceability matrix, ADRs for open decisions, discrepancy log | Gate 0 |
| 1 Foundation | Compiling workspace, app shell, theme, l10n, routing, guard scripts, the gate green, one **reference slice** through every layer | part of Gate 1 |
| 2 Design system | Tokens wired, primitives, every shared component built, previewed and golden-tested in all variants | Gate 1 |
| 3 Feature loop | Shipped vertical slices | Feature DoD (§4.10) |
| 4 Hardening | Accessibility, performance, offline (if the app has it), integration tests, rules audit, CI re-enabled if paused | Phase gate |
| 5 Release | Flavours, signing, store metadata, pilot | Release checklist |

Small projects collapse stages (one PR can be Stage 0 + 1), but keep the gates.

**Gate 0:** design imported and opens locally; references captured for every screen × theme × locale (frames the
board lacks are listed as discrepancies with a capture plan); design annotations triaged; matrix complete with
acceptance criteria; no open discrepancy that blocks a screen of the phase.

**Gate 1:** foundation done with the full gate green; every shared component has previews and approved goldens in all
variants; the reference slice is merged and scaffolding templates (generators/bricks) are cut from it.

**Phase gate:** all matrix rows ✅; a11y (screen reader in every language, text scale 1.3×, contrast, tap targets);
profile-mode performance (scroll, cold start, memory, size); a rules audit (each invariant → the tests that prove it);
owner walk-through of the app against the prototype in every variant, signed off.

## 2. Sources of truth

### 2.1 Precedence (top wins, and every conflict is logged)

| Rank | Source | For |
|---|---|---|
| 1 | Accepted ADRs (`docs/adr/`) | Anything they decide |
| 2 | Product rules / invariants | Never overridden silently |
| 3 | The rendered prototype + captured references (`design/`) | Visual truth: density, colour, spacing, motion |
| 4 | Product specs (screens, components, tokens, states, l10n, permissions) | Behaviour |
| 5 | Architecture blueprint | Engineering standards |
| — | `docs/WORKFLOW.md` | The process (this file, adapted) |

For visuals the prototype outranks the docs; for behaviour the docs outrank the prototype. When a component-anatomy
spec differs from the *rendered* prototype, the rendered prototype wins unless the owner says otherwise.

### 2.2 Discrepancy protocol

1. **Stop.** Do not pick an interpretation in code.
2. **Log** it in `docs/discrepancies.md`: id `D-NNN`, where found, conflicting sources, options, recommendation, what
   it blocks.
3. **Decide.** The owner picks anything touching rules, privacy, permissions, copy, visuals or scope (batch several
   questions in one ask, each with a recommendation). A small technical gap that changes no product behaviour may be
   decided by the agent and marked **delegated**. Rule changes become ADRs.
4. **Propagate** the decision into the losing sources in the same PR that implements it. Closed only when no source
   still says the old thing.

**UI with no design:** small pieces are built from existing tokens/components with the simplest flow and recorded as a
D-entry; anything substantial gets a design brief to the owner/designer (`docs/design-requests/<date>-<topic>.md`).
When a design comes back, take only the new pieces — the design tool does not know later code changes.

## 3. Stages 0–2 in practice

- **Import everything into the repo**: `design/prototype/` (the export), `design/reference/` (captured PNGs — the
  oracle), `design/annotations/` (markups, triaged in `annotations.md`: applied / not applied → D-NNN / obsolete),
  hand-off code under `docs/handoff/` read-only. Agents work only from what is in the repo.
- **Capture references** with `scripts/design/capture.mjs` (`references/golden-tests.md`).
- **Traceability matrix** `docs/traceability/phase-N.md`, one section per screen, with Given/When/Then acceptance
  criteria including every error the screen can show. They become tests.
- **Reference slice**: one real feature through every layer, reviewed, merged; generators are cut from it, and a
  verify script renders each template, builds, analyzes and tests it, then deletes it.
- **Design system**, in dependency order: tokens (wired to the theme, light/dark × each script) → primitives (text,
  icon, surface, divider, tap target, skeleton) → components (buttons, fields, chips, badges, avatars, rows, nav,
  sheets, state views) → patterns (list with its states, sheet scaffold, tab scaffold). Rules:
  - A screen may not pass a colour, size, radius, padding or text style that is not a token or a component variant.
  - A new visual need is a **new variant** of a component (reviewed like an API change), never local styling.
  - A component used by 2+ features lives in the design system; otherwise in the feature, built the same way.
  - The component anatomy spec (tree, spec table, reference code) is read before building each component; values
    whose token column is "—" stay private constants — never borrow an unrelated token.
  - **Component loop:** anatomy + reference PNG → tokens only → preview (all variants side by side) → golden test
    (variants × light/dark × each language) → `compare.mjs` against the reference → open the diff → approve →
    commit the golden.

## 4. Stage 3 — the feature loop

### 4.0 Definition of Ready
Matrix rows complete with acceptance criteria and no blocking discrepancy · references captured for all its screens
and states · needed components exist or are listed as feature-owned · the data it needs is available (an existing
API, or an open question raised before building) · dependencies merged.

### 4.1 Plan
`docs/plans/<stage>-<step>.md`, one per PR, from `templates/docs/plan.md`. Everything decided, self-reviewed against
the sources. Big features are split into slices, each with its own plan and PR.

### 4.2 Logic first (test first)
Business rules the client owns go into pure, framework-free code with unit tests written from the acceptance
criteria. Coverage target set per layer (e.g. ≥ 95 % for pure logic).

### 4.3 Data access
Follow the project's own architecture and its existing backend. Map every error the screen can receive to its own
message. (No backend yet, or the user wants one specified? → `optional/backend-contract/`.)

### 4.4 Presentation
1. State holder per **flow** (not per widget); every acceptance criterion and error tested.
2. Feature-owned components via the component loop (§3).
3. **Pages only compose** (providers, listeners, layout of parts; ~150 lines); behaviour in named mixins/hooks in
   their own files; no private widget classes; every state (loading/skeleton, empty, error + retry, offline, refresh,
   load more) from shared state views; strings from translation files; start/end layout (RTL).
4. Routes with the right presentation (tab/page/sheet/fullscreen) and guards.
5. **Goldens** per screen × state × theme × locale, compared with `design/reference/<screen>/`; widget tests for
   interactions and RTL. What a still cannot show (motion, sheet extents, scroll, keyboard, tap targets) goes into the
   PR checklist.

### 4.5 Wire-up — DI, routes, entry points from other screens, deep links.
### 4.6 Verify — codegen, the full gate, run the app, walk every acceptance criterion in every language and theme, including failure scenarios.
### 4.7 Push and PR — see "Before every push" below.
### 4.8 Review — reviewer agent on the pushed diff + DoD + rules audit for the rules in the matrix row.
### 4.9 Merge and record — squash merge; status files updated (see below).

### 4.10 Feature Definition of Done
- [ ] Every acceptance criterion has a passing test; every error has its own copy
- [ ] Goldens approved for every state × theme × locale; diffs opened; fidelity scores in the PR
- [ ] No guard violations (architecture, tokens, strings)
- [ ] Semantics on icon-only controls, tap targets ≥ 44, text scaling holds, RTL correct
- [ ] Performance section honoured
- [ ] Status files updated: matrix row ✅, discrepancies closed, `CLAUDE.md` §6/§7

### 4.11 PR strategy
| Size | Split |
|---|---|
| Small (1 screen) | One vertical PR |
| Medium/large | Stacked: (a) logic + data → (b) components + goldens → (c) state + pages + routes + wire-up |
| Very large | By user path: read path first, then each action |

Target ≤ ~800 changed lines excluding generated code. Branches `feat/<feature>-<part>`. Conventional Commits.

## 5. Before every push (the pre-push workflow)

```
1. Codegen (if generated sources changed)          → keep generated files
2. tool/gate/run-gate.sh                           → whole repo green (analyze 0 issues, format, guards, all tests, CI goldens)
3. Platform goldens on the recording machine        → only the goldens this task changed differ; each diff opened
4. compare.mjs for changed screens                  → similarity table for the PR, images opened
5. git status                                       → no unrelated file changed, no failures/ folders, no secrets
6. Status files updated in the same branch          → CLAUDE.md §6 row + §7, plan status, matrix row, discrepancies
7. Push the branch (never the base branch) → gh pr create with the PR template + gate table + fidelity table
8. Reviewer → fixes → steps 1–6 again → push
9. Final commit: gate once more, paste the result, all checks green → squash merge → delete branch
```

A red step is fixed, never pushed "to fix later". Clean on one package does not count.

## 6. Status files (what is where)

| File | Answers | Updated when |
|---|---|---|
| `CLAUDE.md` §6 Progress log | What was done, by whom, with which numbers | Every merged PR |
| `CLAUDE.md` §7 Current state | **RESUME HERE**: the next task and its plan, open follow-ups, pending owner decisions, how to run | Every merged PR, every owner decision, before long runs |
| `CLAUDE.md` §8 Working agreements | Roles, standing owner rules (dated, with why) | When the owner sets a rule |
| `docs/plans/<file>.md` header | `Status: planning · in progress · done` | Start and end of the task |
| `docs/traceability/phase-N.md` | Per screen ⬜ / 🟨 / ✅ with PR links | When a screen's work merges |
| `docs/discrepancies.md` | Open 🟥 / recommended 🟨 / decided | When found, decided, propagated |
| `docs/adr/` + `CLAUDE.md` §4 | Decisions others depend on | When decided |
| `docs/agents/<agent>-log.md` | How a trial agent/model performs | After each trial task |

## 7. Scale the process to the task

| Task | Process |
|---|---|
| Architecture, business rules, concurrency, media, visual fidelity | Full loop: research? → plan → implementer → gate → reviewer |
| Simple feature on proven patterns | Full loop; a cheaper implementer model is fine **if** the plan is written in finer detail (exact files, names, values, tests) |
| Docs, copy, renames, config, small mechanical edits | Main session directly → gate → self-review against the DoD → PR |
| Live tweaks while the owner runs the app | Edit + hot reload/restart within minutes; batch them; one gate (and a review if substantive) before the PR |
| Highest-risk areas the owner names (video, payments, auth…) | Strongest model only; research how it fails in practice first; the test section is a matrix (case · failure it catches · test); every key test mutation-checked; device/profile checks before merge |

Do not wait for the owner to test unless they ask: gate → review → merge → next task.

## 8. Growing the codebase

- Cross-feature access only through the other feature's public API. Shared UI → design system.
- Cross-screen consistency goes through a shared change stream, never state holders calling each other.
- A new kind (post kind, alert kind…) is a new registered renderer, not another branch in an old widget.
- Regression: every earlier golden and test runs on every PR. A red golden is a bug or an intended change, approved
  explicitly in the PR.
- Toggle-like actions (like, save, follow…) accept rapid taps: never blocked, each tap shown at once, only the last
  state is sent after a short settle window, one request in flight per item and field, a burst ending where it began
  sends nothing, rollback + notice only for the final state.

## 9. Change management

| Change | Procedure |
|---|---|
| New design export | Replace `design/prototype/` → re-capture references → see which goldens differ → update components first (never screens first) → re-approve goldens → update the matrix |
| Product rule | ADR → rules doc → rules audit → tests, one PR |
| Copy | Every language file in the same PR (a parity guard enforces it) |
| Architecture | ADR → blueprint → generators → reference slice |
| Process | Edit `docs/WORKFLOW.md` (and this skill if it generalises) through a PR |

## 10. Session protocol for agents

1. Load context: `CLAUDE.md` → `docs/WORKFLOW.md` → the plan and matrix rows. Do not load all specs unless needed.
2. One step per session where possible; state it at the start, finish with its exit check.
3. Plan first for anything beyond trivial; load matching skills before writing code.
4. Never invent; report a gap as a discrepancy.
5. Verify with real commands and report their real output.
6. Independent review for substantive code; the main session owns git; never push to the base branch.
7. **Compaction priority:** if context is summarised, keep first (1) the workflow, (2) the working method and roles,
   (3) the last completed task, (4) the next task and its plan. Keep `CLAUDE.md` §6/§7 current *before* long runs.
