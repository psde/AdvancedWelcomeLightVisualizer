const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert');

// ============================================================================
// DOM Stubs + Load Production Code
// ============================================================================
globalThis.window = { addEventListener: function() {}, onload: null, location: { search: '' } };
globalThis.history = { replaceState: function() {} };
globalThis.performance = { now: function() { return 0; } };
globalThis.SVGElement = class SVGElement {};

function stubElement() {
  const el = {
    appendChild: function(child) { return child; },
    removeChild: function() {},
    remove: function() {},
    setAttribute: function() {},
    getAttribute: function() { return null; },
    addEventListener: function() {},
    removeEventListener: function() {},
    contains: function() { return false; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    closest: function() { return null; },
    cloneNode: function() { return stubElement(); },
    getBoundingClientRect: function() { return { left: 0, top: 0, width: 500, height: 250, right: 500, bottom: 250 }; },
    focus: function() {},
    insertBefore: function() {},
    replaceChild: function() {},
    textContent: '',
    innerHTML: '',
    parentNode: null,
    children: [],
    childNodes: [],
    tagName: 'DIV',
    style: { display: '', filter: '', transition: '', transform: '' },
    dataset: {},
    classList: {
      _classes: new Set(),
      add: function(...cls) { cls.forEach(c => this._classes.add(c)); },
      remove: function(...cls) { cls.forEach(c => this._classes.delete(c)); },
      toggle: function(cls, force) {
        if (force !== undefined) { force ? this.add(cls) : this.remove(cls); }
        else if (this._classes.has(cls)) { this._classes.delete(cls); }
        else { this._classes.add(cls); }
      },
      contains: function(cls) { return this._classes.has(cls); }
    }
  };
  return el;
}

globalThis.document = {
  getElementById: function() {
    const el = stubElement();
    el.value = '';
    return el;
  },
  createElement: function(tag) {
    const el = stubElement();
    el.tagName = tag.toUpperCase();
    return el;
  },
  createElementNS: function(ns, tag) {
    const el = stubElement();
    el.tagName = tag;
    return el;
  },
  addEventListener: function() {},
  removeEventListener: function() {},
  contains: function() { return false; },
  body: { observe: function() {} },
  querySelector: function() { return null; },
  querySelectorAll: function() { return []; }
};
globalThis.navigator = { clipboard: {} };
globalThis.localStorage = {
  _store: {},
  getItem: function(key) { return this._store[key] !== undefined ? this._store[key] : null; },
  setItem: function(key, value) { this._store[key] = String(value); },
  removeItem: function(key) { delete this._store[key]; },
  clear: function() { this._store = {}; }
};
globalThis.getComputedStyle = function() {
  return { getPropertyValue: function() { return ''; } };
};
globalThis.requestAnimationFrame = function() {};
globalThis.cancelAnimationFrame = function() {};
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.AbortController = globalThis.AbortController || class {
  constructor() { this.signal = { aborted: false }; }
  abort() { this.signal.aborted = true; }
};

// Load production code into global scope (like <script> tags)
vm.runInThisContext(fs.readFileSync('templates.js', 'utf8'), { filename: 'templates.js' });
vm.runInThisContext(fs.readFileSync('vehicles.js', 'utf8'), { filename: 'vehicles.js' });
vm.runInThisContext(fs.readFileSync('config.js', 'utf8'), { filename: 'config.js' });
vm.runInThisContext(fs.readFileSync('js/core.js', 'utf8'), { filename: 'js/core.js' });
vm.runInThisContext(fs.readFileSync('js/animation.js', 'utf8'), { filename: 'js/animation.js' });
vm.runInThisContext(fs.readFileSync('js/svg-utils.js', 'utf8'), { filename: 'js/svg-utils.js' });
vm.runInThisContext(fs.readFileSync('js/chart.js', 'utf8'), { filename: 'js/chart.js' });
vm.runInThisContext(fs.readFileSync('js/editor.js', 'utf8'), { filename: 'js/editor.js' });
vm.runInThisContext(fs.readFileSync('js/timeline.js', 'utf8'), { filename: 'js/timeline.js' });
vm.runInThisContext(fs.readFileSync('js/init.js', 'utf8'), { filename: 'js/init.js' });

// ============================================================================
// Helpers
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

function resetGlobalState() {
  sideData.left.staging1Bytes = [];
  sideData.left.staging2Bytes = [];
  sideData.left.sequences = [];
  sideData.right.staging1Bytes = [];
  sideData.right.staging2Bytes = [];
  sideData.right.sequences = [];
  currentPhaseTimeline = null;
  currentAnimTime = 0;
  totalDuration = 0;
  isPlaying = false;
  tlDragState = null;
  tlSelectedKeypoint = null;
  chartInstances = [];
  summaryChartInstances = [];
}

module.exports = { assertHexArrayEqual, resetGlobalState, stubElement };
