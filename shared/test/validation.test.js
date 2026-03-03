const test = require('node:test');
const assert = require('node:assert/strict');
const { validateField, validateObject, assertValid } = require('../validation');

test('validateField enforces required', () => {
  const result = validateField('name', undefined, { required: true });
  assert.equal(result.valid, false);
});

test('validateObject collects field errors', () => {
  const result = validateObject({ a: '' }, {
    a: { type: 'string', minLength: 2 },
    b: { type: 'number', required: true },
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
});

test('assertValid returns value when valid', () => {
  const result = validateObject({ a: 'ok' }, { a: { type: 'string', required: true } });
  const value = assertValid(result);
  assert.equal(value.a, 'ok');
});
