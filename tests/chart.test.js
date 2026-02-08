const { describe, it } = require('node:test');
const assert = require('node:assert');
require('./setup.js');

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
