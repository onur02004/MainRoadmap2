import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimit } from '../src/middleware/rateLimit.js';

function makeResponse() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

test('rate limiter rejects requests above configured limit', () => {
  const limiter = createRateLimit({ windowMs: 60_000, max: 2, keyGenerator: () => 'rate-limit-unit-test-fixed-key' });
  const req = { path: '/unit-test', baseUrl: '/unit', ip: '127.0.0.1' };
  let nextCalls = 0;
  for (let i = 0; i < 2; i += 1) limiter(req, makeResponse(), () => { nextCalls += 1; });
  const response = makeResponse();
  limiter(req, response, () => { nextCalls += 1; });
  assert.equal(nextCalls, 2);
  assert.equal(response.statusCode, 429);
  assert.ok(response.headers['Retry-After']);
});
