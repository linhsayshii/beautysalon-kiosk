import { listSort } from '../../lib/list-sort.js';
import { pool } from '../../db.js';
import { HttpError } from '../../lib/http.js';
import { broadcastToBranch, realtimeEvents } from '../../lib/ws.js';
import { recordCashEntry } from '../cashbook/cashbook.ledger.js';
import { deleteProductImage } from '../media/media.storage.js';

const number = (value) => Number(value ?? 0);

const goodsCte = `
  WITH goods AS (
    SELECT
      p.branch_id, 'product'::text AS item_type, p.id AS item_id, p.sku AS code, p.name,
      p.category, p.brand, p.unit, p.sale_price, p.cost_price,
      p.last_purchase_price, COALESCE(ib.quantity, 0) AS stock_quantity,
      p.min_stock, p.max_stock, p.active, p.commission_type, p.commission_rate, p.barcode, p.image_url,
      NULL::varchar AS tour_commission_type, 0::numeric AS tour_commission_rate
    FROM products p
    LEFT JOIN inventory_balances ib ON ib.product_id = p.id AND ib.branch_id = p.branch_id
    UNION ALL
    SELECT
      s.branch_id, 'service'::text, s.id, s.code, s.name,
      s.category, s.brand, 'lần'::varchar, s.price, s.cost_price,
      0::numeric, NULL::numeric, 0::numeric, NULL::numeric, s.active, s.commission_type, s.commission_rate, NULL::varchar, s.image_url,
      s.tour_commission_type, s.tour_commission_rate
    FROM services s
    UNION ALL
    SELECT
      sp.branch_id, 'package'::text, sp.id, sp.code, sp.name,
      sp.category, sp.brand, 'gói'::varchar, sp.list_price, sp.cost_price,
      0::numeric, NULL::numeric, 0::numeric, NULL::numeric, sp.active, sp.commission_type, sp.commission_rate, NULL::varchar, sp.image_url,
      NULL::varchar, 0::numeric
    FROM service_packages sp
    UNION ALL
    SELECT
      ac.branch_id, 'account_card'::text, ac.id, ac.code, ac.name,
      ac.category, ac.brand, 'thẻ'::varchar, ac.sale_price, 0::numeric,
      0::numeric, NULL::numeric, 0::numeric, NULL::numeric, ac.active, ac.commission_type, ac.commission_rate, NULL::varchar, ac.image_url,
      NULL::varchar, 0::numeric
    FROM account_cards ac
  )
`;

function mapProduct(row) {
  return {
    id: `${row.item_type}:${row.item_id}`,
    itemId: number(row.item_id),
    itemType: row.item_type,
    code: row.code,
    barcode: row.barcode || '',
    name: row.name,
    category: row.category,
    brand: row.brand,
    unit: row.unit,
    salePrice: number(row.sale_price),
    costPrice: number(row.cost_price),
    lastPurchasePrice: number(row.last_purchase_price),
    stockQuantity: row.stock_quantity === null ? null : number(row.stock_quantity),
    minStock: number(row.min_stock),
    maxStock: row.max_stock === null ? null : number(row.max_stock),
    active: row.active,
    commissionType: row.commission_type,
    commissionRate: parseFloat(row.commission_rate) || 0,
    tourCommissionType: row.tour_commission_type ?? null,
    tourCommissionRate: parseFloat(row.tour_commission_rate) || 0,
    imageUrl: row.image_url || '',
  };
}

const itemSources = {
  product: { table: 'products', codeColumn: 'sku', prefix: 'SP' },
  service: { table: 'services', codeColumn: 'code', prefix: 'DV' },
  package: { table: 'service_packages', codeColumn: 'code', prefix: 'GDV' },
  account_card: { table: 'account_cards', codeColumn: 'code', prefix: 'TTK' },
};

export async function getInventoryItem({ branchId, type, id }) {
  const source = itemSources[type];
  if (!source) throw new HttpError(400, 'INVALID_TYPE', 'Loại hàng không hợp lệ');

  if (type === 'product') {
    const result = await pool.query(
      `SELECT p.*, COALESCE(ib.quantity, 0) AS stock_quantity
       FROM products p LEFT JOIN inventory_balances ib ON ib.branch_id = p.branch_id AND ib.product_id = p.id
       WHERE p.branch_id = $1 AND p.id = $2`, [branchId, id],
    );
    const row = result.rows[0];
    if (!row) throw new HttpError(404, 'ITEM_NOT_FOUND', 'Không tìm thấy hàng hóa');
    return {
      ...mapProduct({ ...row, item_type: type, item_id: row.id, code: row.sku }),
      barcode: row.barcode, imageUrl: row.image_url, description: row.description, note: row.note,
      initialStock: number(row.stock_quantity),
    };
  }

  if (type === 'service') {
    const result = await pool.query('SELECT * FROM services WHERE branch_id = $1 AND id = $2', [branchId, id]);
    const row = result.rows[0];
    if (!row) throw new HttpError(404, 'ITEM_NOT_FOUND', 'Không tìm thấy hàng hóa');
    return {
      id: `${type}:${row.id}`, itemId: number(row.id), itemType: type, code: row.code, name: row.name,
      category: row.category, brand: row.brand, unit: 'lần', salePrice: number(row.price), costPrice: number(row.cost_price),
      durationMinutes: number(row.duration_minutes), active: row.active, imageUrl: row.image_url,
      description: row.description, note: row.note, commissionType: row.commission_type, commissionRate: number(row.commission_rate),
      tourCommissionType: row.tour_commission_type, tourCommissionRate: number(row.tour_commission_rate),
    };
  }

  if (type === 'package') {
    const [itemResult, itemsResult] = await Promise.all([
      pool.query('SELECT * FROM service_packages WHERE branch_id = $1 AND id = $2', [branchId, id]),
      pool.query('SELECT service_id, units FROM service_package_items WHERE package_id = $1 ORDER BY id', [id]),
    ]);
    const row = itemResult.rows[0];
    if (!row) throw new HttpError(404, 'ITEM_NOT_FOUND', 'Không tìm thấy hàng hóa');
    return {
      id: `${type}:${row.id}`, itemId: number(row.id), itemType: type, code: row.code, name: row.name,
      category: row.category, brand: row.brand, unit: 'gói', salePrice: number(row.list_price), costPrice: number(row.cost_price),
      validityDays: row.validity_days === null ? null : number(row.validity_days), usageSchedule: row.usage_schedule,
      active: row.active, imageUrl: row.image_url, description: row.description, note: row.note,
      commissionType: row.commission_type, commissionRate: number(row.commission_rate),
      packageItems: itemsResult.rows.map((item) => ({ serviceId: number(item.service_id), units: number(item.units) })),
    };
  }

  const [itemResult, scopeResult] = await Promise.all([
    pool.query('SELECT * FROM account_cards WHERE branch_id = $1 AND id = $2', [branchId, id]),
    pool.query('SELECT item_type, item_id FROM account_card_scope_items WHERE account_card_id = $1 ORDER BY id', [id]),
  ]);
  const row = itemResult.rows[0];
  if (!row) throw new HttpError(404, 'ITEM_NOT_FOUND', 'Không tìm thấy hàng hóa');
  return {
    id: `${type}:${row.id}`, itemId: number(row.id), itemType: type, code: row.code, name: row.name,
    category: row.category, brand: row.brand, unit: 'thẻ', salePrice: number(row.sale_price), costPrice: 0,
    faceValue: number(row.face_value), validityDays: row.validity_days === null ? null : number(row.validity_days), active: row.active,
    imageUrl: row.image_url, description: row.description, note: row.note,
    commissionType: row.commission_type, commissionRate: number(row.commission_rate),
    allowedTypes: [row.allow_products && 'product', row.allow_services && 'service', row.allow_packages && 'package'].filter(Boolean),
    scopeItems: scopeResult.rows.map((item) => ({ itemType: item.item_type, itemId: number(item.item_id) })),
  };
}

async function nextItemCode(client, branchId, type, requestedCode) {
  if (requestedCode) return requestedCode;
  const source = itemSources[type];
  await client.query('SELECT pg_advisory_xact_lock($1)', [branchId]);
  // Only codes shaped like this prefix + digits count: imported SKUs can be
  // 13-digit barcodes or free text. The goods list shows every item type
  // together and imports reuse prefixes across types, so scan all tables.
  const codes = Object.values(itemSources)
    .map((item) => `SELECT ${item.codeColumn} AS code FROM ${item.table} WHERE branch_id = $1`)
    .join(' UNION ALL ');
  const result = await client.query(
    `SELECT COALESCE(MAX(substring(code FROM $2)::bigint), 0) + 1 AS next_number
     FROM (${codes}) item_codes WHERE code ~ $3`,
    [branchId, `^${source.prefix}(\\d{1,15})$`, `^${source.prefix}\\d{1,15}$`],
  );
  return `${source.prefix}${String(number(result.rows[0].next_number)).padStart(6, '0')}`;
}

async function ensureDefaultPricebook(client, branchId) {
  const existing = await client.query(
    'SELECT id FROM pricebooks WHERE branch_id = $1 AND is_default ORDER BY created_at, id LIMIT 1',
    [branchId],
  );
  if (existing.rows[0]) {
    await client.query('UPDATE pricebooks SET active = TRUE WHERE id = $1', [existing.rows[0].id]);
    return number(existing.rows[0].id);
  }
  const code = `BG-${branchId}`;
  const result = await client.query(
    `INSERT INTO pricebooks (branch_id, code, name, is_default)
     VALUES ($1, $2, 'Bảng giá chung', TRUE)
     ON CONFLICT (code) DO UPDATE SET active = TRUE, is_default = TRUE
     RETURNING id`,
    [branchId, code],
  );
  return number(result.rows[0].id);
}

export async function resolveApplicablePricebook(client, { branchId, customerId = null }) {
  const result = await client.query(
    `SELECT pb.id, pb.code, pb.name, pb.is_default,
            EXISTS (
              SELECT 1 FROM pricebook_customers pc
              WHERE pc.pricebook_id = pb.id AND pc.customer_id = $2::bigint
            ) AS customer_specific
     FROM pricebooks pb
     JOIN branches b ON b.id = pb.branch_id
     WHERE pb.branch_id = $1
       AND pb.active
       AND (
         pb.is_default
         OR EXISTS (
           SELECT 1 FROM pricebook_customers pc
           WHERE pc.pricebook_id = pb.id AND pc.customer_id = $2::bigint
         )
         OR (
           NOT EXISTS (SELECT 1 FROM pricebook_customers pc WHERE pc.pricebook_id = pb.id)
           AND pb.effective_from IS NOT NULL
           AND pb.effective_to IS NOT NULL
         )
       )
       AND (
         pb.is_default
         OR (
           (pb.effective_from IS NULL OR pb.effective_from <= (CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date)
           AND (pb.effective_to IS NULL OR pb.effective_to >= (CURRENT_TIMESTAMP AT TIME ZONE b.timezone)::date)
         )
       )
     ORDER BY
       CASE
         WHEN EXISTS (
           SELECT 1 FROM pricebook_customers pc
           WHERE pc.pricebook_id = pb.id AND pc.customer_id = $2::bigint
         ) THEN 2
         WHEN NOT pb.is_default THEN 1
         ELSE 0
       END DESC,
       pb.effective_from DESC NULLS LAST,
       pb.created_at DESC,
       pb.id DESC
     LIMIT 1`,
    [branchId, customerId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: number(row.id),
    code: row.code,
    name: row.name,
    isDefault: row.is_default,
    customerSpecific: row.customer_specific,
  };
}

export async function resolvePricebookItemPrice(client, { branchId, pricebookId, itemType, itemId, basePrice }) {
  if (!pricebookId) return number(basePrice);
  const result = await client.query(
    `SELECT COALESCE(selected.sale_price, fallback.sale_price, $5::numeric) AS sale_price
     FROM (SELECT 1) seed
     LEFT JOIN pricebook_items selected
       ON selected.pricebook_id = $2 AND selected.item_type = $3 AND selected.item_id = $4
     LEFT JOIN pricebooks default_book
       ON default_book.branch_id = $1 AND default_book.is_default
     LEFT JOIN pricebook_items fallback
       ON fallback.pricebook_id = default_book.id AND fallback.item_type = $3 AND fallback.item_id = $4
     LIMIT 1`,
    [branchId, pricebookId, itemType, itemId, basePrice],
  );
  return number(result.rows[0]?.sale_price ?? basePrice);
}

async function validateScopedItems(client, branchId, items) {
  const grouped = new Map();
  for (const item of items) {
    const ids = grouped.get(item.itemType) ?? [];
    ids.push(item.itemId);
    grouped.set(item.itemType, ids);
  }
  for (const [itemType, ids] of grouped) {
    const source = itemSources[itemType];
    if (!source || itemType === 'account_card') throw new HttpError(400, 'INVALID_SCOPE_ITEM', 'Phạm vi thẻ có hàng hóa không hợp lệ');
    const result = await client.query(
      `SELECT id FROM ${source.table} WHERE branch_id = $1 AND active AND id = ANY($2::bigint[])`,
      [branchId, [...new Set(ids)]],
    );
    if (result.rowCount !== new Set(ids).size) throw new HttpError(400, 'INVALID_SCOPE_ITEM', 'Phạm vi thẻ có hàng hóa không tồn tại');
  }
}

export async function createInventoryItem({
  branchId, type, name, code: requestedCode, category, brand, salePrice, costPrice, active,
  imageUrl, description, note, barcode, unit, initialStock, minStock, maxStock, durationMinutes,
  validityDays, usageSchedule, packageItems, faceValue, allowedTypes, scopeItems, commissionType, commissionRate,
  tourCommissionType = null, tourCommissionRate = 0,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const code = await nextItemCode(client, branchId, type, requestedCode);
    let created;

    if (type === 'product') {
      const result = await client.query(
        `INSERT INTO products (
          branch_id, sku, name, barcode, sale_price, cost_price, last_purchase_price,
          min_stock, max_stock, category, brand, unit, active, image_url, description, note, commission_type, commission_rate
        ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id`,
        [branchId, code, name, barcode || null, salePrice, costPrice, minStock, maxStock, category, brand || null, unit, active, imageUrl || null, description || null, note || null, commissionType, commissionRate],
      );
      created = result.rows[0];
      await client.query(
        'INSERT INTO inventory_balances (branch_id, product_id, quantity) VALUES ($1, $2, $3)',
        [branchId, created.id, initialStock],
      );
    } else if (type === 'service') {
      const result = await client.query(
        `INSERT INTO services (
          branch_id, code, name, price, cost_price, duration_minutes, category, brand,
          active, image_url, description, note, commission_type, commission_rate, tour_commission_type, tour_commission_rate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id`,
        [branchId, code, name, salePrice, costPrice, durationMinutes, category, brand || null, active, imageUrl || null, description || null, note || null, commissionType, commissionRate, tourCommissionType, tourCommissionRate],
      );
      created = result.rows[0];
    } else if (type === 'package') {
      const serviceIds = packageItems.map((item) => item.serviceId);
      const services = await client.query(
        'SELECT id, price FROM services WHERE branch_id = $1 AND active AND id = ANY($2::bigint[])',
        [branchId, [...new Set(serviceIds)]],
      );
      if (services.rowCount !== new Set(serviceIds).size) throw new HttpError(400, 'INVALID_PACKAGE_SERVICE', 'Gói có dịch vụ không hợp lệ');
      const totalUnits = packageItems.reduce((sum, item) => sum + item.units, 0);
      const result = await client.query(
        `INSERT INTO service_packages (
          branch_id, code, name, total_units, validity_days, list_price, cost_price,
          category, brand, active, image_url, description, note, usage_schedule, commission_type, commission_rate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id`,
        [branchId, code, name, totalUnits, validityDays, salePrice, costPrice, category, brand || null, active, imageUrl || null, description || null, note || null, usageSchedule, commissionType, commissionRate],
      );
      created = result.rows[0];
      const priceByService = new Map(services.rows.map((row) => [number(row.id), number(row.price)]));
      for (const item of packageItems) {
        await client.query(
          'INSERT INTO service_package_items (package_id, service_id, units, unit_price) VALUES ($1, $2, $3, $4)',
          [created.id, item.serviceId, item.units, priceByService.get(item.serviceId) ?? 0],
        );
      }
    } else {
      await validateScopedItems(client, branchId, scopeItems);
      const result = await client.query(
        `INSERT INTO account_cards (
          branch_id, code, name, category, brand, sale_price, face_value, validity_days,
          allow_products, allow_services, allow_packages, active, image_url, description, note, commission_type, commission_rate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id`,
        [branchId, code, name, category, brand || null, salePrice, faceValue, validityDays,
          allowedTypes.includes('product'), allowedTypes.includes('service'), allowedTypes.includes('package'),
          active, imageUrl || null, description || null, note || null, commissionType, commissionRate],
      );
      created = result.rows[0];
      for (const item of scopeItems) {
        await client.query(
          'INSERT INTO account_card_scope_items (account_card_id, item_type, item_id) VALUES ($1, $2, $3)',
          [created.id, item.itemType, item.itemId],
        );
      }
    }

    const pricebookId = await ensureDefaultPricebook(client, branchId);
    await client.query(
      `INSERT INTO pricebook_items (pricebook_id, item_type, item_id, sale_price)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pricebook_id, item_type, item_id) DO UPDATE SET sale_price = EXCLUDED.sale_price, updated_at = NOW()`,
      [pricebookId, type, created.id, salePrice],
    );
    await client.query('COMMIT');
    return { itemId: number(created.id), itemType: type, code, name, salePrice };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new HttpError(409, 'DUPLICATE_ITEM', 'Mã hàng hoặc mã vạch đã tồn tại');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateInventoryItem({
  branchId, type, id, name, code, category, brand, salePrice, costPrice, active,
  imageUrl, description, note, barcode, unit, minStock, maxStock, durationMinutes,
  validityDays, usageSchedule, packageItems, faceValue, allowedTypes, scopeItems, stockQuantity, commissionType, commissionRate,
  tourCommissionType = null, tourCommissionRate = 0,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [branchId]);

    const source = itemSources[type];
    if (!source) throw new HttpError(400, 'INVALID_TYPE', 'Loại hàng không hợp lệ');

    const existing = await client.query(`SELECT id, ${source.codeColumn} AS code, image_url FROM ${source.table} WHERE branch_id = $1 AND id = $2`, [branchId, id]);
    if (!existing.rows[0]) throw new HttpError(404, 'ITEM_NOT_FOUND', 'Không tìm thấy hàng hóa');

    const finalCode = code ? code.trim().toUpperCase() : existing.rows[0].code;
    if (finalCode !== existing.rows[0].code) {
      const codeCheck = await client.query(`SELECT id FROM ${source.table} WHERE ${source.codeColumn} = $1 AND id <> $2`, [finalCode, id]);
      if (codeCheck.rows[0]) throw new HttpError(409, 'DUPLICATE_CODE', 'Mã hàng đã tồn tại');
    }

    if (type === 'product') {
      await client.query(
        `UPDATE products SET
           sku = $1,
           name = $2,
           barcode = $3,
           sale_price = $4,
           cost_price = $5,
           min_stock = $6,
           max_stock = $7,
           category = $8,
           brand = $9,
           unit = $10,
           active = $11,
           image_url = $12,
           description = $13,
           note = $14,
           commission_type = $15,
           commission_rate = $16
         WHERE branch_id = $17 AND id = $18`,
        [finalCode, name, barcode || null, salePrice, costPrice, minStock, maxStock, category, brand || null, unit, active, imageUrl || null, description || null, note || null, commissionType, commissionRate, branchId, id],
      );
      if (stockQuantity !== undefined) {
        await client.query(
          `INSERT INTO inventory_balances (branch_id, product_id, quantity, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (branch_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
          [branchId, id, stockQuantity],
        );
      }
    } else if (type === 'service') {
      await client.query(
        `UPDATE services SET
           code = $1,
           name = $2,
           price = $3,
           cost_price = $4,
           duration_minutes = $5,
           category = $6,
           brand = $7,
           active = $8,
           image_url = $9,
           description = $10,
           note = $11,
           commission_type = $12,
           commission_rate = $13,
           tour_commission_type = $16,
           tour_commission_rate = $17
         WHERE branch_id = $14 AND id = $15`,
        [finalCode, name, salePrice, costPrice, durationMinutes, category, brand || null, active, imageUrl || null, description || null, note || null, commissionType, commissionRate, branchId, id, tourCommissionType, tourCommissionRate],
      );
    } else if (type === 'package') {
      let totalUnits = undefined;
      if (packageItems && packageItems.length > 0) {
        const serviceIds = packageItems.map((item) => item.serviceId);
        const services = await client.query(
          'SELECT id, price FROM services WHERE branch_id = $1 AND active AND id = ANY($2::bigint[])',
          [branchId, [...new Set(serviceIds)]],
        );
        if (services.rowCount !== new Set(serviceIds).size) throw new HttpError(400, 'INVALID_PACKAGE_SERVICE', 'Gói có dịch vụ không hợp lệ');
        totalUnits = packageItems.reduce((sum, item) => sum + item.units, 0);

        await client.query('DELETE FROM service_package_items WHERE package_id = $1', [id]);
        const priceByService = new Map(services.rows.map((row) => [number(row.id), number(row.price)]));
        for (const item of packageItems) {
          await client.query(
            'INSERT INTO service_package_items (package_id, service_id, units, unit_price) VALUES ($1, $2, $3, $4)',
            [id, item.serviceId, item.units, priceByService.get(item.serviceId) ?? 0],
          );
        }
      }

      await client.query(
        `UPDATE service_packages SET
           code = $1,
           name = $2,
           total_units = COALESCE($3, total_units),
           validity_days = $4,
           list_price = $5,
           cost_price = $6,
           category = $7,
           brand = $8,
           active = $9,
           image_url = $10,
           description = $11,
           note = $12,
           usage_schedule = $13,
           commission_type = $14,
           commission_rate = $15
         WHERE branch_id = $16 AND id = $17`,
        [finalCode, name, totalUnits ?? null, validityDays, salePrice, costPrice, category, brand || null, active, imageUrl || null, description || null, note || null, usageSchedule, commissionType, commissionRate, branchId, id],
      );
    } else if (type === 'account_card') {
      if (scopeItems) {
        await validateScopedItems(client, branchId, scopeItems);
        await client.query('DELETE FROM account_card_scope_items WHERE account_card_id = $1', [id]);
        for (const item of scopeItems) {
          await client.query(
            'INSERT INTO account_card_scope_items (account_card_id, item_type, item_id) VALUES ($1, $2, $3)',
            [id, item.itemType, item.itemId],
          );
        }
      }

      await client.query(
        `UPDATE account_cards SET
           code = $1,
           name = $2,
           category = $3,
           brand = $4,
           sale_price = $5,
           face_value = COALESCE($6, face_value),
           validity_days = $7,
           allow_products = COALESCE($8, allow_products),
           allow_services = COALESCE($9, allow_services),
           allow_packages = COALESCE($10, allow_packages),
           active = $11,
           image_url = $12,
           description = $13,
           note = $14,
           commission_type = $15,
           commission_rate = $16
         WHERE branch_id = $17 AND id = $18`,
        [
          finalCode, name, category, brand || null, salePrice, faceValue || null, validityDays,
          allowedTypes ? allowedTypes.includes('product') : null,
          allowedTypes ? allowedTypes.includes('service') : null,
          allowedTypes ? allowedTypes.includes('package') : null,
          active, imageUrl || null, description || null, note || null, commissionType, commissionRate, branchId, id,
        ],
      );
    }

    // Cập nhật bảng giá mặc định
    const pricebookId = await ensureDefaultPricebook(client, branchId);
    await client.query(
      `INSERT INTO pricebook_items (pricebook_id, item_type, item_id, sale_price)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pricebook_id, item_type, item_id) DO UPDATE SET sale_price = EXCLUDED.sale_price, updated_at = NOW()`,
      [pricebookId, type, id, salePrice],
    );

    await client.query('COMMIT');
    const previousImageUrl = existing.rows[0].image_url;
    if (previousImageUrl && previousImageUrl !== (imageUrl || null)) {
      // The file is only unreachable once the new URL is committed; a failed cleanup just leaves an orphan.
      await deleteProductImage({ branchId, url: previousImageUrl }).catch((error) => console.error('[media] could not delete replaced product image', error));
    }
    return { itemId: number(id), itemType: type, code: finalCode, name, salePrice, active };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new HttpError(409, 'DUPLICATE_ITEM', 'Mã hàng hoặc mã vạch đã tồn tại');
    throw error;
  } finally {
    client.release();
  }
}

export async function listProducts({ branchId, search, type, category, stockStatus, status, page, pageSize, offset }) {
  const parameters = [branchId, search, type, category, stockStatus, status];
  const filters = `
    branch_id = $1
    AND ($2 = '' OR code ILIKE '%' || $2 || '%' OR COALESCE(barcode, '') ILIKE '%' || $2 || '%' OR name ILIKE '%' || $2 || '%' OR COALESCE(brand, '') ILIKE '%' || $2 || '%')
    AND ($3 = '' OR item_type = $3)
    AND ($4 = '' OR category = $4)
    AND ($5 = '' OR ($5 = 'low' AND item_type = 'product' AND stock_quantity < min_stock)
      OR ($5 = 'in_stock' AND item_type = 'product' AND stock_quantity > 0)
      OR ($5 = 'out' AND item_type = 'product' AND stock_quantity <= 0))
    AND ($6 = '' OR ($6 = 'active' AND active) OR ($6 = 'inactive' AND NOT active))
  `;
  const [rowsResult, categoriesResult, summaryResult] = await Promise.all([
    pool.query(`${goodsCte}
      SELECT *, COUNT(*) OVER() AS filtered_total
      FROM goods WHERE ${filters}
      ORDER BY active DESC, item_type, code DESC
      LIMIT $7 OFFSET $8`, [...parameters, pageSize, offset]),
    pool.query(`${goodsCte} SELECT DISTINCT category FROM goods WHERE branch_id = $1 ORDER BY category`, [branchId]),
    pool.query(`${goodsCte}
      SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE item_type = 'product') AS products,
        COUNT(*) FILTER (WHERE item_type = 'service') AS services,
        COUNT(*) FILTER (WHERE item_type = 'package') AS packages,
        COUNT(*) FILTER (WHERE item_type = 'account_card') AS account_cards,
        COUNT(*) FILTER (WHERE item_type = 'product' AND stock_quantity < min_stock) AS low_stock
      FROM goods WHERE branch_id = $1`, [branchId]),
  ]);
  const total = number(rowsResult.rows[0]?.filtered_total);
  return {
    rows: rowsResult.rows.map(mapProduct),
    categories: categoriesResult.rows.map((row) => row.category),
    summary: Object.fromEntries(Object.entries(summaryResult.rows[0]).map(([key, value]) => [key, number(value)])),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function listPosProducts({ branchId, customerId, search, type, page = 1, pageSize = 100, offset = 0 }) {
  const pricebook = await resolveApplicablePricebook(pool, { branchId, customerId });
  const result = await pool.query(
    `${goodsCte}
     SELECT g.*, COUNT(*) OVER() AS filtered_total,
       COALESCE(selected.sale_price, fallback.sale_price, g.sale_price) AS resolved_sale_price
     FROM goods g
     LEFT JOIN pricebook_items selected
       ON selected.pricebook_id = $3 AND selected.item_type = g.item_type AND selected.item_id = g.item_id
     LEFT JOIN pricebooks default_book
       ON default_book.branch_id = $1 AND default_book.is_default
     LEFT JOIN pricebook_items fallback
       ON fallback.pricebook_id = default_book.id AND fallback.item_type = g.item_type AND fallback.item_id = g.item_id
     WHERE g.branch_id = $1
       AND g.active
       AND ($2 = '' OR g.item_type = $2)
       AND ($4 = '' OR g.code ILIKE '%' || $4 || '%' OR COALESCE(g.barcode, '') ILIKE '%' || $4 || '%' OR g.name ILIKE '%' || $4 || '%' OR COALESCE(g.brand, '') ILIKE '%' || $4 || '%')
     -- A scanned barcode or typed code that matches exactly comes first.
     ORDER BY (g.barcode = $4 OR g.code = $4) IS TRUE DESC, g.item_type, g.code DESC
     LIMIT $5 OFFSET $6`,
    [branchId, type, pricebook?.id ?? null, search, pageSize, offset],
  );
  const total = number(result.rows[0]?.filtered_total);
  return {
    rows: result.rows.map((row) => mapProduct({ ...row, sale_price: row.resolved_sale_price })),
    pricebook,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function quotePosPrices({ branchId, customerId, items }) {
  const uniqueItems = [...new Map(items.map((item) => [`${item.itemType}:${item.itemId}`, item])).values()];
  if (!uniqueItems.length) return { rows: [], pricebook: null };
  const pricebook = await resolveApplicablePricebook(pool, { branchId, customerId });
  const values = [];
  const parameters = [branchId, pricebook?.id ?? null];
  const tuples = uniqueItems.map((item) => {
    parameters.push(item.itemType, item.itemId);
    const index = parameters.length - 1;
    values.push(`${item.itemType}:${item.itemId}`);
    return `($${index}::text, $${index + 1}::bigint)`;
  });
  const result = await pool.query(
    `${goodsCte}, requested(item_type, item_id) AS (VALUES ${tuples.join(', ')})
     SELECT g.item_type, g.item_id,
       COALESCE(selected.sale_price, fallback.sale_price, g.sale_price) AS sale_price
     FROM requested r
     JOIN goods g ON g.branch_id = $1 AND g.item_type = r.item_type AND g.item_id = r.item_id
     LEFT JOIN pricebook_items selected
       ON selected.pricebook_id = $2 AND selected.item_type = g.item_type AND selected.item_id = g.item_id
     LEFT JOIN pricebooks default_book
       ON default_book.branch_id = $1 AND default_book.is_default
     LEFT JOIN pricebook_items fallback
       ON fallback.pricebook_id = default_book.id AND fallback.item_type = g.item_type AND fallback.item_id = g.item_id`,
    parameters,
  );
  if (result.rowCount !== new Set(values).size) {
    throw new HttpError(404, 'ITEM_NOT_FOUND', 'Có hàng hóa không còn tồn tại trong chi nhánh');
  }
  return {
    rows: result.rows.map((row) => ({ itemType: row.item_type, itemId: number(row.item_id), salePrice: number(row.sale_price) })),
    pricebook,
  };
}

export async function listPricebooks({ branchId, pricebookId, search, category, page, pageSize, offset }) {
  const booksResult = await pool.query(
    `SELECT pb.id, pb.code, pb.name, pb.active, pb.is_default, pb.effective_from, pb.effective_to,
            COUNT(pc.customer_id)::integer AS customer_count
     FROM pricebooks pb
     LEFT JOIN pricebook_customers pc ON pc.pricebook_id = pb.id
     WHERE pb.branch_id = $1
     GROUP BY pb.id
     ORDER BY pb.is_default DESC, pb.active DESC, pb.created_at DESC, pb.id DESC`,
    [branchId],
  );
  const book = pricebookId
    ? booksResult.rows.find((row) => number(row.id) === number(pricebookId))
    : booksResult.rows[0];
  if (!book) {
    return {
      pricebook: null,
      pricebooks: [],
      categories: [],
      rows: [],
      pagination: { page, pageSize, total: 0, totalPages: 1 },
    };
  }
  const parameters = [branchId, book.id, search, category];
  const [result, categoriesResult] = await Promise.all([
    pool.query(`${goodsCte}
      SELECT g.*, COALESCE(pbi.sale_price, g.sale_price) AS book_price, pbi.updated_at,
        COUNT(*) OVER() AS filtered_total
      FROM goods g
      LEFT JOIN pricebook_items pbi ON pbi.pricebook_id = $2 AND pbi.item_type = g.item_type AND pbi.item_id = g.item_id
      WHERE g.branch_id = $1
        AND ($3 = '' OR g.code ILIKE '%' || $3 || '%' OR g.name ILIKE '%' || $3 || '%')
        AND ($4 = '' OR g.category = $4)
      ORDER BY g.item_type, g.code DESC
      LIMIT $5 OFFSET $6`, [...parameters, pageSize, offset]),
    pool.query(`${goodsCte} SELECT DISTINCT category FROM goods WHERE branch_id = $1 ORDER BY category`, [branchId]),
  ]);
  const total = number(result.rows[0]?.filtered_total);
  return {
    pricebook: { id: number(book.id), code: book.code, name: book.name, active: book.active, isDefault: book.is_default },
    pricebooks: booksResult.rows.map((row) => ({
      id: number(row.id), code: row.code, name: row.name, active: row.active, isDefault: row.is_default,
      effectiveFrom: row.effective_from, effectiveTo: row.effective_to, customerCount: number(row.customer_count),
    })),
    categories: categoriesResult.rows.map((row) => row.category),
    rows: result.rows.map((row) => ({ ...mapProduct(row), bookPrice: number(row.book_price), updatedAt: row.updated_at })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function updatePricebookItem({ branchId, pricebookId, itemType, itemId, salePrice }) {
  const book = await pool.query('SELECT id FROM pricebooks WHERE id = $1 AND branch_id = $2', [pricebookId, branchId]);
  if (!book.rows[0]) throw new HttpError(404, 'PRICEBOOK_NOT_FOUND', 'Không tìm thấy bảng giá');
  const source = itemSources[itemType];
  const item = await pool.query(`SELECT id FROM ${source.table} WHERE id = $1 AND branch_id = $2 AND active`, [itemId, branchId]);
  if (!item.rows[0]) throw new HttpError(404, 'ITEM_NOT_FOUND', 'Không tìm thấy hàng hóa trong chi nhánh hiện tại');
  const result = await pool.query(
    `INSERT INTO pricebook_items (pricebook_id, item_type, item_id, sale_price)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (pricebook_id, item_type, item_id)
     DO UPDATE SET sale_price = EXCLUDED.sale_price, updated_at = NOW()
     RETURNING sale_price, updated_at`,
    [pricebookId, itemType, itemId, salePrice],
  );
  return { itemType, itemId, salePrice: number(result.rows[0].sale_price), updatedAt: result.rows[0].updated_at };
}

export async function getPricebook({ branchId, id }) {
  const [result, customersResult] = await Promise.all([
    pool.query(
      'SELECT id, code, name, active, is_default, effective_from, effective_to, created_at FROM pricebooks WHERE id = $1 AND branch_id = $2',
      [id, branchId],
    ),
    pool.query(
      `SELECT c.id, c.code, c.name, c.phone
       FROM pricebook_customers pc
       JOIN customers c ON c.id = pc.customer_id
       WHERE pc.pricebook_id = $1 AND c.branch_id = $2
       ORDER BY c.name, c.id`,
      [id, branchId],
    ),
  ]);
  if (!result.rows[0]) throw new HttpError(404, 'PRICEBOOK_NOT_FOUND', 'Không tìm thấy bảng giá');
  const row = result.rows[0];
  return {
    id: number(row.id),
    code: row.code,
    name: row.name,
    active: row.active,
    isDefault: row.is_default,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    customers: customersResult.rows.map((customer) => ({
      id: number(customer.id), code: customer.code, name: customer.name, phone: customer.phone,
    })),
    createdAt: row.created_at,
  };
}

async function validatePricebookCustomers(client, branchId, customerIds) {
  const uniqueIds = [...new Set(customerIds)];
  if (!uniqueIds.length) return uniqueIds;
  const result = await client.query(
    'SELECT id FROM customers WHERE branch_id = $1 AND id = ANY($2::bigint[])',
    [branchId, uniqueIds],
  );
  if (result.rowCount !== uniqueIds.length) {
    throw new HttpError(400, 'INVALID_PRICEBOOK_CUSTOMER', 'Có khách hàng không thuộc chi nhánh hiện tại');
  }
  return uniqueIds;
}

export function validatePricebookScope({ customerIds, effectiveFrom, effectiveTo }) {
  if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
    throw new HttpError(400, 'INVALID_DATE_RANGE', 'Ngày bắt đầu phải trước ngày kết thúc');
  }
  if (!customerIds.length && (!effectiveFrom || !effectiveTo)) {
    throw new HttpError(400, 'PRICEBOOK_SCOPE_REQUIRED', 'Bảng giá chung theo thời gian phải có đủ ngày bắt đầu và ngày kết thúc');
  }
}

export async function listPricebookCustomerOptions({ branchId, search, selectedIds = [] }) {
  const result = await pool.query(
    `SELECT id, code, name, phone
     FROM customers
     WHERE branch_id = $1
       AND ($2 = '' OR code ILIKE '%' || $2 || '%' OR name ILIKE '%' || $2 || '%' OR COALESCE(phone, '') ILIKE '%' || $2 || '%'
            OR id = ANY($3::bigint[]))
     ORDER BY (id = ANY($3::bigint[])) DESC, name, id
     LIMIT 50`,
    [branchId, search, selectedIds],
  );
  return result.rows.map((row) => ({ id: number(row.id), code: row.code, name: row.name, phone: row.phone }));
}

export async function createPricebook({ branchId, code, name, active, effectiveFrom, effectiveTo, customerIds = [], copyFromDefault }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [branchId]);

    // Check unique code
    const existingCode = await client.query('SELECT id FROM pricebooks WHERE code = $1', [code]);
    if (existingCode.rows[0]) throw new HttpError(400, 'DUPLICATE_CODE', 'Mã bảng giá đã tồn tại');

    const validCustomerIds = await validatePricebookCustomers(client, branchId, customerIds);
    validatePricebookScope({ customerIds: validCustomerIds, effectiveFrom, effectiveTo });

    // Get default pricebook ID for copying prices
    let defaultPricebookId = null;
    if (copyFromDefault) {
      const defaultBook = await client.query('SELECT id FROM pricebooks WHERE branch_id = $1 AND is_default = TRUE', [branchId]);
      if (defaultBook.rows[0]) defaultPricebookId = number(defaultBook.rows[0].id);
    }

    const result = await client.query(
      `INSERT INTO pricebooks (branch_id, code, name, active, is_default, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, FALSE, $5, $6)
       RETURNING id`,
      [branchId, code, name, active ?? true, effectiveFrom || null, effectiveTo || null],
    );
    const pricebookId = number(result.rows[0].id);

    for (const customerId of validCustomerIds) {
      await client.query(
        'INSERT INTO pricebook_customers (pricebook_id, customer_id) VALUES ($1, $2)',
        [pricebookId, customerId],
      );
    }

    // Copy prices from default pricebook if requested
    if (defaultPricebookId) {
      await client.query(
        `INSERT INTO pricebook_items (pricebook_id, item_type, item_id, sale_price)
         SELECT $1, item_type, item_id, sale_price
         FROM pricebook_items WHERE pricebook_id = $2`,
        [pricebookId, defaultPricebookId],
      );
    }

    await client.query('COMMIT');
    return getPricebook({ branchId, id: pricebookId });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePricebook({ branchId, id, name, active, effectiveFrom, effectiveTo, customerIds }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pricebook = await client.query(
      'SELECT is_default, effective_from, effective_to FROM pricebooks WHERE id = $1 AND branch_id = $2 FOR UPDATE',
      [id, branchId],
    );
    if (!pricebook.rows[0]) throw new HttpError(404, 'PRICEBOOK_NOT_FOUND', 'Không tìm thấy bảng giá');
    const row = pricebook.rows[0];
    if (row.is_default) {
      if (active === false) throw new HttpError(400, 'CANNOT_DISABLE_DEFAULT', 'Không thể ngừng bảng giá chung');
      await client.query('UPDATE pricebooks SET name = COALESCE($3, name), active = TRUE WHERE id = $1 AND branch_id = $2', [id, branchId, name]);
    } else {
      const currentCustomers = await client.query('SELECT customer_id FROM pricebook_customers WHERE pricebook_id = $1', [id]);
      const nextCustomerIds = customerIds === undefined
        ? currentCustomers.rows.map((item) => number(item.customer_id))
        : await validatePricebookCustomers(client, branchId, customerIds);
      const nextEffectiveFrom = effectiveFrom === undefined ? row.effective_from : effectiveFrom;
      const nextEffectiveTo = effectiveTo === undefined ? row.effective_to : effectiveTo;
      validatePricebookScope({ customerIds: nextCustomerIds, effectiveFrom: nextEffectiveFrom, effectiveTo: nextEffectiveTo });
      await client.query(
        `UPDATE pricebooks SET
           name = COALESCE($3, name), active = COALESCE($4, active),
           effective_from = $5, effective_to = $6
         WHERE id = $1 AND branch_id = $2`,
        [id, branchId, name, active, nextEffectiveFrom || null, nextEffectiveTo || null],
      );
      if (customerIds !== undefined) {
        await client.query('DELETE FROM pricebook_customers WHERE pricebook_id = $1', [id]);
        for (const customerId of nextCustomerIds) {
          await client.query('INSERT INTO pricebook_customers (pricebook_id, customer_id) VALUES ($1, $2)', [id, customerId]);
        }
      }
    }
    await client.query('COMMIT');
    return getPricebook({ branchId, id });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePricebook({ branchId, id }) {
  const pricebook = await pool.query('SELECT is_default FROM pricebooks WHERE id = $1 AND branch_id = $2', [id, branchId]);
  if (!pricebook.rows[0]) throw new HttpError(404, 'PRICEBOOK_NOT_FOUND', 'Không tìm thấy bảng giá');
  if (pricebook.rows[0].is_default) throw new HttpError(400, 'CANNOT_DELETE_DEFAULT', 'Không thể xóa bảng giá mặc định');

  await pool.query('DELETE FROM pricebooks WHERE id = $1 AND branch_id = $2', [id, branchId]);
  return { deleted: true };
}

export async function listSuppliers({ branchId, search }) {
  const result = await pool.query(
    `SELECT id, code, name, phone, email, address
     FROM suppliers
     WHERE branch_id = $1 AND active
       AND ($2 = '' OR code ILIKE '%' || $2 || '%' OR name ILIKE '%' || $2 || '%' OR COALESCE(phone, '') ILIKE '%' || $2 || '%')
     ORDER BY name LIMIT 30`,
    [branchId, search],
  );
  return result.rows.map((row) => ({ id: number(row.id), code: row.code, name: row.name, phone: row.phone, email: row.email, address: row.address }));
}

function mapPurchase(row) {
  return {
    id: number(row.id), code: row.code, status: row.status, createdAt: row.created_at,
    receivedAt: row.received_at, subtotal: number(row.subtotal), discount: number(row.discount),
    otherCost: number(row.other_cost), amountDue: number(row.amount_due), amountPaid: number(row.amount_paid),
    paymentMethod: row.payment_method, note: row.note,
    supplier: { id: row.supplier_id ? number(row.supplier_id) : null, code: row.supplier_code, name: row.supplier_name ?? 'Chưa xác định', phone: row.supplier_phone },
    createdBy: row.created_by_name,
    itemCount: number(row.item_count), totalQuantity: number(row.total_quantity),
  };
}

export async function listPurchaseOrders({ branchId, search, status, dateFrom, dateTo, page, pageSize, offset, sort }) {
  const orderBy = listSort(sort, {
    date_desc: 'COALESCE(po.received_at, po.created_at) DESC',
    date_asc: 'COALESCE(po.received_at, po.created_at) ASC',
    total_desc: 'po.amount_due DESC',
    total_asc: 'po.amount_due ASC',
    code_asc: 'po.code ASC',
    code_desc: 'po.code DESC',
  }, 'COALESCE(po.received_at, po.created_at) DESC');
  const parameters = [branchId, search, status, dateFrom, dateTo];
  const filters = `
    po.branch_id = $1
    AND ($2 = '' OR po.code ILIKE '%' || $2 || '%' OR COALESCE(s.name, '') ILIKE '%' || $2 || '%')
    AND ($3 = '' OR po.status = $3)
    AND ($4::date IS NULL OR COALESCE(po.received_at, po.created_at) >= $4::date)
    AND ($5::date IS NULL OR COALESCE(po.received_at, po.created_at) < $5::date + INTERVAL '1 day')
  `;
  const [rowsResult, summaryResult] = await Promise.all([
    pool.query(`SELECT po.*, s.code AS supplier_code, s.name AS supplier_name, s.phone AS supplier_phone,
      st.name AS created_by_name, COALESCE(x.item_count, 0) AS item_count,
      COALESCE(x.total_quantity, 0) AS total_quantity, COUNT(*) OVER() AS filtered_total
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN staff st ON st.id = po.created_by
      LEFT JOIN (SELECT purchase_order_id, COUNT(*) AS item_count, SUM(quantity) AS total_quantity FROM purchase_order_items GROUP BY purchase_order_id) x ON x.purchase_order_id = po.id
      WHERE ${filters}
      ORDER BY ${orderBy}, po.id DESC
      LIMIT $6 OFFSET $7`, [...parameters, pageSize, offset]),
    pool.query(`SELECT COUNT(*) AS total_orders, COALESCE(SUM(po.amount_due), 0) AS total_due,
      COALESCE(SUM(po.amount_due - po.amount_paid), 0) AS total_debt,
      COUNT(*) FILTER (WHERE po.status = 'draft') AS drafts
      FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE ${filters}`, parameters),
  ]);
  const total = number(rowsResult.rows[0]?.filtered_total);
  const summary = summaryResult.rows[0];
  return {
    rows: rowsResult.rows.map(mapPurchase),
    summary: { totalOrders: number(summary.total_orders), totalDue: number(summary.total_due), totalDebt: number(summary.total_debt), drafts: number(summary.drafts) },
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function getPurchaseOrder({ branchId, id }) {
  const headerResult = await pool.query(`SELECT po.*, s.code AS supplier_code, s.name AS supplier_name, s.phone AS supplier_phone,
      st.name AS created_by_name, 0 AS item_count, 0 AS total_quantity
    FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    LEFT JOIN staff st ON st.id = po.created_by
    WHERE po.branch_id = $1 AND po.id = $2`, [branchId, id]);
  if (!headerResult.rows[0]) throw new HttpError(404, 'PURCHASE_ORDER_NOT_FOUND', 'Không tìm thấy phiếu nhập');
  const itemsResult = await pool.query(`SELECT poi.id, p.id AS product_id, p.sku, p.name, p.unit,
      poi.quantity, poi.unit_cost, poi.discount, poi.line_total
    FROM purchase_order_items poi JOIN products p ON p.id = poi.product_id
    WHERE poi.purchase_order_id = $1 ORDER BY poi.id`, [id]);
  return {
    ...mapPurchase(headerResult.rows[0]),
    items: itemsResult.rows.map((row) => ({
      id: number(row.id), productId: number(row.product_id), sku: row.sku, name: row.name, unit: row.unit,
      quantity: number(row.quantity), unitCost: number(row.unit_cost), discount: number(row.discount), lineTotal: number(row.line_total),
    })),
  };
}

export async function createPurchaseOrder({ branchId, supplierId, status, receivedAt, discount, otherCost, amountPaid, paymentMethod, note, items, actorAccountId = null }) {
  const client = await pool.connect();
  let cashEntry = null;
  let orderId;
  try {
    await client.query('BEGIN');
    const supplier = await client.query('SELECT id, name FROM suppliers WHERE id = $1 AND branch_id = $2 AND active', [supplierId, branchId]);
    if (!supplier.rows[0]) throw new HttpError(400, 'INVALID_SUPPLIER', 'Nhà cung cấp không hợp lệ');
    const productIds = items.map((item) => item.productId);
    const products = await client.query('SELECT id FROM products WHERE branch_id = $1 AND active AND id = ANY($2::bigint[])', [branchId, productIds]);
    if (products.rowCount !== new Set(productIds).size) throw new HttpError(400, 'INVALID_PRODUCT', 'Phiếu nhập có sản phẩm không hợp lệ');

    const normalizedItems = items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitCost: item.unitCost,
      discount: item.discount ?? 0,
      lineTotal: Math.max(0, item.quantity * item.unitCost - (item.discount ?? 0)),
    }));
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const amountDue = Math.max(0, subtotal - discount + otherCost);
    await client.query('SELECT pg_advisory_xact_lock($1)', [branchId]);
    const sequence = await client.query(`SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::integer), 0) + 1 AS next_number FROM purchase_orders WHERE branch_id = $1`, [branchId]);
    const code = `PN${String(number(sequence.rows[0].next_number)).padStart(6, '0')}`;
    const orderResult = await client.query(`INSERT INTO purchase_orders (
        branch_id, supplier_id, code, status, received_at, subtotal, discount, other_cost,
        amount_due, amount_paid, payment_method, created_by, note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, $12)
      RETURNING id`, [branchId, supplierId, code, status, status === 'completed' ? (receivedAt ?? new Date()) : receivedAt, subtotal, discount, otherCost, amountDue, Math.min(amountPaid, amountDue), paymentMethod, note]);
    orderId = number(orderResult.rows[0].id);

    for (const item of normalizedItems) {
      await client.query(`INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost, discount, line_total)
        VALUES ($1, $2, $3, $4, $5, $6)`, [orderId, item.productId, item.quantity, item.unitCost, item.discount, item.lineTotal]);
      if (status === 'completed') {
        await client.query(`INSERT INTO inventory_balances (branch_id, product_id, quantity)
          VALUES ($1, $2, $3)
          ON CONFLICT (branch_id, product_id) DO UPDATE SET quantity = inventory_balances.quantity + EXCLUDED.quantity, updated_at = NOW()`, [branchId, item.productId, item.quantity]);
        await client.query('UPDATE products SET last_purchase_price = $1, cost_price = $1 WHERE id = $2 AND branch_id = $3', [item.unitCost, item.productId, branchId]);
      }
    }
    // Only a received order has actually been paid for; drafts record intent.
    if (status === 'completed') {
      cashEntry = await recordCashEntry(client, {
        branchId,
        type: 'expense',
        categoryKey: 'supplier_payment',
        amount: Math.min(amountPaid, amountDue),
        paymentMethod,
        sourceType: 'purchase_order',
        sourceId: orderId,
        counterpartyType: 'supplier',
        counterpartyId: supplierId,
        counterpartyName: supplier.rows[0].name,
        note: `Chi trả phiếu nhập ${code}`,
        createdBy: actorAccountId,
      });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  if (cashEntry) broadcastToBranch(branchId, realtimeEvents.cashbookUpdated, { voucherId: cashEntry.id, action: 'created' });
  return getPurchaseOrder({ branchId, id: orderId });
}
