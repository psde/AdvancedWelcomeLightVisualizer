# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Advanced Welcome Light Visualizer — a client-side web tool for analyzing and editing BMW FLM2 welcome light animations. It parses hex byte sequences representing light channel animations (duration/brightness pairs) and provides visual editing, diagrams, and real-time animation preview.

## Running the Application

No build system or installation. Open `index.html` directly in a browser.

### Tests

Tests use the Node.js built-in test runner. Run with:

```
npm test
```

Test files live in `tests/`:
- **`tests/setup.js`** — Shared DOM stubs, loads all production code via `vm.runInThisContext`, exports `assertHexArrayEqual` helper.
- **`tests/core.test.js`** — Core data logic: hex parsing, sequence parsing, reassembly, round-trips, string conversions, edge cases.
- **`tests/chart.test.js`** — Chart/diagram tests: `arePointsIdentical`, `parseForChart`.
- **`tests/templates.test.js`** — Template hex byte validation (all templates x 4 fields).
- **`tests/vehicles.test.js`** — Vehicle config structure validation (channel shapes, required attributes).

All template data in `templates.js` must contain only valid two-character hex bytes (`[0-9A-Fa-f]{2}`).

## Architecture

### File Layout

- **`index.html`** — HTML structure, loads external scripts and stylesheet.
- **`js/core.js`** — Data model, constants (`MAX_STAGING1`, `MAX_STAGING2`), byte parsing (`parseByteString`, `buildByteString`), sequence parsing (`parseAllSequencesFromBytes`), reassembly (`reAssembleBytes`), string conversion (`sequenceToString`, `stringToSequence`).
- **`js/animation.js`** — Animation player: playback state, `rebuildAnimationPlayer()`, grid/image visualization, `createSVGShape()` (path/circle/polygon/rect), `getLightElement()`, brightness interpolation (`getBrightnessAtTime`), playback controls.
- **`js/chart.js`** — p5.js brightness diagrams: `chartSketches`, `parseForChart()`, `arePointsIdentical()`, `createSingleChart()`, `updateSingleDiagram()`.
- **`js/editor.js`** — Sequence editors: hex/visual editor rendering, step manipulation, `renderDynamicSequences()`, `createSeqSubblock()`, channel labeling.
- **`js/init.js`** — Initialization: clipboard helpers, `buildDynamicFields()`, template/vehicle loading, `DOMContentLoaded`/`window.onload` handlers.
- **`styles.css`** — All CSS styles for the application.
- **`templates.js`** — Generated file containing `TEMPLATES` constant with pre-defined animation data for various BMW models (hex byte strings).
- **`vehicles.js`** — `VEHICLE_CONFIGS` defining vehicle models, visualization types ("grid" or "image"), and light channel mappings (ID, SVG shape type, position, label). Channels use direct shape properties (`type` + attrs) or a `shapes` array for multi-shape channels. Supported shape types: `path`, `circle`, `polygon`, `rect`. Shapes support an optional `color` attribute (hex string `#RRGGBB` or `#RRGGBBAA`) to override the default white; brightness modulates the color's alpha during animation.
- **`parse_templates.py`** — Python script that parses `Templates/` directory files (FLM2 Left/Right, Staging1/Staging2 sections) into `templates.js`.
- **`Templates/`** — Raw template text files per BMW model variant.
- **`assets/generic_light.png`** — Vehicle image used for SVG overlay visualization.

### Data Model

The core data structure is a **sequence**: a light channel animation stored as hex bytes.

```
Format: [channel_id] [00] [length] [duration, brightness, duration, brightness, ...]
```

- **channel_id**: identifies which light (DRL, beam, accent, etc.)
- **length**: number of duration/brightness pairs
- **duration**: hex byte × 20 = milliseconds
- **brightness**: hex byte = percentage (0x00–0x64 → 0–100%)
- **Staging1_Data**: first 252 bytes, **Staging2_Data**: additional 168 bytes (420 total per side)

Key global state: `sideData.left.staging1Bytes`, `sideData.left.staging2Bytes`, `sideData.right.staging1Bytes`, `sideData.right.staging2Bytes` (raw byte arrays), `sideData.left.sequences`/`sideData.right.sequences` (parsed sequence objects).

### Data Flow

1. User inputs hex data or loads a template → populates four text areas (Left/Right × Staging1/Staging2)
2. `buildDynamicFields()` parses bytes into sequence objects
3. `renderDynamicSequences()` creates per-sequence editors (hex or visual mode) and p5.js brightness diagrams
4. `rebuildAnimationPlayer()` sets up real-time visualization (grid of bulbs or SVG overlay on vehicle image)
5. Edits in sequence editors propagate back to byte arrays via `reAssembleBytes(side)`
6. Animation runs via `requestAnimationFrame` loop, interpolating brightness per channel at current time

### External Dependencies

- **p5.js v1.4.2** (loaded via CDN) — used for brightness-over-time chart diagrams

## Key Conventions

- Application logic is split across files in `js/` (loaded via `<script>` tags in `index.html`, order matters) — there are no modules or bundling.
- Diagrams use left=blue, right=red, identical=green color coding.
- The visual editor uses sliders for duration/brightness per step; hex editor uses raw textarea.
- Sequences terminate when `00, 00, 00` is encountered during parsing.
- Animation light element IDs: image mode uses `${side}_light_ch${channel.id}` (matched by channel ID from sequence identifier), grid mode uses `${side}_light_${idx}` (matched by sequence index).
- Licensed under CC BY-NC-SA 4.0.

## Code Style

### Self-documenting code / Comments policy
- Write self-documenting code: descriptive function names, clear variable names, obvious structure
- No comments that restate what the code does (e.g. `// Parse bytes` before `parseBytes()`)
- Comments ARE required for: non-obvious business logic, edge cases, real-world validation references (e.g. BMW timing multiplier), and critical invariants
- In functions >~20 lines with 2+ distinct logical blocks, use brief section comments (2-4 words) to label each block. DOM/HTML construction code especially benefits from these since `createElement`/`setAttribute` chains are visually dense.
- Remove commented-out code entirely; use git history instead

### Naming conventions
- `camelCase` for all JS variables, functions, and parameters
- No single-letter variables except loop counters in tiny scopes (`i`, `j`)
- No cryptic abbreviations (`s`, `si`, `sti`, `ta`, `pts`, `sd`) — spell out (`side`, `seqIndex`, `stepIndex`, `textarea`, `points`, `sideDataEntry`)
- String constants used more than twice should be named constants (e.g. `"RAW"` → `RAW_IDENTIFIER`)

### Variable declarations
- Use `const` by default; `let` only when reassignment is needed; never `var`
- Prefer `const` for object/array bindings even if contents are mutated

### Functions
- Top-level named functions use `function` declarations
- Inline callbacks and short helpers use arrow functions
- Functions over ~60 lines should be broken into smaller focused functions

### CSS/HTML
- No inline styles in HTML — use CSS classes
- Use hex colors consistently (not `rgb()`)
- Left=blue (`#0000ff`), Right=red (`#ff0000`) color convention

## Workflow

- Always run `npm test` before starting work to confirm a clean baseline.
- After UI changes, use AskUserQuestion to ask the user to verify the result in the browser (there is no automated browser testing).

## Known Technical Debt

- **Duplicate logic**: `getPhysicalLightBrightness` & `getPhysicalLightSource` in animation.js (~95 lines duplicated) — extract shared phase-finding logic
- **Massive functions**: `createSingleChart` (197 lines) and `createSummaryChart` (218 lines) in chart.js with ~90% shared p5 scaffold — extract chart factory
- **Duplicate init functions**: `initTemplates` / `initVehicles` in init.js are nearly identical — extract generic `initializeSelect()`
- **Global state encapsulation**: 7 mutable animation globals, `editModes`, `chartSketches` — consider wrapping in objects/closures
- **Redundant `buildDynamicFields()` call** in `window.onload` (already called by `loadSelectedTemplate`)
- **core.js `hasContent` check**: `b !== "0"` condition is unreachable — should be just `b !== "00"`
