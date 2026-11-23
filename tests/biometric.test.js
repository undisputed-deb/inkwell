'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/biometric.js');

const img = (fn, n = 64) => Float32Array.from({ length: n * n }, (_, i) => fn(i % n, Math.floor(i / n)));

test('signature has fixed length regardless of input size', () => {
  assert.equal(B.signature(img(() => 1, 64), 64, 64).length, 256);
  assert.equal(B.signature(img(() => 1, 32), 32, 32).length, 256);
});

test('same picture matches itself and survives brightness change', () => {
  const a = B.signature(img((x, y) => x * 3 + y), 64, 64);
  const brighter = B.signature(img((x, y) => (x * 3 + y) * 0.7 + 40), 64, 64);
  assert.ok(B.similarity(a, brighter) > 0.99);
});

test('different pictures score low', () => {
  const a = B.signature(img((x, y) => x), 64, 64);
  const b = B.signature(img((x, y) => (x + y) % 2 * 255), 64, 64);
  assert.ok(B.similarity(a, b) < 0.5);
});

test('nearest returns the enrolled user above the threshold', () => {
  const a = B.signature(img((x, y) => x), 64, 64);
  const b = B.signature(img((x, y) => y), 64, 64);
  const hit = B.nearest(a, [{ id: 'a', sample: a }, { id: 'b', sample: b }]);
  assert.equal(hit.id, 'a');
});

test('unrecognized sample is rejected, never logs anyone in (R13.3)', () => {
  const a = B.signature(img((x, y) => x), 64, 64);
  const noise = B.signature(img((x, y) => (x * 7919 + y * 104729) % 251), 64, 64);
  assert.equal(B.nearest(noise, [{ id: 'a', sample: a }]), null);
});

test('users with no enrolled sample are skipped', () => {
  const a = B.signature(img((x, y) => x), 64, 64);
  assert.equal(B.nearest(a, [{ id: 'x', sample: null }]), null);
});

test('flat image does not crash (divide by zero)', () => {
  const flat = B.signature(img(() => 5, 64), 64, 64);
  assert.equal(flat.every(Number.isFinite), true);
});
