const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

// Load vehicles.js into global scope
vm.runInThisContext(fs.readFileSync('vehicles.js', 'utf8'), { filename: 'vehicles.js' });

// ============================================================================
// Vehicle Config Validation
// ============================================================================

const VALID_TYPES = ['path', 'circle', 'polygon', 'rect'];

const REQUIRED_ATTRS = {
  path:    ['d'],
  circle:  ['cx', 'cy', 'r'],
  polygon: ['points'],
  rect:    ['x', 'y', 'width', 'height']
};

function validateShape(shape, context) {
  assert.ok(VALID_TYPES.includes(shape.type),
    context + ': invalid shape type "' + shape.type + '"');
  const required = REQUIRED_ATTRS[shape.type];
  for (const attr of required) {
    assert.ok(attr in shape,
      context + ': shape type "' + shape.type + '" missing required attribute "' + attr + '"');
  }
}

describe('VEHICLE_CONFIGS structure', () => {
  for (const [key, config] of Object.entries(VEHICLE_CONFIGS)) {
    describe(key, () => {
      it('should have a name and valid type', () => {
        assert.ok(typeof config.name === 'string' && config.name.length > 0,
          key + ': missing or empty name');
        assert.ok(config.type === 'grid' || config.type === 'image',
          key + ': type must be "grid" or "image", got "' + config.type + '"');
      });

      if (config.type === 'image') {
        it('should have image config properties', () => {
          assert.ok(typeof config.image === 'string', key + ': missing image path');
          assert.ok(typeof config.viewBox === 'string', key + ': missing viewBox');
          assert.ok(Array.isArray(config.channels), key + ': missing channels array');
          assert.ok(config.channels.length > 0, key + ': channels array is empty');
        });

        for (let i = 0; i < (config.channels || []).length; i++) {
          const ch = config.channels[i];
          const ctx = key + ' channel[' + i + ']';

          it('should have valid id and label for ' + ctx, () => {
            assert.ok(typeof ch.id === 'number', ctx + ': id must be a number');
            assert.ok(typeof ch.label === 'string' && ch.label.length > 0,
              ctx + ': missing or empty label');
          });

          it('should have valid shape(s) for ' + ctx, () => {
            if (ch.shapes) {
              assert.ok(Array.isArray(ch.shapes), ctx + ': shapes must be an array');
              assert.ok(ch.shapes.length > 0, ctx + ': shapes array is empty');
              for (let s = 0; s < ch.shapes.length; s++) {
                validateShape(ch.shapes[s], ctx + ' shapes[' + s + ']');
              }
            } else {
              assert.ok(typeof ch.type === 'string',
                ctx + ': must have either "type" or "shapes"');
              validateShape(ch, ctx);
            }
          });
        }
      }
    });
  }
});
