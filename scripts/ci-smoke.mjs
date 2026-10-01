// Full-stack smoke test. Runs inside the api container (stdin) against a freshly seeded database:
//   docker compose ... exec -T api env SMOKE_SEED=anna node --input-type=module < scripts/ci-smoke.mjs
// SMOKE_SEED=anna exercises business flows; SMOKE_SEED=minji checks the bootstrap-only dataset.
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3000/api/v1';
const SEED = process.env.SMOKE_SEED || 'anna';
const failures = [];
let cookie = '';

async function call(method, path, body, { auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json.data, code: json.error?.code, headers: res.headers };
}

function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failures.push(`${name} ${detail}`);
}

const expectStatus = (name, res, status, code) =>
  check(name, res.status === status && (!code || res.code === code), `→ ${res.status} ${res.code ?? ''}`);

async function login(username) {
  cookie = '';
  return call('POST', '/auth/login', { username, password: '12345678' }, { auth: false });
}

// --- public + security -------------------------------------------------------------------------
expectStatus('GET /health', await call('GET', '/health', null, { auth: false }), 200);
const ready = await call('GET', '/ready', null, { auth: false });
check('GET /ready', ready.status === 200 && ready.json.status === 'ready', `→ ${ready.status}`);

const missing = await call('GET', '/health', null, { auth: false });
for (const [header, value] of [['x-content-type-options', 'nosniff'], ['x-frame-options', 'DENY'], ['cache-control', 'no-store']]) {
  check(`header ${header}`, missing.headers.get(header) === value, `→ ${missing.headers.get(header)}`);
}
check('X-Request-Id present', Boolean(missing.headers.get('x-request-id')));

expectStatus('protected route without session', await call('GET', '/staff', null, { auth: false }), 401, 'AUTH_REQUIRED');
expectStatus('wrong password', await call('POST', '/auth/login', { username: 'admin', password: 'wrong-password' }, { auth: false }), 401);

// --- admin session -----------------------------------------------------------------------------
const admin = await login('admin');
expectStatus('login admin', admin, 200);
check('admin is a manager', admin.data?.role === 'manager', `→ ${admin.data?.role}`);
expectStatus('GET /auth/me', await call('GET', '/auth/me'), 200);
expectStatus('unknown route uses the error envelope', await call('GET', '/nonexistent'), 404, 'ROUTE_NOT_FOUND');
for (const path of ['/meta', '/branches', '/dashboard', '/staff', '/customers', '/orders', '/pos/catalog', '/inventory/products',
  '/inventory/suppliers', '/cashbook/vouchers', '/reports/profit']) {
  const res = await call('GET', path);
  check(`GET ${path}`, res.status === 200, `→ ${res.status} ${res.code ?? ''}`);
}

if (SEED === 'minji') {
  const catalog = await call('GET', '/pos/catalog');
  check('minji seed has an empty catalog', catalog.data?.length === 0, `→ ${catalog.data?.length}`);
  expectStatus('anna-only account is absent', await login('manager'), 401);
} else {
  // --- role boundaries --------------------------------------------------------------------------
  expectStatus('login cashier', await login('cashier'), 200);
  expectStatus('cashier cannot read reports', await call('GET', '/reports/profit'), 403, 'ACCESS_DENIED');
  expectStatus('login staff', await login('staff'), 200);
  expectStatus('staff cannot read inventory', await call('GET', '/inventory/products'), 403, 'ACCESS_DENIED');
  expectStatus('staff cannot read cashbook', await call('GET', '/cashbook/vouchers'), 403, 'ACCESS_DENIED');

  // --- customer -> checkout -> order ------------------------------------------------------------
  await login('admin');
  const phone = `09${String(Date.now()).slice(-8)}`;
  const created = await call('POST', '/customers', { name: 'CI Smoke Customer', phone });
  expectStatus('POST /customers', created, 201);
  expectStatus('POST /customers rejects an empty body', await call('POST', '/customers', {}), 400, 'NAME_REQUIRED');

  const service = (await call('GET', '/pos/catalog?type=service')).data?.[0];
  check('catalog has a service', Boolean(service?.itemId));
  const checkout = await call('POST', '/pos/checkout', {
    customerId: created.data?.id,
    lines: [{ itemType: 'service', itemId: service?.itemId, quantity: 1 }],
    paymentMethod: 'cash',
    requestKey: crypto.randomUUID(),
  });
  expectStatus('POST /pos/checkout', checkout, 201);
  expectStatus('POST /pos/checkout rejects an empty cart', await call('POST', '/pos/checkout', { lines: [] }), 400, 'EMPTY_CART');
  const orders = await call('GET', '/orders');
  check('checkout appears in /orders', orders.status === 200 && JSON.stringify(orders.json).includes(checkout.data?.code ?? '\0'),
    `→ ${orders.status}`);
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll smoke checks passed');
