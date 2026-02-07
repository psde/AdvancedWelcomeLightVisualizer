# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Advanced Welcome Light Visualizer — a client-side web tool for analyzing and editing BMW FLM2 welcome light animations. It parses hex byte sequences representing light channel animations (duration/brightness pairs) and provides visual editing, diagrams, and real-time animation preview.

## Running the Application

No build system or installation. Open `index.html` directly in a browser.

### Tests

Tests live in `tests/run-tests.js` and use the Node.js built-in test runner. Run with:

```
npm test
```

Tests cover: hex parsing, sequence parsing, reassembly, round-trips, string conversions, and template hex validation. All template data in `templates.js` must contain only valid two-character hex bytes (`[0-9A-Fa-f]{2}`).

## Architecture

### File Layout

- **`index.html`** — The entire application: HTML structure, CSS, and all JavaScript (~1600 lines). This is the main file you'll be editing.
- **`templates.js`** — Generated file containing `TEMPLATES` constant with pre-defined animation data for various BMW models (hex byte strings).
- **`vehicles.js`** — `VEHICLE_CONFIGS` defining vehicle models, visualization types ("grid" or "image"), and light channel mappings (ID, SVG shape type, position, label).
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
- **duration**: hex byte × 10 = milliseconds
- **brightness**: hex byte = percentage (0x00–0x64 → 0–100%)
- **Staging1_Data**: first 252 bytes, **Staging2_Data**: additional 168 bytes (420 total per side)

Key global state: `left1Bytes`, `left2Bytes`, `right1Bytes`, `right2Bytes` (raw byte arrays), `sequencesLeft`/`sequencesRight` (parsed sequence objects).

### Data Flow

1. User inputs hex data or loads a template → populates four text areas (Left/Right × Staging1/Staging2)
2. `buildDynamicFields()` parses bytes into sequence objects
3. `renderDynamicSequences()` creates per-sequence editors (hex or visual mode) and p5.js brightness diagrams
4. `rebuildAnimationPlayer()` sets up real-time visualization (grid of bulbs or SVG overlay on vehicle image)
5. Edits in sequence editors propagate back to byte arrays via `reAssembleLeftBytes()`/`reAssembleRightBytes()`
6. Animation runs via `requestAnimationFrame` loop, interpolating brightness per channel at current time

### External Dependencies

- **p5.js v1.4.2** (loaded via CDN) — used for brightness-over-time chart diagrams

## Key Conventions

- All application logic lives in `index.html` as inline `<script>` — there are no modules or bundling.
- Diagrams use left=blue, right=red, identical=green color coding.
- The visual editor uses sliders for duration/brightness per step; hex editor uses raw textarea.
- Sequences terminate when `00, 00, 00` is encountered during parsing.
- Licensed under CC BY-NC-SA 4.0.
