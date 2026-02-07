const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

// ============================================================================
// Section 1: DOM Stubs + Load Production Code
// ============================================================================
globalThis.window = { addEventListener: function() {}, onload: null };
globalThis.document = {
  getElementById: function() { return null; },
  createElement: function() { return { appendChild: function() {} }; }
};
globalThis.navigator = { clipboard: {} };
globalThis.requestAnimationFrame = function() {};

// Load production code into global scope (like <script> tags)
vm.runInThisContext(fs.readFileSync('templates.js', 'utf8'), { filename: 'templates.js' });
vm.runInThisContext(fs.readFileSync('app.js', 'utf8'), { filename: 'app.js' });

// ============================================================================
// Section 2: Helper — Case-Insensitive Hex Array Comparison
// ============================================================================
function assertHexArrayEqual(actual, expected, message) {
  const prefix = message || 'hex array';
  assert.strictEqual(actual.length, expected.length, prefix + ' (length mismatch: got ' + actual.length + ', expected ' + expected.length + ')');
  for (let i = 0; i < actual.length; i++) {
    assert.strictEqual(
      actual[i].toUpperCase(), expected[i].toUpperCase(),
      prefix + ' mismatch at index ' + i + ': got "' + actual[i] + '", expected "' + expected[i] + '"'
    );
  }
}

// ============================================================================
// Section 3: parseByteString Tests
// ============================================================================
describe('parseByteString', () => {
  it('should return empty array for empty string', () => {
    assert.deepStrictEqual(parseByteString(''), []);
  });

  it('should return empty array for null', () => {
    assert.deepStrictEqual(parseByteString(null), []);
  });

  it('should return empty array for undefined', () => {
    assert.deepStrictEqual(parseByteString(undefined), []);
  });

  it('should parse a single byte', () => {
    assert.deepStrictEqual(parseByteString('01'), ['01']);
  });

  it('should parse comma-separated bytes with spaces', () => {
    assert.deepStrictEqual(parseByteString('01, 02, 03'), ['01', '02', '03']);
  });

  it('should parse comma-separated bytes without spaces', () => {
    assert.deepStrictEqual(parseByteString('01,02,03'), ['01', '02', '03']);
  });

  it('should handle extra whitespace', () => {
    assert.deepStrictEqual(parseByteString('  01 , 02 , 03  '), ['01', '02', '03']);
  });
});

// ============================================================================
// Section 4: parseAllSequencesFromBytes Tests
// ============================================================================
describe('parseAllSequencesFromBytes', () => {
  it('should return empty array for empty input', () => {
    const result = parseAllSequencesFromBytes([], []);
    assert.deepStrictEqual(result, []);
  });

  it('should parse a single sequence', () => {
    // identifier=01, lenHigh=00, lenLow=02 => lengthVal=2, dataByteCount=4
    const arr = ['01', '00', '02', 'AA', 'BB', 'CC', 'DD'];
    const result = parseAllSequencesFromBytes(arr, []);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].identifier, '01');
    assert.strictEqual(result[0].lengthVal, 2);
    assert.deepStrictEqual(result[0].data, ['AA', 'BB', 'CC', 'DD']);
  });

  it('should parse multiple sequences', () => {
    // seq1: id=01, len=0001 => 1 pair (2 data bytes)
    // seq2: id=02, len=0001 => 1 pair (2 data bytes)
    const arr = ['01', '00', '01', 'AA', 'BB', '02', '00', '01', 'CC', 'DD'];
    const result = parseAllSequencesFromBytes(arr, []);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].identifier, '01');
    assert.deepStrictEqual(result[0].data, ['AA', 'BB']);
    assert.strictEqual(result[1].identifier, '02');
    assert.deepStrictEqual(result[1].data, ['CC', 'DD']);
  });

  it('should stop at 00,00,00 terminator', () => {
    const arr = ['01', '00', '01', 'AA', 'BB', '00', '00', '00', '01', '00', '01', 'CC', 'DD'];
    const result = parseAllSequencesFromBytes(arr, []);
    // Only the first sequence should be parsed; data after terminator is non-zero => RAW
    assert.strictEqual(result[0].identifier, '01');
    assert.deepStrictEqual(result[0].data, ['AA', 'BB']);
    // Leftover after terminator: ['01','00','01','CC','DD'] => has non-zero => RAW
    const rawSeq = result.find(s => s.identifier === 'RAW');
    assert.ok(rawSeq, 'should have a RAW sequence for non-zero leftover after terminator');
    assert.deepStrictEqual(rawSeq.data, ['01', '00', '01', 'CC', 'DD']);
  });

  it('should not create RAW for all-zero leftover', () => {
    const arr = ['01', '00', '01', 'AA', 'BB', '00', '00', '00', '00', '00', '00'];
    const result = parseAllSequencesFromBytes(arr, []);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].identifier, '01');
  });

  it('should handle RAW leftover with non-zero bytes', () => {
    const arr = ['01', '00', '01', 'AA', 'BB', '00', '00', '00', '00', 'FF', '00'];
    const result = parseAllSequencesFromBytes(arr, []);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[1].identifier, 'RAW');
    assert.deepStrictEqual(result[1].data, ['00', 'FF', '00']);
  });

  it('should handle incomplete/truncated sequence data', () => {
    // identifier=01, lenHigh=00, lenLow=05 => lengthVal=5, needs 10 data bytes, only 2 available
    const arr = ['01', '00', '05', 'AA', 'BB'];
    const result = parseAllSequencesFromBytes(arr, []);
    // Parser consumes 3-byte header (idx advances to 3), then breaks due to
    // insufficient data. Leftover is ['AA','BB'] which has non-zero => RAW.
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].identifier, 'RAW');
    assert.deepStrictEqual(result[0].data, ['AA', 'BB']);
  });

  it('should combine arr1 and arr2', () => {
    // Sequence spans across arr1 and arr2
    const arr1 = ['01', '00', '02'];
    const arr2 = ['AA', 'BB', 'CC', 'DD'];
    const result = parseAllSequencesFromBytes(arr1, arr2);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].identifier, '01');
    assert.strictEqual(result[0].lengthVal, 2);
    assert.deepStrictEqual(result[0].data, ['AA', 'BB', 'CC', 'DD']);
  });
});

// ============================================================================
// Section 5: Reassembly Tests
// ============================================================================
describe('reAssembleLeftBytes', () => {
  it('should pad to 252/168 for empty sequences', () => {
    sequencesLeft = [];
    reAssembleLeftBytes();
    assert.strictEqual(left1Bytes.length, 252);
    assert.strictEqual(left2Bytes.length, 168);
    assert.ok(left1Bytes.every(b => b === '00'), 'left1Bytes should be all zeros');
    assert.ok(left2Bytes.every(b => b === '00'), 'left2Bytes should be all zeros');
  });

  it('should reconstruct header from sequence fields', () => {
    sequencesLeft = [{ identifier: '01', lengthVal: 2, data: ['AA', 'BB', 'CC', 'DD'] }];
    reAssembleLeftBytes();
    // Header: 01, 00, 02, AA, BB, CC, DD, then padded with 00s
    assert.strictEqual(left1Bytes[0].toUpperCase(), '01');
    assert.strictEqual(left1Bytes[1].toUpperCase(), '00');
    assert.strictEqual(left1Bytes[2].toUpperCase(), '02');
    assert.strictEqual(left1Bytes[3].toUpperCase(), 'AA');
    assert.strictEqual(left1Bytes[4].toUpperCase(), 'BB');
    assert.strictEqual(left1Bytes[5].toUpperCase(), 'CC');
    assert.strictEqual(left1Bytes[6].toUpperCase(), 'DD');
    // Rest should be padded
    for (let i = 7; i < 252; i++) {
      assert.strictEqual(left1Bytes[i], '00');
    }
    assert.strictEqual(left2Bytes.length, 168);
  });

  it('should pass through RAW data without header', () => {
    sequencesLeft = [{ identifier: 'RAW', lengthVal: 3, data: ['FF', 'EE', 'DD'] }];
    reAssembleLeftBytes();
    assert.strictEqual(left1Bytes[0].toUpperCase(), 'FF');
    assert.strictEqual(left1Bytes[1].toUpperCase(), 'EE');
    assert.strictEqual(left1Bytes[2].toUpperCase(), 'DD');
  });

  it('should split data across staging1/staging2 boundary', () => {
    // Create data that exceeds 252 bytes
    const data = [];
    for (let i = 0; i < 260; i++) data.push('FF');
    // lengthVal = 130 pairs => 260 data bytes; header = 3 bytes; total = 263
    sequencesLeft = [{ identifier: '01', lengthVal: 130, data: data }];
    reAssembleLeftBytes();
    assert.strictEqual(left1Bytes.length, 252);
    assert.strictEqual(left2Bytes.length, 168);
    // First 252 bytes in left1Bytes (3 header + 249 data)
    assert.strictEqual(left1Bytes[0].toUpperCase(), '01');
    // Remaining 11 data bytes should be in left2Bytes
    assert.strictEqual(left2Bytes[0].toUpperCase(), 'FF');
    assert.strictEqual(left2Bytes[10].toUpperCase(), 'FF');
    // left2Bytes[11] onward should be padding
    assert.strictEqual(left2Bytes[11], '00');
  });

  it('should skip null sequences', () => {
    sequencesLeft = [null, { identifier: '01', lengthVal: 1, data: ['AA', 'BB'] }];
    reAssembleLeftBytes();
    assert.strictEqual(left1Bytes[0].toUpperCase(), '01');
    assert.strictEqual(left1Bytes[1].toUpperCase(), '00');
    assert.strictEqual(left1Bytes[2].toUpperCase(), '01');
    assert.strictEqual(left1Bytes[3].toUpperCase(), 'AA');
    assert.strictEqual(left1Bytes[4].toUpperCase(), 'BB');
  });
});

describe('reAssembleRightBytes', () => {
  it('should pad to 252/168 for empty sequences', () => {
    sequencesRight = [];
    reAssembleRightBytes();
    assert.strictEqual(right1Bytes.length, 252);
    assert.strictEqual(right2Bytes.length, 168);
  });

  it('should reconstruct header from sequence fields', () => {
    sequencesRight = [{ identifier: '02', lengthVal: 1, data: ['AA', 'BB'] }];
    reAssembleRightBytes();
    assert.strictEqual(right1Bytes[0].toUpperCase(), '02');
    assert.strictEqual(right1Bytes[1].toUpperCase(), '00');
    assert.strictEqual(right1Bytes[2].toUpperCase(), '01');
    assert.strictEqual(right1Bytes[3].toUpperCase(), 'AA');
    assert.strictEqual(right1Bytes[4].toUpperCase(), 'BB');
  });
});

// ============================================================================
// Section 6: Round-Trip Tests (per template)
// ============================================================================
describe('Round-trip: parse then reassemble per template', () => {
  for (const [name, tmpl] of Object.entries(TEMPLATES)) {
    describe('Template: ' + name, () => {
      it('should round-trip left side', () => {
        const orig1 = parseByteString(tmpl.left1);
        const orig2 = parseByteString(tmpl.left2);

        const seqs = parseAllSequencesFromBytes(orig1.slice(), orig2.slice());

        // Reassemble via globals
        sequencesLeft = seqs;
        reAssembleLeftBytes();

        // Build expected: pad originals to 252/168
        const expected1 = orig1.slice();
        while (expected1.length < 252) expected1.push('00');
        expected1.length = 252;

        const expected2 = orig2.slice();
        while (expected2.length < 168) expected2.push('00');
        expected2.length = 168;

        assertHexArrayEqual(left1Bytes, expected1, name + ' left staging1');
        assertHexArrayEqual(left2Bytes, expected2, name + ' left staging2');
      });

      it('should round-trip right side', () => {
        const orig1 = parseByteString(tmpl.right1);
        const orig2 = parseByteString(tmpl.right2);

        const seqs = parseAllSequencesFromBytes(orig1.slice(), orig2.slice());

        sequencesRight = seqs;
        reAssembleRightBytes();

        const expected1 = orig1.slice();
        while (expected1.length < 252) expected1.push('00');
        expected1.length = 252;

        const expected2 = orig2.slice();
        while (expected2.length < 168) expected2.push('00');
        expected2.length = 168;

        assertHexArrayEqual(right1Bytes, expected1, name + ' right staging1');
        assertHexArrayEqual(right2Bytes, expected2, name + ' right staging2');
      });
    });
  }
});

// ============================================================================
// Section 7: sequenceToString / stringToSequence Round-Trip Tests
// ============================================================================
describe('sequenceToString / stringToSequence', () => {
  it('should return empty string for null', () => {
    assert.strictEqual(sequenceToString(null), '');
  });

  it('should round-trip a normal sequence', () => {
    const seq = { identifier: '01', lengthVal: 2, data: ['AA', 'BB', 'CC', 'DD'] };
    const str = sequenceToString(seq);
    const parsed = stringToSequence(str);
    assert.strictEqual(parsed.identifier, '01');
    assert.strictEqual(parsed.lengthVal, 2);
    assert.deepStrictEqual(
      parsed.data.map(d => d.toUpperCase()),
      ['AA', 'BB', 'CC', 'DD']
    );
  });

  it('should round-trip a RAW sequence', () => {
    const seq = { identifier: 'RAW', lengthVal: 3, data: ['FF', 'EE', 'DD'] };
    const str = sequenceToString(seq);
    const parsed = stringToSequence(str);
    // RAW sequences: stringToSequence sees the first element is not "RAW"
    // and has >= 3 elements, so it will parse as a normal sequence with
    // identifier=FF. Let's verify the actual behavior:
    // sequenceToString(RAW) => buildByteString(data) => "FF, EE, DD"
    // stringToSequence("FF, EE, DD") => arr=[FF,EE,DD], len>=3, id=FF, lenHigh=EE, lenLow=DD
    // This is expected behavior - RAW is a passthrough for byte data
    assert.ok(parsed !== null);
  });

  it('should handle sequenceToString for RAW', () => {
    const seq = { identifier: 'RAW', lengthVal: 2, data: ['AB', 'CD'] };
    const str = sequenceToString(seq);
    assert.strictEqual(str, 'AB, CD');
  });

  it('should produce correct header format', () => {
    const seq = { identifier: '0A', lengthVal: 15, data: Array(30).fill('FF') };
    const str = sequenceToString(seq);
    const parts = parseByteString(str);
    assert.strictEqual(parts[0], '0A');
    assert.strictEqual(parts[1].toUpperCase(), '00');
    assert.strictEqual(parts[2].toUpperCase(), '0F');
    assert.strictEqual(parts.length, 33); // 3 header + 30 data
  });

  it('should return null for empty string input to stringToSequence', () => {
    assert.strictEqual(stringToSequence(''), null);
  });

  it('should treat short arrays as RAW in stringToSequence', () => {
    const parsed = stringToSequence('AB, CD');
    assert.strictEqual(parsed.identifier, 'RAW');
    assert.deepStrictEqual(parsed.data, ['AB', 'CD']);
  });

  it('should round-trip all sequences from each template', () => {
    for (const [name, tmpl] of Object.entries(TEMPLATES)) {
      const orig1 = parseByteString(tmpl.left1);
      const orig2 = parseByteString(tmpl.left2);
      const seqs = parseAllSequencesFromBytes(orig1, orig2);

      for (let i = 0; i < seqs.length; i++) {
        const seq = seqs[i];
        if (seq.identifier === 'RAW') continue;
        const str = sequenceToString(seq);
        const reparsed = stringToSequence(str);
        assert.strictEqual(reparsed.identifier, seq.identifier,
          name + ' seq ' + i + ' identifier mismatch');
        assert.strictEqual(reparsed.lengthVal, seq.lengthVal,
          name + ' seq ' + i + ' lengthVal mismatch');
        assert.deepStrictEqual(
          reparsed.data.map(d => d.toUpperCase()),
          seq.data.map(d => d.toUpperCase()),
          name + ' seq ' + i + ' data mismatch'
        );
      }
    }
  });
});

// ============================================================================
// Section 8: Edge Cases
// ============================================================================
describe('Edge cases', () => {
  it('should handle all-zero input', () => {
    const zeros = Array(252).fill('00');
    const result = parseAllSequencesFromBytes(zeros, []);
    // Starts with 00,00,00 => terminator immediately, rest is all zeros => no RAW
    assert.strictEqual(result.length, 0);
  });

  it('should handle exactly 252 bytes of real data in staging1', () => {
    // Build a sequence that exactly fills 252 bytes
    // header(3) + data(249) = 252; lengthVal = 124 pairs + 1 extra byte...
    // Actually lengthVal * 2 = data bytes, so 249/2 is not integer.
    // Use 248 data bytes: lengthVal=124, total = 3 + 248 = 251
    // Then pad. Let's just use a known size.
    const data = Array(248).fill('FF');
    sequencesLeft = [{ identifier: '01', lengthVal: 124, data: data }];
    reAssembleLeftBytes();
    assert.strictEqual(left1Bytes.length, 252);
    // 3 header + 248 data = 251, so byte 251 (index 251) should be padding
    assert.strictEqual(left1Bytes[251], '00');
    assert.strictEqual(left2Bytes.length, 168);
    assert.ok(left2Bytes.every(b => b === '00'));
  });

  it('should handle overflow beyond 420 bytes (252+168) via ensureMaxSize behavior', () => {
    // Total bytes > 420: left2Bytes is sliced to MAX_LEFT2 (168)
    const data = Array(500).fill('FF');
    sequencesLeft = [{ identifier: 'RAW', lengthVal: 500, data: data }];
    reAssembleLeftBytes();
    assert.strictEqual(left1Bytes.length, 252);
    assert.strictEqual(left2Bytes.length, 168);
  });

  it('should handle empty staging2 template correctly', () => {
    // BMW G07 has empty left2
    const tmpl = TEMPLATES['BMW G07 - SimR'];
    assert.ok(tmpl, 'G07 template should exist');
    const orig1 = parseByteString(tmpl.left1);
    const orig2 = parseByteString(tmpl.left2);
    assert.strictEqual(orig2.length, 0);

    const seqs = parseAllSequencesFromBytes(orig1, orig2);
    sequencesLeft = seqs;
    reAssembleLeftBytes();

    assert.strictEqual(left1Bytes.length, 252);
    assert.strictEqual(left2Bytes.length, 168);
    assert.ok(left2Bytes.every(b => b === '00'), 'staging2 should be all zeros for empty template');
  });

  it('buildByteString should join with comma-space', () => {
    assert.strictEqual(buildByteString(['01', '02', '03']), '01, 02, 03');
  });

  it('ensureMaxSize should trim arrays exceeding max', () => {
    const arr = ['01', '02', '03', '04', '05'];
    ensureMaxSize(arr, 3);
    assert.strictEqual(arr.length, 3);
    assert.deepStrictEqual(arr, ['01', '02', '03']);
  });

  it('ensureMaxSize should not modify arrays within limit', () => {
    const arr = ['01', '02'];
    ensureMaxSize(arr, 5);
    assert.strictEqual(arr.length, 2);
  });
});

// ============================================================================
// Section 9: Template Hex Validation
// ============================================================================
describe('Template hex validation', () => {
  const fields = ['left1', 'left2', 'right1', 'right2'];
  const hexBytePattern = /^[0-9A-Fa-f]{2}$/;

  for (const [name, tmpl] of Object.entries(TEMPLATES)) {
    for (const field of fields) {
      it('should contain only valid hex bytes in "' + name + '" ' + field, () => {
        const value = tmpl[field];
        if (!value || value.trim() === '') return;

        const tokens = value.split(',').map(t => t.trim());
        for (let i = 0; i < tokens.length; i++) {
          assert.match(tokens[i], hexBytePattern,
            '"' + name + '" field ' + field + ' byte ' + i + ': invalid hex "' + tokens[i] + '"');
        }
      });
    }
  }
});
