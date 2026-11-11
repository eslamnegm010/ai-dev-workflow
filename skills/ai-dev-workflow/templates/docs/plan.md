# <Stage> · <step> — <name>                 Status: planning | in progress | done

> Implementer: <role/model> · Branch: `feat/<feature>-<part>` · PR split: this file = one PR.
> Rules for the implementer: no comments by default · pages only compose · UI from tokens/components only · tests must be
> able to fail (★ = mutation-check and report) · regenerate only the goldens listed here.

## 1. Scope
Screens/modules (matrix links) · what is in · **out of scope** (and where it lands later).

## 2. Acceptance criteria
AC-<feature>-01 Given … When … Then …   (from the matrix, refined; every error code the screen can receive)

## 3. Decisions (binding)
| # | Decision | Why | Source / D-entry |
|---|---|---|---|

## 4. Logic
Pure rules the client owns (with the rule each enforces) · entities · interfaces.

## 5. Data access
Which existing API calls · error → message mapping · cache policy. (Schema delta only if `optional/backend-contract` is in use.)

## 6. UI references
For each screen/state: `design/reference/<screen>/<frame>.png` · components reused · new components/variants · what a still cannot show (motion, keyboard, sheet extents).

## 7. Presentation
State holder: events · state shape (status enums, loaded data) · listeners · concurrency · optimistic paths.
Components: reused (catalogue) · new (with references and every variant).
Pages & routes: presentation type · guard · entry points.
Copy: keys + exact text in every language · plurals.

## 8. Files
| File | New/changed | What |
|---|---|---|

## 9. Performance
Prefetch · cache first + revalidate · media sized and precached · parallel/coalesced requests · rebuild scope ·
startup cost. Budgets to measure (profile mode) if any.

## 10. Tests
| # | Case | Failure it would catch | Test (file · name) | ★ |
|---|---|---|---|---|

Goldens (new/changed only): `<file>` × light/dark × <locales>; platform goldens compared with `design/reference/<…>`.

## 11. Rules audit
| Rule | Where honoured | Test |
|---|---|---|

## 12. Gate
`tool/gate/run-gate.sh` (+ `--only <conditional steps>` for platform goldens or other conditional steps). Paste the table in the report.

## 13. Risks & open questions
Only links to D-entries; nothing open for the implementer.
