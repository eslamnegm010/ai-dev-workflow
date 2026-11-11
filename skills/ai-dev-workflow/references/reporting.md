# Presenting results

Every hand-back has a fixed shape so the reader sees status first, evidence second, and nothing padded.

## 1. Implementer report (agent → main session)

```markdown
## Built (per plan section)
- §2 Domain: `LatestActionScheduler` (settle 400 ms, one in flight per item+field) …
- §3 Data: …
## Gate (on <sha>)
| Step | Result | Last line |
|---|---|---|
| analyze | ✅ | No issues found! |
| app tests | ✅ | +1242: All tests passed! |
## Mutation checks
- M1 removed the window restart → "burst sends one request" failed ✅ restored
## Fidelity (if goldens compared)
| Golden | Reference | Similarity | Note |
## Deviations from the plan (and why)
## Not verified
```

## 2. Reviewer review (posted on the PR, one per round)

```markdown
**changes requested**        ← first line: approve | changes requested

### Must fix
1. `lib/feed/x.dart:42` — overtaken result still shows a snackbar (rule: rapid taps, CLAUDE.md §8).
2. …
### Follow-up
1. `…:10` — …

— Reviewer agent
```
Only real defects are Must fix; everything else Follow-up. No praise, no repeating what passed. Each item:
`file:line` + the source it violates. It returns to the caller: verdict, Must-fix list, anything it could not verify.

## 3. PR body

Template `templates/docs/pr-body.md`:
```markdown
Plan: `docs/plans/<file>.md`. Implemented by <role/model>; <n> review rounds.

- What was built, one line per piece, with the numbers that matter.
- Decisions taken in this PR (D-NNN, delegated or owner).
- Tests: the plan's matrix + extra cases; key tests mutation-checked (M1–Mn in the report).

Gate (main session, on <sha>): analyze clean · format 0 changed · guards clean · core 73 · app 1242 · platform 58.

Fidelity: feed viewport 93.8–96.3 % (light/dark × en/ar); diffs opened.

Checklist: matrix rows · ACs tested · goldens approved · guards · error codes · rules · docs updated · manual run.
```
The one-line gate summary lists every step with its test count, on the exact commit merged.

## 4. Merge record (`CLAUDE.md` §6 row)

Dense, one row: **bold slice name**: what was built (components, rules, numbers), decisions (D-NNN), who implemented,
review rounds and who finished, fidelity range, follow-ups. Then §7 rewritten with **RESUME HERE**.

## 5. Owner messages

- In the owner's language; name tasks by what they are ("the sign-in screens"), not codes (a code may follow in
  parentheses).
- Lead with the result or the question. For a decision: the options, a recommendation, what each changes; batch
  questions in one ask.
- After an agent/model trial task: a short verdict — what it did well, what needed fixing, rounds, time, tokens if
  known, keep using it for this kind of task or not — and a log row.
- Before telling the owner to enter anything into a bank, store, developer console or official form, verify every
  detail it depends on first.

## 6. Visual evidence

- `compare.mjs` side-by-side images (reference | golden | diff) for any screen work; put the similarity table in the
  PR and open the images yourself.
- Golden failures: `*_testImage.png` and `*_isolatedDiff.png`.
- For a long explainer, dashboard or decision for other people: publish a page/artifact or a PDF
  (`md_to_pdf.mjs`) instead of terminal text.

## 7. Live view of an external implementer (optional)

With the optional Gemini module, `watch.mjs` opens a Terminal with the brief, thinking, file reads, each edit with its
diff, commands with results, then a summary of changed files and the report; `watch-latest.sh` reopens it.
