import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDateTime, parseOptionalHttpUrl, parseTime } from './http.js';

test('HTTP URL validation rejects active and credential-bearing schemes', () => {
  assert.equal(parseOptionalHttpUrl('https://images.example.com/a.png', 'imageUrl'), 'https://images.example.com/a.png');
  assert.throws(() => parseOptionalHttpUrl('javascript:alert(1)', 'imageUrl'), { status: 400 });
  assert.throws(() => parseOptionalHttpUrl('https://user:secret@example.com/a.png', 'imageUrl'), { status: 400 });
});

test('time validation only accepts real 24-hour HH:MM values', () => {
  assert.equal(parseTime('09:30', 'startsAt'), '09:30');
  assert.throws(() => parseTime('25:00', 'startsAt'), { status: 400 });
  assert.throws(() => parseTime('9:30', 'startsAt'), { status: 400 });
});

test('date time validation rejects invalid dates', () => {
  assert.equal(parseDateTime('2026-08-15T10:00:00+07:00', 'startsAt') instanceof Date, true);
  assert.throws(() => parseDateTime('not-a-date', 'startsAt'), { status: 400 });
});
