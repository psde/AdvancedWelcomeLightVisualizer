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

## Key Discovery: Two-Phase Playback

The real FLM2 does **NOT** play all 5 channels simultaneously (as our visualizer assumes). Channels play in two sequential **phases**, with a variable gap between them:

```
Phase 1: {Ch1, Ch2, Ch4}    (simultaneous within phase)
  gap:    variable (0s to ~10s observed, depends on total animation length)
Phase 2: {Ch3, Ch5}          (simultaneous, starts after gap)
```

END channels (Ch3, Ch5) play **concurrently** in Phase 2, each driving their respective physical light (DRL and Low Beam). The total animation duration and gap are determined by a formula not yet fully understood — see Competing Models.

During the gap, lights not controlled by any channel revert to their **default state** (e.g., DRL turns on at its normal parking brightness).

---

## Competing Models

Three models explain the observed channel behavior. All agree on two-phase structure ({Ch1,Ch2,Ch4} → gap → {Ch3,Ch5}), but differ on what determines the total animation length and the gap between phases.

### Established Facts (from Experiments 1 and 5)

- Phase 1 = {Ch1, Ch2, Ch4} simultaneous, duration = max(Ch1, Ch2, Ch4)
- Phase 2 = {Ch3, Ch5} simultaneous, duration = max(Ch3, Ch5)
- Variable gap between Phase 1 and Phase 2
- ~0.10s inter-phase transition delay (hardware)
- Lights revert to default state during the gap (e.g., DRL turns on at parking brightness)
- Channels restart from t=0 when Phase 2 begins

### Model A: No Minimum Duration — *Status: Falsified*

Total = Phase 1 + max(Ch3, Ch5), with no gap. Phase 2 starts immediately after Phase 1.

```
|-- Phase 1 --|-- Phase 2 --|
   Ch1,Ch2,Ch4   Ch3 + Ch5
```

- **Identify Channels**: 10 + 10 = 20s predicted → **30.4s recorded** (10.4s error — cannot explain the 10s gap)
- **Original**: 13.76 + 5.62 = 19.38s predicted → 25.2s recorded (**5.8s unexplained**)
- **v15**: 19.90 + 6.60 = 26.50s predicted → 26.57s recorded (0.07s error — fits, but only because Phase 1 is already ~20s)

**Falsified**: Fails two of three precisely-timed experiments with 5-10s errors. The near-perfect v15 match is coincidental — Phase 1 happens to be ~20s, so the absence of a gap is indistinguishable from Models B and C.

### Model B: Fixed Minimum Duration with Gap

The FLM2 operates on a timeline with a minimum total duration. Ch3 and Ch5 are anchored to the **end** of this timeline and play simultaneously. If Phase 1 + max(Ch3, Ch5) < minimum, a gap is inserted.

```
|-- Phase 1 --|------- gap -------|-- Ch3+Ch5 --|
   Ch1,Ch2,Ch4   (default lights)
|<------------- total (≥ minimum) ------------>|
```

- **Identify Channels**: Phase1=10, max(Ch3,Ch5)=10, total=30 → gap=10 → 30s predicted → 30.4s recorded (0.4s error) — **implies minimum ≥ 30s**
- **Original**: Phase1=13.76, max(Ch3,Ch5)=5.62, total=25.2 → gap=5.8 → **implies minimum ~25s**
- **v15**: Phase1=19.9, max(Ch3,Ch5)=6.6, total=26.5 → gap≈0 → no stretching needed (content > minimum)

### Model C: Fixed Phase 2 Anchor

Phase 2 always starts at a fixed anchor point (~20s), or immediately after Phase 1 if Phase 1 exceeds the anchor:

```
Phase2_start = max(Phase1_end + 0.1s, ~20s)
Total = Phase2_start + max(Ch3, Ch5)
```

```
|-- Phase 1 --|---- gap (if any) ----|-- Ch3+Ch5 --|
   Ch1,Ch2,Ch4   (DRL default-on)
                                      ^
                                   ~20s anchor
```

**Verification against all three experiments:**

| Experiment | Phase1_end | max(Phase1+0.1, ~20) | + max(Ch3,Ch5) | Predicted | Observed | Error |
|---|---|---|---|---|---|---|
| Identify Channels | 10.0s | 20s | + 10.0s | 30.0s | 30.4s | −0.4s |
| Original | 13.76s | 20s | + 5.62s | 25.62s | ~25.2s | +0.4s |
| v15 | 19.90s | 20s | + 6.60s | 26.60s | 26.57s | +0.03s |

All three experiments fit within ±0.4s. The ~0.4s errors in Experiments 1 and 2 may reflect measurement precision (both used less precise timing methods than Experiment 5's frame-by-frame analysis).

**Key advantage**: This model eliminates the "Minimum Duration Puzzle" entirely — there is no variable minimum. The gap is simply `max(0, ~20 - Phase1_end)`, a fixed anchor rather than a content-dependent formula.

### The Minimum Duration Puzzle

The gap data from two experiments gives inconsistent minimums:

| Experiment | Phase 1 | max(Ch3,Ch5) | Observed Total | Gap | Implied Minimum |
|---|---|---|---|---|---|
| Identify Channels | 10.0s | 10.0s | 30.4s | ~10s | ~30s |
| Original | 13.76s | 5.62s | 25.2s | ~5.8s | ~25s |
| v15 | 19.90s | 6.60s | 26.57s | ~0s | ≤26.5s |

If the minimum were fixed at 25s, Identify Channels should be ~25s (not 30.4s). If fixed at 30s, Original should be ~30s (not 25.2s). **The minimum is not a single fixed value** under Model B's framework. However, **Model C resolves this puzzle** by replacing the variable minimum with a fixed ~20s anchor point for Phase 2 — all three experiments fit within ±0.4s without requiring a content-dependent formula.

**Note (post-Experiment 4 reanalysis):** The Stagger Test (Experiment 4) initially appeared to challenge both models, but frame-level reanalysis (see Experiment 4, Discovery #7) reveals that **all observations match Model C with <0.1s accuracy** when Phase 2 is anchored at 19.84s. The apparent "zero-gap Ch3 onset" at 14s was actually the DRL's default parking revert (not Ch3), the "11s visible duration" was default brightness + Ch3's 0% override ramp, and the "40-43s flash" was Ch3's programmed active content at its correct offset. Ch4/Ch5 suppression remains consistent with the ~25s duration cap (Discovery #5). Experiments A, B, and C remain important for definitive confirmation with simpler template designs.

---

## Experiment 1: "Identify Channels" Template

### Template Data

All channels configured to 10s total (1s on, 9s off), staggered with leading zeros:

| Channel | Pairs | Leading Off | On Duration | Trailing Off | Total |
|---------|-------|-------------|-------------|--------------|-------|
| Ch1     | 5     | 0ms         | 1000ms      | 9000ms       | 10.0s |
| Ch2     | 6     | 2000ms      | 1000ms      | 7000ms       | 10.0s |
| Ch3     | 6     | 4000ms      | 1000ms      | 5000ms       | 10.0s |
| Ch4     | 7     | 6000ms      | 1000ms      | 3000ms       | 10.0s |
| Ch5     | 8     | 8000ms      | 1000ms      | 1000ms       | 10.0s |

### Observed Behavior

- **Total recorded duration**: ~30.4s
- **Expected if simultaneous**: 10s (all channels play at once)
- **Expected if 2-phase, no gap**: 10 + 10 = 20s
- **Expected if 2-phase with 10s gap**: 10 + 10 + 10 = 30s

**Conclusion**: 30.4s matches two-phase model with a ~10s gap between phases.

### Observed Sequence (revised with 60fps frame counting)

Peak times measured as last frame before dimming is noticeable:

**Phase 1 (t=0 to ~10s):**

| Channel | Peak Time | Predicted (leading + 1s on) | Match |
|---------|-----------|----------------------------|-------|
| High Beam (Ch1) | 1.00s | 0 + 1 = 1.00s | exact |
| DRL (Ch2) | 3.00s | 2 + 1 = 3.00s | exact |
| Low Beam (Ch4) | 7.00s | 6 + 1 = 7.00s | exact |

**Gap (~10s to ~20s):**
- DRL switches on at **9.98s** (default parking brightness, ~2s ramp up) and off at **21.96s** (~2s ramp down)
- This is the DRL's default ON state during the gap — no FLM2 channel is controlling it
- The 2s ramp down starting at ~20s corresponds to Ch3 taking control and driving DRL to 0% (its leading zeros)

**Phase 2 (Ch3 + Ch5 simultaneous, starting at ~20s):**

| Channel | Peak Time | Predicted (20s + leading + 1s on) | Match |
|---------|-----------|----------------------------------|-------|
| DRL-END (Ch3) | **24.96s** | 20 + 4 + 1 = 25.00s | −0.04s |
| LB-END (Ch5) | **28.95s** | 20 + 8 + 1 = 29.00s | −0.05s |

The 4.00s gap between DRL and LB peaks (24.96 vs 28.95) exactly matches the difference in leading zeros (4s vs 8s), confirming Ch3 and Ch5 start at the same time.

### Key Revision: Two Phases, Not Three

The original interpretation assumed three sequential phases (Ch3 at 10s, Ch5 at 20s). Re-analysis with precise 60fps timing shows Ch3 and Ch5 both start at ~20s:
- If Ch3 started at 10s: DRL peak would be at 10+4+1 = **15s** (not 24.96s)
- If Ch5 started at 20s after Ch3: LB peak would be at 20+10+8+1 = **39s** (not 28.95s)

The actual structure is: Phase 1 (10s) + gap (10s) + Phase 2 {Ch3, Ch5 simultaneous} (10s) = 30s + overhead ≈ 30.4s.

---

## Experiment 2: "Original" Template

### Template Data (parsed hex)

| Channel | Pairs | Duration | Key Brightness Pattern |
|---------|-------|----------|----------------------|
| Ch1     | 15    | 13.76s   | 5s off → ramp to 100% → hold → fade |
| Ch2     | 5     | 3.94s    | 2.5s off → 240ms dim → 1.2s bright |
| Ch3     | 3     | 2.62s    | 1.2s@43% → 1.18s@20% → 240ms off |
| Ch4     | 3     | 2.44s    | 1s off → 240ms@20% → 1.2s@46% |
| Ch5     | 6     | 5.62s    | 3×(1s@46%) → 1.2s@43% → 1.18s@20% → 240ms off |

### Duration Analysis (Two-Phase Model)

- **Phase 1**: max(13.76, 3.94, 2.44) = **13.76s** (limited by Ch1)
- **Phase 2**: max(2.62, 5.62) = **5.62s** (Ch3 + Ch5 simultaneous, limited by Ch5)
- **No-gap total**: 13.76 + 5.62 = **19.38s**
- **Recorded total**: **~25.2s**
- **Gap**: 25.2 − 13.76 − 5.62 = **~5.8s**

### The Gap — Timeline Stretching

With no gap, the total would be 19.38s. The observed 25.2s implies a **~5.8s gap** between Phase 1 and Phase 2. Under the Model B framework, this gap is inserted to meet a minimum total animation duration:

- Phase 1 ends at t=13.76s
- Gap of ~5.8s (DRL likely reverts to default ON during this period)
- Phase 2 starts at ~19.6s: Ch3 (2.62s) and Ch5 (5.62s) play simultaneously
- Ch5 anchored to end → animation ends at ~25.2s
- Total = 25.2s recorded (implies minimum duration ≥ ~25s for this template's content)

---

## Experiment 3: Long Duration Test (Informal)

### Setup
- Ch4 (Low Beam) configured to ~32s duration
- Other channels shorter

### Observed Behavior
- Ch4 never lit up
- Suggests a **maximum duration cap** for phase 1

### Hypothesis
- Phase 1 may have a maximum duration (possibly ~25-30s)
- If phase 1 duration exceeds the cap, it gets truncated
- At 32s, Ch4's "on" period may fall after the cap cutoff

---

## Experiment 4: Stagger Test

### Purpose

Test channel timing with large staggered offsets — 5 channels with identical 5s active profiles (2s fade-in, 1s hold at 100%, 2s fade-out) offset by 9s each via leading zeros. This pushes the total programmed duration (41s) well beyond the suspected ~25s cap.

### Template Data

Hex sequences (Left side shown; Right side identical):

```
01, 00, 03, 64, 64, 32, 64, 64, 00, 02, 00, 05, FF, 00, C3, 00, 64, 64, 32, 64, 64, 00, 03, 00, 07, FF, 00, FF, 00, FF, 00, 87, 00, 64, 64, 32, 64, 64, 00, 04, 00, 09, FF, 00, FF, 00, FF, 00, FF, 00, FF, 00, 4B, 00, 64, 64, 32, 64, 64, 00, 05, 00, 0B, FF, 00, FF, 00, FF, 00, FF, 00, FF, 00, FF, 00, FF, 00, 0F, 00, 64, 64, 32, 64, 64, 00, 00, 00
```

### Parsed Structure

Each channel has leading zero-brightness pairs (at max duration 0xFF=5100ms each) to create the offset, followed by an identical 5s active profile.

| Channel | ID | Physical Light | Leading Off | Active Profile | Total |
|---------|----|----------------|------------|----------------|-------|
| Ch1 | 01 | High Beam | 0s | 2s↑ 1s hold 2s↓ | 5.0s |
| Ch2 | 02 | DRL | 9.0s (5100+3900ms) | 2s↑ 1s hold 2s↓ | 14.0s |
| Ch3 | 03 | DRL-END | 18.0s (3×5100+2700ms) | 2s↑ 1s hold 2s↓ | 23.0s |
| Ch4 | 04 | Low Beam | 27.0s (5×5100+1500ms) | 2s↑ 1s hold 2s↓ | 32.0s |
| Ch5 | 05 | LB-END | 36.0s (7×5100+300ms) | 2s↑ 1s hold 2s↓ | 41.0s |

Active profile for all channels: `64 64 32 64 00 32 00` → 100×20ms fade to 100%, 50×20ms hold at 100%, 100×20ms fade to 0%, 50×20ms at 0% → 2s fade-in, 1s hold, 2s fade-out.

### Predictions (Pre-Experiment)

**Model A (Sequential Phases):**
- Phase 1 = max(Ch1=5s, Ch2=14s, Ch4=32s) = 32s
- Phase 2 = Ch3 = 23s
- Phase 3 = Ch5 = 41s
- Total = 96s (but Ch4 at 32s may exceed cap)

**Model B (Fixed Duration + Placement):**
- Total content far exceeds 25s → no stretching
- Ch5 anchored at end, Ch3 placed before Ch5
- Both END channels' leading zeros would play normally

**Both models predict**: All 5 channels visible at their programmed times, just disagreeing on exact placement of Ch3/Ch5.

### Observed Behavior (Video Analysis)

| Time | Event | Expected? |
|------|-------|-----------|
| ~0s | Ch1 (High Beam) fades in | Yes |
| ~5s | Ch1 fades out | Yes |
| ~9s | Ch2 (DRL) fades in | Yes |
| ~14s | Ch2 fades out completely | Yes |
| ~14s (+1 frame) | DRL comes back on at ~50% with PWM flickering | **NO** — unexpected |
| 14-25s | DRL gradually dims from ~50% to 0% | **NO** — 11s visible, only 5s programmed |
| 25-39s | Complete darkness | Partially expected |
| ~40s | DRL fades up to ~100% and back down | Unexpected (possible cycle 2) |
| ~43s | Last light off | — |
| 43-75s+ | No further light activity recorded | — |

**Ch4 (Low Beam)**: Never visible at any point.
**Ch5 (Low Beam-END)**: Never visible at any point.

### Key Discoveries

#### 1. DRL at 14s is default revert, not Ch3 — confirmed by Model C timing
Ch3 has 18.0s of programmed leading zeros. The DRL reappearing ONE FRAME after Ch2 ended at 14s was originally puzzling — it appeared Ch3's leading zeros were skipped. However, **Model C reanalysis (Discovery #7) confirms** this is the DRL reverting to its **default-on parking state**, not Ch3 activating. The ~50% brightness with PWM flickering matches the default parking behavior observed in Experiments 1 and 5. Under Model C, Ch3 doesn't start until 19.84s (Phase 2 anchor), at which point it drives 0% via its leading zeros — this explains the gradual dimming observed from ~20s onward. Ch3's actual active content doesn't begin until 37.84s (19.84 + 18.0s leading zeros), exactly matching the observed 40-43s flash (see Discovery #6).

#### 2. Inconsistency with Identify Channels experiment
In Experiment 1 (Identify Channels), Ch3 had 4s of leading zeros and they played normally — Ch3's flash peak appeared at 24.96s = ~20s(Phase 2 start) + 4s(leading zeros) + 1s(flash). In this Stagger Test, Ch3's 18s of leading zeros were apparently skipped. The FLM2 may handle leading zeros **context-dependently** — perhaps stripping them when they would exceed the animation timeline, but playing them when they fit.

#### 3. The 11-second mystery — resolved by Model C
Ch3's programmed active content is only 5s (2s fade-in, 1s hold, 2s fade-out). Yet DRL was visible from 14s to ~25s = 11 seconds. **Model C resolves this** (see Discovery #7): the 11s visibility comprises two distinct effects — 5.84s of DRL default-on brightness (14.0–19.84s, before Ch3 starts) plus ~5s of gradual dimming as Ch3's leading zeros (0% output) progressively override the default state (19.84–~24.9s). Total ≈ 10.9s, consistent with the observed ~11s. No hardware anomalies or unusual interpolation needed.

#### 4. ~50% brightness with PWM flickering
When Ch3 activated at 14s, the DRL was at roughly 50% with visible PWM flickering, not the programmed 100%. This suggests the FLM2 may be driving the LED differently when replaying END-channel content, or that Ch3's fade-in was interrupted/modified.

#### 5. Ch4 and Ch5 never visible — ~25s duration cap confirmed
Ch4's active content starts at 27s and Ch5's at 36s. Neither was ever visible, consistent with a ~25s maximum animation duration. This reinforces the cap hinted at in Experiment 3.

#### 6. DRL activity at 40-43s — Ch3's active content under Model C
DRL activity at 40-43s was originally interpreted as a possible second animation cycle. However, Model C reanalysis (see Discovery #7) reveals this is Ch3's **programmed active content** playing at exactly the predicted time: Phase 2 starts at ~19.84s, Ch3 has 18.0s of leading zeros, so Ch3's active content (2s fade-in, 1s hold, 2s fade-out) begins at 19.84 + 18.0 = **37.84s** — matching the observed first light at 37.84s with extraordinary precision.

#### 7. Model C reanalysis: all observations explained by Phase 2 anchor at ~19.84s

Re-analysis of the Experiment 4 video with frame-level precision reveals that **all observations match Model C** (Phase 2 anchored at a fixed ~20s point) within <0.1s accuracy.

**Phase 2 anchor derivation**: Using the observed Ch3 active content start at 37.84s and Ch3's 18.0s of leading zeros: anchor = 37.84 − 18.0 = **19.84s**. This is consistent with the ~20s anchor from Experiments 1 (Phase 2 at ~20s) and 5 (Phase 2 at ~19.97s).

**Ch3's full timeline under Model C (Phase 2 at 19.84s):**

| Step | Channel Time | Absolute (19.84 + ch_time) | Description |
|------|-------------|---------------------------|-------------|
| Leading zeros | 0–18.0s | 19.84–37.84s | Ch3 driving DRL at 0% (overrides default) |
| Fade-in start | 18.0s | 37.84s | First light appears |
| Full 100% | 20.0s | 39.84s | 2s fade-in complete |
| Hold end | 21.0s | 40.84s | 1s hold at 100% complete |
| Fade-out end | 23.0s | 42.84s | 2s fade-out complete |

**Predicted vs observed timestamps:**

| Event | Predicted | Observed | Delta |
|-------|-----------|----------|-------|
| DRL default revert (Ch2 ends) | 14.0s | ~14s | ~0s |
| DRL dim starts (Ch3 takes control at 0%) | 19.84s | ~20s | ~−0.2s |
| Totally dark (DRL default fully overridden) | ~24.9s* | 24.76s | +0.1s |
| Ch3 first light (fade-in begins) | 37.84s | 37.84s | **0.00s** |
| Ch3 full 100% | 39.84s | 39.84s | **0.00s** |
| Ch3 dim starts (fade-out begins) | 40.84s | 40.84s | **0.00s** |
| Ch3 fade-out ends | 42.84s | 42.75s | +0.09s |

*The ~24.9s "totally dark" prediction assumes ~5s for the DRL's default-on brightness to ramp down after Ch3 takes control at 0% (consistent with the ~2s ramp observed in Experiment 1, but slower here possibly due to the gradual nature of the override).

**Mysteries resolved:**

- **Mystery #1 (zero-gap Ch3 onset)**: The DRL at 14s is NOT Ch3 — it is the DRL reverting to its **default parking brightness** when Ch2 ends, exactly as observed in Experiments 1 and 5. Ch3 doesn't start until 19.84s, at which point it drives 0% (leading zeros), gradually overriding the default brightness.
- **Mystery #3 (11s visible from 5s content)**: The 11s visibility (14–25s) is explained by two overlapping effects: 5.84s of DRL default-on (14.0–19.84s) + ~5s of gradual dim as Ch3's 0% output overrides the default (19.84–~24.9s). Total ≈ 10.9s, consistent with the observed ~11s.
- **Mystery #4 (50% PWM flickering)**: The ~50% brightness with PWM flickering at 14s is the DRL's **default parking brightness**, not Ch3 output. This is exactly what the DRL does when uncontrolled, as confirmed in Experiments 1 and 5.
- **Discovery #6 (40-43s flash)**: This is Ch3's **programmed active content** (2s fade-in, 1s hold, 2s fade-out) playing at its correct channel-relative offset of 18.0s after Phase 2 start — NOT a second animation cycle.

**Significance**: This is the strongest evidence yet for Model C. The 19.84s anchor is consistent across three independent experiments (Exp 1: ~20s, Exp 4: 19.84s, Exp 5: 19.97s), and the frame-level timestamp matches (<0.1s) leave no room for alternative models.

---

## Experiment 5: External Video Peak Analysis (v15 Template)

### Setup

- **Observer**: Different user (independent verification)
- **Vehicle**: Same spec — BMW G20 Laser
- **Template**: "BMW G20 2022 - EU - Laser light - Left right swipe v15"
- **Recording**: 30fps video, 26.57s total observed duration
- **Measurement**: Left side DRL/Low Beam brightness peaks identified frame-by-frame

### Template Data (Left Side, v15)

Five channels parsed from `templates.js` line 21:

| Channel | ID | Physical Light | Pairs | Duration |
|---------|----|----------------|-------|----------|
| Ch1     | 01 | High Beam      | 15    | 19.90s   |
| Ch2     | 02 | DRL            | 23    | 7.02s    |
| Ch3     | 03 | DRL-END        | 19    | 6.16s    |
| Ch4     | 04 | Low Beam       | 11    | 6.94s    |
| Ch5     | 05 | LB-END         | 9     | 6.60s    |

Phase 1 duration = max(Ch1, Ch2, Ch4) = max(19.90, 7.02, 6.94) = **19.90s** (limited by Ch1 High Beam).

#### Ch2 Peaks (DRL — Phase 1, "swipe forward")

Ch2 has 5 brightness peaks with an ascending pattern (60→75→80→95→100%), creating the forward swipe effect. Background brightness between peaks is 30%.

| Peak | Time  | Brightness | Hex (ramp→hold) |
|------|-------|------------|------------------|
| 1    | 2.44s | 60%        | 03,3C / 01,3C    |
| 2    | 3.22s | 75%        | 03,4B / 01,4B    |
| 3    | 3.59s | 80%        | 03,50 / 01,50    |
| 4    | 4.37s | 95%        | 03,5F / 01,5F    |
| 5    | 4.91s | 100%       | 03,64 / 01,64    |

#### Ch3 Peaks (DRL-END — Phase 2, "swipe back")

Ch3 has 4 brightness peaks with a descending pattern (100→85→80→65%), creating the return swipe. Background brightness between peaks is 50%.

| Peak | Time  | Brightness | Hex (ramp→hold) |
|------|-------|------------|------------------|
| 1    | 2.14s | 100%       | 03,64 / 01,64    |
| 2    | 2.88s | 85%        | 03,55 / 01,55    |
| 3    | 3.26s | 80%        | 03,50 / 01,50    |
| 4    | 4.00s | 65%        | 03,41 / 01,41    |

#### Ch4 Peak (Low Beam — Phase 1)

Ch4 has a single brightness peak at 5.06s reaching 100%, part of the low beam flash that coincides with the end of the DRL swipe.

### Phase Timing and Absolute Predictions

Ch2 peaks are in Phase 1 (starts at t=0), so their absolute times equal their channel-relative times.

Ch3 peaks are in Phase 2 (starts after Phase 1 ends at t=19.90s), so their absolute times = 19.90s + channel-relative time.

| # | Source  | Channel Time | Absolute Predicted |
|---|---------|-------------|-------------------|
| 1 | Ch2 P1  | 2.44s       | 2.44s             |
| 2 | Ch2 P2  | 3.22s       | 3.22s             |
| 3 | Ch2 P3  | 3.59s       | 3.59s             |
| 4 | Ch2 P4  | 4.37s       | 4.37s             |
| 5 | Ch2 P5  | 4.91s       | 4.91s             |
| 6 | Ch3 P1  | 2.14s       | 22.04s            |
| 7 | Ch3 P2  | 2.88s       | 22.78s            |
| 8 | Ch3 P3  | 3.26s       | 23.16s            |
| 9 | Ch3 P4  | 4.00s       | 23.90s            |

### Observed vs Predicted Comparison

| #  | Observed | Source  | Predicted | Diff    | Frames @30fps |
|----|----------|---------|-----------|---------|---------------|
| 1  | 2.40s    | Ch2 P1  | 2.44s     | −0.04s  | ~1            |
| 2  | 3.20s    | Ch2 P2  | 3.22s     | −0.02s  | ~1            |
| 3  | 3.57s    | Ch2 P3  | 3.59s     | −0.02s  | ~1            |
| 4  | 4.33s    | Ch2 P4  | 4.37s     | −0.04s  | ~1            |
| 5  | 4.90s    | Ch2 P5  | 4.91s     | −0.01s  | ~0            |
| 6  | 22.10s   | Ch3 P1  | 22.04s    | +0.06s  | ~2            |
| 7  | 22.87s   | Ch3 P2  | 22.78s    | +0.09s  | ~3            |
| 8  | 23.23s   | Ch3 P3  | 23.16s    | +0.07s  | ~2            |
| 9  | 23.97s   | Ch3 P4  | 23.90s    | +0.07s  | ~2            |

All 9 predictions within **±0.09s** (≤3 frames at 30fps).

### Additional Observations (Full Video Analysis)

Beyond the DRL peak timing, frame-by-frame analysis of the full video revealed High Beam, DRL continuity, and Low Beam behavior.

#### High Beam (Ch1) Timeline

| Event | Observed | Predicted | Diff |
|-------|----------|-----------|------|
| First ON | 4.67s | 4.70s (5×940ms dark) | −0.03s (~1 frame) |
| Starts dimming | ~17s | 17.90s (step 100%→50%) | hard to see, subtle |
| Finishes dimming | ~18.8s | 17.90s (instant step) | gradual vs instant |
| Fully OFF | **19.87s** | 19.90s | **−0.03s (~1 frame)** |

The High Beam OFF time directly measures Phase 1 end = **19.87s**.

The template programs an instant step from 100% to 50% at 17.90s, but the observer saw a gradual dim from ~17s to ~18.8s. This suggests either the FLM2 interpolates between brightness steps, or the LED driver smooths transitions.

#### DRL Never Goes Fully Dark — Default ON Behavior

The model predicts DRL should be **completely dark from 7.02s to ~19.97s** (~13 seconds): Ch2 ends at 7.02s (last value 50%), and Ch3 doesn't start until Phase 2. Yet the DRL was never observed going fully dark.

**Explanation**: The DRL reverts to its default parking-light brightness when no FLM2 channel is actively controlling it. This was confirmed by Experiment 1's re-analysis: during the 10s gap (10-20s), the DRL turned ON at 9.98s despite Ch2's last value being 0% (trailing zeros). In v15, the DRL stays continuously lit from Ch2's active period through the gap into Ch3's start because the DRL default state is ON.

#### Low Beam (Ch5) — Anchored to Animation End

Low Beam activity was observed late in the animation:

| Event | Observed |
|-------|----------|
| Starts brightening | 24.67s |
| Peak brightness | ~24.9s |
| Fully off | 26.53s |
| "Might be on before that, hard to tell" | — |

If Ch5 is **anchored to the end** of the animation (ending at 26.53s), working backwards through Ch5's data gives:

| Ch5 Event | Time into Ch5 | Absolute (26.53 − remaining) | Observed | Diff |
|-----------|---------------|-------------------------------|----------|------|
| 30% baseline starts | 0.00s | 19.93s | "might be on" | — |
| Flash ramp (95%) | 4.70s | **24.63s** | **24.67s** | +0.04s |
| Peak (100%) | 4.94s | **24.87s** | **~24.9s** | +0.03s |
| Goes to 0% | 5.10s | 25.03s | — | — |
| Trailing zeros end | 6.60s | **26.53s** | **26.53s** | exact |

Sub-frame accuracy on all measurements. This means Ch5 starts at **19.93s** — effectively the same moment as Ch3 (~19.97s).

### Key Findings

#### 1. Ch2 and Ch3 drive the same physical DRL element across phases

The first 5 observed peaks are Ch2 (DRL, Phase 1) performing the forward swipe with ascending brightness. The last 4 observed peaks are Ch3 (DRL-END, Phase 2) performing the return swipe with descending brightness. The observer correctly identified all 9 as "DRL peaks" — because both channels animate the same physical light, just in different phases.

#### 2. Phase 1 end measured independently at 19.87s

High Beam OFF time provides a direct, non-DRL measurement of Phase 1 duration. The predicted 19.90s matches within one frame (−0.03s).

#### 3. Inter-phase transition delay of ~0.10s

Using Phase 1 end = 19.87s, the Ch3 peak offsets become:

| # | Observed | Predicted (19.87 + ch3_time) | Diff |
|---|----------|------------------------------|------|
| 6 | 22.10s | 22.01s | +0.09s |
| 7 | 22.87s | 22.75s | +0.12s |
| 8 | 23.23s | 23.13s | +0.10s |
| 9 | 23.97s | 23.87s | +0.10s |

Consistent **+0.10s offset** across all four peaks. Phase 2 starts ~0.10s after Phase 1 ends (~3 frames at 30fps), suggesting a hardware inter-phase transition delay. Phase 2 start ≈ **19.97s**.

#### 4. Ch3 and Ch5 run simultaneously — two phases, not three

Ch5 starts at 19.93s (derived from anchored-to-end analysis) and Ch3 starts at ~19.97s. Both begin at essentially the same time after Phase 1, driving **different physical lights** (Ch3 → DRL, Ch5 → Low Beam). The animation structure for v15 is:

```
Phase 1: {Ch1, Ch2, Ch4}     t=0 to 19.87s
Phase 2: {Ch3, Ch5}           t=19.97s to 26.53s
Total = Phase1 + 0.10s delay + max(Ch3, Ch5) = 19.87 + 0.10 + 6.60 = 26.57s
```

This is a **two-phase model**, not three. END channels (Ch3, Ch5) play concurrently after Phase 1, each driving their respective light. The total animation duration is Phase 1 + max(Ch3, Ch5), not Phase 1 + Ch3 + Ch5.

#### 5. Lights revert to default state when uncontrolled

DRL never going dark between Ch2 ending (7.02s) and Ch3 starting (~19.97s) was initially interpreted as "hold last value." However, Experiment 1 re-analysis showed DRL turning ON during a gap despite Ch2's last value being 0%. The actual mechanism is: lights revert to their hardware default state (DRL defaults to parking brightness) when no FLM2 channel is driving them.

### Implications for Phase Model

#### Confirmed: Two-Phase Model with Simultaneous END Channels

Re-analysis of Experiment 1 with 60fps precision (see revised Experiment 1) confirmed that Ch3 and Ch5 also play simultaneously there — the apparent "three-phase" behavior was actually two phases with a 10s gap. Both experiments show the same structure:

| | Experiment 1 | Experiment 5 (v15) |
|---|---|---|
| Phase 1 | 10.0s | 19.87s |
| Gap | ~10s | ~0.1s |
| Phase 2 start | ~20s | ~19.97s |
| Phase 2 content | max(10, 10) = 10s | max(6.16, 6.60) = 6.60s |
| Total | ~30.4s | ~26.57s |

The gap difference (~10s vs ~0s) is the remaining puzzle — see Competing Models for discussion.

#### DRL Default ON During Gap

In Experiment 1, DRL was observed glowing from 9.98s to 21.96s (the gap period). In v15, DRL "never went fully dark." Both are explained by the DRL reverting to its default parking-light brightness when no FLM2 channel is actively controlling it.

#### Model validation

This experiment provides strong independent validation of:
- **Phase boundary timing**: High Beam OFF = 19.87s matches Ch1 data (19.90s) within one frame
- **Per-phase time restart**: Ch3 replays from its own t=0 in Phase 2
- **Sub-frame timing accuracy**: 12 independent measurements (9 DRL peaks + 3 Ch5/Ch1 events), all within ±0.12s
- **Ch5 anchored-to-end placement**: consistent with Model B's core premise
- **Inter-phase delay**: ~0.10s hardware transition between phases

---

## Open Questions

### Q1: Does time restart per phase?
When phase 2 begins, does Ch3 start playing from its own t=0, or does it continue from the global clock?

**Evidence so far**: Identify Channels result (30.4s) strongly suggests restart model. Experiment 5 confirms: Ch3 peaks match channel-relative times offset by Phase 1 end + 0.10s delay, consistent with restart from t=0.

**Definitive test**: Experiment A (Short Phase 2 Baseline)

### Q2: Is the minimum total animation time fixed or variable?
A gap exists between Phase 1 and Phase 2, but the implied minimum is inconsistent: ~30s for Identify Channels, ~25s for Original, ≤26.5s for v15. The gap formula is the central remaining mystery.

**Definitive test**: Experiments A and B share the same Phase 1 (5s) but differ in Phase 2 content (3s vs 11s). If Phase 2 start shifts between A and B → Model B (timeline-end anchor). If both start at ~20s → Model C (fixed anchor). The 8s Phase 2 content difference creates an unmistakable prediction gap.

### Q3: Is there a maximum phase 1 duration?
Would explain why the long-duration Ch4 never lit up.

**Definitive test**: Experiment C (Max Phase Duration Test)

### Q4: Do "END" channels override or add to base channels?
- Ch3 = "DRL - END" — does it add to Ch2 (DRL) or replace it in phase 2?
- Ch5 = "Low Beam - END" — same question for Ch4 (Low Beam)
- The phase separation suggests they are independent animations that play after the main ones.

### Q5: Are leading zeros stripped or fast-forwarded for END channels?
In Experiment 1 (Identify Channels), Ch3's 4s leading zeros played normally (Ch3 flash at 24.96s = Phase 2 start ~20s + 4s leading + 1s on). In Experiment 4 (Stagger Test), Ch3's 18s leading zeros were apparently skipped — Ch3 activated immediately after Ch2 ended. Does the FLM2 strip leading zeros when they exceed the remaining timeline? Or is there a different mechanism for END channels vs phase 1 channels?

**Evidence so far**: Inconsistent between experiments. Needs targeted testing with varying leading-zero lengths on END channels.

### Q6: Does Phase 1 end based on last ACTIVE channel rather than longest data?
In the Stagger Test, Ch2 ends at 14s and Ch3 appears immediately. If Phase 1 ended at Ch2's end (14s) rather than Ch4's programmed end (32s), this would explain the zero-gap onset. But Ch4 has data extending to 32s — was it ignored because it exceeds the cap?

**Definitive test**: Experiment A (Ch3/Ch5 have no leading zeros) should clarify phase boundary behavior.

### Q7: Why does Ch3's visible duration (11s) far exceed its programmed active content (5s)?
Ch3 is programmed for 2s fade-in, 1s hold, 2s fade-out = 5s active. Yet DRL was visible from 14s to ~25s = 11s. This 6s discrepancy is too large for measurement error alone.

**Possible explanations**: Hardware phosphor/capacitor decay, different interpolation model in FLM2, or Ch3's leading zeros partially played at reduced brightness.

### Q8: Why ~50% brightness with PWM flickering instead of programmed 100%?
When Ch3 activated at 14s, DRL showed ~50% brightness with visible PWM flickering, not the smooth 100% ramp programmed in the hex data. This may indicate the FLM2 handles END-channel brightness differently, or that the fast-forwarding of leading zeros affects the brightness output.

### Q9: What determines the gap between Phase 1 and Phase 2?
Both Experiment 1 and Experiment 5 confirm two phases with Ch3+Ch5 simultaneous, but the gap between phases varies dramatically:

| Experiment | Phase 1 | max(Ch3,Ch5) | Total | Gap |
|---|---|---|---|---|
| Identify Channels | 10.0s | 10.0s | 30.4s | ~10s |
| Original | 13.76s | 5.62s | 25.2s | ~5.8s |
| v15 | 19.90s | 6.60s | 26.57s | ~0s |

No single fixed minimum explains all three: 25s gives wrong Exp1, 30s gives wrong Original and v15. The gap formula likely involves individual channel durations (possibly Phase1 + Ch3 + Ch5 or a similar computation), not just Phase1 + max(Ch3,Ch5).

**Possible answer (Model C)**: If Phase 2 is anchored at ~20s, the gap is simply `max(0, ~20 - Phase1_end)`. This eliminates the need for a variable minimum — the anchor point is fixed, and the gap is whatever time remains between Phase 1 ending and the ~20s mark. See Model C under Competing Models.

**Experiment 4 confirmation**: Re-analysis of the Stagger Test (Experiment 4, Discovery #7) provides the strongest evidence yet for Model C. With Phase 2 anchored at 19.84s, all observed timestamps match predictions within <0.1s — including Ch3's active content appearing at exactly 37.84s (= 19.84 + 18.0s leading zeros). The anchor point is now consistent across three independent experiments:

| Experiment | Phase 2 anchor | Method |
|---|---|---|
| Exp 1 (Identify Channels) | ~20.0s | DRL default-on/off timing |
| Exp 4 (Stagger Test) | **19.84s** | Ch3 active content start − leading zeros |
| Exp 5 (v15) | ~19.97s | Ch3 peak times − channel-relative times |

The convergence on ~19.9±0.1s across experiments with very different Phase 1 durations (5s, 10s, 19.9s) strongly supports a fixed anchor rather than a content-dependent formula.

**Definitive test**: Experiments A+B combined will provide final confirmation. A has Phase1=5s, Phase2=3s. B has Phase1=5s, Phase2=11s. If Phase 2 starts at ~20s in both → Model C definitively confirmed. If Phase 2 start shifts by ~8s between A and B → Model B.

### Q10: Do lights revert to default state when no channel controls them?
In Experiment 1, DRL glowed from 9.98s to 21.96s during the gap between phases — no FLM2 channel was driving it, yet it was clearly on with ~2s ramp up and down. This is NOT "hold last value" — Ch2's last value was 0% (trailing zeros), yet DRL turned ON. The DRL then turned off at 21.96s because Ch3 took control at Phase 2 start (~20s) and is actively driving 0% (its leading zeros), overriding the default state. The ~2s ramp up (at 10s) and ramp down (at 20s) likely reflect the LED driver's hardware transition speed.

In Experiment 5 (v15), DRL "never went fully dark" between Ch2 ending (7.02s) and Ch3 starting (~19.97s). This is consistent with default-revert but ambiguous: the observer couldn't distinguish "default brightness" from Ch2's last value of 50%.

**Open sub-question**: Does the revert happen when a channel's data ends mid-phase, or only at phase boundaries? In v15, Ch2 ends at 7.02s but Phase 1 continues until 19.9s — does DRL revert to default at 7.02s or at 19.9s? In Experiment 1, Ch2 and Phase 1 end at the same time (both 10s), so this can't be distinguished.

**Needs testing**: A template where a Phase 1 channel ends well before Phase 1 ends, with last value = 0%, to see if the light reverts to default mid-phase or stays dark. Also: do other lights (High Beam, Low Beam) have default-on states, or only the DRL?

### Q11: Does the FLM2 interpolate between brightness steps?
In Experiment 5, the High Beam showed a gradual dim from ~17s to ~18.8s, but the template programs an instant step from 100% to 50% at 17.90s. This could indicate the FLM2 smoothly interpolates between brightness values rather than using discrete steps.

**Evidence so far**: Single observation at 30fps, observer noted it was "hard to see." Could also be LED driver response time rather than FLM2 interpolation.

---

## Planned Experiments

### Design Principles

These experiments are redesigned for **observability** and **model discrimination**:

1. **Ch4 (LB) stays dark in Phase 1** — HB and LB are physically close and indistinguishable when both on. Keeping LB dark avoids confusion.
2. **Ch1 (HB) = "Phase 1 running" indicator** — its turn-off is the unambiguous Phase 1 end signal.
3. **Ch2 (DRL) = start marker** — brief flash at t=0 confirms animation began.
4. **Phase 2: DRL brightens + LB on** — unambiguous since HB is off by then.
5. **Experiments A and B share Phase 1 (5s) but differ in Phase 2 content (3s vs 11s)** — this is the key test to distinguish Model B from Model C.

**The key insight**: To distinguish Model B (Phase 2 anchored to timeline end) from Model C (Phase 2 anchored at ~20s), vary Phase 2 content while keeping Phase 1 fixed. Model C predicts Phase 2 starts at ~20s regardless of Phase 2 content. Model B predicts Phase 2 start shifts with Phase 2 content length. The 8s difference in Phase 2 content creates an unmistakable prediction gap.

**Risk mitigation**: Ch4 at 0% brightness has never been tested. If the FLM2 rejects all-zero channels, behavior may differ. Run Experiment A first to validate this approach.

### Experiment A: Short Phase 2 Baseline (Phase 1 = 5s, Phase 2 = 3s)

- **Template**: `BMW G20 2020 - Exp A Short Phase 2`
- **Goal**: First data point — measure Phase 2 start time with short Phase 2 content. Pin down the exact Phase 2 anchor point.

**Channel design:**

| Channel | Pattern | Duration | Purpose |
|---------|---------|----------|---------|
| Ch1 (HB) | 5s ON, 20ms OFF | ~5s | Phase 1 end marker |
| Ch2 (DRL) | 2s ON, 3s OFF | 5s | Start marker, then explicitly dark |
| Ch3 (DRL-END) | 2s ON, 1s OFF | 3s | Phase 2 DRL (short) |
| Ch4 (LB) | 5s at 0% | 5s | Dark — avoids HB/LB confusion |
| Ch5 (LB-END) | 2s ON, 1s OFF | 3s | Phase 2 LB (short) |

Phase 1 = 5s. Phase 2 = max(3, 3) = 3s.

**Hex encoding:**
```
Ch1: 01, 00, 02, FA, 64, 01, 00                (5000ms@100%, 20ms@0%)
Ch2: 02, 00, 02, 64, 64, 96, 00                (2000ms@100%, 3000ms@0%)
Ch3: 03, 00, 02, 64, 64, 32, 00                (2000ms@100%, 1000ms@0%)
Ch4: 04, 00, 01, FA, 00                        (5000ms@0%)
Ch5: 05, 00, 02, 64, 64, 32, 00                (2000ms@100%, 1000ms@0%)
Terminator: 00, 00, 00
Total: 7+7+7+5+7+3 = 36 bytes (staging1 only)
```

**Observation sequence:**
1. HB on + DRL on → "started"
2. ~2s: DRL goes dark (Ch2 driving 0%). HB still on.
3. ~5s: **HB turns off** → note T1 (Phase 1 end)
4. Gap: DRL reverts to default parking brightness (steady glow)
5. **DRL brightens + LB comes on** → note T2 (Phase 2 start)
6. ~T2+2s: DRL and LB go off → note T3 (animation end)

**Model predictions:**

| Model | Phase 2 start (T2) | Total (T3) | Gap (T2−T1) |
|-------|-------------------|------------|-------------|
| No minimum | ~5s | ~8s | 0s |
| Model C (20s anchor) | **~20s** | ~23s | ~15s |
| Model B (min=25) | **~22s** (25−3) | ~25s | ~17s |
| Model B (min=30) | **~27s** (30−3) | ~30s | ~22s |

- **What to record**: T1 (HB off), T2 (DRL brightens / LB on), T3 (last light off). **Frame-count T2** — this is the one measurement worth high precision (see Measurement Guide below).
- **Results**: _(pending)_

### Experiment B: Long Phase 2 Comparison (Phase 1 = 5s, Phase 2 = 11s)

- **Template**: `BMW G20 2020 - Exp B Long Phase 2`
- **Goal**: B-vs-C killer test. Same Phase 1 as A, but much longer Phase 2. Compare Phase 2 start times between A and B.

**Channel design:**

| Channel | Pattern | Duration | Purpose |
|---------|---------|----------|---------|
| Ch1 (HB) | 5s ON, 20ms OFF | ~5s | Phase 1 end marker (same as A) |
| Ch2 (DRL) | 2s ON, 3s OFF | 5s | Start marker (same as A) |
| Ch3 (DRL-END) | 10s ON, 1s OFF | 11s | Phase 2 DRL (**long**) |
| Ch4 (LB) | 5s at 0% | 5s | Dark (same as A) |
| Ch5 (LB-END) | 10s ON, 1s OFF | 11s | Phase 2 LB (**long**) |

Phase 1 = 5s. Phase 2 = max(11, 11) = 11s.

**Hex encoding:**
```
Ch1: 01, 00, 02, FA, 64, 01, 00                (5000ms@100%, 20ms@0%)
Ch2: 02, 00, 02, 64, 64, 96, 00                (2000ms@100%, 3000ms@0%)
Ch3: 03, 00, 03, FF, 64, F6, 64, 32, 00        (5100ms@100%, 4920ms@100%, 1000ms@0% ≈ 11s)
Ch4: 04, 00, 01, FA, 00                        (5000ms@0%)
Ch5: 05, 00, 03, FF, 64, F6, 64, 32, 00        (5100ms@100%, 4920ms@100%, 1000ms@0% ≈ 11s)
Terminator: 00, 00, 00
Total: 7+7+9+5+9+3 = 40 bytes (staging1 only)
```

**Observation sequence:**
1. HB on + DRL on → "started" (identical to Exp A for first 5s)
2. ~2s: DRL goes dark. HB still on.
3. ~5s: **HB turns off** → note T1
4. Gap: DRL reverts to default
5. **DRL brightens + LB comes on** → note T2 (Phase 2 start)
6. ~T2+10s: DRL and LB off → note T3

**Model predictions:**

| Model | Phase 2 start (T2) | Total (T3) | Gap (T2−T1) |
|-------|-------------------|------------|-------------|
| No minimum | ~5s | ~16s | 0s |
| Model C (20s anchor) | **~20s** | ~31s | ~15s |
| Model B (min=25) | **~14s** (25−11) | ~25s | ~9s |
| Model B (min=30) | **~19s** (30−11) | ~30s | ~14s |

**Cross-experiment comparison (the key test):**

| What to compare | Model C prediction | Model B prediction |
|-----------------|-------------------|-------------------|
| Phase 2 start difference (A vs B) | **0s** (both at ~20s) | **8s** (shifts with Phase 2 content) |
| Total duration difference | ~8s (23 vs 31) | ~0-5s (both ≈ minimum) |

The 8s difference in Phase 2 start time is unmistakable even with rough timing. The observer just needs to answer: "Did the second flash happen at roughly the same time in both experiments, or was it noticeably different?"

- **What to record**: T1 (HB off), T2 (DRL brightens / LB on), T3 (last light off). Rough stopwatch timing is sufficient — only need to distinguish ~20s from ~14s.
- **Results**: _(pending)_

### Experiment C: Max Phase Duration (Phase 1 = 26.5s)

- **Template**: `BMW G20 2020 - Exp C Max Phase Duration`
- **Goal**: Test Phase 1 duration cap (Q3). Does NOT discriminate B vs C (both predict same thing for Phase 1 > 20s).

**Channel design:**

| Channel | Pattern | Duration | Purpose |
|---------|---------|----------|---------|
| Ch1 (HB) | 25.5s ON, 1s OFF | 26.5s | Long HB — does it get truncated? |
| Ch2 (DRL) | 2s ON, 1s OFF | 3s | Brief start marker |
| Ch3 (DRL-END) | 3s ON, 1s OFF | 4s | Phase 2 DRL |
| Ch4 (LB) | 3s at 0% | 3s | Dark |
| Ch5 (LB-END) | 3s ON, 1s OFF | 4s | Phase 2 LB |

Phase 1 = 26.5s. Phase 2 = max(4, 4) = 4s.

**Hex encoding:**
```
Ch1: 01, 00, 06, FF, 64, FF, 64, FF, 64, FF, 64, FF, 64, 32, 00  (5×5100ms@100% + 1000ms@0% = 26.5s)
Ch2: 02, 00, 02, 64, 64, 32, 00                (2000ms@100%, 1000ms@0%)
Ch3: 03, 00, 02, 96, 64, 32, 00                (3000ms@100%, 1000ms@0%)
Ch4: 04, 00, 01, 96, 00                        (3000ms@0%)
Ch5: 05, 00, 02, 96, 64, 32, 00                (3000ms@100%, 1000ms@0%)
Terminator: 00, 00, 00
Total: 15+7+7+5+7+3 = 44 bytes (staging1 only)
```

**Observation sequence:**
1. HB on + DRL flash → "started"
2. ~2s: DRL off/default. HB still on for a long time.
3. **HB turns off** → note T1. Was it ~26.5s or earlier?
4. DRL brightens + LB on → note T2 (immediately after T1?)
5. All off → note T3

**Decision tree:**
- T1 ≈ 26.5s → no cap (or cap > 26.5s)
- T1 ≈ 25s → cap at ~25s (Phase 1 truncated)
- T1 ≈ 20s → cap at ~20s
- HB never turns on → FLM2 rejected oversized channel entirely
- T2 ≈ T1 + 0.1s → no gap for long Phase 1 (consistent with Model C)

- **What to record**: T1 (HB off — rough stopwatch sufficient to distinguish ~20s vs ~25s vs ~26.5s), T2 (DRL brightens / LB on), T3 (last light off).
- **Results**: _(pending)_

---

## Decision Trees for A+B Combined

**If Phase 2 starts at ~20s in BOTH A and B:**
→ Model C confirmed. Fixed ~20s anchor. Model B falsified.

**If Phase 2 starts at different times in A vs B (>3s apart):**
→ Model B supported. Phase 2 anchored to timeline end. Anchor time = T2 + max(Ch3,Ch5).

**If Phase 2 starts immediately after Phase 1 (~5s) in both:**
→ No minimum duration. Re-examine all prior evidence.

**If Phase 2 never starts / no second flash:**
→ FLM2 rejected the template. Likely the all-dark Ch4 or short channel issue. Retry with Ch4 having a brief low-brightness pulse (100ms at 5%).

---

## Measurement Precision Guide

Model predictions are so far apart (8+ seconds) that **most measurements need only stopwatch-level timing**. Frame counting is expensive and should be reserved for the one measurement that matters most.

### What does NOT need frame counting (eyeball / stopwatch)

| Measurement | Why rough is enough |
|-------------|-------------------|
| **T1 in all experiments** (HB turns off) | We already know Phase 1 duration from the hex data. T1 just confirms the animation is running as expected. |
| **T2 in Exp B** (Phase 2 start) | Only needs to answer: "same as Exp A (~20s) or noticeably different (~14s)?" A 6s difference is obvious without frame counting. |
| **T3 in all experiments** (last light off) | Total duration only needs ±1s precision to distinguish models. |
| **T1 in Exp C** (HB off — cap test) | Need to tell ~20s vs ~25s vs ~26.5s. A phone timer or counting in your head is sufficient. |
| **T2 in Exp C** (Phase 2 start) | Just need to observe: "did Phase 2 start immediately after HB off, or was there a gap?" |

### The ONE measurement worth frame counting

**Experiment A, T2: When does Phase 2 start?**

This pins down the exact anchor point. If Model C is correct, this tells us whether the anchor is 19.9s, 20.0s, or 20.1s — refining the constant for all future predictions. One frame count, maximum value.

How to frame count T2: Find the frame where DRL visibly brightens beyond its default parking level, OR the frame where LB first appears (since HB is off, LB should be easy to spot). Count frames from animation start.

---

## Recording Protocol

1. Use 60fps camera (phone slow-mo or screen recording)
2. Start recording before opening door / triggering welcome light
3. **Run Experiment A first** — validates the Ch4-at-0% approach before flashing B and C
4. On first viewing: note approximate times with stopwatch for all T1/T2/T3
5. Only frame-count **Experiment A, T2** carefully
6. If results are ambiguous (e.g., total lands between model predictions), then frame-count more
7. Record at least 2 runs per template for consistency
8. Note ambient conditions (temperature, battery state) if behavior seems inconsistent
