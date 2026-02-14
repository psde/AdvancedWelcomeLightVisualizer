# FLM2 Channel Behavior Evidence

## Vehicle Under Test

- **Model**: BMW G20 (3 Series) 2020
- **Headlight**: EU Laser light (FLM2 module)
- **FLM2 Address**: 0x43AF (NCD file: `InitialBU_000043AF_016_002_001.ncd`)

### Channel Mapping (G20 2020 Laser)

| Channel | ID | Physical Light      | Phase |
|---------|-----|---------------------|-------|
| Ch1     | 01  | High Beam           | 1     |
| Ch2     | 02  | DRL                 | 1     |
| Ch3     | 03  | DRL - END           | 2     |
| Ch4     | 04  | Low Beam            | 1     |
| Ch5     | 05  | Low Beam - END      | 2     |

---

## Summary of Findings

### Two-Phase Playback Structure

The FLM2 plays channels in two sequential **phases**, not simultaneously:

```
Phase 1: {Ch1, Ch2, Ch4}    (simultaneous, hard-capped at ~20s)
  gap:    ~20s - Phase1_end
Phase 2: {Ch3, Ch5}          (simultaneous, always starts at ~20s)
```

END channels (Ch3, Ch5) play **concurrently** in Phase 2, each driving their respective physical light (DRL and Low Beam). Channels restart from t=0 when Phase 2 begins.

### Model C: Fixed ~20s Phase 2 Anchor (Confirmed)

Phase 2 always starts at a fixed anchor point (~20s). Phase 1 is hard-capped at the same ~20s timer (Experiment C), so Phase 1 can never exceed the anchor:

```
Phase1_end = min(max(Ch1, Ch2, Ch4), ~20s)
Phase2_start = ~20s
Total = ~20s + max(Ch3, Ch5)
```

| Experiment | Phase1_end | Phase2_start | + max(Ch3,Ch5) | Predicted | Observed | Error |
|---|---|---|---|---|---|---|
| 1: Identify Channels | 10.0s | ~20.0s | + 10.0s | 30.0s | 30.4s | -0.4s |
| 2: Original | 13.76s | ~20.0s | + 5.62s | 25.62s | ~25.2s | +0.4s |
| 4: Stagger Test | 14.0s* | 19.84s | + 23.0s | 42.84s | 42.75s | +0.09s |
| 5: v15 External | 19.90s | ~19.97s | + 6.60s | 26.57s | 26.57s | ~0s |
| **A: Short Phase 2** | **5.02s** | **~19.85s** | **+ 3.0s** | **~22.85s** | **22.74s** | **+0.11s** |
| **B: Long Phase 2** | **5.02s** | **~19.85s** | **+ 11.02s** | **~30.87s** | **30.84s** | **+0.03s** |
| **C: Max Phase Duration** | **capped ~20s** | **~19.82s** | **+ 4.0s** | **~23.82s** | **23.82s** | **~0s** |

*Phase 1 effectively ends at Ch2's end (14s); Ch4's 32s data exceeds the ~20s duration cap.

The ~0.4s errors in Experiments 1 and 2 reflect less precise timing methods compared to later frame-by-frame analysis. The Phase 2 anchor across all precise measurements spans **19.74–19.97s**. Best estimate: **~19.85s** (excluding imprecise measurements).

| Experiment | Phase 2 start | Method |
|---|---|---|
| 4: Stagger Test | 19.84s | Ch3 active content onset |
| 5: v15 External | 19.97s | Ch3 peak offsets |
| A: Short Phase 2 | ~19.91s | T2 visual (imprecise) |
| A: Short Phase 2 | 19.74s | T3 minus Ch3 duration (less reliable) |
| B: Long Phase 2 | 19.82s | Dimming onset and total duration |
| C: Max Phase Duration | 19.82s | Total minus Ch3 duration |

> **Status**: **Confirmed.** Experiments A+B provide definitive independent validation — same Phase 1 (5s), different Phase 2 (3s vs 11s). The 8.10s difference in total duration matches Model C's prediction (~8s) and decisively falsifies Model B (which predicts ~0s difference). All 7 experiments fit Model C within ±0.4s.

### Duration Cap (~20s)

Phase 1 has a maximum duration of **~20s**, confirmed by Experiment C:
- Experiment C: Ch1 programmed for 26.5s, but HB cuts off at 19.94s with instant 100%→0% (no dimming) — Phase 1 hard-capped
- The cap (~19.94s) closely matches the Phase 2 anchor (~19.82–19.85s) — likely the **same ~20s timer**: Phase 1 runs until the timer expires, then Phase 2 starts
- Experiment 3: Ch4 at ~32s never lit up (consistent with ~20s cap, originally misinterpreted as ~25s)
- Experiment 4: Ch4 (active at 27s in Phase 1) never visible (consistent with ~20s cap)
- Experiment 4: Ch5 (active at 36s absolute, i.e. ~16s into Phase 2) also never visible — may indicate a separate Phase 2 cap or total animation length cap

### Default State Revert

When no FLM2 channel controls a light, it reverts to its **hardware default state** (not "hold last value"). The DRL defaults to parking brightness (~50%, with visible PWM). This is confirmed by:
- Experiment 1: DRL turns ON during the 10s gap despite Ch2's last value being 0%
- Experiment 4: DRL at ~50% with PWM immediately after Ch2 ends at 14s
- Experiment 5: DRL never fully dark between Ch2 ending (7.02s) and Ch3 starting (~19.97s)

The default-on state shows ~2s hardware ramp-up/ramp-down transitions when FLM2 channels take or release control.

### Inter-Phase Transition Delay

A consistent ~0.10s hardware delay exists between Phase 1 ending and Phase 2 starting, measured via Ch3 peak offsets in Experiment 5.

---

## Experiments

### Experiment 1: Identify Channels

**Setup**: All channels configured to 10s total (1s flash staggered with leading zeros).

| Channel | Leading Off | On Duration | Trailing Off | Total |
|---------|-------------|-------------|--------------|-------|
| Ch1     | 0ms         | 1000ms      | 9000ms       | 10.0s |
| Ch2     | 2000ms      | 1000ms      | 7000ms       | 10.0s |
| Ch3     | 4000ms      | 1000ms      | 5000ms       | 10.0s |
| Ch4     | 6000ms      | 1000ms      | 3000ms       | 10.0s |
| Ch5     | 8000ms      | 1000ms      | 1000ms       | 10.0s |

**Key Observations** (revised with 60fps frame counting):

- **Total duration**: ~30.4s (not 10s simultaneous, not 20s sequential — confirms two-phase + gap)
- **Phase 1** (t=0 to ~10s): Ch1 peak at 1.00s, Ch2 peak at 3.00s, Ch4 peak at 7.00s — all exact matches
- **Gap** (~10s to ~20s): DRL turns ON at 9.98s (default parking brightness, ~2s ramp up), OFF at 21.96s (~2s ramp down as Ch3 takes control)
- **Phase 2** (starting ~20s): Ch3 peak at 24.96s (predicted 25.00s, -0.04s), Ch5 peak at 28.95s (predicted 29.00s, -0.05s)

The 4.00s gap between Ch3 and Ch5 peaks exactly matches their leading-zero difference (4s vs 8s), confirming simultaneous Phase 2 start.

**Conclusions**: Established two-phase model. Originally misinterpreted as three sequential phases; 60fps re-analysis corrected this.

---

### Experiment 2: Original Template

**Setup**: Factory-style template with complex brightness patterns.

| Channel | Pairs | Duration | Key Pattern |
|---------|-------|----------|-------------|
| Ch1     | 15    | 13.76s   | 5s off -> ramp to 100% -> hold -> fade |
| Ch2     | 5     | 3.94s    | 2.5s off -> 240ms dim -> 1.2s bright |
| Ch3     | 3     | 2.62s    | 1.2s@43% -> 1.18s@20% -> 240ms off |
| Ch4     | 3     | 2.44s    | 1s off -> 240ms@20% -> 1.2s@46% |
| Ch5     | 6     | 5.62s    | 3x(1s@46%) -> 1.2s@43% -> 1.18s@20% -> 240ms off |

**Key Observations**:

- Phase 1 = max(13.76, 3.94, 2.44) = **13.76s**
- Phase 2 = max(2.62, 5.62) = **5.62s**
- Recorded total: **~25.2s** (gap of ~5.8s between phases)
- Under Model C: Phase 2 starts at ~20s, total = 20 + 5.62 = 25.62s (matches within ~0.4s)

---

### Experiment 3: Long Duration Test (Informal)

**Setup**: Ch4 (Low Beam) configured to ~32s duration; other channels shorter.

**Result**: Ch4 never lit up. Suggests a **maximum duration cap** for Phase 1. Later confirmed by Experiment C to be ~20s (originally estimated at ~25-30s, but no experiment had content between 20-25s to discriminate).

---

### Experiment 4: Stagger Test

**Purpose**: Test channel timing with large staggered offsets. Five channels with identical 5s active profiles (2s fade-in, 1s hold, 2s fade-out) offset by 9s each via leading zeros. Total programmed duration: 41s.

**Raw hex** (Left side; Right side identical):
```
01, 00, 03, 64, 64, 32, 64, 64, 00, 02, 00, 05, FF, 00, C3, 00, 64, 64, 32, 64, 64, 00, 03, 00, 07, FF, 00, FF, 00, FF, 00, 87, 00, 64, 64, 32, 64, 64, 00, 04, 00, 09, FF, 00, FF, 00, FF, 00, FF, 00, FF, 00, 4B, 00, 64, 64, 32, 64, 64, 00, 05, 00, 0B, FF, 00, FF, 00, FF, 00, FF, 00, FF, 00, FF, 00, FF, 00, 0F, 00, 64, 64, 32, 64, 64, 00, 00, 00
```

**Template Data**:

| Channel | ID | Physical Light | Leading Off | Active Profile | Total |
|---------|----|----------------|------------|----------------|-------|
| Ch1 | 01 | High Beam | 0s | 2s up, 1s hold, 2s down | 5.0s |
| Ch2 | 02 | DRL | 9.0s | 2s up, 1s hold, 2s down | 14.0s |
| Ch3 | 03 | DRL-END | 18.0s | 2s up, 1s hold, 2s down | 23.0s |
| Ch4 | 04 | Low Beam | 27.0s | 2s up, 1s hold, 2s down | 32.0s |
| Ch5 | 05 | LB-END | 36.0s | 2s up, 1s hold, 2s down | 41.0s |

**Observed Behavior**:

| Time | Event |
|------|-------|
| ~0s | Ch1 (High Beam) fades in |
| ~5s | Ch1 fades out |
| ~9s | Ch2 (DRL) fades in |
| ~14s | Ch2 fades out; DRL immediately reverts to default ~50% with PWM |
| 14-~20s | DRL at default parking brightness (not Ch3 — Ch3 hasn't started yet) |
| ~20s onward | DRL gradually dims as Ch3 takes control at 0% (leading zeros override default) |
| ~25s | DRL fully dark (default state fully overridden by Ch3's 0%) |
| 25-37.8s | Complete darkness |
| 37.84s | Ch3's active content begins (fade-in) — exactly 19.84 + 18.0s leading zeros |
| 39.84s | Ch3 at 100% |
| 42.75s | Ch3 fade-out complete |
| — | Ch4 and Ch5 never visible |

**Key Findings**:

1. **Phase 2 anchor at 19.84s**: Derived from Ch3 active content start (37.84s) minus 18.0s leading zeros. Consistent with ~20s anchor from other experiments.

2. **DRL at 14s is default revert, not Ch3**: The ~50% brightness with PWM flickering immediately after Ch2 ended matches the DRL's default parking behavior seen in Experiments 1 and 5. Ch3 doesn't start until 19.84s.

3. **11s DRL visibility explained**: The 14-25s visibility comprises two effects: 5.84s of default-on (14.0-19.84s) plus ~5s of gradual dimming as Ch3's 0% output overrides the default (19.84-~24.9s). Total ~10.9s, matching observed ~11s.

4. **Ch3 active content at 40-43s**: Not a second animation cycle — it's Ch3's programmed 5s profile playing at its correct offset (19.84 + 18.0 = 37.84s).

5. **Duration cap evidence**: Ch4 (programmed to activate at 27s absolute, within Phase 1) never visible — consistent with the ~20s Phase 1 cap confirmed by Experiment C. Ch5 (programmed to activate at 36s absolute, which is ~16s into Phase 2 starting at 19.84s) also never visible — this may indicate a Phase 2 cap or total animation length cap rather than the Phase 1 cap alone.

**Frame-level verification** (all within <0.1s of Model C predictions):

| Event | Predicted | Observed | Delta |
|-------|-----------|----------|-------|
| DRL default revert | 14.0s | ~14s | ~0s |
| Ch3 takes control | 19.84s | ~20s | ~-0.2s |
| Fully dark | ~24.9s | 24.76s | +0.1s |
| Ch3 fade-in begins | 37.84s | 37.84s | **0.00s** |
| Ch3 at 100% | 39.84s | 39.84s | **0.00s** |
| Ch3 fade-out starts | 40.84s | 40.84s | **0.00s** |
| Ch3 fade-out ends | 42.84s | 42.75s | +0.09s |

This is the strongest evidence for Model C — frame-perfect predictions with a consistent anchor point.

---

### Experiment 5: External Video Peak Analysis (v15 Template)

**Setup**: Independent observer, same vehicle spec (BMW G20 Laser). Template: "BMW G20 2022 - EU - Laser light - Left right swipe v15". 30fps video, 26.57s total.

**Template Data** (Left Side):

| Channel | ID | Physical Light | Pairs | Duration |
|---------|----|----------------|-------|----------|
| Ch1     | 01 | High Beam      | 15    | 19.90s   |
| Ch2     | 02 | DRL            | 23    | 7.02s    |
| Ch3     | 03 | DRL-END        | 19    | 6.16s    |
| Ch4     | 04 | Low Beam       | 11    | 6.94s    |
| Ch5     | 05 | LB-END         | 9     | 6.60s    |

Phase 1 = max(19.90, 7.02, 6.94) = **19.90s** (limited by Ch1).

**DRL Peak Predictions vs Observed** (9 peaks across both phases):

| # | Source | Predicted | Observed | Diff |
|---|--------|-----------|----------|------|
| 1 | Ch2 P1 | 2.44s | 2.40s | -0.04s |
| 2 | Ch2 P2 | 3.22s | 3.20s | -0.02s |
| 3 | Ch2 P3 | 3.59s | 3.57s | -0.02s |
| 4 | Ch2 P4 | 4.37s | 4.33s | -0.04s |
| 5 | Ch2 P5 | 4.91s | 4.90s | -0.01s |
| 6 | Ch3 P1 | 22.04s | 22.10s | +0.06s |
| 7 | Ch3 P2 | 22.78s | 22.87s | +0.09s |
| 8 | Ch3 P3 | 23.16s | 23.23s | +0.07s |
| 9 | Ch3 P4 | 23.90s | 23.97s | +0.07s |

All 9 predictions within **+/-0.09s** (<=3 frames at 30fps). Ch3 predictions use Phase 2 start = Phase1_end + 0.10s = 19.97s.

**Additional Measurements**:

- **Phase 1 end** (High Beam OFF): 19.87s observed vs 19.90s predicted (-0.03s, ~1 frame)
- **Inter-phase delay**: Consistent +0.10s offset on all Ch3 peaks, giving Phase 2 start at **~19.97s**
- **Ch5 backward calculation**: Working backwards from Ch5's observed end time (26.53s) through its data:

  | Ch5 Event | Time into Ch5 | Absolute (26.53 − remaining) | Observed | Diff |
  |-----------|---------------|-------------------------------|----------|------|
  | 30% baseline starts | 0.00s | 19.93s | "might be on" | — |
  | Flash ramp (95%) | 4.70s | 24.63s | 24.67s | +0.04s |
  | Peak (100%) | 4.94s | 24.87s | ~24.9s | +0.03s |
  | Trailing zeros end | 6.60s | 26.53s | 26.53s | exact |

  Ch5 starts at **19.93s** — matching Ch3 start (~19.97s), confirming simultaneous Phase 2
- **DRL default-on during gap**: DRL never fully dark between Ch2 ending (7.02s) and Ch3 starting (~19.97s), consistent with default revert behavior

**Possible FLM2 interpolation**: High Beam showed gradual dim from ~17s to ~18.8s where the template programs an instant 100%->50% step at 17.90s. May indicate FLM2 smooths brightness transitions.

**Significance**: Cleanest experiment — 12 independent measurements all within +/-0.12s. Independent observer and vehicle confirm the two-phase model and ~20s anchor.

---

### Experiment A: Short Phase 2 Baseline

**Goal**: Pin down exact Phase 2 anchor with short Phase 2 content. First of the A/B pair designed to discriminate Model C vs Model B.

**Setup**: Phase 1 = 5s (Ch1 HB on), Phase 2 = 3s (Ch3/Ch5: 2s on + 1s off). Ch4 at 0% to keep LB dark.

| Channel | Pattern | Duration | Purpose |
|---------|---------|----------|---------|
| Ch1 (HB) | 5s ON, 20ms OFF | ~5.02s | Phase 1 end marker |
| Ch2 (DRL) | 2s ON, 3s OFF | 5s | Start marker |
| Ch3 (DRL-END) | 2s ON, 1s OFF | 3s | Phase 2 DRL |
| Ch4 (LB) | 5s at 0% | 5s | Dark |
| Ch5 (LB-END) | 2s ON, 1s OFF | 3s | Phase 2 LB |

```
Ch1: 01, 00, 02, FA, 64, 01, 00
Ch2: 02, 00, 02, 64, 64, 96, 00
Ch3: 03, 00, 02, 64, 64, 32, 00
Ch4: 04, 00, 01, FA, 00
Ch5: 05, 00, 02, 64, 64, 32, 00
Terminator: 00, 00, 00
```

**Recording**: 59.51fps (60fps configured).

**Raw Measurements**:

| Event | Time | Notes |
|-------|------|-------|
| T1: HB off | 5.06s | Expected ~5.02s (Ch1: FA=5.0s + 01=0.02s) |
| T2: DRL brightens / LB on | ~19.91s | Hard to frame-count — DRL default→Ch3 transition is very subtle |
| DRL max brightness after T2 | 21.66s | 1.75s hardware ramp after Phase 2 start |
| T3: Last light off | 22.74s | |

**Total duration**: 22.74s.

**Analysis**:

- T1 = 5.06s vs expected ~5.02s: delta +0.04s — Phase 1 content plays accurately
- T2 ≈ 19.91s — imprecise due to subtle DRL brightness change (default parking → Ch3 at 100%)
- DRL max brightness at 21.66s = 1.75s hardware ramp-up after Phase 2 start
- T3 = 22.74s vs Model C prediction (19.91 + 3.0 = 22.91s): delta -0.17s
- Phase 2 anchor derived from T3: 22.74 - 3.0 = 19.74s (less reliable than T2 due to compounding)
- **Model C prediction**: ~20 + 3.0 = ~23s — matches observed 22.74s
- **Model B (min=25) prediction**: ~25s — off by 2.3s, clearly wrong

---

### Experiment B: Long Phase 2

**Goal**: B-vs-C discrimination. Same Phase 1 as A, much longer Phase 2.

**Setup**: Phase 1 = 5s (identical to Exp A), Phase 2 = 11.02s (Ch3/Ch5: 5.1s on + 4.92s on + 1s off).

| Channel | Pattern | Duration | Purpose |
|---------|---------|----------|---------|
| Ch1 (HB) | 5s ON, 20ms OFF | ~5.02s | Phase 1 end marker (same as A) |
| Ch2 (DRL) | 2s ON, 3s OFF | 5s | Start marker (same as A) |
| Ch3 (DRL-END) | FF(5.1s) + F6(4.92s) ON, 1s OFF | 11.02s | Phase 2 DRL (**long**) |
| Ch4 (LB) | 5s at 0% | 5s | Dark (same as A) |
| Ch5 (LB-END) | FF(5.1s) + F6(4.92s) ON, 1s OFF | 11.02s | Phase 2 LB (**long**) |

```
Ch1: 01, 00, 02, FA, 64, 01, 00
Ch2: 02, 00, 02, 64, 64, 96, 00
Ch3: 03, 00, 03, FF, 64, F6, 64, 32, 00
Ch4: 04, 00, 01, FA, 00
Ch5: 05, 00, 03, FF, 64, F6, 64, 32, 00
Terminator: 00, 00, 00
```

**Recording**: 59.51fps.

**Raw Measurements**:

| Event | Time | Notes |
|-------|------|-------|
| T1: HB off | 4.95s | Expected ~5.02s |
| T2: Phase 2 start | — | Can't measure — DRL dimming is really subtle |
| Lights starting to dim | 29.84s | Ch3/Ch5 active content ending |
| T3: Last light off | 30.84s | |

**Total duration**: 30.84s.

**Analysis**:

- T1 = 4.95s vs expected ~5.02s: delta -0.07s
- Ch3/Ch5 active content: FF(5.1s) + F6(4.92s) = 10.02s at 100%
- Ch3/Ch5 total with trailing off: 10.02 + 1.0s = 11.02s
- Dimming at 29.84s = Phase 2 start + 10.02s → Phase 2 start = 19.82s
- Total 30.84s = Phase 2 start + 11.02s → Phase 2 start = 19.82s (consistent)
- **Model C prediction**: ~20 + 11.02 = ~31.02s → delta -0.18s

**Cross-Experiment A-vs-B Comparison (the decisive test)**:

| | Model C | Model B (min=25) | Observed |
|---|---|---|---|
| Total A | ~23s | ~25s | 22.74s |
| Total B | ~31s | ~25s | 30.84s |
| **Difference** | **~8s** | **~0s** | **8.10s** |

The 8.10s difference decisively confirms Model C and **falsifies Model B**. Under Model B, both experiments should have similar totals (~25s), but the observed difference matches Model C's prediction exactly.

---

### Experiment C: Max Phase Duration

**Goal**: Determine the Phase 1 duration cap (Q2).

**Setup**: Ch1 programmed for 26.5s (5×FF at 100% = 25.5s + 1s off). Short Phase 2 (4s).

| Channel | Pattern | Duration | Purpose |
|---------|---------|----------|---------|
| Ch1 (HB) | 25.5s ON, 1s OFF | 26.5s | Long HB — does it get truncated? |
| Ch2 (DRL) | 2s ON, 1s OFF | 3s | Brief start marker |
| Ch3 (DRL-END) | 3s ON, 1s OFF | 4s | Phase 2 DRL |
| Ch4 (LB) | 3s at 0% | 3s | Dark |
| Ch5 (LB-END) | 3s ON, 1s OFF | 4s | Phase 2 LB |

```
Ch1: 01, 00, 06, FF, 64, FF, 64, FF, 64, FF, 64, FF, 64, 32, 00
Ch2: 02, 00, 02, 64, 64, 32, 00
Ch3: 03, 00, 02, 96, 64, 32, 00
Ch4: 04, 00, 01, 96, 00
Ch5: 05, 00, 02, 96, 64, 32, 00
Terminator: 00, 00, 00
```

**Raw Measurements**:

| Event | Time | Notes |
|-------|------|-------|
| HB off | 19.94s | Instant 100%→0% cutoff, no dimming — hard cap |
| Last light off | 23.82s | |

**Total duration**: 23.82s.

**Key Finding — Phase 1 cap is ~20s, not ~25s**:

- Ch1 programmed for 26.5s, but HB cuts off at **19.94s** with instant brightness drop (no dimming ramp)
- This is a hard cap — the FLM2 abruptly terminates Phase 1 at ~20s
- Phase 2 start derived from total: 23.82 - 4.0 = **19.82s**
- Phase 1 cap (~19.94s) ≈ Phase 2 anchor (~19.82s) — these are likely the **same ~20s timer**

The mechanism appears to be: a single ~20s timer governs both the Phase 1 cap and the Phase 2 start. Phase 1 runs until either its content ends or the timer expires (whichever comes first), then Phase 2 begins.

Previous evidence (Experiment 3: Ch4 at ~32s, Experiment 4: Ch4 at 27s) was consistent with a ~20s cap but was originally misinterpreted as ~25s — neither experiment had content between 20s and 25s to discriminate the two values.

---

### Experiment D: Precise Phase 2 Anchor (Planned)

**Goal**: Pin down Phase 2 start to within 1–2 frames using sharp 0%→100% transitions. Current range is 19.74–19.97s (0.23s spread) — Experiments A/B suffered from subtle DRL transitions that were hard to frame-count.

**Key design insight**: Use LB (Low Beam) as the primary Phase 2 marker. LB defaults to OFF (unlike DRL which defaults to ~50%), so when Ch5 drives 100% at Phase 2 start, the 0%→100% transition should be unambiguous. The HB instant cutoff in Exp C proves the FLM2 can do single-frame transitions — LB should behave similarly.

**Additional improvement**: Add a 0%→100% step on Ch3 after a brief 0% lead-in, so DRL also has a sharp dark→bright transition (Ch3 at 0% overrides DRL default, then jumps to 100%).

| Channel | Pattern | Duration | Purpose |
|---------|---------|----------|---------|
| Ch1 (HB) | 5s ON, 20ms OFF | 5.02s | Phase 1 end marker |
| Ch2 (DRL) | 100ms ON, 4.9s OFF | 5.0s | Brief start flash, then DRL goes to default |
| Ch3 (DRL-END) | 1s at 0%, 2s at 100%, 1s OFF | 4s | 0% overrides default → sharp jump to 100% |
| Ch4 (LB) | 5s at 0% | 5s | Keep LB dark |
| Ch5 (LB-END) | 3s at 100%, 1s OFF | 4s | LB dark→bright = Phase 2 start marker |

```
Ch1: 01, 00, 02, FA, 64, 01, 00
Ch2: 02, 00, 02, 05, 64, F5, 00
Ch3: 03, 00, 03, 32, 00, 64, 64, 32, 00
Ch4: 04, 00, 01, FA, 00
Ch5: 05, 00, 02, 96, 64, 32, 00
Terminator: 00, 00, 00
```

**Hex breakdown**:
- Ch2: 0x05=100ms at 100%, 0xF5=4900ms at 0%. Total 5.0s.
- Ch3: 0x32=1s at 0%, 0x64=2s at 100%, 0x32=1s at 0%. Total 4s.
- Ch5: 0x96=3s at 100%, 0x32=1s at 0%. Total 4s.

**Byte count**: 7 + 7 + 9 + 5 + 7 + 3 = 38 bytes (fits in staging1's 252 limit).

**What to measure**:
- T1: HB off (~5s) — sharp, easy
- T2: **LB turns on** — primary measurement, should be sharp 0→100% (frame-count this)
- T2b: DRL goes bright (~T2 + 1s, after Ch3's 0% lead-in) — secondary confirmation
- T3: last light off

**Prediction**: T2 = ~19.85s (Phase 2 anchor). Total = ~19.85 + 4.0 = **~23.85s**.

**Why this is better than Exp A**: Two sharp markers instead of zero — LB dark→bright at Phase 2 start, and DRL dark→bright 1s later. Both are 0%→100% transitions.

**Caveat**: The Ch3 DRL marker may not be perfectly sharp — the DRL default (~50%) takes ~2s to ramp down, so 1s of Ch3 at 0% may not fully darken the DRL before the jump to 100%. The LB marker (Ch5) is the primary measurement since LB defaults to OFF and has no ramp ambiguity.

---

### Experiment E: Phase 2 Cap Test (Planned)

**Goal**: Determine if Phase 2 has a duration cap, and if so, measure it. Experiment 4 showed Ch5 content at ~16s into Phase 2 never appeared — is there a Phase 2 cap?

**Design**: Program Ch3/Ch5 with 36.7s of Phase 2 content (constant 100%, then off). Measure total duration. Total minus ~20s = actual Phase 2 duration played. If less than 36.7s, there's a cap.

| Channel | Pattern | Duration | Purpose |
|---------|---------|----------|---------|
| Ch1 (HB) | 5s ON, 20ms OFF | 5.02s | Phase 1 end marker |
| Ch2 (DRL) | 100ms ON, 4.9s OFF | 5.0s | Brief start flash |
| Ch3 (DRL-END) | 35.7s at 100%, 1s OFF | 36.7s | Long Phase 2 content |
| Ch4 (LB) | 5s at 0% | 5s | Keep LB dark |
| Ch5 (LB-END) | 35.7s at 100%, 1s OFF | 36.7s | Mirror on LB |

```
Ch1: 01, 00, 02, FA, 64, 01, 00
Ch2: 02, 00, 02, 05, 64, F5, 00
Ch3: 03, 00, 08, FF, 64, FF, 64, FF, 64, FF, 64, FF, 64, FF, 64, FF, 64, 32, 00
Ch4: 04, 00, 01, FA, 00
Ch5: 05, 00, 08, FF, 64, FF, 64, FF, 64, FF, 64, FF, 64, FF, 64, FF, 64, 32, 00
Terminator: 00, 00, 00
```

**Hex breakdown**: Ch3/Ch5 each have 8 pairs — 7× FF (5.1s each) at 100% = 35.7s, then 0x32 (1s) at 0%. Total = 36.7s.

**Byte count**: 7 + 7 + 19 + 5 + 19 + 3 = 60 bytes (fits in staging1's 252 limit).

**Predictions**:
- No Phase 2 cap: total = ~20 + 36.7 = **~56.7s**
- Cap at ~20s: total = ~20 + 20 = **~40s**
- Cap at ~25s: total = ~20 + 25 = **~45s**

**What to measure**: T1 (HB off, ~5s), T2 (LB on, ~20s), T3 (last light off). Phase 2 duration = T3 − T2. LB on at ~20s and LB off at end are both sharp transitions (using Exp D's LB marker design).

---

### Experiment F: Cross-Vehicle Validation (For Friends)

**Goal**: Test whether the ~20s timer / two-phase model exists on other BMW FLM2 modules. All evidence so far is from one G20 2020 laser — need independent vehicle confirmation.

**Challenge**: Channel IDs and count vary across vehicles (some have up to 15 channels). The channel mapping must be determined from the vehicle's original Staging1/Staging2 data before designing the template.

**Methodology** (adapt per vehicle):

1. **Determine channel mapping**: Read the vehicle's original FLM2 Staging1/Staging2 hex data. Parse channel IDs and identify which channels are "END" channels (Phase 2) vs base channels (Phase 1). The original data's channel IDs and structure reveal this.

2. **Build a minimal test template**: Equivalent to Experiment A — pick one Phase 1 channel (preferably one with a sharp on/off like High Beam) at 5s duration, and the END channels at 3s duration. All other channels at 0% for 5s (to keep them dark without reverting to default).

3. **Flash and measure**: Total duration with a phone stopwatch.

**Template pattern** (substitute actual channel IDs from step 1):
```
[Phase1_marker_ID], 00, 02, FA, 64, 01, 00     -- 5s ON, 20ms OFF
[Other_Phase1_IDs], 00, 01, FA, 00              -- 5s at 0% each
[END_channel_IDs],  00, 02, 64, 64, 32, 00      -- 2s ON, 1s OFF each
00, 00, 00                                       -- terminator
```

**Decision tree** (friend measures total duration):
- **Total ~23s, marker off ~5s** → ~20s timer confirmed on their vehicle
- **Total ~8s, marker off ~5s** → no timer, phases play back-to-back
- **Total ~5s** → all channels simultaneous, no phase separation
- **Nothing happens** → channel IDs wrong or template rejected

**Optional second experiment**: Same Phase 1, but END channels at 11s (Experiment B equivalent). If total differs from first run by ~8s, Model C confirmed on their vehicle.

**What to report**: Vehicle model, headlight type, channel IDs used, total duration, time of Phase 1 marker off.

---

## Falsified Models

### Model A: No Gap Between Phases

Predicted total = Phase1 + max(Ch3, Ch5) with Phase 2 starting immediately after Phase 1. **Falsified** — fails Experiments 1 and 2 with 5-10s errors (cannot explain the gap). Only appeared to work for v15 because Phase 1 (~20s) coincidentally matched the anchor point.

### Model B: Variable Minimum Total Duration — Falsified

Phase 2 anchored to the **end** of a minimum total timeline, with gap inserted if content is too short. **Falsified by Experiments A+B.**

**Decisive evidence — the A-vs-B comparison**:

Experiments A and B have identical Phase 1 (5s) but different Phase 2 (3s vs 11s). Model B predicts total duration is dominated by a minimum, so both should have similar totals. Model C predicts Phase 2 content directly adds to the ~20s anchor, giving an ~8s difference.

| | Model C | Model B (min=25) | Observed |
|---|---|---|---|
| Total A | ~23s | ~25s | 22.74s |
| Total B | ~31s | ~25s | 30.84s |
| **Difference** | **~8s** | **~0s** | **8.10s** |

The observed 8.10s difference is exactly what Model C predicts and is incompatible with any fixed-minimum Model B variant.

**The Minimum Duration Puzzle** (earlier evidence already disfavored Model B):

| Experiment | Phase 1 | max(Ch3,Ch5) | Observed Total | Gap | Implied Minimum |
|---|---|---|---|---|---|
| Identify Channels | 10.0s | 10.0s | 30.4s | ~10s | ~30s |
| Original | 13.76s | 5.62s | 25.2s | ~5.8s | ~25s |
| v15 | 19.90s | 6.60s | 26.57s | ~0s | ≤26.5s |

If the minimum were fixed at 25s, Identify Channels should be ~25s (not 30.4s). If fixed at 30s, Original should be ~30s (not 25.2s). Model C resolves this by replacing the variable minimum with a fixed ~20s anchor — all fit within ±0.4s.

---

## Open Questions

### Q1: Does time restart per phase? — Confirmed

When Phase 2 begins, channels restart from their own t=0. **Confirmed** by Experiments 1, 4, 5, A, and B — Ch3/Ch5 content consistently plays from t=0 relative to Phase 2 start.

### Q2: Maximum Phase 1 duration? — Answered: ~20s

**Answered by Experiment C**: Phase 1 is hard-capped at **~20s** (19.94s measured). Ch1 programmed for 26.5s cuts off abruptly at 19.94s with instant 100%→0%. The cap coincides with the Phase 2 anchor — likely the same timer.

Previous estimate of ~25s was based on experiments that lacked content between 20–25s, so the tighter cap couldn't be distinguished.

### Q3: Does Phase 2 have a duration cap? — Open

Experiment 4 showed Ch5 content scheduled at ~16s into Phase 2 never appeared. This could indicate a Phase 2 cap, a total animation length cap, or something else entirely.

**Evidence so far**:
- Experiment 4: Ch5 active at ~36s absolute (~16s into Phase 2) — never visible
- Experiment B: Ch3/Ch5 at 11.02s played fully — no cap at 11s
- Experiment 4: Ch3 at 23s into Phase 2 played fully — no cap at 23s

The Experiment 4 evidence is ambiguous because Ch5's content was preceded by 36s of leading zeros (most beyond the ~20s cap). **Experiment E** is designed to resolve this by testing 36.7s of Phase 2 content directly.

### Q7: Do END channels override or add to base channels?

Ch3 = "DRL - END" and Ch5 = "Low Beam - END" — do they replace or combine with Ch2/Ch4? The phase separation suggests independent sequential animations, but this hasn't been definitively tested.

### Q4: Does Phase 1 end based on last active channel or cap? — Answered: Cap

**Answered by Experiment C**: Phase 1 ends based on the **~20s cap**, not channel content length. If channel content exceeds the cap, it is hard-truncated (instant cutoff, no dimming). If all channels end before the cap, Phase 1 ends when the last channel finishes (and the gap until ~20s is filled with default states).

### Q5: Mid-phase revert — Confirmed: immediate revert

**Confirmed** by Experiments A and B: DRL reverts to default parking brightness immediately when Ch2 ends (~2–5s), well before Phase 1 ends. The light does not hold its last programmed value — it reverts to hardware default as soon as the channel's data runs out, regardless of whether the phase is still active.

### Q6: Does the FLM2 interpolate between brightness steps?

In Experiment 5, High Beam showed gradual dimming where the template programs an instant step. Single observation at 30fps — could be FLM2 interpolation or LED driver response time.

---

## Completed Experiments Summary

| Experiment | Phase 1 | Phase 2 | Total Observed | Model C Error | Key Finding |
|---|---|---|---|---|---|
| 1: Identify Channels | 10.0s | 10.0s | 30.4s | -0.4s | Two-phase model discovered |
| 2: Original | 13.76s | 5.62s | ~25.2s | +0.4s | Gap confirms phases |
| 3: Long Duration | ~32s | — | — | — | Duration cap exists (informal) |
| 4: Stagger Test | 14.0s | 23.0s | 42.75s | +0.09s | Frame-perfect Phase 2 anchor |
| 5: v15 External | 19.90s | 6.60s | 26.57s | ~0s | Independent validation |
| A: Short Phase 2 | 5.02s | 3.0s | 22.74s | +0.11s | Model C confirmed |
| B: Long Phase 2 | 5.02s | 11.02s | 30.84s | +0.03s | Model B falsified |
| C: Max Phase | 26.5s (capped) | 4.0s | 23.82s | ~0s | Phase 1 cap = ~20s |
| **D: Precise Anchor** | **5.02s** | **4.0s** | **planned** | — | **Sharp LB marker for Phase 2 start** |
| **E: Phase 2 Cap** | **5.02s** | **36.7s** | **planned** | — | **Test Phase 2 duration limit** |
| **F: Cross-Vehicle** | **varies** | **varies** | **planned** | — | **Validate model on other vehicles** |

---

## Measurement Precision Guide

| Measurement | Precision needed | Why |
|-------------|-----------------|-----|
| T1 (HB off) | Stopwatch | Confirms animation running; duration known from hex data |
| T2 (Phase 2 start) | Frame-count when possible | Pins down Phase 2 anchor |
| T3 (last light off) | Stopwatch | +/-1s sufficient for model validation |

---

## Recording Protocol

1. Use 60fps camera (phone slow-mo or screen recording)
2. Start recording before opening door / triggering welcome light
3. On first viewing: note approximate times with stopwatch for all T1/T2/T3
4. Frame-count key transitions when precision matters
5. Record at least 2 runs per template for consistency
6. Note ambient conditions (temperature, battery state) if behavior seems inconsistent

### Experiment Design Lessons

- **Use sharp brightness transitions** (0%↔100%) at key measurement points. Subtle dimming (e.g., DRL default ~50% → Ch3 at 100%) is nearly impossible to frame-count accurately. Experiments A and B suffered from this — the DRL default-to-Phase-2 transition was too subtle to pinpoint T2.
- **Avoid relying on transitions between similar brightness levels** for timing. The HB 100%→0% cutoff in Experiments A, B, and C was unambiguous; the DRL transitions were not.
- **Use LB as a Phase 2 marker** — LB defaults to OFF (unlike DRL which defaults to ~50%), so a Ch5 0%→100% transition at Phase 2 start should be unambiguous. Designed into Experiments D and E.
- **Override defaults with explicit 0% before a sharp transition** — programming Ch3 at 0% before jumping to 100% creates a dark→bright transition on DRL, making the Phase 2 onset visible even through the default ramp-down.
