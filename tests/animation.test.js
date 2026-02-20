const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetGlobalState } = require('./setup.js');

// ============================================================================
// parseHexColor
// ============================================================================
describe('parseHexColor', () => {
  it('should parse 6-char hex (#RRGGBB)', () => {
    const result = parseHexColor('#FF8000');
    assert.strictEqual(result.r, 255);
    assert.strictEqual(result.g, 128);
    assert.strictEqual(result.b, 0);
    assert.strictEqual(result.a, 1);
  });

  it('should parse 8-char hex (#RRGGBBAA)', () => {
    const result = parseHexColor('#FF800080');
    assert.strictEqual(result.r, 255);
    assert.strictEqual(result.g, 128);
    assert.strictEqual(result.b, 0);
    assert.ok(Math.abs(result.a - 128 / 255) < 0.01);
  });

  it('should handle missing hash', () => {
    const result = parseHexColor('00FF00');
    assert.strictEqual(result.r, 0);
    assert.strictEqual(result.g, 255);
    assert.strictEqual(result.b, 0);
  });

  it('should return zeroes for invalid input', () => {
    const result = parseHexColor('');
    assert.strictEqual(result.r, 0);
    assert.strictEqual(result.g, 0);
    assert.strictEqual(result.b, 0);
  });

  it('should parse black (#000000)', () => {
    const result = parseHexColor('#000000');
    assert.strictEqual(result.r, 0);
    assert.strictEqual(result.g, 0);
    assert.strictEqual(result.b, 0);
    assert.strictEqual(result.a, 1);
  });

  it('should parse white (#FFFFFF)', () => {
    const result = parseHexColor('#FFFFFF');
    assert.strictEqual(result.r, 255);
    assert.strictEqual(result.g, 255);
    assert.strictEqual(result.b, 255);
  });

  it('should handle fully transparent alpha', () => {
    const result = parseHexColor('#FF000000');
    assert.strictEqual(result.r, 255);
    assert.strictEqual(result.a, 0);
  });

  it('should handle fully opaque alpha', () => {
    const result = parseHexColor('#FF0000FF');
    assert.strictEqual(result.r, 255);
    assert.strictEqual(result.a, 1);
  });
});

// ============================================================================
// getBrightnessAtTime
// ============================================================================
describe('getBrightnessAtTime', () => {
  it('should return 0 for null sequence', () => {
    assert.strictEqual(getBrightnessAtTime(null, 100), 0);
  });

  it('should return 0 for RAW sequence', () => {
    const seq = { identifier: RAW_IDENTIFIER, data: ['AB', 'CD'] };
    assert.strictEqual(getBrightnessAtTime(seq, 100), 0);
  });

  it('should interpolate brightness linearly within a step', () => {
    // 10 hex units = 200ms, brightness 100%
    const seq = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    const midBri = getBrightnessAtTime(seq, 100); // halfway through 200ms
    assert.ok(Math.abs(midBri - 50) < 0.01, `Expected ~50, got ${midBri}`);
  });

  it('should return final brightness after sequence ends', () => {
    const seq = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    const bri = getBrightnessAtTime(seq, 5000);
    assert.strictEqual(bri, 100);
  });

  it('should handle zero-duration step', () => {
    const seq = { identifier: '01', lengthVal: 1, data: ['00', '64'] };
    const bri = getBrightnessAtTime(seq, 0);
    assert.strictEqual(bri, 100);
  });

  it('should cap brightness at 100 even if hex value exceeds 0x64', () => {
    const seq = { identifier: '01', lengthVal: 1, data: ['0A', 'FF'] };
    const bri = getBrightnessAtTime(seq, 200);
    assert.strictEqual(bri, 100);
  });

  it('should handle multi-step sequences', () => {
    // Step 1: 200ms ramp to 100%, Step 2: 200ms ramp to 0%
    const seq = { identifier: '01', lengthVal: 2, data: ['0A', '64', '0A', '00'] };
    assert.ok(Math.abs(getBrightnessAtTime(seq, 0) - 0) < 0.01);
    assert.ok(Math.abs(getBrightnessAtTime(seq, 200) - 100) < 0.01);
    assert.ok(Math.abs(getBrightnessAtTime(seq, 300) - 50) < 1);
    assert.ok(Math.abs(getBrightnessAtTime(seq, 400) - 0) < 0.01);
  });

  it('should use initialBrightness when provided', () => {
    const seq = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    const bri = getBrightnessAtTime(seq, 0, 50);
    assert.strictEqual(bri, 50);
  });

  it('should interpolate from initialBrightness', () => {
    const seq = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    const midBri = getBrightnessAtTime(seq, 100, 50);
    assert.ok(Math.abs(midBri - 75) < 0.01, `Expected ~75, got ${midBri}`);
  });
});

// ============================================================================
// findSequenceByChannelId
// ============================================================================
describe('findSequenceByChannelId', () => {
  beforeEach(() => resetGlobalState());

  it('should find sequence by channel ID', () => {
    sideData.left.sequences = [
      { identifier: '01', lengthVal: 1, data: ['0A', '64'] },
      { identifier: '02', lengthVal: 1, data: ['14', '32'] }
    ];
    const result = findSequenceByChannelId('left', 2);
    assert.ok(result);
    assert.strictEqual(result.identifier, '02');
  });

  it('should return null for non-existent channel', () => {
    sideData.left.sequences = [
      { identifier: '01', lengthVal: 1, data: ['0A', '64'] }
    ];
    const result = findSequenceByChannelId('left', 99);
    assert.strictEqual(result, null);
  });

  it('should handle case-insensitive matching', () => {
    sideData.left.sequences = [
      { identifier: '0a', lengthVal: 1, data: ['0A', '64'] }
    ];
    const result = findSequenceByChannelId('left', 10);
    assert.ok(result);
    assert.strictEqual(result.identifier, '0a');
  });

  it('should search the correct side', () => {
    sideData.left.sequences = [
      { identifier: '01', lengthVal: 1, data: ['0A', '64'] }
    ];
    sideData.right.sequences = [];
    assert.ok(findSequenceByChannelId('left', 1));
    assert.strictEqual(findSequenceByChannelId('right', 1), null);
  });
});

// ============================================================================
// getControllingChannelsSorted
// ============================================================================
describe('getControllingChannelsSorted', () => {
  it('should include the physical channel ID itself', () => {
    const config = { channels: [{ id: 1 }, { id: 2 }] };
    const timeline = { channelPhaseMap: { 1: 0, 2: 1 } };
    const result = getControllingChannelsSorted(1, config, timeline);
    assert.ok(result.includes(1));
  });

  it('should include channels that reference the physical light', () => {
    const config = { channels: [{ id: 1 }, { id: 3, physicalLight: 1 }] };
    const timeline = { channelPhaseMap: { 1: 0, 3: 1 } };
    const result = getControllingChannelsSorted(1, config, timeline);
    assert.ok(result.includes(1));
    assert.ok(result.includes(3));
  });

  it('should sort by phase index', () => {
    const config = { channels: [{ id: 1 }, { id: 3, physicalLight: 1 }, { id: 5, physicalLight: 1 }] };
    const timeline = { channelPhaseMap: { 1: 2, 3: 0, 5: 1 } };
    const result = getControllingChannelsSorted(1, config, timeline);
    assert.deepStrictEqual(result, [3, 5, 1]);
  });
});

// ============================================================================
// getActiveVehicleConfig
// ============================================================================
describe('getActiveVehicleConfig', () => {
  it('should return null when no vehicleSelect element exists', () => {
    assert.strictEqual(getActiveVehicleConfig(), null);
  });
});

// ============================================================================
// getPhysicalLightIds
// ============================================================================
describe('getPhysicalLightIds', () => {
  it('should return empty for null config', () => {
    assert.deepStrictEqual(getPhysicalLightIds(null), []);
  });

  it('should return empty for config without channels', () => {
    assert.deepStrictEqual(getPhysicalLightIds({}), []);
  });

  it('should return all channels with shapes that are not physicalLight aliases', () => {
    const config = {
      channels: [
        { id: 1, shapes: [{ type: 'path', d: 'M0 0' }] },
        { id: 2, shapes: [{ type: 'circle', cx: 0, cy: 0, r: 5 }] },
        { id: 3, physicalLight: 1 }
      ]
    };
    assert.deepStrictEqual(getPhysicalLightIds(config), [1, 2]);
  });

  it('should include channels with type instead of shapes', () => {
    const config = {
      channels: [
        { id: 1, type: 'rect', x: 0, y: 0, width: 10, height: 10 }
      ]
    };
    assert.deepStrictEqual(getPhysicalLightIds(config), [1]);
  });
});

// ============================================================================
// getLightElement
// ============================================================================
describe('getLightElement', () => {
  let origGetById;
  let origGetActiveVehicleConfig;

  beforeEach(() => {
    resetGlobalState();
    origGetById = document.getElementById;
    origGetActiveVehicleConfig = globalThis.getActiveVehicleConfig;
  });

  const afterEach = () => {
    document.getElementById = origGetById;
    globalThis.getActiveVehicleConfig = origGetActiveVehicleConfig;
  };

  it('should return channel element for normal sequence', () => {
    const fakeEl = { id: 'left_light_ch2' };
    document.getElementById = (id) => id === 'left_light_ch2' ? fakeEl : null;
    globalThis.getActiveVehicleConfig = () => null;

    const seq = { identifier: '02', data: [] };
    const result = getLightElement('left', seq, 0);
    assert.strictEqual(result, fakeEl);
    afterEach();
  });

  it('should resolve physicalLight alias to referenced element', () => {
    const physicalEl = { id: 'left_light_ch1' };
    document.getElementById = (id) => id === 'left_light_ch1' ? physicalEl : null;
    globalThis.getActiveVehicleConfig = () => ({
      channels: [
        { id: 1, shapes: [{ type: 'path', d: 'M0 0' }] },
        { id: 3, physicalLight: 1 }
      ]
    });

    const seq = { identifier: '03', data: [] };
    const result = getLightElement('left', seq, 0);
    assert.strictEqual(result, physicalEl);
    afterEach();
  });

  it('should fall back to index-based element for grid mode', () => {
    const gridEl = { id: 'left_light_0' };
    document.getElementById = (id) => id === 'left_light_0' ? gridEl : null;
    globalThis.getActiveVehicleConfig = () => null;

    const seq = { identifier: '02', data: [] };
    const result = getLightElement('left', seq, 0);
    assert.strictEqual(result, gridEl);
    afterEach();
  });

  it('should fall back to index-based element for RAW sequence', () => {
    const gridEl = { id: 'right_light_2' };
    document.getElementById = (id) => id === 'right_light_2' ? gridEl : null;

    const seq = { identifier: RAW_IDENTIFIER, data: [] };
    const result = getLightElement('right', seq, 2);
    assert.strictEqual(result, gridEl);
    afterEach();
  });

  it('should fall back to index-based element for null sequence', () => {
    const gridEl = { id: 'left_light_1' };
    document.getElementById = (id) => id === 'left_light_1' ? gridEl : null;

    const result = getLightElement('left', null, 1);
    assert.strictEqual(result, gridEl);
    afterEach();
  });
});
