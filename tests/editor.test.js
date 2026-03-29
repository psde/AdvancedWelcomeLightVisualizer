const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetGlobalState } = require('./setup.js');

// ============================================================================
// formatStepTime
// ============================================================================
describe('formatStepTime', () => {
  it('should format 0ms as "0ms"', () => {
    assert.strictEqual(formatStepTime(0), '0ms');
  });

  it('should format 500ms as "500ms"', () => {
    assert.strictEqual(formatStepTime(500), '500ms');
  });

  it('should format 999ms as "999ms"', () => {
    assert.strictEqual(formatStepTime(999), '999ms');
  });

  it('should format 1000ms as "1.0s"', () => {
    assert.strictEqual(formatStepTime(1000), '1.0s');
  });

  it('should format 2500ms as "2.5s"', () => {
    assert.strictEqual(formatStepTime(2500), '2.5s');
  });

  it('should format 10000ms as "10.0s"', () => {
    assert.strictEqual(formatStepTime(10000), '10.0s');
  });
});

// ============================================================================
// copySequence
// ============================================================================
describe('copySequence', () => {
  beforeEach(() => resetGlobalState());

  it('should deep copy sequence from left to right', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 2, data: ['0A', '64', '14', '32'] };
    sideData.right.sequences[0] = null;
    copySequence('left', 0);

    const copied = sideData.right.sequences[0];
    assert.ok(copied);
    assert.strictEqual(copied.identifier, '01');
    assert.strictEqual(copied.lengthVal, 2);
    assert.deepStrictEqual(copied.data, ['0A', '64', '14', '32']);
  });

  it('should make an independent copy (not shared reference)', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    sideData.right.sequences[0] = null;
    copySequence('left', 0);

    sideData.left.sequences[0].data[0] = 'FF';
    assert.strictEqual(sideData.right.sequences[0].data[0], '0A');
  });

  it('should copy from right to left', () => {
    sideData.right.sequences[0] = { identifier: '02', lengthVal: 1, data: ['05', '32'] };
    sideData.left.sequences[0] = null;
    copySequence('right', 0);

    assert.strictEqual(sideData.left.sequences[0].identifier, '02');
  });
});

// ============================================================================
// addStep
// ============================================================================
describe('addStep', () => {
  beforeEach(() => resetGlobalState());

  it('should append a step inheriting brightness from previous step', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    addStep('left', 0);

    const seq = sideData.left.sequences[0];
    assert.strictEqual(seq.data.length, 4);
    assert.strictEqual(seq.data[2], '0A');
    assert.strictEqual(seq.data[3], '64');
    assert.strictEqual(seq.lengthVal, 2);
  });

  it('should not add step to RAW sequence', () => {
    sideData.left.sequences[0] = { identifier: RAW_IDENTIFIER, lengthVal: 2, data: ['AB', 'CD'] };
    addStep('left', 0);

    assert.strictEqual(sideData.left.sequences[0].data.length, 2);
  });

  it('should not add step to null sequence', () => {
    sideData.left.sequences[0] = null;
    addStep('left', 0);
    assert.strictEqual(sideData.left.sequences[0], null);
  });
});

// ============================================================================
// removeStep
// ============================================================================
describe('removeStep', () => {
  beforeEach(() => resetGlobalState());

  it('should remove the specified step', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 3, data: ['0A', '64', '14', '32', '1E', '00'] };
    removeStep('left', 0, 1);

    const seq = sideData.left.sequences[0];
    assert.strictEqual(seq.data.length, 4);
    assert.deepStrictEqual(seq.data, ['0A', '64', '1E', '00']);
    assert.strictEqual(seq.lengthVal, 2);
  });

  it('should remove first step', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 2, data: ['0A', '64', '14', '32'] };
    removeStep('left', 0, 0);

    assert.deepStrictEqual(sideData.left.sequences[0].data, ['14', '32']);
  });

  it('should remove last step', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 2, data: ['0A', '64', '14', '32'] };
    removeStep('left', 0, 1);

    assert.deepStrictEqual(sideData.left.sequences[0].data, ['0A', '64']);
  });
});

// ============================================================================
// moveStep
// ============================================================================
describe('moveStep', () => {
  beforeEach(() => resetGlobalState());

  it('should swap step up (direction=-1)', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 2, data: ['0A', '64', '14', '32'] };
    moveStep('left', 0, 1, -1);

    assert.deepStrictEqual(sideData.left.sequences[0].data, ['14', '32', '0A', '64']);
  });

  it('should swap step down (direction=+1)', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 2, data: ['0A', '64', '14', '32'] };
    moveStep('left', 0, 0, 1);

    assert.deepStrictEqual(sideData.left.sequences[0].data, ['14', '32', '0A', '64']);
  });

  it('should not move first step up', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 2, data: ['0A', '64', '14', '32'] };
    moveStep('left', 0, 0, -1);

    assert.deepStrictEqual(sideData.left.sequences[0].data, ['0A', '64', '14', '32']);
  });

  it('should not move last step down', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 2, data: ['0A', '64', '14', '32'] };
    moveStep('left', 0, 1, 1);

    assert.deepStrictEqual(sideData.left.sequences[0].data, ['0A', '64', '14', '32']);
  });
});

// ============================================================================
// insertStepAfter
// ============================================================================
describe('insertStepAfter', () => {
  beforeEach(() => resetGlobalState());

  it('should insert step after specified index', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 2, data: ['0A', '64', '14', '32'] };
    insertStepAfter('left', 0, 0);

    const seq = sideData.left.sequences[0];
    assert.strictEqual(seq.data.length, 6);
    assert.strictEqual(seq.data[2], '0A');
    assert.strictEqual(seq.data[3], '64');
    assert.strictEqual(seq.lengthVal, 3);
  });

  it('should insert at beginning when afterStepIndex is -1', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 1, data: ['14', '64'] };
    insertStepAfter('left', 0, -1);

    const seq = sideData.left.sequences[0];
    assert.strictEqual(seq.data.length, 4);
    assert.strictEqual(seq.data[0], '0A');
    assert.strictEqual(seq.data[1], '00');
  });
});

// ============================================================================
// updateStepValue
// ============================================================================
describe('updateStepValue', () => {
  beforeEach(() => resetGlobalState());

  it('should update duration as hex', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    updateStepValue('left', 0, 0, 'duration', 20);

    assert.strictEqual(sideData.left.sequences[0].data[0], '14');
  });

  it('should update brightness as hex', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    updateStepValue('left', 0, 0, 'brightness', 50);

    assert.strictEqual(sideData.left.sequences[0].data[1], '32');
  });

  it('should not update RAW sequence', () => {
    sideData.left.sequences[0] = { identifier: RAW_IDENTIFIER, lengthVal: 2, data: ['AB', 'CD'] };
    updateStepValue('left', 0, 0, 'duration', 20);

    assert.strictEqual(sideData.left.sequences[0].data[0], 'AB');
  });

  it('should pad hex to 2 characters', () => {
    sideData.left.sequences[0] = { identifier: '01', lengthVal: 1, data: ['0A', '64'] };
    updateStepValue('left', 0, 0, 'duration', 5);

    assert.strictEqual(sideData.left.sequences[0].data[0], '05');
  });
});
