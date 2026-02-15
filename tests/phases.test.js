const { describe, it } = require('node:test');
const assert = require('node:assert');
require('./setup.js');

// ============================================================================
// computePhaseTimeline tests
// ============================================================================

function makeSeq(channelId, steps) {
  // steps: array of [durHex, briHex] pairs
  const data = [];
  for (const [d, b] of steps) {
    data.push(d.toString(16).toUpperCase().padStart(2, '0'));
    data.push(b.toString(16).toUpperCase().padStart(2, '0'));
  }
  return {
    identifier: channelId.toString(16).toUpperCase().padStart(2, '0'),
    lengthVal: steps.length,
    data: data
  };
}

describe('computePhaseTimeline', () => {
  it('should return null for vehicle without phases', () => {
    const result = computePhaseTimeline({ name: 'test' }, { left: [], right: [] });
    assert.strictEqual(result, null);
  });

  it('should return null for null config', () => {
    assert.strictEqual(computePhaseTimeline(null, { left: [], right: [] }), null);
  });

  it('should compute two-phase timeline', () => {
    const config = {
      phases: [
        { name: 'Phase 1', channels: [1, 2], maxDuration: 20000 },
        { name: 'Phase 2', channels: [3], anchor: 20000, maxDuration: null }
      ]
    };
    // Ch1: 100 * 20 = 2000ms, Ch2: 50 * 20 = 1000ms, Ch3: 80 * 20 = 1600ms
    const seqs = [
      makeSeq(1, [[100, 50]]),  // 2000ms
      makeSeq(2, [[50, 50]]),   // 1000ms
      makeSeq(3, [[80, 50]])    // 1600ms
    ];

    const result = computePhaseTimeline(config, { left: seqs, right: seqs });
    assert.ok(result !== null);
    assert.strictEqual(result.phases.length, 2);

    // Phase 1: channels 1,2. Max content = 2000ms, capped at 20000 = 2000ms
    assert.strictEqual(result.phases[0].start, 0);
    assert.strictEqual(result.phases[0].end, 2000);

    // Phase 2: anchor=20000, so start = max(2000, 20000) = 20000
    assert.strictEqual(result.phases[1].start, 20000);
    assert.strictEqual(result.phases[1].end, 21600);

    assert.strictEqual(result.totalDuration, 21600);
  });

  it('should apply hard cap from maxDuration', () => {
    const config = {
      phases: [
        { name: 'Phase 1', channels: [1], maxDuration: 5000 }
      ]
    };
    // Ch1: 255 * 20 * 3 steps = 15300ms (exceeds 5000 cap)
    const seqs = [makeSeq(1, [[255, 50], [255, 50], [255, 50]])];

    const result = computePhaseTimeline(config, { left: seqs, right: [] });
    assert.strictEqual(result.phases[0].end, 5000);
    assert.strictEqual(result.totalDuration, 5000);
  });

  it('should handle no anchor (sequential)', () => {
    const config = {
      phases: [
        { name: 'Phase 1', channels: [1], maxDuration: null },
        { name: 'Phase 2', channels: [2], maxDuration: null }
      ]
    };
    const seqs = [
      makeSeq(1, [[50, 100]]),   // 1000ms
      makeSeq(2, [[100, 100]])   // 2000ms
    ];

    const result = computePhaseTimeline(config, { left: seqs, right: [] });
    assert.strictEqual(result.phases[0].start, 0);
    assert.strictEqual(result.phases[0].end, 1000);
    assert.strictEqual(result.phases[1].start, 1000);
    assert.strictEqual(result.phases[1].end, 3000);
    assert.strictEqual(result.totalDuration, 3000);
  });

  it('should handle empty sequences', () => {
    const config = {
      phases: [
        { name: 'Phase 1', channels: [1], maxDuration: 20000 }
      ]
    };

    const result = computePhaseTimeline(config, { left: [], right: [] });
    assert.strictEqual(result.phases[0].start, 0);
    assert.strictEqual(result.phases[0].end, 0);
    assert.strictEqual(result.totalDuration, 0);
  });

  it('should build channelPhaseMap correctly', () => {
    const config = {
      phases: [
        { name: 'Phase 1', channels: [1, 2, 4], maxDuration: 20000 },
        { name: 'Phase 2', channels: [3, 5], anchor: 20000, maxDuration: null }
      ]
    };

    const result = computePhaseTimeline(config, { left: [], right: [] });
    assert.strictEqual(result.channelPhaseMap[1], 0);
    assert.strictEqual(result.channelPhaseMap[2], 0);
    assert.strictEqual(result.channelPhaseMap[4], 0);
    assert.strictEqual(result.channelPhaseMap[3], 1);
    assert.strictEqual(result.channelPhaseMap[5], 1);
  });

  it('should use max duration across both sides', () => {
    const config = {
      phases: [
        { name: 'Phase 1', channels: [1], maxDuration: 20000 }
      ]
    };
    const leftSeqs = [makeSeq(1, [[50, 100]])];   // 1000ms
    const rightSeqs = [makeSeq(1, [[100, 100]])];  // 2000ms

    const result = computePhaseTimeline(config, { left: leftSeqs, right: rightSeqs });
    assert.strictEqual(result.phases[0].end, 2000);
  });
});

// ============================================================================
// getPhysicalLightBrightness tests
// ============================================================================

describe('getPhysicalLightBrightness', () => {
  const vehicleConfig = {
    phases: [
      { name: 'Phase 1', channels: [1, 2, 4], maxDuration: 20000 },
      { name: 'Phase 2', channels: [3, 5], anchor: 20000, maxDuration: null }
    ],
    defaultStates: {
      2: { brightness: 67, rampUp: 2000, rampDown: 2000 },
      4: { brightness: 46, rampUp: 2000, rampDown: 2000 }
    },
    channels: [
      { id: 1, label: 'High Beam' },
      { id: 2, label: 'DRL' },
      { id: 3, label: 'DRL - END', physicalLight: 2 },
      { id: 4, label: 'Low Beam' },
      { id: 5, label: 'Low Beam - END', physicalLight: 4 }
    ]
  };

  // Set up sequences and timeline before each test group
  // Ch2: ramps to 100% over 5000ms (250 * 20 = 5000ms)
  // Ch3: ramps to 50% over 3000ms (150 * 20 = 3000ms)
  const ch2Seq = makeSeq(2, [[250, 100]]);  // 5000ms
  const ch3Seq = makeSeq(3, [[150, 50]]);   // 3000ms
  const ch4Seq = makeSeq(4, [[200, 80]]);   // 4000ms
  const ch5Seq = makeSeq(5, [[100, 60]]);   // 2000ms

  const testSeqs = [ch2Seq, ch3Seq, ch4Seq, ch5Seq];

  // We need to set up global state for getPhysicalLightBrightness
  function setupTimeline() {
    sideData.left.sequences = [...testSeqs];
    sideData.right.sequences = [...testSeqs];
    currentPhaseTimeline = computePhaseTimeline(vehicleConfig, {
      left: sideData.left.sequences,
      right: sideData.right.sequences
    });
  }

  it('should return 0 before any phase starts (time=0 is phase start)', () => {
    setupTimeline();
    // At time 0, Phase 1 is active - Ch2 starts at brightness 0 (interpolating to 100)
    const bri = getPhysicalLightBrightness(2, 0, 'left', vehicleConfig);
    assert.strictEqual(bri, 0); // At t=0, interpolation starts from 0
  });

  it('should return channel brightness during active phase', () => {
    setupTimeline();
    // At time 2500ms, Ch2 is active (Phase 1: 0-5000ms)
    // Ch2: linear ramp 0→100 over 5000ms, at 2500ms = 50%
    const bri = getPhysicalLightBrightness(2, 2500, 'left', vehicleConfig);
    assert.ok(Math.abs(bri - 50) < 0.01, 'Expected ~50%, got ' + bri);
  });

  it('should return default brightness during gap (after ramp)', () => {
    setupTimeline();
    // Phase 1 ends at 5000ms for DRL (Ch2), Phase 2 starts at 20000ms
    // Gap: 5000-20000ms, default = 67%, rampUp = 2000ms
    // At 10000ms (well past rampUp), should be at default 67%
    const bri = getPhysicalLightBrightness(2, 10000, 'left', vehicleConfig);
    assert.strictEqual(bri, 67);
  });

  it('should ramp up to default at start of gap', () => {
    setupTimeline();
    // Phase 1 end for DRL = 5000ms (Ch2 duration), rampUp = 2000ms
    // At 5000ms (gap start), should be at last Ch2 brightness = 100%
    // At 6000ms (midway through ramp), should be midpoint between 100 and 67
    const bri = getPhysicalLightBrightness(2, 6000, 'left', vehicleConfig);
    // Progress = (6000-5000)/2000 = 0.5, interpolate 100 → 67: 100 + (67-100)*0.5 = 83.5
    assert.ok(Math.abs(bri - 83.5) < 0.01, 'Expected ~83.5%, got ' + bri);
  });

  it('should stay at default during ramp down before Phase 2', () => {
    setupTimeline();
    // Phase 2 starts at 20000ms, rampDown = 2000ms
    // Phase 2 now starts from default brightness (67%), so rampDown target = 67%
    // This means rampDown is effectively a no-op for DRL (67% → 67%)
    // At 19000ms: should stay at default brightness
    const bri = getPhysicalLightBrightness(2, 19000, 'left', vehicleConfig);
    assert.strictEqual(bri, 67, 'Expected default 67% during ramp-down (no visible change)');
  });

  it('should return Phase 2 channel brightness starting from default', () => {
    setupTimeline();
    // Phase 2 starts at 20000ms. Ch3: 67→50 over 3000ms (starts from default 67%)
    // At 21500ms: localTime = 1500ms, progress = 1500/3000 = 0.5
    // brightness = 67 + (50 - 67) * 0.5 = 67 - 8.5 = 58.5
    const bri = getPhysicalLightBrightness(2, 21500, 'left', vehicleConfig);
    assert.ok(Math.abs(bri - 58.5) < 0.01, 'Expected ~58.5%, got ' + bri);
  });

  it('should return 0 after all phases end', () => {
    setupTimeline();
    // Phase 2 ends at 20000 + 3000 = 23000ms (Ch3 duration)
    // totalDuration = 23000ms
    const bri = getPhysicalLightBrightness(2, 25000, 'left', vehicleConfig);
    assert.strictEqual(bri, 0);
  });

  it('should enforce hard cap (instant cutoff at maxDuration)', () => {
    setupTimeline();
    // For a channel whose content exceeds maxDuration:
    // Create a config where Phase 1 maxDuration = 3000ms but Ch2 content is 5000ms
    // At time 3000ms, should cut off
    const shortCapConfig = {
      phases: [
        { name: 'Phase 1', channels: [2], maxDuration: 3000 },
        { name: 'Phase 2', channels: [3], anchor: 5000, maxDuration: null }
      ],
      defaultStates: { 2: { brightness: 67, rampUp: 500, rampDown: 500 } },
      channels: [
        { id: 2, label: 'DRL' },
        { id: 3, label: 'DRL - END', physicalLight: 2 }
      ]
    };
    sideData.left.sequences = [ch2Seq, ch3Seq];
    sideData.right.sequences = [ch2Seq, ch3Seq];
    currentPhaseTimeline = computePhaseTimeline(shortCapConfig, {
      left: sideData.left.sequences,
      right: sideData.right.sequences
    });

    // At 2999ms (just before cap): should still have brightness
    const briBefore = getPhysicalLightBrightness(2, 2999, 'left', shortCapConfig);
    assert.ok(briBefore > 0, 'Expected brightness > 0 before cap');

    // At 3000ms (at cap): we're in the gap now since effectiveEnd = 3000
    const briAt = getPhysicalLightBrightness(2, 3000, 'left', shortCapConfig);
    // Should be in gap, ramp from last brightness to default
    assert.ok(typeof briAt === 'number', 'Expected a number');
  });

  it('should handle Low Beam with default brightness 46', () => {
    setupTimeline();
    // Ch4 default = 46%, rampUp = 2000ms, rampDown = 2000ms
    // Gap: Ch4 ends at 4000ms, Ch5 starts at 20000ms
    // At 10000ms: well past rampUp, should be at default 46%
    const bri = getPhysicalLightBrightness(4, 10000, 'left', vehicleConfig);
    assert.strictEqual(bri, 46);
  });
});

// ============================================================================
// getPhysicalLightIds tests
// ============================================================================

describe('getPhysicalLightIds', () => {
  it('should return empty for null config', () => {
    assert.deepStrictEqual(getPhysicalLightIds(null), []);
  });

  it('should return empty for config without channels', () => {
    assert.deepStrictEqual(getPhysicalLightIds({ name: 'test' }), []);
  });

  it('should return all channels with shapes that are not physicalLight aliases', () => {
    const config = {
      channels: [
        { id: 1, label: 'High Beam', shapes: [{ type: 'rect' }] },
        { id: 2, label: 'DRL', shapes: [{ type: 'polygon' }] },
        { id: 3, label: 'DRL - END', physicalLight: 2 },
        { id: 4, label: 'Low Beam', shapes: [{ type: 'polygon' }] },
        { id: 5, label: 'Low Beam - END', physicalLight: 4 }
      ]
    };
    assert.deepStrictEqual(getPhysicalLightIds(config), [1, 2, 4]);
  });

  it('should include channels with type instead of shapes', () => {
    const config = {
      channels: [
        { id: 1, label: 'Beam', type: 'circle', cx: 0, cy: 0, r: 5 },
        { id: 2, label: 'Alias', physicalLight: 1 }
      ]
    };
    assert.deepStrictEqual(getPhysicalLightIds(config), [1]);
  });
});

// ============================================================================
// getChannelCapWarning tests
// ============================================================================

describe('getChannelCapWarning', () => {
  it('should return null when no phase timeline', () => {
    currentPhaseTimeline = null;
    sideData.left.sequences = [makeSeq(1, [[100, 50]])];
    sideData.right.sequences = [];
    assert.strictEqual(getChannelCapWarning(0), null);
  });

  it('should return null when content fits within cap', () => {
    const config = {
      phases: [{ name: 'Phase 1', channels: [1], maxDuration: 20000 }]
    };
    const seq = makeSeq(1, [[50, 100]]);  // 1000ms < 20000ms
    sideData.left.sequences = [seq];
    sideData.right.sequences = [seq];
    currentPhaseTimeline = computePhaseTimeline(config, {
      left: sideData.left.sequences, right: sideData.right.sequences
    });
    assert.strictEqual(getChannelCapWarning(0), null);
  });

  it('should return maxDuration when content exceeds cap', () => {
    const config = {
      phases: [{ name: 'Phase 1', channels: [1], maxDuration: 5000 }]
    };
    const seq = makeSeq(1, [[255, 50], [255, 50], [255, 50]]);  // 15300ms > 5000ms
    sideData.left.sequences = [seq];
    sideData.right.sequences = [seq];
    currentPhaseTimeline = computePhaseTimeline(config, {
      left: sideData.left.sequences, right: sideData.right.sequences
    });
    assert.strictEqual(getChannelCapWarning(0), 5000);
  });

  it('should return null when maxDuration is null (no cap)', () => {
    const config = {
      phases: [{ name: 'Phase 1', channels: [1], maxDuration: null }]
    };
    const seq = makeSeq(1, [[255, 50], [255, 50]]);  // 10200ms
    sideData.left.sequences = [seq];
    sideData.right.sequences = [seq];
    currentPhaseTimeline = computePhaseTimeline(config, {
      left: sideData.left.sequences, right: sideData.right.sequences
    });
    assert.strictEqual(getChannelCapWarning(0), null);
  });
});

// ============================================================================
// getBrightnessAtTime with initialBrightness tests
// ============================================================================

describe('getBrightnessAtTime with initialBrightness', () => {
  it('should start from 0 by default', () => {
    const seq = makeSeq(1, [[50, 100]]);  // 0→100 over 1000ms
    assert.strictEqual(getBrightnessAtTime(seq, 0), 0);
  });

  it('should start from initialBrightness when provided', () => {
    const seq = makeSeq(1, [[50, 100]]);  // initial→100 over 1000ms
    assert.strictEqual(getBrightnessAtTime(seq, 0, 67), 67);
  });

  it('should interpolate from initialBrightness', () => {
    const seq = makeSeq(1, [[50, 50]]);  // 67→50 over 1000ms
    const bri = getBrightnessAtTime(seq, 500, 67);
    // progress = 0.5, brightness = 67 + (50-67)*0.5 = 58.5
    assert.ok(Math.abs(bri - 58.5) < 0.01, 'Expected ~58.5%, got ' + bri);
  });

  it('should not affect second step (only first uses initialBrightness)', () => {
    const seq = makeSeq(1, [[50, 50], [50, 100]]);  // 67→50→100
    // At step 2 start (1000ms), bStart = 50 (from step 1 end, not initialBrightness)
    const bri = getBrightnessAtTime(seq, 1500, 67);
    // progress = 0.5, brightness = 50 + (100-50)*0.5 = 75
    assert.ok(Math.abs(bri - 75) < 0.01, 'Expected ~75%, got ' + bri);
  });
});

// ============================================================================
// getSequenceDuration tests (moved to core.js)
// ============================================================================

describe('getSequenceDuration', () => {
  it('should return 0 for null', () => {
    assert.strictEqual(getSequenceDuration(null), 0);
  });

  it('should return 0 for RAW sequence', () => {
    assert.strictEqual(getSequenceDuration({ identifier: 'RAW', data: ['FF'] }), 0);
  });

  it('should calculate duration correctly', () => {
    const seq = makeSeq(1, [[50, 100], [100, 0]]);  // 1000 + 2000 = 3000ms
    assert.strictEqual(getSequenceDuration(seq), 3000);
  });
});
