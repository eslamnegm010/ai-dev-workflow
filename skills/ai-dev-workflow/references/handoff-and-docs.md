# Hand-off and project docs

Status files and what each answers: `references/workflow.md` §6.

## 1. `CLAUDE.md` — the living hand-off

The single hand-off between sessions: a new session must be able to continue from this file alone, without the owner
re-explaining anything. Template: `templates/CLAUDE.md`.

| § | Section | Holds |
|---|---|---|
| 1 | The product in 60 seconds | What it is, its core promise, scope model, the invariants file, phases |
| 2 | Where the truth lives | Precedence table of sources + pointers (workflow, matrix, discrepancies, reference docs, original material) |
| 3 | Engineering decisions (locked) | Architecture/feature anatomy, DI, state management, l10n, UI fidelity, lints, CI state, pinned SDK |
| 4 | Product decisions | One row per ADR: number + one-line decision |
| 5 | Layout | Folder tree with one line per package/folder |
| 6 | Progress log | Date · what (dense: what was built, numbers, decisions, who implemented, review rounds) · PR |
| 7 | Current state and next step | **RESUME HERE** line, the next task with its plan, open follow-ups, pending owner decisions, how to run the app, known gotchas |
| 8 | Working agreements | Language with the owner, hard gate, Roles table, process scale, review procedure, git ownership, comment policy, every standing owner rule with its date |
| — | Reference implementations | Other repos on the machine with patterns to port |
| — | Compaction priority + Keeping this file current | See below |

**Keeping it current** — at the end of every completed unit of work (merged PR, owner decision, finished step):
1. Add a §6 row. 2. Rewrite §7 so the next session knows exactly where to resume. 3. New ADR → §4; new owner rule
→ §8 (dated, with the reason). 4. Commit it in the same PR as the work or an immediate follow-up.

**Owner rules** are recorded in the repo (`CLAUDE.md` §8, agent files, workflow) *and* in memory — never only in
memory. Each rule: what, owner + date, why, how to apply. A rule that applies to implementers goes into both agent
files.

## 2. Plans — `docs/plans/<stage>-<step>.md`

Template: `templates/docs/plan.md`. One per PR. Contains every decision with its reason, exact files, behaviour,
UI references per screen/state, Performance section, test list mapped to acceptance criteria with ★ for mutation-checked tests,
rules audit, gate. Self-reviewed against the sources before hand-off. For a cheaper implementer model: exact file
paths, public names, values, copy in every language, test cases, golden list — nothing left to infer.

## 3. Research notes — `docs/research/<date>-<topic>.md`

Template: `templates/docs/research-note.md`. Question · what big products do and why (with sources) · options with
trade-offs · recommendation · what needs the owner. Then a plan.

## 4. ADRs — `docs/adr/NNNN-title.md`

Template: `templates/docs/adr.md`. Context · Decision · Alternatives · Consequences. Status `proposed | accepted |
superseded by NNNN`. Product and architecture decisions that other work depends on. An amendment is dated inside the
ADR.

## 5. Discrepancy log — `docs/discrepancies.md`

Template: `templates/docs/discrepancies.md`. Open/recommended table (ID · found in · conflict · options ·
recommendation · blocks · status) and a decided table (ID · conflict · decision · propagated in). Delegated technical
decisions are marked "delegated".

## 6. Traceability matrix — `docs/traceability/phase-N.md`

Template: `templates/docs/traceability.md`. One section per screen/route: purpose, references, components,
endpoints, models, rules, permissions, states, strings, notifications, navigation, acceptance criteria. Status per
row (⬜ → 🟨 → ✅ with PR links).

## 7. Binding reference docs for dependencies — `docs/reference/<package>.md`

For a third-party package the core of a feature builds on (video engine, sync engine, payment SDK). Template:
`templates/docs/reference-doc.md`. Written after reading the package's **source** (not only its README) and running
its tests on your toolchain:
- Package link, licence, exact pinned version + commit, size, dependencies, test count, I/O it does.
- What it does and does not do; its integration contract (the interfaces you implement); every mechanism; config
  and the values you use with why; device/memory behaviour; lifecycle and disposal; observability.
- Caveats found in the source, and lessons from its example app.
- **Rules for our code** (who may talk to it, one instance per X, never do Y).
- **To verify on devices** before building on it.
- Upgrade policy: read the diff, re-run our tests, update this file in the same PR.

The implementer follows it; the reviewer checks against it; a deviation is a Must fix.

## 8. PDFs for people outside the repo

Any Markdown hand-off (a spec for a partner, a backend hand-off if `optional/backend-contract` is used, a release
note) can become a print-ready PDF:

```bash
node tool/design/md_to_pdf.mjs docs/<file>.md docs/<File>.pdf --brand "Project" --footer "For <audience>" \
  [--color "#1E3A5F"] [--fonts <dir with .ttf>]
```
Cover (brand, title, `> subtitle` line), contents (h2–h3), page numbers, RTL-aware paragraphs, and
`<!-- include: other.md -->` to embed another file once (its headings shifted one level down). Regenerate the PDF in
the same PR as any change to its source.

## 9. Other folders

| Path | For |
|---|---|
| `docs/WORKFLOW.md` | The process, adapted to the project (template from this skill) |
| `docs/blueprint.md` | Architecture and engineering standards |
| `docs/product/` | Rules (invariants), screens, tokens, components, permissions, l10n, states |
| `docs/handoff/` | Code handed over by design/product, read-only reference, excluded from analysis |
| `docs/design-requests/<date>-<topic>.md` | Design briefs sent to the owner/designer for UI with no design |
| `docs/agents/<agent>-log.md` | Trial log for an agent/model |
| `design/README.md` | How to open the prototype, re-capture references, known gaps |
| `design/annotations/annotations.md` | Each design markup: what it asks, `applied` / `not applied → D-NNN` / `obsolete` |
