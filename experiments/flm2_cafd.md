# FLM2 CAFD Cross-Reference Analysis

**CAFD**: `CAFD_000043AF_015_192_000` — BMW G20 2020 EU Laser headlight (FLM2 module at address 0x43AF)

## 1. File Overview

The CAFD contains 1204 parameters in a flat key-value format. The FLM2 is primarily an **LED driver controller** — the vast majority of parameters configure thermal management, current regulation, voltage monitoring, headlight leveling (AHL), and LED binning classes. Welcome light animation is secondary functionality, stored in just two fields (`Staging1_Data`, `Staging2_Data`) with animation playback behavior almost entirely firmware-driven.

Key parameter categories:
- **AHL** (Adaptive Headlight Leveling): ~85 parameters for motor control, position sensing, calibration
- **LM01–LM15** (Light Modules): LED current, voltage, binning, gamma for each of 15 hardware slots
- **Lmm1–Lmm6_Data** (Lichtmuster/Light Mode Matrices): 6 × 252-byte blobs defining operational driving modes (parking, low beam, high beam, etc.) — separate from welcome light
- **Staging1/2_Data**: Welcome light animation data
- **Sat_Data**: 226-byte opaque satellite driver configuration blob
- **GAMMA_0–3**: Four gamma correction curves
- **BOOST/SYS**: Power supply monitoring and boost converter config

---

## 2. Confirmed Constants

Cross-referencing experimentally determined constants (from `evidence_v2.md`) against CAFD values:

| Constant | Evidence Value | CAFD Match | CAFD Line | Confidence |
|---|---|---|---|---|
| Staging1 size | 252 bytes | `Staging1_Data` = exactly 252 bytes | 1195 | **CONFIRMED** |
| Staging2 size | 168 bytes | `Staging2_Data` = exactly 168 bytes | 1196 | **CONFIRMED** |
| Channel count | 5 (for G20 laser) | Staging1_Data decodes to 5 channels (IDs 01–05) | 1195 | **CONFIRMED** |
| Staging1 content | v15 template | Matches Ch1:15p, Ch2:30p, Ch3:19p, Ch4:11p, Ch5:9p | 1195 | **CONFIRMED** |
| ~0.1s transition delay | ~100ms inter-phase | `LED_HAUPT_SEGMENT_ON_OFF_T` = `0x64` = 100 | 493 | MEDIUM |

### Staging1_Data Decode

The Staging1_Data field at line 1195 begins with:

```
01 00 0F ...   → Ch1 (High Beam), 15 pairs = 19.90s
02 00 1E ...   → Ch2 (DRL), 30 pairs = 7.02s
03 00 13 ...   → Ch3 (DRL-END), 19 pairs = 6.16s
04 00 0B ...   → Ch4 (Low Beam), 11 pairs = 6.94s
05 00 09 ...   → Ch5 (LB-END), 9 pairs = 6.60s
00 00 00       → terminator
```

This is the "BMW G20 2022 - EU - Laser light - Left right swipe v15" template that was independently verified in Experiment 5.

---

## 3. Firmware-Hardcoded (NOT in CAFD)

These experimentally observed behaviors have **no corresponding CAFD parameters** — they are implemented in firmware:

| Constant | Value from Experiments | Notes |
|---|---|---|
| ~20s Phase 2 anchor | 19.84–19.97s | Zero "welcome", "phase", or "animation" parameters exist in CAFD |
| ~20s Phase 1 duration cap | ~19.94s (Experiment 8) | No max-duration parameter found |
| 20ms time base | 20ms per tick | No explicit time-base parameter |
| Two-phase playback | Phase 1 → gap → Phase 2 | Entirely firmware logic |
| Channel-to-LM mapping | See section 6 | Not explicit in CAFD |
| DRL default revert | 74% parking / 89% low beam | Confirmed from Lmm_Data mode 1 (0x4A) and mode 6 (0x59), group 4 DRL outputs. 600ms ramp time (0x1E). See section 9 |
| Default state revert (mid-animation) | Uncontrolled lights → Lmm default during animation; all lights → off after animation ends | Governed by Lmm_Data during animation gaps; lights go dark when animation completes |
| ~2s hardware ramp | Ramp-up/down on control handoff | Lmm_Data DRL records use 0x1E/0x1E = 600ms ramps. Total ~2s = ramp + firmware transition. See section 9 |

The complete absence of animation timing parameters from the CAFD is significant — it means these behaviors **cannot be changed via coding** and are baked into the FLM2 firmware version.

---

## 4. Speculative Matches in Sat_Data

The `Sat_Data` blob at line 1174 is a 226-byte opaque field. Several values are tantalizing when interpreted as timing constants, but the overall structure strongly suggests it is a **satellite LED driver configuration** (currents, temperatures, voltage monitoring):

### Byte[0]: Value 0x32

`0x32` = 50 — coincidentally equals 50, but the DRL parking brightness is actually encoded in the Lmm_Data driving mode records (see section 9). The actual default brightness cannot be determined from visual observation alone; only sub-100% operation is confirmed via observed PWM flicker. This byte's function within Sat_Data remains unknown.

### Bytes 28–43: Ascending Current Table

| Offset | Hex | Decimal | If 20ms ticks | More likely |
|---|---|---|---|---|
| 28–29 | `00 64` | 100 | 2.0s | 100 mA |
| 30–31 | `01 F4` | 500 | 10.0s | 500 mA |
| 32–33 | `02 EE` | 750 | 15.0s | 750 mA |
| 34–35 | `04 4C` | 1100 | 22.0s | 1100 mA |
| 36–37 | `05 14` | 1300 | 26.0s | 1300 mA |
| 38–39 | `05 DC` | 1500 | 30.0s | 1500 mA |
| 40–41 | `06 A4` | 1700 | 34.0s | 1700 mA |
| 42–43 | `07 D0` | 2000 | 40.0s | 2000 mA |

If these were timing values at 20ms ticks: `0x0514` = 1300 → 26.0s (near the ~20s cap) and `0x05DC` = 1500 → 30.0s. However, the ascending table pattern (100 → 2000) with regular spacing is far more consistent with LED current binning classes, matching the `LM_CURRENT_BINNING_CLASS` format used elsewhere in the CAFD.

### Bytes 48–80: Four Repeated Blocks

This region contains eight instances of `0x03E8` = 1000. If interpreted at 20ms ticks: 20.0s (the Phase 2 anchor!). However, these are more likely **1000 mA current setpoints** — 0x03E8 appears as `LM10_CURRENT_BINNING_CLASS0` (line 905), confirming this is a standard current value in the CAFD.

### Bytes 110–125: Current Binning

Contains values matching the `LM_CURRENT_BINNING_CLASS` format seen in the per-LM sections, further confirming Sat_Data is an LED driver configuration blob.

**Verdict**: Sat_Data is primarily satellite LED driver configuration. The coincidence of 1000 (= 20.0s at 20ms) and 1300 (= 26.0s at 20ms) is notable but almost certainly just that — a coincidence.

---

## 5. Hardware Channel Architecture — LM_Name Function Map

The FLM2 has 15 Light Module (LM) hardware slots. Each slot has a `Name` (function ID), LED count, I/O binning class, and allocated gamma curve:

| LM | Name | Function | LEDs | IO_BIN | Gamma | Status |
|---|---|---|---|---|---|---|
| LM01 | 06 | High Beam | 4 | 05 | 0 | Active |
| LM02 | 02 | DRL (inner strip) | 3 | 02 | 0 | Active |
| LM03 | 00 | — | 0 | 00 | 0 | Inactive |
| LM04 | 03 | Low Beam (secondary) | 1 | 04 | 0 | Active |
| LM05 | 0A | Accent / Outer DRL | 6 | 01 | 0 | Active |
| LM06 | 04 | Position light | 4 | 01 | 0 | Active |
| LM07 | 02 | DRL (outer strip) | 3 | 02 | 0 | Active |
| LM08 | 03 | Low Beam (secondary) | 1 | 03 | 0 | Active |
| LM09 | 07 | Turn Signal | 1 | 06 | 0 | Active |
| LM10 | 01 | Low Beam (main) | 3 | 07 | 0 | Active |
| LM11 | 09 | DRL virtual (accent) | — | 0F | **2** | Virtual → LM06 |
| LM12 | 04 | Position virtual | — | 01 | 0 | Virtual → LM01+LM07 |
| LM13 | 00 | — | — | 00 | 0 | Inactive |
| LM14 | 00 | — | — | 00 | 0 | Inactive |
| LM15 | 00 | — | — | 00 | 0 | Inactive |

**Total**: 26 physical LEDs across 10 active LMs + 2 virtual LMs

### Virtual LM Connections

Virtual LMs don't drive LEDs directly — they composite onto physical LMs:

- `VIRT_LM11_CONNECTION` = `0x20` = bit 5 → **LM06** (Position light). LM11 (Name 09, DRL virtual/accent) overlays onto LM06's 4 LEDs.
- `VIRT_LM12_CONNECTION` = `0x41` = bits 0+6 → **LM01 + LM07** (High Beam + DRL outer). LM12 (Name 04, Position virtual) overlays onto LM01's 4 LEDs and LM07's 3 LEDs.

### LM_Name Function ID Assignments

| Name ID | Function | Physical LMs |
|---|---|---|
| 00 | Unused | LM03, LM13, LM14, LM15 |
| 01 | Low Beam (main) | LM10 |
| 02 | DRL | LM02, LM07 |
| 03 | Low Beam (secondary) | LM04, LM08 |
| 04 | Position light | LM06, LM12 (virtual) |
| 06 | High Beam | LM01 |
| 07 | Turn Signal | LM09 |
| 09 | DRL virtual (accent) | LM11 (virtual) |
| 0A | Accent / Outer DRL | LM05 |

---

## 6. Animation Channel → Physical LM Mapping (Proposed)

The animation channel IDs (01–05) in Staging data are **sequential indices**, not LM_Name function IDs. The firmware maps them internally:

| Anim Ch | Label | LM_Name(s) driven | Physical LMs | Total LEDs |
|---|---|---|---|---|
| 01 | High Beam | Name 06 | LM01 | 4 |
| 02 | DRL | Name 02 (+0A, 04, 09?) | LM02+LM07 (+LM05, LM06, LM11?) | 6–20 |
| 03 | DRL-END | Ch2 lights + 1 accent LED | Ch2 LMs + likely LM11 or LM05 | Ch2 LEDs + 1 |
| 04 | Low Beam | Name 01 (+03?) | LM10 (+LM04, LM08?) | 3–5 |
| 05 | LB-END | Same as Ch4 | Same as Ch4 | Same |

### Open Question: DRL Channel Scope and Ch3's Extra LED

Does Ch2 (DRL) drive **only** the primary DRL strips (Name 02 → LM02+LM07, 6 LEDs) or **all** DRL-related LMs including accent (Name 0A → LM05, 6 LEDs), position (Name 04 → LM06, 4 LEDs), and DRL virtual (Name 09 → LM11)?

The headlight photo (`assets/bmw_g20_2020_eu_laser_original.png`) suggests the DRL animation illuminates the full L-shaped light guide, which would require multiple LM groups working together. The 26 total LEDs across 10 active modules produce the complex G20 laser headlight appearance with a single 5-channel animation.

**Ch3 constraint**: Ch3 (DRL-END) is physically observed to drive one additional small accent LED that Ch2 (DRL) does not, while otherwise illuminating the same set of lights. This constrains the channel-to-LM mapping — the extra LED is likely driven by:
- **LM11** (virtual DRL accent → LM06, gamma curve 2): Particularly interesting because LM11 uses a distinct gamma curve, which could produce a visibly different accent effect on a sub-element of LM06's 4 position LEDs.
- **LM05** sub-element (accent/outer DRL, 6 LEDs): A single LED within the 6-LED LM05 module could be selectively activated.

The LM11 virtual connection (bit 5 → LM06) is notable because it's the only LM with a non-standard gamma assignment (curve 2), suggesting it was designed for a distinct visual behavior — consistent with the observed accent difference between Ch2 and Ch3.

---

## 7. Why Other Vehicles Can Have Up to 15 Channels

The G20 laser uses only 5 animation channels because it groups LEDs by **function** (HB, DRL, LB) with END variants. The FLM2 supports up to 15 LM hardware slots. Vehicles with individually addressable DRL segments (e.g., newer BMWs with sequential/"flowing" DRL animations) could assign separate animation channels to each segment:

- 4× outer DRL segments (Ch 1–4)
- 4× inner DRL segments (Ch 5–8)
- Low beam modules (Ch 9–10)
- High beam (Ch 11)
- Position lights (Ch 12–13)
- Accent/laser (Ch 14–15)

The animation channel count is limited by:
1. The number of distinct LM_Name function groups
2. The 15 LM hardware slots
3. The 420-byte staging data capacity (252 + 168)

---

## 8. Gamma Correction

Four identical gamma curves are defined (`GAMMA_0` through `GAMMA_3`), all with heavy non-linear compression:

| Input | Hex | Output | Ratio |
|---|---|---|---|
| 20% | `0x02` | 0.8% | 25:1 |
| 40% | `0x0D` | 5.1% | 8:1 |
| 60% | `0x2B` | 16.9% | 3.5:1 |
| 75% | `0x54` | 32.9% | 2.3:1 |
| 90% | `0x92` | 57.3% | 1.6:1 |
| 95% | `0xAB` | 67.1% | 1.4:1 |

Output percentages are hex value / 255 × 100.

### Gamma Curve Allocation

| Curve | Assigned to |
|---|---|
| Curve 0 | LM01–LM10, LM12 (all physical + position virtual) |
| Curve 2 | **LM11 only** (DRL virtual/accent) |
| Curves 1, 3 | Unused (identical to 0 anyway) |

Since all four curves are identical in this CAFD, the gamma assignment only matters if curves are customized. LM11's use of curve 2 suggests the firmware may apply different gamma tables in other vehicle configurations.

**Implication for animation**: Brightness values in Staging data pass through gamma correction before reaching LEDs. A programmed 50% brightness command results in approximately **13% actual light output** (interpolating between the 40% → 5.1% and 60% → 16.9% points). This explains why welcome light animations may appear dimmer than expected at mid-range values.

---

## 9. Notable Other Findings

### Vehicle Identification

`HlPrjLabel` (lines 454–460):
- `CarPrj` = `0x23` (35) → G20 platform
- `HlSupplier` = `0x01` → Supplier 1
- `HlType` = `0x06` → Laser headlight
- `HlRechtslenker` = `0x00` → LHD (Left-Hand Drive)

### Channel Start PWM

`Channel_Start_PWM` = `0x00` (line 358): Channels start at 0% brightness when first activated. This is consistent with the observed behavior where animation channels begin at 0% and ramp up according to their programmed sequence.

### LWR_WELL_REF_timeout

`LWR_WELL_REF_timeout` = `0x14` = 20 (line 1108): The "WELL" prefix might abbreviate "Welcome" — this could be a welcome-light-related headlight leveling reference timeout. However, `LWR_REF_timeout` = `0x14` = 20 (line 1073) has the same value, suggesting "WELL" may just be a different context for the same leveling operation rather than welcome-light-specific.

### Matrix Beam

All `NON_SAT_MATRIX_SEG` channels = 0 (lines 1124–1135): No matrix beam segments are active. This G20 uses laser high beam, not matrix LED.

### Lmm_Data (Light Mode Matrices) — Deep Analysis

Six 252-byte blocks (`Lmm1_Data` through `Lmm6_Data`, lines 1109–1114) define operational driving light modes — how LEDs behave during normal driving (parking, low beam, high beam combinations). These are **separate from** the welcome light animation system.

#### Continuous Record Stream

Lmm1–Lmm3 form a **single continuous stream** of 6-byte records, NOT separate mode definitions. Evidence: modes 5 and 9 span Lmm block boundaries (mode 5 starts in Lmm1, ends in Lmm2; mode 9 starts in Lmm2, ends in Lmm3). Lmm4–Lmm6 are all `0xFF` (unused capacity).

- **107 total records** = 642 bytes used out of 756 byte capacity (3 × 252)
- Lmm1: 42 records (full), Lmm2: 42 records (full), Lmm3: 23 records + 114 bytes `0xFF` padding

#### Record Structure: `[B0 B1 B2 B3 B4 B5]`

| Byte | Function |
|---|---|
| **B0** | Mode + LM group: `(mode << 4) \| lm_group` |
| **B1** | Sub-address within the LM group (identifies specific output register) |
| **B2** | Configuration flags (see B2 Flags below) |
| **B3** | Brightness/duty-cycle (`0x00`–`0x64` = 0–100%, same scale as the animation system) |
| **B4** | Ramp-up time (units assumed to be 20ms ticks, matching animation time base) |
| **B5** | Ramp-down time |

**B0 encoding**: The high nibble encodes the driving mode (0x0–0xB, with mode 2 absent), and the low nibble identifies the LM group (0, 1, 2, 3, 4, or 8). This gives 11 modes across 6 LM groups. The previously noted +0x50 offset between modes 1 and 6 is the mode high nibble incrementing by 5 (0x1→0x6).

#### Driving Mode Identification

| Mode | Records | LM Groups | Avg Brightness | Proposed Function | Confidence |
|---|---|---|---|---|---|
| 0 | 2 | 4 | 100% instant | **Init/Power-on default** | LOW |
| 1 | 13 | 0,1,3,4 | 70–98% | **Parking light (Standlicht)** | CONFIRMED |
| (2) | 0 | — | — | Absent/unused | — |
| 3 | 10 | 0,1,2,4 | 84–100% | **DRL (Tagfahrlicht)** | HIGH |
| 4 | 10 | 3,4 | 46–89% | **Auxiliary/reduced (Abbiegelicht?)** | MEDIUM |
| 5 | 9 | 1,3,4,8 | 67–100% | **Turn signal combo** | MEDIUM |
| 6 | 13 | 0,1,3,4 | 74–100% | **Low beam (Abblendlicht)** | CONFIRMED |
| 7 | 13 | 0,1,2,3,4 | 0–100% | **High beam (Fernlicht)** | HIGH |
| 8 | 6 | 0,2,3,4,8 | 0–100%, slow ramps | **Cornering/adverse weather** | LOW |
| 9 | 14 | 0,1,3,4 | 63–100% | **Highway/adaptive mode** | LOW |
| A | 9 | 0,1,2,3 | 0–89% | **Alternate high beam config** | LOW |
| B | 8 | 3,4 | 67–100% | **Alternate auxiliary** | LOW |

Key evidence for mode assignments:

- **Mode 1↔6**: Perfect structural match — same 13 records, same groups, same B1 sub-addresses. Only B3 brightness differs: DRL outputs at 74% vs 89%. This is the parking↔low beam pair.
- **Mode 3 = DRL**: Includes LM group 2 (which parking/low beam modes lack), high brightness (84–100%), no group 3 (no low beam LMs needed for DRL-only).
- **Mode 7 = High beam**: Only mode that activates ALL 5 standard groups (0,1,2,3,4). Mostly 100% brightness. Contains deliberate 0% records (outputs disabled during high beam).
- **Modes 5 and B**: Both use 0x43=67% extensively. Only modes with LM group 8. Could be turn signal integration or alternate functions.

#### LM Group → Physical Function Mapping (Speculative)

| LM Group | Modes Active In | Records/Mode | Proposed Mapping |
|---|---|---|---|
| 0 | 1,3,6,7,8,9,A | 4–5 | Main DRL + accent modules (LM02, LM05, LM07?) |
| 1 | 1,3,5,6,7,9,A | 2–5 | Low beam main (LM10?) |
| 2 | 3,7,8,A | 1–2 | Virtual/accent overlay (LM11, LM12?) |
| 3 | 1,4,5,6,7,9,A,B | 2–9 | Position + secondary LMs (LM04, LM06, LM08?) |
| 4 | 0,1,3,4,5,6,7,8,9,B | 1–3 | DRL (LM02+LM07 via function) — present in nearly ALL modes |
| 8 | 5,8 | 1 | Turn signal (LM09?) — extremely rare |

Key clues:
- **Group 4** present in 10/11 modes = fundamental always-on function (DRL or position)
- **Group 8** in only 2 modes = special-purpose (turn signal makes sense)
- **Group 2** only in modes 3,7,8,A = virtual overlay, not needed in basic parking/low beam

#### Cross-Mode Comparison: Mode 1 (Parking) vs Mode 6 (Low Beam)

Modes 1 and 6 have a perfect 1:1 register match — all 13 records pair up by (LM group, B1 sub-address). Six of 13 records are completely identical; the remaining seven differ only in B3 brightness (and one B2 flag change):

| Group | B1 | Mode 1 B3 | Mode 6 B3 | Delta | Notes |
|---|---|---|---|---|---|
| 0 | 0x04 | 93% (0x5D) | 100% (0x64) | +7% | |
| 0 | 0x53 | 100% (0x64) | 93% (0x5D) | −7% | Swapped vs 0x04! |
| 0 | 0x93 | 93% (0x5D) | 100% (0x64) | +7% | |
| 3 | 0x01 | 93% (B2=0xA0) | 98% (B2=0x10) | +5% | B2 flag change too |
| 3 | 0xD0 | 93% (0x5D) | 100% (0x64) | +7% | |
| 3 | 0xE0 | 93% (0x5D) | 100% (0x64) | +7% | |
| **4** | **0xA0** | **74% (0x4A)** | **89% (0x59)** | **+15%** | **DRL output — largest delta** |
| **4** | **0xB1** | **74% (0x4A)** | **89% (0x59)** | **+15%** | **DRL output — largest delta** |

The two group-4 outputs (B1=0xA0 and B1=0xB1) show the largest brightness delta (+15%), confirming these are the DRL outputs that change most noticeably between parking and low beam. Both have slow ramp times (0x1E/0x1E = 600ms up / 600ms down), consistent with visible DRL dimming transitions.

The six identical records (groups 0/D2, 1/03, 1/44, 3/93, 4/40) maintain the same brightness and ramps in both modes — these likely drive outputs that don't change between parking and low beam (e.g., always-on position indicators, or outputs that are already at their target level).

#### B2 Configuration Flags

| B2 | Binary | Count | Pattern |
|---|---|---|---|
| 0xA0 | 10100000 | 28× | Most common — standard LED output |
| 0x20 | 00100000 | 22× | Bit 5 only — secondary output config |
| 0xC3 | 11000011 | 4× | Always paired with B3=0% (modes 1,6,9) or 67% (mode B) — "off/standby" register |
| 0x10 | 00010000 | 4× | Low-flag mode, often with instant ramps |
| 0xC0 | 11000000 | 5× | High-flag variant, group 4 records |

Bit 7 (0x80) appears to be a main output enable flag. Bit 5 (0x20) appears to be a secondary enable. Lower bits are mode-specific.

#### Ramp Time Patterns

| Ramp (up/dn) | Count | Duration (at 20ms ticks) |
|---|---|---|
| 06/06 | 38× | 120ms / 120ms — fast, most common |
| 00/00 | 19× | Instant — hard switching |
| 0A/06 | 10× | 200ms up / 120ms down — asymmetric |
| 02/02 | 8× | 40ms / 40ms — very fast |
| 0A/0A | 7× | 200ms / 200ms — medium |
| 1E/1E | 7× | **600ms / 600ms — slow DRL transitions** |
| 1E/14 | 4× | 600ms up / 400ms down — mode 8 only (cornering?) |
| 34/34 | 1× | **1040ms / 1040ms — slowest, mode B group 3** |

The 1E/1E (600ms) ramp appears exclusively on group-4 DRL outputs and the mode 8 slow-ramp records, consistent with the ~2s hardware ramp observed during welcome light revert (600ms ramp + firmware transition time).

#### Anomalous Record

The last data record in Lmm3: `90 02 A0 E4 0A 0A` — B3=0xE4=228, which exceeds the 0–100 (0x00–0x64) brightness percentage range. This is the only such record in all 107. Possible interpretations:

- Raw PWM value (228/255 = 89.4%) instead of percentage scale
- A non-brightness register write (e.g., max current limit)
- The B1=0x02 sub-address is unique to this record — no other record in any mode uses it

This record also appears out of sequence: it's a mode 9 record placed after all mode B records at the end of Lmm3, rather than grouped with other mode 9 records in Lmm2/early Lmm3.

#### Welcome Light Revert Brightness — Confirmed Values

During the welcome light animation, lights that are not controlled by an active channel revert to their Lmm driving mode brightness. After the animation ends completely, lights go dark (the Lmm driving mode only applies if independently activated, e.g., by parking lights being turned on). The DRL brightness the animation reverts to during gaps:

| Driving State | Mode | DRL Brightness (Group 4, B1=A0/B1) | Ramp Time |
|---|---|---|---|
| Parked, parking lights | Mode 1 | **74% (0x4A)** | 600ms (0x1E/0x1E) |
| Driving, low beam | Mode 6 | **89% (0x59)** | 600ms (0x1E/0x1E) |

This is the ~2s hardware ramp observed in experiments — the 600ms ramp-up plus firmware transition time.

#### No Channel-to-LM Mapping Found

**No explicit channel-to-LM mapping** was found in the Lmm blocks. The animation routing from Staging channel IDs to physical LMs is firmware logic, not a configurable parameter.

---

## 10. Summary

The CAFD cross-reference reveals a clear split:

**Configurable via CAFD coding:**
- Staging1/2 animation byte data (the sequences themselves)
- LED current levels per LM (binning classes)
- Gamma correction curves
- LM-to-function assignment (Name)
- Virtual LM compositing connections
- LED segment on/off transition time

**Firmware-hardcoded (not configurable):**
- Two-phase playback architecture
- ~20s Phase 2 anchor point
- ~20s Phase 1 duration cap
- 20ms time base
- Channel-to-LM mapping logic
- Default state revert behavior
- Hardware ramp-up/ramp-down transitions

The practical implication: **animation content is fully customizable** (any brightness pattern, any duration within the ~20s Phase 1 cap), but the **playback structure is fixed**. You cannot change when Phase 2 starts, how long the total animation can be, or how channels map to physical lights — those are firmware decisions.
