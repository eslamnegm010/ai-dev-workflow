# design/

The visual source of truth (`docs/WORKFLOW.md` §2.1) and the inputs of the golden tests.

| Folder | Holds | Edited by hand? |
|---|---|---|
| `prototype/` | The design export (HTML prototype, screens board, component anatomy, tokens, assets) | No — replaced wholesale on a new export |
| `reference/` | Captured PNGs, the oracle for goldens: `<screen>/viewport.<theme>.<locale>.png`, `<screen>/scroll-NN.<…>.png`, `manifest.json` | No — generated |
| `annotations/` | Design review markups, triaged in `annotations.md` (applied / not applied → D-NNN / obsolete) | Only `annotations.md` |

## Open the prototype
It fetches sibling files, so serve it: `cd design/prototype && python3 -m http.server 8080`.

## Re-capture references (after a new export)
```bash
cd tool/design && npm install && npx playwright install chromium
npm run capture               # all frames (config: design/capture.config.json)
npm run capture -- feed post  # only these screen ids
```

## Compare a golden with its reference
`npm run compare -- <golden.png> ../../design/reference/<screen>/viewport.light.en.png` → `build/design-compare/`.

## Known gaps
Frames the board does not have (sheets, derived screens, states) — listed in `docs/discrepancies.md`.
