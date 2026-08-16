import assert from 'node:assert/strict';
import test from 'node:test';
import { apiErrorHandler, requestIdentity } from './app.js';

test('API errors contain HTTP status, application code and request reference', () => {
  const headers = new Map();
  const request = {};
  let payload;
  const response = {
    headersSent: false,
    setHeader: (name, value) => headers.set(name.toLowerCase(), value),
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };

  requestIdentity(request, response, () => undefined);
  apiErrorHandler({ type: 'entity.parse.failed' }, request, response, () => undefined);

  assert.equal(response.statusCode, 400);
  assert.equal(payload.error.status, 400);
  assert.equal(payload.error.code, 'MALFORMED_JSON');
  assert.equal(payload.error.message, 'Nội dung JSON không hợp lệ');
  assert.match(payload.error.requestId, /^[0-9a-f-]{36}$/);
  assert.equal(headers.get('x-request-id'), payload.error.requestId);
});
