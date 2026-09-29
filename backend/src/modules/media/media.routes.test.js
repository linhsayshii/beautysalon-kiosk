import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

const uploadDir = mkdtempSync(join(tmpdir(), 'annachill-media-'));
process.env.UPLOAD_DIR = uploadDir;

const { requireJsonBody } = await import('../../lib/security.js');
const { productImageBodyParser, default: mediaRoutes } = await import('./media.routes.js');
const { deleteProductImage, parseProductImageUrl } = await import('./media.storage.js');

const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(32, 1)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);

function buildApp() {
  const app = express();
  // Mirrors the order in app.js.
  app.use(express.json());
  app.use('/api/v1/media/product-images', productImageBodyParser);
  app.use('/api/v1', requireJsonBody);
  app.use((request, response, next) => {
    request.account = { id: 1, branchId: Number(request.get('x-branch') ?? 1), role: request.get('x-role') ?? 'manager' };
    next();
  });
  app.use('/api/v1/media', mediaRoutes);
  app.use((error, request, response, next) => {
    const status = error.type === 'entity.too.large' ? 413 : error.status ?? 500;
    response.status(status).json({ error: { code: error.code, message: error.message } });
  });
  return app;
}

test('product image upload and download', async (t) => {
  const server = buildApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1/media`;
  const upload = (body, headers = {}) => fetch(`${base}/product-images`, {
    method: 'POST', body, headers: { 'content-type': 'image/webp', ...headers },
  });
  t.after(() => {
    server.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  await t.test('stores a WebP upload in the session branch and serves it back', async () => {
    const response = await upload(webp);
    assert.equal(response.status, 201);
    const { data } = await response.json();
    assert.match(data.url, /^\/api\/v1\/media\/products\/[0-9a-f-]{36}\.webp$/);
    assert.deepEqual(readdirSync(join(uploadDir, '1', 'products')).length, 1);

    const image = await fetch(`http://127.0.0.1:${server.address().port}${data.url}`);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/webp');
    assert.match(image.headers.get('cache-control'), /immutable/);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), webp);
  });

  await t.test('detects JPEG from its bytes even when the header claims WebP', async () => {
    const response = await upload(jpeg);
    assert.equal(response.status, 201);
    assert.match((await response.json()).data.url, /\.jpg$/);
  });

  await t.test('rejects bytes that are not WebP or JPEG', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(32)]);
    const response = await upload(png);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_IMAGE');
  });

  await t.test('rejects unsupported content types and empty bodies', async () => {
    assert.equal((await upload(webp, { 'content-type': 'image/png' })).status, 415);
    assert.equal((await upload(Buffer.alloc(0))).status, 400);
  });

  await t.test('rejects uploads over 1 MB', async () => {
    const large = Buffer.concat([webp, Buffer.alloc(1024 * 1024)]);
    assert.equal((await upload(large)).status, 413);
  });

  await t.test('only inventory managers can upload', async () => {
    assert.equal((await upload(webp, { 'x-role': 'staff' })).status, 403);
    assert.equal((await upload(webp, { 'x-role': 'cashier' })).status, 403);
  });

  await t.test('any signed-in role can view, but only within its own branch', async () => {
    const { data } = await (await upload(webp)).json();
    const url = `http://127.0.0.1:${server.address().port}${data.url}`;
    assert.equal((await fetch(url, { headers: { 'x-role': 'staff' } })).status, 200);
    assert.equal((await fetch(url, { headers: { 'x-branch': '2' } })).status, 404);
  });

  await t.test('file names outside the generated pattern are not found', async () => {
    assert.equal((await fetch(`${base}/products/..%2F..%2Fetc%2Fpasswd`)).status, 404);
    assert.equal((await fetch(`${base}/products/not-a-uuid.webp`)).status, 404);
  });

  await t.test('deleteProductImage removes internal files of the branch only', async () => {
    const { data } = await (await upload(webp)).json();
    const file = join(uploadDir, '1', 'products', data.url.split('/').pop());
    assert.equal(existsSync(file), true);
    await deleteProductImage({ branchId: 2, url: data.url });
    assert.equal(existsSync(file), true);
    await deleteProductImage({ branchId: 1, url: data.url });
    assert.equal(existsSync(file), false);
    await deleteProductImage({ branchId: 1, url: 'https://images.example.com/a.png' });
  });
});

test('imageUrl accepts legacy http(s) URLs and internal media paths only', () => {
  const internal = '/api/v1/media/products/0f8fad5b-d9cb-469f-a165-70867728950e.webp';
  assert.equal(parseProductImageUrl(internal), internal);
  assert.equal(parseProductImageUrl('https://images.example.com/a.png'), 'https://images.example.com/a.png');
  assert.equal(parseProductImageUrl(''), '');
  assert.equal(parseProductImageUrl(null), '');
  assert.throws(() => parseProductImageUrl('/api/v1/media/products/../../secret.webp'), { status: 400 });
  assert.throws(() => parseProductImageUrl('/etc/passwd'), { status: 400 });
  assert.throws(() => parseProductImageUrl('javascript:alert(1)'), { status: 400 });
});
