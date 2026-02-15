# Timing Analysis: Real-World Validation of Duration Multiplier

## Introduction

This document presents the findings from real-world validation testing of BMW FLM2 (Footwell Light Module 2) welcome light animation timing. Testing was conducted on a **BMW G20 2020** using high-speed video recordings to precisely measure actual hardware animation timing and compare it against the code's predictions.

**Testing Date:** February 2026
**Vehicle:** BMW G20 2020
**Recording Equipment:** 60fps camera (actual framerate: 59.89 fps)
**Testing Goal:** Validate the duration byte-to-millisecond conversion multiplier

## Executive Summary

**Finding:** The hardware uses a **×20 multiplier**, not the originally documented **×10 multiplier**.

**Evidence:** Two independent channels tested with different animation patterns consistently showed timing approximately **2x slower** than code predictions.

**Action Taken:** Updated codebase from ×10 to ×20 multiplier throughout.

---

## Testing Methodology

### Frame-to-Millisecond Conversion

With 59.89 fps recording:
- **Milliseconds per frame:** 1000 / 59.89 = **16.697 ms/frame**

### Measurement Process

1. Record BMW FLM2 animation at 60fps (actual: 59.89fps)
2. Identify key frames where brightness changes occur
3. Convert frame numbers to milliseconds: `Frame × 16.697 ms/frame`
4. Compare observed timing against code predictions
5. Calculate timing ratio: `Observed / Expected`

---

## Channel 1 Analysis

### Hex Sequence
```
01, 00, 03, 64, 64, 32, 64, 64, 00
```

### Sequence Breakdown
- **Channel ID:** `01`
- **Separator:** `00`
- **Length:** `03` (3 duration/brightness pairs)
- **Pair 1:** Duration `64` (100 decimal), Brightness `64` (100%)
- **Pair 2:** Duration `32` (50 decimal), Brightness `64` (100%)
- **Pair 3:** Duration `64` (100 decimal), Brightness `00` (0%)

### Expected Timeline (×10 multiplier)

| Segment | Duration (hex→dec×10) | Brightness Target | Time Range | Event |
|---------|----------------------|-------------------|------------|-------|
| 1 | `64` → 100 → 1000ms | 100% | 0–1000ms | Ramp from 0% to 100% |
| 2 | `32` → 50 → 500ms | 100% | 1000–1500ms | Hold at 100% |
| 3 | `64` → 100 → 1000ms | 0% | 1500–2500ms | Ramp from 100% to 0% |

**Expected total duration:** 2500ms

### Observed Timeline (60fps recording)

| Frame | Time (ms) | Observed Event |
|-------|-----------|----------------|
| 0 | 0 | Brightness 0% |
| 115 | 1,920 | Brightness reaches 100% |
| 180 | 3,005 | Last frame at 100% (transition to fade starts) |
| 286 | 4,775 | Brightness reaches 0% |

**Observed total duration:** 4775ms

### Comparison: Expected vs Observed

| Event | Expected (ms) | Observed (ms) | Ratio (Observed/Expected) |
|-------|---------------|---------------|---------------------------|
| Ramp up (0%→100%) | 1,000 | 1,920 | **1.92x** |
| Hold duration at 100% | 500 | 1,085 | **2.17x** |
| Ramp down (100%→0%) | 1,000 | 1,770 | **1.77x** |
| **Total animation** | **2,500** | **4,775** | **1.91x** |

**Average timing ratio:** **1.95x** ≈ **2.0x**

---

## Channel 2 Analysis

### Hex Sequence
```
02, 00, 05, FF, 00, C3, 00, 64, 64, 32, 64, 64, 00
```

### Sequence Breakdown
- **Channel ID:** `02`
- **Separator:** `00`
- **Length:** `05` (5 duration/brightness pairs)
- **Pair 1:** Duration `FF` (255 decimal), Brightness `00` (0%) — initial hold at 0%
- **Pair 2:** Duration `C3` (195 decimal), Brightness `00` (0%) — continue hold at 0%
- **Pair 3:** Duration `64` (100 decimal), Brightness `64` (100%) — ramp to 100%
- **Pair 4:** Duration `32` (50 decimal), Brightness `64` (100%) — hold at 100%
- **Pair 5:** Duration `64` (100 decimal), Brightness `00` (0%) — ramp to 0%

### Expected Timeline (×10 multiplier)

| Segment | Duration (hex→dec×10) | Brightness Target | Time Range | Event |
|---------|----------------------|-------------------|------------|-------|
| 1 | `FF` → 255 → 2550ms | 0% | 0–2550ms | Hold at 0% |
| 2 | `C3` → 195 → 1950ms | 0% | 2550–4500ms | Continue hold at 0% |
| 3 | `64` → 100 → 1000ms | 100% | 4500–5500ms | Ramp from 0% to 100% |
| 4 | `32` → 50 → 500ms | 100% | 5500–6000ms | Hold at 100% |
| 5 | `64` → 100 → 1000ms | 0% | 6000–7000ms | Ramp from 100% to 0% |

**Expected total duration:** 7000ms
**Expected active animation (pairs 3-5):** 2500ms

### Observed Timeline (60fps recording)

Frame 542 marks the start of visible animation (after initial hold period).

| Frame | Time from Start (ms) | Observed Event |
|-------|----------------------|----------------|
| 542 | 0 | Light starts brightening |
| 655 | 1,887 | Reaches 100% |
| 720 | 2,972 | Last frame at 100% |
| 836 | 4,909 | Reaches 0% |

**Observed active animation duration:** 4909ms

### Comparison: Expected vs Observed (Active Animation Portion)

| Segment | Expected (ms) | Observed (ms) | Ratio (Observed/Expected) |
|---------|---------------|---------------|---------------------------|
| Ramp 0%→100% | 1,000 | 1,887 | **1.89x** |
| Hold at 100% | 500 | 1,085 | **2.17x** |
| Ramp 100%→0% | 1,000 | 1,937 | **1.94x** |
| **Total active** | **2,500** | **4,909** | **1.96x** |

**Average timing ratio:** **2.00x**

---

## Cross-Channel Comparison

| Metric | Channel 1 | Channel 2 | Consistency |
|--------|-----------|-----------|-------------|
| Ramp up ratio | 1.92x | 1.89x | ✓ Very close |
| Hold ratio | 2.17x | 2.17x | ✓ **IDENTICAL** |
| Ramp down ratio | 1.77x | 1.94x | ✓ Close |
| Overall average | 1.95x | 2.00x | ✓ **CONFIRMS 2x PATTERN** |

### Key Observation

The **hold duration ratio is identical (2.17x)** in both channels, despite:
- Different channel IDs (01 vs 02)
- Different sequence lengths (3 pairs vs 5 pairs)
- Different animation contexts (standalone vs with long initial hold)

This consistency strongly indicates a systematic timing difference, not measurement error.

---

## Conclusions

### 1. Hardware Uses ×20 Multiplier

The real BMW G20 2020 FLM2 module consistently applies a **×20 multiplier** to duration bytes:

```
Duration (ms) = Hex Byte Value × 20
```

**Not** the originally documented ×10 multiplier.

### 2. Consistency Across Channels

Testing confirmed the timing pattern across:
- ✓ Different channel IDs (01, 02)
- ✓ Different duration values (32, 64, C3, FF hex)
- ✓ Different animation patterns (ramps, holds)
- ✓ Different sequence lengths (3 pairs, 5 pairs)

**Average timing ratio:** 1.97x ≈ **2.0x**

### 3. Original Documentation Was Incorrect

The original reverse-engineering documentation stated:
> "Duration Byte to decimal and multiplied with 10 results in the time in milliseconds"

This was **incorrect** for BMW G20 2020 hardware.

---

## Theory: Why Was the Original ×10 Multiplier Wrong?

### Possible Explanations

1. **Measurement Method Limitations**
   - Without high-speed camera, difficult to measure sub-second timing precisely
   - Human perception of "1 second" can be off by 50-100%
   - Original engineer may have eyeballed "this looks like about 1 second" for a `64` duration value

2. **Different Test Conditions**
   - Original reverse engineering may have been done on different BMW model/firmware
   - Some models might use ×10, others ×20 (though G20 2020 clearly uses ×20)
   - Firmware updates could have changed timing behavior

3. **Lack of Systematic Validation**
   - May have only tested one or two sequences
   - Without systematic validation across multiple channels and durations
   - No cross-validation with different duration values

4. **Measurement Tools**
   - Standard phone cameras (30fps) have ~33ms resolution
   - 60fps cameras provide ~16.7ms resolution (6x more precise)
   - High-speed video reveals timing details invisible to human eye or slower cameras

---

## Implementation Impact

### Files Modified

1. **`js/animation.js`** — Updated `getBrightnessAtTime()` and `getSequenceDuration()`
   - Line 109: `t += durHex * 20;` (was ×10)
   - Line 243: `let stepDur = durHex * 20;` (was ×10)

2. **`js/chart.js`** — Updated `parseForChart()`
   - Line 23: `sumT += durHex * 20;` (was ×10)

3. **`js/editor.js`** — Updated visual editor display
   - Line 97: `max="5100" step="20"` (was max="2550" step="10")
   - Line 135: `numInput.value = val * 20;` (was ×10)

4. **`README.md`** — Updated documentation
   - Changed "multiplied with 10" to "multiplied with 20"
   - Added reference to this timing analysis document

5. **Tests** — Updated timing expectations throughout test suite

### Expected Behavior Changes

**Before (×10 multiplier):**
- Duration `64` (100 decimal) → 1000ms
- Duration `FF` (255 decimal) → 2550ms
- Total for sequence `64,64,32,64,64,00` → 2500ms

**After (×20 multiplier):**
- Duration `64` (100 decimal) → **2000ms**
- Duration `FF` (255 decimal) → **5100ms**
- Total for sequence `64,64,32,64,64,00` → **5000ms**

**Visual editor changes:**
- Duration input range: 0-5100ms (was 0-2550ms)
- Duration step: 20ms (was 10ms)
- Animation playback: 2x longer (matches real hardware)

---

## Future Validation Recommendations

### Additional Testing Needed

1. **Test Other BMW Models**
   - G30, G80, G82, G07 (models in templates.js)
   - Confirm if all use ×20 or if multiplier varies by model
   - Document any model-specific timing variations

2. **Test Different Firmware Versions**
   - Same vehicle model, different years (2020 vs 2022 vs 2023)
   - Check if firmware updates changed timing behavior

3. **Test Full Animation Suite**
   - Record all sequences from templates.js
   - Validate timing across all channels (DRL, beam, accent, etc.)
   - Identify any channel-specific timing quirks

4. **Document Edge Cases**
   - Very short durations (hex values < 10)
   - Very long durations (hex values > F0)
   - Mixed duration ranges in same sequence

### Validation Protocol

For future testing, use this standardized protocol:

1. **Equipment:** 60fps camera minimum (120fps preferred)
2. **Recording:** Start before animation, capture full sequence
3. **Frame Analysis:** Note exact frame numbers for each brightness change
4. **Calculation:** Convert frames to milliseconds using actual framerate
5. **Comparison:** Calculate ratio = Observed / Expected
6. **Documentation:** Record vehicle year, model, template used

---

## References

- BMW FLM2 (Footwell Light Module 2) documentation
- BMW G20 2020 original template data
- `CLAUDE.md` — Project architecture and data model
- `MEMORY.md` — Development patterns and conventions

---

**Document Version:** 1.0
**Last Updated:** 2026-02-08
**Validated Hardware:** BMW G20 2020
**Validation Method:** 60fps (59.89fps) video recording frame analysis
