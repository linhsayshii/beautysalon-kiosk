import { listSort } from '../../lib/list-sort.js';
import { pool } from '../../db.js';
import { HttpError } from '../../lib/http.js';

const number = (value) => Number(value ?? 0);

// A visit is a branch-local day with a completed appointment or a paid
// invoice, so a walk-in POS sale counts and a checked-out appointment is
// not counted twice.
const visitsLateral = `
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT (v.at AT TIME ZONE vb.timezone)::date) AS visit_count, MAX(v.at) AS last_visit
    FROM (
      SELECT a.starts_at AS at FROM appointments a WHERE a.customer_id = c.id AND a.status = 'completed'
      UNION ALL
      SELECT i.issued_at FROM invoices i WHERE i.customer_id = c.id AND i.status = 'paid'
    ) v
    JOIN branches vb ON vb.id = c.branch_id
  ) visits ON TRUE`;

export async function listCustomers({ branchId, search, group, debtStatus, page, pageSize, offset, sort }) {
  const orderBy = listSort(sort, {
    name_asc: 'c.name ASC',
    name_desc: 'c.name DESC',
    debt_desc: 'c.debt_balance DESC',
    debt_asc: 'c.debt_balance ASC',
    lastVisit_desc: 'visits.last_visit DESC NULLS LAST',
    lastVisit_asc: 'visits.last_visit ASC NULLS FIRST',
  }, 'c.created_at DESC');
  const parameters = [branchId, search, group, debtStatus];
  const filters = `
    c.branch_id = $1
    AND ($2 = '' OR c.code ILIKE '%' || $2 || '%' OR c.name ILIKE '%' || $2 || '%' OR c.phone ILIKE '%' || $2 || '%')
    AND ($3 = '' OR c.customer_group = $3)
    AND ($4 = '' OR ($4 = 'with_debt' AND c.debt_balance > 0) OR ($4 = 'no_debt' AND c.debt_balance = 0))
  `;

  const [rowsResult, summaryResult, groupsResult] = await Promise.all([
    pool.query(
      `SELECT
         c.id, c.code, c.name, c.phone, c.customer_type, c.customer_group, c.debt_balance, c.created_at,
         COALESCE(sales.total_spent, 0) AS total_spent,
         visits.last_visit,
         COALESCE(packages.active_packages, 0) AS active_packages,
         COALESCE(pkg_units.remaining_units, 0) AS remaining_units,
         COUNT(*) OVER() AS filtered_total
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT SUM(i.total) AS total_spent FROM invoices i WHERE i.customer_id = c.id AND i.status = 'paid'
       ) sales ON TRUE
       ${visitsLateral}
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS active_packages FROM customer_packages cp WHERE cp.customer_id = c.id AND cp.status = 'active'
       ) packages ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(cp.total_units - cp.used_units), 0) AS remaining_units
         FROM customer_packages cp
         WHERE cp.customer_id = c.id
           AND cp.status = 'active'
           AND (cp.expires_at IS NULL OR cp.expires_at > NOW())
       ) pkg_units ON TRUE
       WHERE ${filters}
       ORDER BY ${orderBy}, c.id DESC
       LIMIT $5 OFFSET $6`,
      [...parameters, pageSize, offset],
    ),
    pool.query(
      `SELECT COUNT(*) AS total_customers,
              COUNT(*) FILTER (WHERE c.debt_balance > 0) AS customers_in_debt,
              COALESCE(SUM(c.debt_balance), 0) AS total_debt
       FROM customers c WHERE ${filters}`,
      parameters,
    ),
    pool.query(
      `SELECT DISTINCT customer_group
       FROM customers
       WHERE branch_id = $1 AND customer_group IS NOT NULL AND customer_group <> ''
       ORDER BY customer_group`,
      [branchId],
    ),
  ]);

  const total = number(rowsResult.rows[0]?.filtered_total);
  const summary = summaryResult.rows[0];
  return {
    rows: rowsResult.rows.map((row) => ({
      id: number(row.id),
      code: row.code,
      name: row.name,
      phone: row.phone,
      customerType: row.customer_type,
      group: row.customer_group,
      debtBalance: number(row.debt_balance),
      totalSpent: number(row.total_spent),
      lastVisit: row.last_visit,
      activePackages: number(row.active_packages),
      remainingPackageUnits: number(row.remaining_units),
      createdAt: row.created_at,
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    summary: {
      totalCustomers: number(summary.total_customers),
      customersInDebt: number(summary.customers_in_debt),
      totalDebt: number(summary.total_debt),
    },
    groups: groupsResult.rows.map((row) => row.customer_group),
  };
}

export async function listCustomerPackages({ branchId, search, status, itemType, page, pageSize, offset, sort }) {
  const orderBy = listSort(sort, {
    soldAt_desc: 'sold_at DESC',
    soldAt_asc: 'sold_at ASC',
    name_asc: 'item_name ASC',
    name_desc: 'item_name DESC',
    price_desc: 'sale_price DESC',
    price_asc: 'sale_price ASC',
  }, 'sold_at DESC');
  const parameters = [branchId, search, status, itemType];
  const filters = `branch_id = $1
    AND ($2 = '' OR code ILIKE '%' || $2 || '%' OR item_name ILIKE '%' || $2 || '%'
      OR customer_code ILIKE '%' || $2 || '%' OR customer_name ILIKE '%' || $2 || '%' OR COALESCE(customer_phone, '') ILIKE '%' || $2 || '%')
    AND ($3 = '' OR status = $3)
    AND ($4 = '' OR item_type = $4)`;
  const result = await pool.query(
    `WITH sold_cards AS (
       SELECT cp.id, 'package'::text AS item_type, cp.package_code AS code,
         sp.code AS template_code, sp.name AS item_name, cp.sale_price,
         cp.total_units, cp.used_units, NULL::numeric AS opening_balance, NULL::numeric AS current_balance,
         cp.sold_at, cp.expires_at, cp.status, cp.branch_id,
         c.code AS customer_code, c.name AS customer_name, c.phone AS customer_phone, c.customer_group
       FROM customer_packages cp
       JOIN service_packages sp ON sp.id = cp.package_id
       JOIN customers c ON c.id = cp.customer_id
       UNION ALL
       SELECT cac.id, 'account_card'::text, cac.card_code,
         ac.code, ac.name, cac.sale_price,
         NULL::integer, NULL::integer, cac.opening_balance, cac.current_balance,
         cac.sold_at, cac.expires_at, cac.status, cac.branch_id,
         c.code, c.name, c.phone, c.customer_group
       FROM customer_account_cards cac
       JOIN account_cards ac ON ac.id = cac.account_card_id
       JOIN customers c ON c.id = cac.customer_id
     )
     SELECT *, COUNT(*) OVER() AS filtered_total,
       COALESCE(SUM(used_units) OVER(), 0) AS total_used,
       COALESCE(SUM(current_balance) OVER(), 0) AS total_balance
     FROM sold_cards WHERE ${filters}
     ORDER BY ${orderBy}, item_type, id DESC
     LIMIT $5 OFFSET $6`,
    [...parameters, pageSize, offset],
  );

  const total = number(result.rows[0]?.filtered_total);
  return {
    rows: result.rows.map((row) => ({
      id: number(row.id),
      itemType: row.item_type,
      code: row.code,
      itemName: row.item_name,
      templateCode: row.template_code,
      customer: { code: row.customer_code, name: row.customer_name, phone: row.customer_phone, group: row.customer_group },
      salePrice: number(row.sale_price),
      totalUnits: row.total_units === null ? null : number(row.total_units),
      usedUnits: row.used_units === null ? null : number(row.used_units),
      remainingUnits: row.total_units === null ? null : number(row.total_units) - number(row.used_units),
      openingBalance: row.opening_balance === null ? null : number(row.opening_balance),
      currentBalance: row.current_balance === null ? null : number(row.current_balance),
      soldAt: row.sold_at,
      expiresAt: row.expires_at,
      status: row.status,
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    summary: { totalUsed: number(result.rows[0]?.total_used), totalBalance: number(result.rows[0]?.total_balance) },
  };
}

export async function getCustomer({ branchId, id }) {
  const result = await pool.query(
    `SELECT
       c.id, c.code, c.name, c.phone, c.customer_type, c.customer_group, c.debt_balance, c.created_at,
       to_char(c.dob, 'YYYY-MM-DD') AS dob, c.gender, c.email, c.facebook,
       b.name AS branch_name,
       COALESCE(sales.total_spent, 0) AS total_spent,
       COALESCE(sales.invoice_count, 0) AS invoice_count,
       COALESCE(visits.visit_count, 0) AS visit_count,
       visits.last_visit,
       COALESCE(packages.active_packages, 0) AS active_packages,
       COALESCE(cards.active_cards, 0) AS active_cards,
       COALESCE(cards.card_balance, 0) AS card_balance
     FROM customers c
     JOIN branches b ON b.id = c.branch_id
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(i.total), 0) AS total_spent, COUNT(*) AS invoice_count
       FROM invoices i WHERE i.customer_id = c.id AND i.status = 'paid'
     ) sales ON TRUE
     ${visitsLateral}
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS active_packages FROM customer_packages cp
       WHERE cp.customer_id = c.id AND cp.status = 'active'
     ) packages ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS active_cards, COALESCE(SUM(cac.current_balance), 0) AS card_balance
       FROM customer_account_cards cac WHERE cac.customer_id = c.id AND cac.status = 'active'
     ) cards ON TRUE
     WHERE c.branch_id = $1 AND c.id = $2`,
    [branchId, id],
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Không tìm thấy khách hàng');
  return {
    id: number(row.id), code: row.code, name: row.name, phone: row.phone,
    dob: row.dob, gender: row.gender, email: row.email, facebook: row.facebook,
    customerType: row.customer_type, group: row.customer_group, branchName: row.branch_name,
    debtBalance: number(row.debt_balance), totalSpent: number(row.total_spent), invoiceCount: number(row.invoice_count),
    visitCount: number(row.visit_count), lastVisit: row.last_visit, activePackages: number(row.active_packages),
    activeCards: number(row.active_cards), cardBalance: number(row.card_balance), createdAt: row.created_at,
  };
}

export async function getCustomerActivity({ branchId, id, kind }) {
  const customer = await pool.query('SELECT id FROM customers WHERE branch_id = $1 AND id = $2', [branchId, id]);
  if (!customer.rows[0]) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Không tìm thấy khách hàng');

  if (kind === 'orders') {
    const result = await pool.query(`SELECT id, code, issued_at, total, amount_paid, payment_status, status, payment_method
      FROM invoices WHERE customer_id = $1 ORDER BY issued_at DESC, id DESC LIMIT 20`, [id]);
    return result.rows.map((row) => ({ id: number(row.id), code: row.code, occurredAt: row.issued_at, amount: number(row.total), amountPaid: number(row.amount_paid), paymentStatus: row.payment_status, status: row.status, paymentMethod: row.payment_method }));
  }
  if (kind === 'appointments') {
    // Appointments plus services sold straight at POS (paid lines with no
    // appointment), newest first.
    const result = await pool.query(`SELECT * FROM (
        SELECT 'appointment' AS source, a.id, a.starts_at AS occurred_at, a.status, sv.code AS service_code, sv.name AS service_name, s.name AS staff_name
        FROM appointments a LEFT JOIN services sv ON sv.id = a.service_id LEFT JOIN staff s ON s.id = a.staff_id
        WHERE a.customer_id = $1
        UNION ALL
        SELECT 'invoice_item', ii.id, i.issued_at, 'completed', sv.code, COALESCE(sv.name, ii.description), s.name
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii.invoice_id
        LEFT JOIN services sv ON sv.id = ii.service_id
        LEFT JOIN staff s ON s.id = ii.staff_id
        WHERE i.customer_id = $1 AND i.status = 'paid' AND ii.item_type = 'service' AND ii.appointment_id IS NULL
      ) history ORDER BY occurred_at DESC, id DESC LIMIT 20`, [id]);
    return result.rows.map((row) => ({
      id: row.source === 'appointment' ? number(row.id) : `invoice-item-${row.id}`,
      occurredAt: row.occurred_at, status: row.status, serviceCode: row.service_code, serviceName: row.service_name, staffName: row.staff_name,
    }));
  }
  if (kind === 'packages') {
    const result = await pool.query(`SELECT cp.id, cp.package_code AS code, sp.name, cp.sale_price, cp.total_units, cp.used_units, cp.sold_at, cp.expires_at, cp.status
      FROM customer_packages cp JOIN service_packages sp ON sp.id = cp.package_id
      WHERE cp.customer_id = $1 ORDER BY cp.sold_at DESC, cp.id DESC`, [id]);
    return result.rows.map((row) => ({ id: number(row.id), code: row.code, name: row.name, salePrice: number(row.sale_price), totalUnits: number(row.total_units), usedUnits: number(row.used_units), soldAt: row.sold_at, expiresAt: row.expires_at, status: row.status }));
  }
  if (kind === 'cards') {
    const result = await pool.query(`SELECT cac.id, cac.card_code AS code, ac.name, cac.sale_price, cac.opening_balance, cac.current_balance, cac.sold_at, cac.expires_at, cac.status
      FROM customer_account_cards cac JOIN account_cards ac ON ac.id = cac.account_card_id
      WHERE cac.customer_id = $1 ORDER BY cac.sold_at DESC, cac.id DESC`, [id]);
    return result.rows.map((row) => ({ id: number(row.id), code: row.code, name: row.name, salePrice: number(row.sale_price), openingBalance: number(row.opening_balance), currentBalance: number(row.current_balance), soldAt: row.sold_at, expiresAt: row.expires_at, status: row.status }));
  }
  return [];
}

export async function createCustomer({ branchId, name, code, phone, dob, gender, email, facebook, customerType = 'new', customerGroup = 'Cá nhân' }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [branchId]);

    let finalCode = code?.trim();
    if (!finalCode) {
      const sequence = await client.query(
        // Hand-typed codes (phone numbers, legacy ids) must not drive the sequence.
        `SELECT COALESCE(MAX(substring(code FROM '^KH(\\d{1,15})$')::bigint), 0) + 1 AS next_number
         FROM customers WHERE branch_id = $1 AND code ~ '^KH\\d{1,15}$'`,
        [branchId],
      );
      finalCode = `KH${String(number(sequence.rows[0].next_number)).padStart(6, '0')}`;
    }

    const existing = await client.query('SELECT id FROM customers WHERE code = $1', [finalCode]);
    if (existing.rows[0]) throw new HttpError(409, 'CODE_EXISTS', 'Mã khách hàng đã tồn tại');

    const result = await client.query(
      `INSERT INTO customers (
         branch_id, code, name, phone, dob, gender, email, facebook, customer_type, customer_group
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, code, name, phone, dob, gender, email, facebook, customer_type, customer_group, debt_balance, created_at`,
      [
        branchId,
        finalCode,
        name.trim(),
        phone?.trim() || null,
        dob || null,
        gender || null,
        email?.trim() || null,
        facebook?.trim() || null,
        customerType,
        customerGroup || 'Cá nhân',
      ],
    );
    await client.query('COMMIT');

    const row = result.rows[0];
    return {
      id: number(row.id),
      code: row.code,
      name: row.name,
      phone: row.phone,
      dob: row.dob,
      gender: row.gender,
      email: row.email,
      facebook: row.facebook,
      customerType: row.customer_type,
      group: row.customer_group,
      debtBalance: number(row.debt_balance),
      totalSpent: 0,
      lastVisit: null,
      activePackages: 0,
      createdAt: row.created_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCustomer({ branchId, id, name, code, phone, dob, gender, email, facebook, customerGroup }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [branchId]);

    const existing = await client.query('SELECT id, code FROM customers WHERE branch_id = $1 AND id = $2', [branchId, id]);
    if (!existing.rows[0]) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Không tìm thấy khách hàng');

    let finalCode = code?.trim();
    if (finalCode && finalCode !== existing.rows[0].code) {
      const codeCheck = await client.query('SELECT id FROM customers WHERE code = $1 AND id <> $2', [finalCode, id]);
      if (codeCheck.rows[0]) throw new HttpError(409, 'CODE_EXISTS', 'Mã khách hàng đã tồn tại');
    } else {
      finalCode = existing.rows[0].code;
    }

    const result = await client.query(
      `UPDATE customers SET
         name = $1,
         code = $2,
         phone = $3,
         dob = $4,
         gender = $5,
         email = $6,
         facebook = $7,
         customer_group = COALESCE($8, customer_group)
       WHERE branch_id = $9 AND id = $10
       RETURNING id, code, name, phone, dob, gender, email, facebook, customer_type, customer_group, debt_balance, created_at`,
      [
        name.trim(),
        finalCode,
        phone?.trim() || null,
        dob || null,
        gender || null,
        email?.trim() || null,
        facebook?.trim() || null,
        customerGroup?.trim() || null,
        branchId,
        id,
      ],
    );
    await client.query('COMMIT');

    const row = result.rows[0];
    return {
      id: number(row.id),
      code: row.code,
      name: row.name,
      phone: row.phone,
      dob: row.dob,
      gender: row.gender,
      email: row.email,
      facebook: row.facebook,
      customerType: row.customer_type,
      group: row.customer_group,
      debtBalance: number(row.debt_balance),
      createdAt: row.created_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getCustomerPackage({ branchId, itemType, id }) {
  const isPackage = itemType === 'package';
  const result = await pool.query(isPackage
    ? `SELECT cp.id, 'package'::text AS item_type, cp.package_code AS code, sp.name, cp.sale_price,
         cp.total_units, cp.used_units, NULL::numeric AS opening_balance, NULL::numeric AS current_balance,
         cp.sold_at, cp.expires_at, cp.status, b.name AS branch_name,
         c.id AS customer_id, c.code AS customer_code, c.name AS customer_name, c.phone AS customer_phone
       FROM customer_packages cp JOIN service_packages sp ON sp.id = cp.package_id
       JOIN customers c ON c.id = cp.customer_id JOIN branches b ON b.id = cp.branch_id
       WHERE cp.branch_id = $1 AND cp.id = $2`
    : `SELECT cac.id, 'account_card'::text AS item_type, cac.card_code AS code, ac.name, cac.sale_price,
         NULL::integer AS total_units, NULL::integer AS used_units, cac.opening_balance, cac.current_balance,
         cac.sold_at, cac.expires_at, cac.status, b.name AS branch_name,
         c.id AS customer_id, c.code AS customer_code, c.name AS customer_name, c.phone AS customer_phone
       FROM customer_account_cards cac JOIN account_cards ac ON ac.id = cac.account_card_id
       JOIN customers c ON c.id = cac.customer_id JOIN branches b ON b.id = cac.branch_id
       WHERE cac.branch_id = $1 AND cac.id = $2`, [branchId, id]);
  const row = result.rows[0];
  if (!row) throw new HttpError(404, 'CUSTOMER_PACKAGE_NOT_FOUND', 'Không tìm thấy gói hoặc thẻ đã bán');

  let services = [];
  let usages = [];
  if (isPackage) {
    const [servicesResult, usagesResult] = await Promise.all([
      pool.query(`SELECT s.id, s.code, s.name, spi.units, spi.unit_price
        FROM customer_packages cp JOIN service_package_items spi ON spi.package_id = cp.package_id
        JOIN services s ON s.id = spi.service_id WHERE cp.id = $1 ORDER BY spi.id`, [id]),
      pool.query(`SELECT pu.id, pu.used_at, pu.units_used, pu.note, a.id AS appointment_id,
          sv.name AS service_name, i.code AS invoice_code
        FROM package_usages pu
        LEFT JOIN appointments a ON a.id = pu.appointment_id
        LEFT JOIN services sv ON sv.id = a.service_id
        LEFT JOIN invoices i ON i.customer_id = $2 AND i.issued_at::date = pu.used_at::date
        WHERE pu.customer_package_id = $1 ORDER BY pu.used_at DESC, pu.id DESC`, [id, row.customer_id]),
    ]);
    services = servicesResult.rows.map((item) => ({ id: number(item.id), code: item.code, name: item.name, units: number(item.units), unitPrice: number(item.unit_price) }));
    usages = usagesResult.rows.map((item) => ({ id: number(item.id), occurredAt: item.used_at, unitsUsed: number(item.units_used), note: item.note, serviceName: item.service_name, invoiceCode: item.invoice_code }));
  }

  return {
    id: number(row.id), itemType: row.item_type, code: row.code, itemName: row.name,
    customer: { id: number(row.customer_id), code: row.customer_code, name: row.customer_name, phone: row.customer_phone },
    salePrice: number(row.sale_price), totalUnits: row.total_units === null ? null : number(row.total_units),
    usedUnits: row.used_units === null ? null : number(row.used_units),
    remainingUnits: row.total_units === null ? null : number(row.total_units) - number(row.used_units),
    openingBalance: row.opening_balance === null ? null : number(row.opening_balance),
    currentBalance: row.current_balance === null ? null : number(row.current_balance),
    soldAt: row.sold_at, expiresAt: row.expires_at, status: row.status, branchName: row.branch_name,
    services, usages,
  };
}
