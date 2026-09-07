import assert from 'node:assert/strict';
import test from 'node:test';
import { requireJsonBody } from './security.js';

function runJsonBodyCheck({ method = 'POST', contentLength, transferEncoding, contentType, body = undefined } = {}) {
  const headers = new Map();
  if (contentLength !== undefined) headers.set('content-length', contentLength);
  if (transferEncoding !== undefined) headers.set('transfer-encoding', transferEncoding);
  const request = {
    method,
    body,
    get(name) {
      if (name === 'content-type') return contentType;
      return headers.get(name.toLowerCase());
    },
    is(value) {
      return value === 'application/json' && contentType === 'application/json';
    },
  };
  let error;
  requireJsonBody(request, {}, (cause) => { error = cause; });
  return { request, error };
}

test('allows an empty POST request without a JSON content type', () => {
  const { request, error } = runJsonBodyCheck({ contentLength: '0' });

  assert.equal(error, undefined);
  assert.deepEqual(request.body, {});
});

test('rejects a non-empty request without a JSON content type', () => {
  const { error } = runJsonBodyCheck({ contentLength: '2', body: {} });

  assert.equal(error?.status, 415);
  assert.equal(error?.code, 'JSON_REQUIRED');
});

test('accepts a non-empty JSON request', () => {
  const { error } = runJsonBodyCheck({ contentLength: '2', contentType: 'application/json', body: {} });

  assert.equal(error, undefined);
});
