const test = require('node:test');
const assert = require('node:assert/strict');
const { Config } = require('../config');

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

test('config parses numeric ports', () => {
  const prev = process.env.ADMIN_PORT;
  process.env.ADMIN_PORT = '9090';
  const cfg = new Config();
  assert.equal(cfg.get('ADMIN_PORT'), 9090);
  restoreEnv('ADMIN_PORT', prev);
});

test('config exposes bind hosts for admin and player', () => {
  const prevAdminHost = process.env.ADMIN_HOST;
  const prevPlayerHost = process.env.PLAYER_HOST;
  process.env.ADMIN_HOST = '0.0.0.0';
  process.env.PLAYER_HOST = '::';
  const cfg = new Config();
  assert.equal(cfg.getAdmin().host, '0.0.0.0');
  assert.equal(cfg.getPlayer().host, '::');
  restoreEnv('ADMIN_HOST', prevAdminHost);
  restoreEnv('PLAYER_HOST', prevPlayerHost);
});

test('config throws on invalid enum', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'staging';
  assert.throws(() => new Config());
  restoreEnv('NODE_ENV', prev);
});
