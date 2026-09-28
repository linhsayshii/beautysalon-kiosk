import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePassword } from './auth.routes.js';

test('passwords require a strong minimum policy', () => {
  assert.throws(() => validatePassword('short1A'), { code: 'INVALID_PASSWORD' });
  assert.throws(() => validatePassword('1234567'), { code: 'INVALID_PASSWORD' });
  assert.doesNotThrow(() => validatePassword('12345678'));
  assert.doesNotThrow(() => validatePassword('StrongPassw0rd'));
});
