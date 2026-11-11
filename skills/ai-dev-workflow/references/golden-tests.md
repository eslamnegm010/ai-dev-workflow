# Golden tests against the design

The design is measured once by machines, translated once into components, and every screen after that is assembly
plus automatic comparison.

```
design prototype (HTML) ──capture.mjs──► design/reference/<screen>/<frame>.<theme>.<locale>.png  (the oracle)
                                                         │
component/screen ──golden test──► goldens/ci/*.png (tolerant, every machine)
                                  goldens/<os>/*.png (exact, real fonts, one OS)
                                                         │
                       compare.mjs: reference | golden | diff  + similarity %  → you open the image and judge
```

## 1. Capture the references (`scripts/design/capture.mjs`)

Playwright screenshots of every phone frame in an HTML prototype board.

```bash
cp ~/.claude/skills/ai-dev-workflow/scripts/design/{capture.mjs,compare.mjs,md_to_pdf.mjs,package.json} tool/design/
cd tool/design && npm install && npx playwright install chromium
# design/capture.config.json (see below), then:
npm run capture                 # every frame
npm run capture -- feed post    # only these screen ids
```

`design/capture.config.json`:
```json
{
  "prototypeDir": "design/prototype",
  "page": "Screens.html",
  "frameSelector": "[data-frame-key]",
  "keyAttribute": "data-frame-key",
  "keySeparator": "-",
  "screenMap": { "auth": "signUp", "post": "postDetail" },
  "outDir": "design/reference",
  "frameWidth": 402,
  "minTextLength": 100,
  "settleMs": 500,
  "scrollPages": true,
  "deviceScaleFactor": 1
}
```
- Each frame's key is split on `keySeparator`: the first part is the screen id (mapped through `screenMap`, default
  identity), the rest is the variant (`light-en` → `viewport.light.en.png`).
- The prototype is served over local HTTP (it fetches sibling files; `file://` breaks it). Fonts must finish loading
  (`document.fonts.ready`) and lazily rendered frames are waited for.
- With `scrollPages`, the main scroll body inside the untouched frame is paged (85 % of the viewport per step), so
  fixed headers and nav stay as designed: `scroll-01.light.en.png`, … with offsets in `manifest.json`.
- Commit the PNGs and the manifest. Re-capture only when the design changes. Frames missing from the board (sheets,
  derived screens) get their own small capture script or a discrepancy entry.
- If the prototype has no stable frame attribute, ask the designer/tool to add one (`data-frame-key="feed-light-en"`).

## 2. Two kinds of goldens

| | CI goldens | Platform goldens |
|---|---|---|
| Where | `goldens/ci/` | `goldens/<os>/` (e.g. `macos/`) |
| Runs | Every machine and CI | Only on the OS they were recorded on (test tag, excluded from CI) |
| Text | Blocks/test font (stable) | Real fonts |
| Comparison | Tolerant: a small pixel budget (e.g. 64 px) for cross-OS anti-aliasing | Exact |
| Purpose | Regression on every PR | Fidelity against the design reference |

Rules:
- **One golden per scenario.** No grids: a grid hides a regression in a big image and clips cells.
- **Every component in its variants**: light/dark × each language (LTR and RTL). Screens: each captured state ×
  theme × locale.
- Screen goldens use the prototype's exact frame (e.g. 402 × 874) and safe areas (top/bottom padding of the design's
  device), animations disabled (a shimmer caught mid-sweep differs between OSes), real translations loaded.
- Data in goldens = the prototype's sample content, set up in the test, so golden and reference show the same
  content. Sample images load from `test/` only (never from the network).
- **Regenerate only the goldens the task changes** (`--update-goldens <that test file>`); check `git status` for
  any other golden that changed and restore it.
- Never regenerate a failing golden before opening the failure images (`failures/*_testImage.png`,
  `*_isolatedDiff.png`). Unintended diff = bug. `failures/` is gitignored.
- After an OS or font-stack update, run platform goldens on the base branch first. A uniform ~0.2–0.3 % failure
  everywhere is rasterisation: open one diff to confirm, then regenerate in the next PR.
- Accessibility: a widget that excludes semantics must re-add its tap action; test by tapping through the semantics
  tree, not only the widget.

Flutter (alchemist) helpers ship in `scripts/flutter-goldens/`:
- `tolerant_golden_comparator.dart` — exact everywhere except paths containing `/ci/`, which pass within the pixel
  budget.
- `flutter_test_config.dart` — installs the comparator; platform goldens off by default.
- `golden_scenario.dart` — `themedScenario` + `scenarioGoldens` (one golden per scenario, theme × direction).
- `golden_frame.dart` — `screenGoldens(...)`: the same builder as a CI golden and, tagged `platform`, an exact one,
  inside a design-sized frame with safe areas and animations off.
- `dart_test.yaml` — declares the `golden` and `platform` tags.

## 3. Compare with the reference (`scripts/design/compare.mjs`)

```bash
npm run compare -- <golden.png> <reference.png>          # one pair
npm run compare -- --pairs design/compare-pairs.json     # many → Markdown table
```
Writes `build/design-compare/<name>.png` = reference | golden | diff overlay side by side, and prints
`similarity 96.31 %`. `pairs.json` is `[{"name":"feed viewport light en","golden":"…","reference":"…"}]`.

**The score is advisory.** Browser vs engine font rasterisation differs, so judge the diff image for layout,
spacing, colour and alignment errors. Typical healthy numbers on a real screen: 93–98 %. A low score on an
intended difference (a decided copy change, a feature the design lacks) is explained in the PR. Structural errors are
fixed, never tolerated.

## 4. Lessons that cost time

- Judge by opening the image, never by the percentage alone.
- A prototype's Arabic (or other script) line heights may already include script leading; do not scale them again.
- A text field inside a design-system component must override every theme-level border/fill, or the app theme leaks.
- Numbers in localised copy go through a locale formatter (e.g. Arabic-Indic digits).
- Disable animations and wait for fonts/translations before the snapshot (pump N frames).

## 5. Other stacks

| Stack | CI-style goldens | Exact/platform |
|---|---|---|
| Web | Playwright `toHaveScreenshot` with `maxDiffPixels`, in Docker for stable fonts | Same, per browser |
| React components | Storybook + Chromatic / Loki / `@storybook/test-runner` | — |
| Android (Compose/Views) | Paparazzi or Roborazzi (JVM) | Device screenshot tests |
| iOS | swift-snapshot-testing with `precision`/`perceptualPrecision` | Recorded per simulator |
| React Native | Jest + `react-native-owl` / Detox screenshots | Device |

The method is the same: references captured from the design, one snapshot per scenario × theme × locale, tolerant
cross-machine comparison plus an exact recording on one machine, diffs opened by a human or the reviewer.
