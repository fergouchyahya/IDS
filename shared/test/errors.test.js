const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ValidationError,
  NotFoundError,
  errorToResponse,
} = require('../errors');

test('shared/errors maps app errors to response', () => {
  const err = new ValidationError([{ path: 'x', message: 'required', code: 'required' }]);
  const out = errorToResponse(err);
  assert.equal(out.statusCode, 400);
  assert.equal(out.body.error, 'validation_failed');
});

test('shared/errors maps unknown errors to internal', () => {
  const out = errorToResponse(new Error('boom'));
  assert.equal(out.statusCode, 500);
  assert.equal(out.body.error, 'internal_error');
});

test('shared/errors not found shape', () => {
  const err = new NotFoundError('Campaign', 'abc');
  const out = errorToResponse(err);
  assert.equal(out.statusCode, 404);
  assert.match(out.body.message, /Campaign not found/);
});
