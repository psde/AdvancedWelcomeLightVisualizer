const { describe, it } = require('node:test');
const assert = require('node:assert');
const { resetGlobalState } = require('./setup.js');

// ============================================================================
// Coordinate Mapping Round-trips
// ============================================================================
describe('timeToX / xToTime round-trip', () => {
  const maxTime = 5000;
  const plotWidth = 400;

  it('should round-trip time=0', () => {
    const x = timeToX(0, maxTime, plotWidth);
    const t = xToTime(x, maxTime, plotWidth);
    assert.strictEqual(Math.round(t), 0);
  });

  it('should round-trip time=maxTime', () => {
    const x = timeToX(maxTime, maxTime, plotWidth);
    const t = xToTime(x, maxTime, plotWidth);
    assert.strictEqual(Math.round(t), maxTime);
  });

  it('should round-trip time=2500 (midpoint)', () => {
    const x = timeToX(2500, maxTime, plotWidth);
    const t = xToTime(x, maxTime, plotWidth);
    assert.ok(Math.abs(t - 2500) < 0.01);
  });

  it('should round-trip for arbitrary time values', () => {
    for (const time of [100, 500, 1234, 3000, 4999]) {
      const x = timeToX(time, maxTime, plotWidth);
      const t = xToTime(x, maxTime, plotWidth);
      assert.ok(Math.abs(t - time) < 0.01, `round-trip failed for time=${time}: got ${t}`);
    }
  });
});

describe('brightnessToY / yToBrightness round-trip', () => {
  const plotHeight = 170;

  it('should round-trip brightness=0', () => {
    const y = brightnessToY(0, plotHeight);
    const b = yToBrightness(y, plotHeight);
    assert.ok(Math.abs(b) < 0.01);
  });

  it('should round-trip brightness=100', () => {
    const y = brightnessToY(100, plotHeight);
    const b = yToBrightness(y, plotHeight);
    assert.ok(Math.abs(b - 100) < 0.01);
  });

  it('should round-trip brightness=50 (midpoint)', () => {
    const y = brightnessToY(50, plotHeight);
    const b = yToBrightness(y, plotHeight);
    assert.ok(Math.abs(b - 50) < 0.01);
  });

  it('should round-trip for arbitrary brightness values', () => {
    for (const bri of [10, 25, 33, 67, 90]) {
      const y = brightnessToY(bri, plotHeight);
      const b = yToBrightness(y, plotHeight);
      assert.ok(Math.abs(b - bri) < 0.01, `round-trip failed for bri=${bri}: got ${b}`);
    }
  });
});

// ============================================================================
// getGridStepX
// ============================================================================
describe('getGridStepX', () => {
  it('should return 50/500 for maxTime <= 2500', () => {
    const result = getGridStepX(2000);
    assert.deepStrictEqual(result, { grid: 50, label: 500 });
  });

  it('should return 50/500 for maxTime = 2500 (boundary)', () => {
    const result = getGridStepX(2500);
    assert.deepStrictEqual(result, { grid: 50, label: 500 });
  });

  it('should return 200/1000 for maxTime = 5000', () => {
    const result = getGridStepX(5000);
    assert.deepStrictEqual(result, { grid: 200, label: 1000 });
  });

  it('should return 200/1000 for maxTime = 10000 (boundary)', () => {
    const result = getGridStepX(10000);
    assert.deepStrictEqual(result, { grid: 200, label: 1000 });
  });

  it('should return 500/5000 for maxTime > 10000', () => {
    const result = getGridStepX(20000);
    assert.deepStrictEqual(result, { grid: 500, label: 5000 });
  });
});

// ============================================================================
// pointToSegmentDistance
// ============================================================================
describe('pointToSegmentDistance', () => {
  it('should return 0 when point is on segment start', () => {
    assert.strictEqual(pointToSegmentDistance(0, 0, 0, 0, 10, 0), 0);
  });

  it('should return 0 when point is on segment end', () => {
    assert.strictEqual(pointToSegmentDistance(10, 0, 0, 0, 10, 0), 0);
  });

  it('should return perpendicular distance for midpoint', () => {
    // Horizontal segment from (0,0) to (10,0), point at (5,3)
    const dist = pointToSegmentDistance(5, 3, 0, 0, 10, 0);
    assert.ok(Math.abs(dist - 3) < 0.01);
  });

  it('should return distance to nearest endpoint when projection is outside', () => {
    // Segment from (0,0) to (10,0), point at (15,0)
    const dist = pointToSegmentDistance(15, 0, 0, 0, 10, 0);
    assert.ok(Math.abs(dist - 5) < 0.01);
  });

  it('should handle zero-length segment', () => {
    const dist = pointToSegmentDistance(3, 4, 0, 0, 0, 0);
    assert.ok(Math.abs(dist - 5) < 0.01);
  });
});

// ============================================================================
// findInsertSegment
// ============================================================================
describe('findInsertSegment', () => {
  const maxTime = 1000;
  const plotWidth = 400;
  const plotHeight = 170;

  it('should return null for click far from curve', () => {
    const points = [{ t: 0, b: 0 }, { t: 500, b: 100 }, { t: 1000, b: 0 }];
    // Click far above the curve
    const localX = timeToX(250, maxTime, plotWidth);
    const localY = brightnessToY(50, plotHeight) - 100;
    const result = findInsertSegment(points, 250, maxTime, plotWidth, plotHeight, localX, localY);
    assert.strictEqual(result, null);
  });

  it('should find correct segment when click is near curve', () => {
    const points = [{ t: 0, b: 0 }, { t: 500, b: 100 }, { t: 1000, b: 0 }];
    // Click near the first segment midpoint
    const clickTime = 250;
    const localX = timeToX(clickTime, maxTime, plotWidth);
    const localY = brightnessToY(50, plotHeight);
    const result = findInsertSegment(points, clickTime, maxTime, plotWidth, plotHeight, localX, localY);
    assert.ok(result !== null);
    assert.strictEqual(result.segmentIndex, 0);
  });

  it('should return null for click outside time range', () => {
    const points = [{ t: 100, b: 50 }, { t: 500, b: 100 }];
    const localX = timeToX(50, maxTime, plotWidth);
    const localY = brightnessToY(50, plotHeight);
    const result = findInsertSegment(points, 50, maxTime, plotWidth, plotHeight, localX, localY);
    assert.strictEqual(result, null);
  });
});

// ============================================================================
// getTimelineMaxTime
// ============================================================================
describe('getTimelineMaxTime', () => {
  it('should return at least 500', () => {
    resetGlobalState();
    const seq = { identifier: '01', lengthVal: 1, data: ['01', '64'] };
    sideData.left.sequences[0] = seq;
    sideData.right.sequences[0] = null;
    const maxTime = getTimelineMaxTime(seq, 'left', 0);
    assert.ok(maxTime >= 500);
  });

  it('should use the longer side for maxTime', () => {
    resetGlobalState();
    const shortSeq = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    const longSeq = { identifier: '01', lengthVal: 3, data: ['FF', '64', 'FF', '32', 'FF', '00'] };
    sideData.left.sequences[0] = shortSeq;
    sideData.right.sequences[0] = longSeq;
    const maxTime = getTimelineMaxTime(shortSeq, 'left', 0);
    const longDuration = 255 * 3 * TIME_MULTIPLIER;
    assert.ok(maxTime >= longDuration, `maxTime ${maxTime} should be >= ${longDuration}`);
  });

  it('should add 10% padding', () => {
    resetGlobalState();
    const seq = { identifier: '01', lengthVal: 1, data: ['32', '64'] };
    sideData.left.sequences[0] = seq;
    sideData.right.sequences[0] = null;
    const rawDuration = 0x32 * TIME_MULTIPLIER;
    const maxTime = getTimelineMaxTime(seq, 'left', 0);
    assert.ok(maxTime >= rawDuration * 1.1, `maxTime ${maxTime} should include 10% padding over ${rawDuration}`);
  });
});
