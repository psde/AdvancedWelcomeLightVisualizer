const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert');

// ============================================================================
// DOM Stubs + Load Production Code
// ============================================================================
globalThis.window = { addEventListener: function() {}, onload: null, location: { search: '' } };
const stubElement = () => ({
  appendChild: function() {},
  setAttribute: function() {},
  getAttribute: function() { return null; },
  addEventListener: function() {},
  textContent: ''
});
globalThis.document = {
  getElementById: function() { return null; },
  createElement: function() { return stubElement(); },
  createElementNS: function() { return stubElement(); },
  addEventListener: function() {},
  removeEventListener: function() {},
  contains: function() { return false; },
  body: { observe: function() {} }
};
globalThis.navigator = { clipboard: {} };
globalThis.requestAnimationFrame = function() {};
globalThis.cancelAnimationFrame = function() {};
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };

// Load production code into global scope (like <script> tags)
vm.runInThisContext(fs.readFileSync('templates.js', 'utf8'), { filename: 'templates.js' });
vm.runInThisContext(fs.readFileSync('config.js', 'utf8'), { filename: 'config.js' });
vm.runInThisContext(fs.readFileSync('js/core.js', 'utf8'), { filename: 'js/core.js' });
vm.runInThisContext(fs.readFileSync('js/animation.js', 'utf8'), { filename: 'js/animation.js' });
vm.runInThisContext(fs.readFileSync('js/chart.js', 'utf8'), { filename: 'js/chart.js' });
vm.runInThisContext(fs.readFileSync('js/editor.js', 'utf8'), { filename: 'js/editor.js' });
vm.runInThisContext(fs.readFileSync('js/timeline.js', 'utf8'), { filename: 'js/timeline.js' });
vm.runInThisContext(fs.readFileSync('js/init.js', 'utf8'), { filename: 'js/init.js' });

// ============================================================================
// Helper — Case-Insensitive Hex Array Comparison
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

module.exports = { assertHexArrayEqual };
