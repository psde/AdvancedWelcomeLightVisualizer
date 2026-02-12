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

Two models explain the observed channel behavior. Both agree on two-phase structure ({Ch1,Ch2,Ch4} → gap → {Ch3,Ch5}), but differ on what determines the total animation length and the gap between phases.

### Established Facts (from Experiments 1 and 5)

- Phase 1 = {Ch1, Ch2, Ch4} simultaneous, duration = max(Ch1, Ch2, Ch4)
- Phase 2 = {Ch3, Ch5} simultaneous, duration = max(Ch3, Ch5)
- Variable gap between Phase 1 and Phase 2
- ~0.10s inter-phase transition delay (hardware)
- Lights revert to default state during the gap (e.g., DRL turns on at parking brightness)
- Channels restart from t=0 when Phase 2 begins

### Model A: No Minimum Duration

Total = Phase 1 + max(Ch3, Ch5), with no gap. Phase 2 starts immediately after Phase 1.

```
|-- Phase 1 --|-- Phase 2 --|
   Ch1,Ch2,Ch4   Ch3 + Ch5
```

- **Identify Channels**: 10 + 10 = 20s predicted → **30.4s recorded** (10.4s error — cannot explain the 10s gap)
- **Original**: 13.76 + 5.62 = 19.38s predicted → 25.2s recorded (**5.8s unexplained**)

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

### The Minimum Duration Puzzle

The gap data from two experiments gives inconsistent minimums:

| Experiment | Phase 1 | max(Ch3,Ch5) | Observed Total | Gap | Implied Minimum |
|---|---|---|---|---|---|
| Identify Channels | 10.0s | 10.0s | 30.4s | ~10s | ~30s |
| Original | 13.76s | 5.62s | 25.2s | ~5.8s | ~25s |
| v15 | 19.90s | 6.60s | 26.57s | ~0s | ≤26.5s |

If the minimum were fixed at 25s, Identify Channels should be ~25s (not 30.4s). If fixed at 30s, Original should be ~30s (not 25.2s). **The minimum is not a single fixed value.** The gap calculation involves a formula not yet determined — possibly related to Phase 1 + Ch3 + Ch5, or involving per-channel durations rather than just the maximum.

**Note (post-Experiment 4):** The Stagger Test (Experiment 4) challenges both models with behaviors neither predicts — Ch3 appearing with zero gap after Ch2, an 11s visible duration from 5s of programmed content, and a ~25s apparent cycle cap that suppresses Ch4/Ch5 entirely. The actual FLM2 behavior appears more complex than either model captures. See Experiment 4 for full details. Experiments A, B, and C remain the most important next steps since they use simple designs (no leading zeros on END channels) that cleanly test the core phase/timing questions.

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
The below data seems to be wrong:
**Staging1 (252 bytes):**
```
01 00 01 00 64 64 32 64 00 32 00
02 00 12 FF 00 FF 00 FF 00 FF 00 FF 00 C3 00 64 64 32 64 00 32 00
03 00 23 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 87 00 64 64 32 64 00 32 00
```

**Staging2 (168 bytes):**
```
04 00 30 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 4B 00 64 64 32 64 00 32 00
05 00 3D FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 FF 00 0F 00 64 64 32 64 00 32 00
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

#### 1. Zero-gap Ch3 onset contradicts both models
Ch3 has 18.0s of programmed leading zeros. Under any model where Ch3 replays from its own t=0, it should be dark for 18s before its active content. Yet DRL reappeared ONE FRAME after Ch2 ended at 14s — zero gap. This means the FLM2 either stripped Ch3's leading zeros entirely, or fast-forwarded through them.

#### 2. Inconsistency with Identify Channels experiment
In Experiment 1 (Identify Channels), Ch3 had 4s of leading zeros and they played normally — Ch3's flash peak appeared at 24.96s = ~20s(Phase 2 start) + 4s(leading zeros) + 1s(flash). In this Stagger Test, Ch3's 18s of leading zeros were apparently skipped. The FLM2 may handle leading zeros **context-dependently** — perhaps stripping them when they would exceed the animation timeline, but playing them when they fit.

#### 3. The 11-second mystery
Ch3's programmed active content is only 5s (2s fade-in, 1s hold, 2s fade-out). Yet DRL was visible from 14s to ~25s = 11 seconds. Possible explanations:
- Hardware slow-discharge after the drive signal stops (phosphor/capacitor decay)
- Different brightness interpolation in real FLM2 vs our linear model
- Ch3's leading zeros partially played at reduced brightness
- Measurement uncertainty in the "dims to 0%" endpoint

#### 4. ~50% brightness with PWM flickering
When Ch3 activated at 14s, the DRL was at roughly 50% with visible PWM flickering, not the programmed 100%. This suggests the FLM2 may be driving the LED differently when replaying END-channel content, or that Ch3's fade-in was interrupted/modified.

#### 5. Ch4 and Ch5 never visible — ~25s duration cap confirmed
Ch4's active content starts at 27s and Ch5's at 36s. Neither was ever visible, consistent with a ~25s maximum animation duration. This reinforces the cap hinted at in Experiment 3.

#### 6. Possible second cycle at 40-43s
DRL activity at 40-43s could indicate the animation looped with a ~25s cycle:
- Cycle 2 starts at ~25s
- Ch2 would activate at 25+9 = 34s, end at 25+14 = 39s
- Ch3 would activate at ~39-40s, end at ~44s
- Observed: DRL at 40-43s ≈ consistent with Ch3 in cycle 2
- After cycle 2, Ch4/Ch5 would again exceed the cap → no further light

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

**Definitive test**: Experiment A (Phase Restart Test)

### Q2: Is the minimum total animation time fixed or variable?
A gap exists between Phase 1 and Phase 2, but the implied minimum is inconsistent: ~30s for Identify Channels, ~25s for Original, ≤26.5s for v15. The gap formula is the central remaining mystery.

**Definitive test**: Experiments A and B will provide new data points (Phase1=5, Ch3=5, Ch5=5 and Phase1=1.5, Ch3=1.5, Ch5=1.5). The observed gap in each will constrain the formula. See Q9 for detailed analysis.

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

**Definitive test**: Experiment A (no leading zeros on any END channel) should clarify phase boundary behavior.

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

**Definitive test**: Experiment A (Phase1=5s, Ch3=5s, Ch5=5s). The total and gap will constrain the formula. If total ≈ 10s → no minimum. If ≈ 15s → gap=5s. If ≈ 25s → gap=20s.

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

### Experiment A: Phase Restart Test
- **Template**: `BMW G20 2020 - Exp A Phase Restart`
- **Goal**: Measure the gap between Phase 1 and Phase 2, and confirm Ch3+Ch5 simultaneous playback with no leading zeros.
- **Design**: All channels flash at t=0 for 1s, then 4s off (5s total). Ch3 and Ch5 have NO leading zeros.
- **Predictions by model**:

  **No minimum (gap = 0):**
  - Phase 1 = 5s, Phase 2 = {Ch3, Ch5} simultaneously = 5s → **total ~10s**
  - Ch3 and Ch5 both flash immediately at Phase 2 start (~5s)
  - DRL and Low Beam flash at the same time

  **Model B (minimum ~25s):**
  - Phase1 + max(Ch3,Ch5) = 10s < 25s → gap inserted
  - Total ~25s, Phase 2 starts at ~20s
  - Ch3 and Ch5 both flash at ~20s
  - 15s of darkness/default-DRL between Phase 1 and Phase 2

  **"Total = Phase1+Ch3+Ch5" model:**
  - Total = 5+5+5 = 15s, Phase 2 at 15-5 = 10s
  - Gap = 5s between Phase 1 and Phase 2
  - Ch3 and Ch5 both flash at ~10s

  **Distinguishing outcomes**: The total duration and gap directly constrain the minimum formula. ~10s → no minimum. ~15s → total=Phase1+Ch3+Ch5. ~25s → fixed 25s minimum. Any other value → more complex formula. In all cases, Ch3 and Ch5 should flash simultaneously (confirming the two-phase model).

- **What to record**: Total duration. When does DRL flash a second time? When does Low Beam flash a second time? Do they flash simultaneously? Length of gap between Phase 1 and Phase 2 (watch for DRL default-on during gap).
- **Results**: _(pending)_
- **Results**: _(pending)_

### Experiment B: Min Phase Duration Test
- **Template**: `BMW G20 2020 - Exp B Min Phase Duration`
- **Goal**: Second data point for the gap/minimum formula with very short channels.
- **Design**: All channels 0.5s on, 1s off (1.5s total each)
- **Predictions by model**:

  **No minimum (gap = 0):**
  - Phase 1 = 1.5s, Phase 2 = {Ch3, Ch5} = 1.5s → **total ~3s**

  **"Total = Phase1+Ch3+Ch5" model:**
  - Total = 1.5+1.5+1.5 = 4.5s, Phase 2 at 4.5−1.5 = 3.0s → gap = 1.5s

  **Model B (minimum ~25s):**
  - Phase1 + max(Ch3,Ch5) = 3.0s << 25s → **gap ≈ 22s**
  - Phase 2 at ~23.5s, total ~25s
  - Extremely long darkness/default-DRL between Phase 1 and Phase 2

  **Distinguishing outcome**: Combined with Experiment A, this gives a second data point (Phase1=1.5, Ch3=1.5, Ch5=1.5) to constrain the gap formula. The gap here should follow the same rule as Experiments 1, 2, 5, and A.

- **What to record**: Total duration. Timestamps of each light on/off. Length of gap between Phase 1 and Phase 2. Does DRL turn on at default brightness during the gap?
- **Results**: _(pending)_

### Experiment C: Max Phase Duration Test
- **Template**: `BMW G20 2020 - Exp C Max Phase Duration`
- **Goal**: Determine if there's a maximum duration / upper bound on the timeline, and test gap behavior with a very long Phase 1.
- **Design**: Ch1 = 25.5s on + 1s off (26.5s). Ch2/Ch4 = 1.5s. Ch3/Ch5 flash immediately, 2s on + 1s off (3s).
- **Predictions by model**:

  **No minimum (gap = 0):**
  - Phase 1 = 26.5s, Phase 2 = {Ch3, Ch5} = 3s → **total ~29.5s**
  - Phase 2 starts immediately after Phase 1 (no gap, since content is long)

  **"Total = Phase1+Ch3+Ch5" model:**
  - Total = 26.5+3+3 = 32.5s, Phase 2 at 32.5−3 = 29.5s → gap = 3.0s

  **Distinguishing outcome**: Tests both the upper bound (does Phase 1 get truncated at ~25-30s?) and the gap formula (is there a gap when Phase 1 is very long?). If High Beam cuts off early, reveals the Phase 1 cap. The gap (or lack thereof) gives another data point for the formula.

- **What to record**: How long does High Beam stay on? When does DRL-END flash (Ch3)? When does LB-END flash (Ch5)? Do they flash simultaneously? Total duration? Gap between Phase 1 end and Phase 2 start?
- **Results**: _(pending)_

---

## Recording Protocol

1. Use 60fps camera (phone slow-mo or screen recording)
2. Start recording before opening door / triggering welcome light
3. Frame-count timestamps for: first light on, each channel on/off, last light off
4. Record at least 2 runs per template for consistency
5. Note ambient conditions (temperature, battery state) if behavior seems inconsistent
