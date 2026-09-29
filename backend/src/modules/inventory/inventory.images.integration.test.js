import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const uploadDir = mkdtempSync(join(tmpdir(), 'annachill-inventory-images-'));
process.env.UPLOAD_DIR = uploadDir;

const { pool } = await import('../../db.js');
const { customerDebtMigration } = await import('../../migrations/customer-debt.js');
const { cashbookMigration } = await import('../../migrations/cashbook.js');
const { saveProductImage } = await import('../media/media.storage.js');
const { createInventoryItem, listPosProducts, updateInventoryItem } = await import('./inventory.service.js');

const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(16, 1)]);
const fileOf = (url) => join(uploadDir, '1', 'products', url.split('/').pop());

test('product images', async (t) => {
  const db = new PGlite();
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const query = (sql, params = []) => db.query(sql, params);
  pool.connect = async () => ({ query, release() {} });
  pool.query = query;
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(customerDebtMigration);
    await db.exec(cashbookMigration);
    await db.exec(`INSERT INTO branches(code,name) VALUES('TEST','Test');`);

    const firstImage = await saveProductImage({ branchId: 1, buffer: webp });
    const base = {
      branchId: 1, type: 'service', name: 'Gội đầu', category: 'Dịch vụ', salePrice: 100000, costPrice: 0,
      active: true, durationMinutes: 30, commissionType: null, commissionRate: 0, imageUrl: firstImage,
    };
    const created = await createInventoryItem(base);

    await t.test('the POS catalog returns the image URL', async () => {
      const pos = await listPosProducts({ branchId: 1, customerId: null, search: '', type: 'service' });
      assert.equal(pos.rows[0].imageUrl, firstImage);
    });

    await t.test('replacing the image deletes the previous file after saving', async () => {
      const secondImage = await saveProductImage({ branchId: 1, buffer: webp });
      await updateInventoryItem({ ...base, id: created.itemId, code: created.code, imageUrl: secondImage });
      assert.equal(existsSync(fileOf(firstImage)), false);
      assert.equal(existsSync(fileOf(secondImage)), true);

      // Saving the same image again keeps its file; removing the image deletes it.
      await updateInventoryItem({ ...base, id: created.itemId, code: created.code, imageUrl: secondImage });
      assert.equal(existsSync(fileOf(secondImage)), true);
      await updateInventoryItem({ ...base, id: created.itemId, code: created.code, imageUrl: '' });
      assert.equal(existsSync(fileOf(secondImage)), false);
    });
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
    rmSync(uploadDir, { recursive: true, force: true });
  }
});
