const test = require('node:test');
const assert = require('node:assert/strict');
const { Config } = require('../config');

test('config parses numeric ports', () => {
  const prev = process.env.ADMIN_PORT;
  process.env.ADMIN_PORT = '9090';
  const cfg = new Config();
  assert.equal(cfg.get('ADMIN_PORT'), 9090);
  process.env.ADMIN_PORT = prev;
});

test('config throws on invalid enum', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'staging';
  assert.throws(() => new Config());
  process.env.NODE_ENV = prev;
});
