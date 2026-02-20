const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetGlobalState } = require('./setup.js');

// ============================================================================
// arePointsIdentical Tests
// ============================================================================
describe('arePointsIdentical', () => {
  it('should return true for two empty arrays', () => {
    assert.strictEqual(arePointsIdentical([], []), true);
  });

  it('should return true for identical point arrays', () => {
    const a = [{ t: 0, b: 0 }, { t: 100, b: 50 }, { t: 200, b: 100 }];
    const b = [{ t: 0, b: 0 }, { t: 100, b: 50 }, { t: 200, b: 100 }];
    assert.strictEqual(arePointsIdentical(a, b), true);
  });

  it('should return false for different lengths', () => {
    const a = [{ t: 0, b: 0 }, { t: 100, b: 50 }];
    const b = [{ t: 0, b: 0 }];
    assert.strictEqual(arePointsIdentical(a, b), false);
  });

  it('should return false when time values differ', () => {
    const a = [{ t: 0, b: 0 }, { t: 100, b: 50 }];
    const b = [{ t: 0, b: 0 }, { t: 200, b: 50 }];
    assert.strictEqual(arePointsIdentical(a, b), false);
  });

  it('should return false when brightness values differ', () => {
    const a = [{ t: 0, b: 0 }, { t: 100, b: 50 }];
    const b = [{ t: 0, b: 0 }, { t: 100, b: 75 }];
    assert.strictEqual(arePointsIdentical(a, b), false);
  });

  it('should detect identical sequences via parseForChart', () => {
    const seq = { identifier: '43', lengthVal: 2, data: ['0A', '64', '14', '00'] };
    const left = parseForChart(seq);
    const right = parseForChart(seq);
    assert.strictEqual(arePointsIdentical(left.points, right.points), true);
  });

  it('should detect different sequences via parseForChart', () => {
    const seqL = { identifier: '43', lengthVal: 2, data: ['0A', '64', '14', '00'] };
    const seqR = { identifier: '43', lengthVal: 2, data: ['0A', '32', '14', '00'] };
    const left = parseForChart(seqL);
    const right = parseForChart(seqR);
    assert.strictEqual(arePointsIdentical(left.points, right.points), false);
  });
});

// ============================================================================
// parseForChart
// ============================================================================
describe('parseForChart', () => {
  it('should return empty points for null sequence', () => {
    const result = parseForChart(null);
    assert.strictEqual(result.maxT, 0);
    assert.deepStrictEqual(result.points, []);
  });

  it('should return empty points for RAW sequence', () => {
    const result = parseForChart({ identifier: RAW_IDENTIFIER, data: ['AB', 'CD'] });
    assert.strictEqual(result.maxT, 0);
    assert.deepStrictEqual(result.points, []);
  });

  it('should always start with origin point (t:0, b:0)', () => {
    const seq = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    const result = parseForChart(seq);
    assert.deepStrictEqual(result.points[0], { t: 0, b: 0 });
  });

  it('should parse single step correctly', () => {
    // 0x0A = 10, × 20 = 200ms; brightness 0x64 = 100
    const seq = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    const result = parseForChart(seq);
    assert.strictEqual(result.points.length, 2);
    assert.deepStrictEqual(result.points[1], { t: 200, b: 100 });
    assert.strictEqual(result.maxT, 200);
  });

  it('should parse multi-step sequence with cumulative time', () => {
    const seq = { identifier: '01', lengthVal: 3, data: ['05', '64', '0A', '32', '05', '00'] };
    const result = parseForChart(seq);
    assert.strictEqual(result.points.length, 4);
    assert.strictEqual(result.points[1].t, 100);   // 5 * 20
    assert.strictEqual(result.points[2].t, 300);   // 100 + 10 * 20
    assert.strictEqual(result.points[3].t, 400);   // 300 + 5 * 20
    assert.strictEqual(result.maxT, 400);
  });

  it('should clamp brightness to 100', () => {
    const seq = { identifier: '01', lengthVal: 1, data: ['05', 'FF'] };
    const result = parseForChart(seq);
    assert.strictEqual(result.points[1].b, 100);
  });

  it('should handle zero-duration step', () => {
    const seq = { identifier: '01', lengthVal: 2, data: ['00', '64', '0A', '00'] };
    const result = parseForChart(seq);
    assert.strictEqual(result.points[1].t, 0);
    assert.strictEqual(result.points[1].b, 100);
    assert.strictEqual(result.points[2].t, 200);
  });
});

// ============================================================================
// isDefaultSource
// ============================================================================
describe('isDefaultSource', () => {
  it('should return true for "default"', () => {
    assert.strictEqual(isDefaultSource('default'), true);
  });

  it('should return true for "rampUp"', () => {
    assert.strictEqual(isDefaultSource('rampUp'), true);
  });

  it('should return true for "rampDown"', () => {
    assert.strictEqual(isDefaultSource('rampDown'), true);
  });

  it('should return false for "channel"', () => {
    assert.strictEqual(isDefaultSource('channel'), false);
  });

  it('should return false for "off"', () => {
    assert.strictEqual(isDefaultSource('off'), false);
  });
});

// ============================================================================
// getChartData
// ============================================================================
describe('getChartData', () => {
  beforeEach(() => resetGlobalState());

  it('should return data for both sides', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    sideData.right.sequences[0] = { identifier: '01', lengthVal: 1, data: ['14', '32'] };
    const result = getChartData(0);
    assert.ok(result.leftData);
    assert.ok(result.rightData);
    assert.ok(result.maxTime > 0);
  });

  it('should handle empty sequences', () => {
    sideData.left.sequences[0] = null;
    sideData.right.sequences[0] = null;
    const result = getChartData(0);
    assert.strictEqual(result.leftData.maxT, 0);
    assert.strictEqual(result.rightData.maxT, 0);
    assert.strictEqual(result.maxTime, 1000); // default minimum
  });

  it('should use the longer sequence for maxTime', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    sideData.right.sequences[0] = { identifier: '01', lengthVal: 1, data: ['FF', '64'] };
    const result = getChartData(0);
    assert.ok(result.maxTime >= 255 * TIME_MULTIPLIER);
  });
});
