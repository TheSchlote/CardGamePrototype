# CardGamePrototype

Browser-based, deterministic card battle prototype inspired by the DW3 layout, rebuilt with original fantasy cards and rules from the requirements document.

## Quick start

```bash
# If Node is not on your PATH, use the bundled portable binary:
set PATH=%CD%\.tools\node\node-v22.13.1-win-x64;%PATH%

npm install
npm run dev        # local dev server
npm test           # vitest with coverage
npm run build      # type-check + Vite build
```

## What’s included

- Headless rules engine with seeded RNG, full 7-phase round flow, chain system, energy, combo merge, triggers scaffold, and deterministic AI.
- JSON data in `src/data/cards.json` and `src/data/decks.json` plus a name mapping in `docs/nameMapping.json`.
- One-shot conversion helper `npm run convert` (reads `starterDeck.json` and writes `generated/cards.json`/`generated/decks.json`).
- Vitest suites for every phase, effects, AI, and helpers (current overall coverage ~91%).
- React UI (`src/ui/GamePage.tsx`) mirroring the DW3-style layout: dual boards, energy bars, deck/trash, chain indicator, action log, and controls to summon/play/pass against the AI.

## Notes

- Data is non-IP fantasy content; affinities follow the required mapping (Nature, Fire, Water, Earth, Energy, Dark, Light, Neutral).
- Two identical 40-card starter decks ship in `src/data/decks.json`; engine supports swapping in others.
- The UI assumes Player A is human and Player B is AI; rounds advance via the “Start Next Round” button after a win. Match ends at best-of-3.
