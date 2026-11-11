# Quality gate

## The hard rule

Before **every** push, PR and merge, from the repo root, with the pinned toolchain, the **whole** repo is green:

1. Code generation (only when generated sources changed; keep the generated files).
2. Static analysis of the whole workspace → zero issues (errors, warnings *and* infos).
3. Format check (`--set-exit-if-changed`-style; scoped to source folders, never reformat vendored/hand-off code).
4. Guard scripts → no findings.
5. Every package's tests (unit, widget/component, CI goldens).
6. Platform goldens (if the project has them, on the machine they are recorded on).
7. Any project-specific check (e.g. an API schema lint when `optional/backend-contract` is used).
8. Review findings fixed.

"Clean on one package" does not count. Pin the SDK (FVM, `.nvmrc`, `.tool-versions`, `rust-toolchain`…) and call it
by full path in scripts and agent briefs — a different toolchain on `PATH` produces false errors.

While CI is paused or absent, **the local gate is the merge gate**: run it on the final commit right before merge and
paste the table into the PR.

## `run-gate.sh`

`scripts/gate/run-gate.sh` runs `tool/gate/steps.txt` and prints a Markdown table:

```
# tool/gate/steps.txt — one step per line:  name | command   (# comments, blank lines ok; runs from the repo root)
analyze        | ~/fvm/versions/3.x/bin/flutter analyze
format         | dart format --output=none --set-exit-if-changed apps packages tool
guards         | (cd tool/guards && dart run my_guards:check_all)
core tests     | (cd packages/core && dart test)
app tests      | (cd apps/app && flutter test --exclude-tags platform)
?platform goldens | (cd app && flutter test --tags platform)
```

A `?` prefix marks a conditional step: it runs only with `--all` or when named with `--only`. Options: `--only a,b`,
`--from <name>`, `--keep-going` (default: stop at the first failure), `--md <file>` (also write the table).
Output:

```
| Step | Result | Time | Last line |
|---|---|---|---|
| analyze | ✅ pass | 41s | No issues found! |
| app tests | ❌ fail | 2m10s | Some tests failed. |
```

Exit 1 if any step failed. Logs per step in `build/gate/<step>.log`.

## Zero hints, always

Format and analyze each file as you write it, not only at push time. Fix the cause. If a lint is noise for this
project, disable it **once** in the root lint config with a one-line reason (owner-approved); never scatter
`ignore` comments.

## Guard scripts (project rules as code)

Rules a linter cannot express become small scripts in `tool/guards/`:

| Guard | Fails when |
|---|---|
| `check_architecture` | A layer imports the wrong way (domain → data/framework, presentation → data, feature → another feature's internals, core → app), or a required argument is missing (e.g. a list state builder without `onRetry`) |
| `check_design_tokens` | Colour literals, inline magic numbers in paddings/radii/sizes/text styles inside UI code, left/right APIs instead of start/end (RTL) |
| `check_strings` | User-visible string literals in presentation code; translation files whose key sets, placeholders or plural categories differ between languages |

Build them well:
- Parse with the language's AST (analyzer, TypeScript compiler API, ESLint custom rule, `ast` module) — never regex
  over source.
- Output `path:line:col  rule-id  message`, exit 1 on any finding.
- Scope: source folders minus generated files and the raw theme/token files.
- **No suppression comments.** A legitimate exception goes in an allowlist constant in the script with a one-line
  reason.
- The guards have their own tests (a sample that must trip each rule, one that must pass).
- Record known gaps of each guard and tighten them when a feature trips them.

## Tests that catch real problems

- **Mutation check** the key tests: break the guarded line, run the test, see it fail, restore. List each check in
  the report (`M1: removed the settle-window restart → "burst sends one request" failed`). A test that cannot fail
  is a Must fix.
- **Never edit a test just to make it pass.** Decide whether code or test is wrong; a changed test must prove at least
  what it proved before, and is mutation-checked after the change. After a test-only change re-run the affected tests;
  the full gate runs once before merge.
- Tests that hang: find the cause by reading the code; never re-run in a loop.
- Coverage targets per layer (e.g. domain ≥ 95 %, data ≥ 90 %); coverage never goes down in a PR.
- High-risk work: the plan's test section is a matrix (case · failure it would catch · test), built from research on
  how that area fails in practice, not only the obvious cases.

## Fault ratchet (adopting a gate on an existing repo)

When a check already fails on the base branch, do not weaken it or leave it out silently:
1. Count the baseline faults per check and store them (`tool/gate/known.json`).
2. The gate fails if a count goes **up**, passes if equal or lower.
3. The numbers only shrink: when a task fixes faults, lower them in the same PR. Never raise them.

## CI

CI runs the same gate (pinned SDK, cached). If CI is slow or noisy the owner may pause it to manual dispatch; record
that in `CLAUDE.md` with the stage where it is restored, keep fast checks on PRs, and treat the
local gate as the merge gate. Add a download timeout so a stalled cache falls back to a fresh fetch. Never merge
while a check is pending.
