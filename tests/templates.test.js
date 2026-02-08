const { describe, it } = require('node:test');
const assert = require('node:assert');
require('./setup.js');

// ============================================================================
// Template Hex Validation
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
