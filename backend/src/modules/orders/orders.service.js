import { pool } from '../../db.js';
import { HttpError } from '../../lib/http.js';

const number = (value) => Number(value ?? 0);

export async function listOrders({ branchId, search, status, paymentMethod, dateFrom, dateTo, page, pageSize, offset }) {
  const parameters = [branchId, search, status, paymentMethod, dateFrom, dateTo];
  const filters = `
    i.branch_id = $1
    AND ($2 = '' OR i.code ILIKE '%' || $2 || '%' OR c.name ILIKE '%' || $2 || '%' OR c.phone ILIKE '%' || $2 || '%')
    AND ($3 = '' OR i.status = $3)
    AND ($4 = '' OR i.payment_method = $4)
    AND ($5::date IS NULL OR i.issued_at >= $5::date)
    AND ($6::date IS NULL OR i.issued_at < $6::date + INTERVAL '1 day')
  `;

  const [rowsResult, summaryResult] = await Promise.all([
    pool.query(
      `SELECT
         i.id, i.code, i.status, i.subtotal, i.discount, i.total, i.payment_method, i.sales_channel, i.issued_at,
         c.code AS customer_code, COALESCE(c.name, 'Khách lẻ') AS customer_name, c.phone AS customer_phone,
         s.name AS staff_name,
         COUNT(*) OVER() AS filtered_total
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       LEFT JOIN staff s ON s.id = i.staff_id
       WHERE ${filters}
       ORDER BY i.issued_at DESC, i.id DESC
       LIMIT $7 OFFSET $8`,
      [...parameters, pageSize, offset],
    ),
    pool.query(
      `SELECT
         COUNT(*) AS total_orders,
         COALESCE(SUM(i.total) FILTER (WHERE i.status = 'paid'), 0) AS paid_revenue,
         COUNT(*) FILTER (WHERE i.status = 'draft') AS draft_orders,
         COUNT(*) FILTER (WHERE i.status = 'refunded') AS refunded_orders
       FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
       WHERE ${filters}`,
      parameters,
    ),
  ]);

  const total = number(rowsResult.rows[0]?.filtered_total);
  const summary = summaryResult.rows[0];

  return {
    rows: rowsResult.rows.map((row) => ({
      id: number(row.id),
      code: row.code,
      status: row.status,
      subtotal: number(row.subtotal),
      discount: number(row.discount),
      total: number(row.total),
      paymentMethod: row.payment_method,
      salesChannel: row.sales_channel,
      issuedAt: row.issued_at,
      customer: {
        code: row.customer_code,
        name: row.customer_name,
        phone: row.customer_phone,
      },
      staffName: row.staff_name,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    summary: {
      totalOrders: number(summary.total_orders),
      paidRevenue: number(summary.paid_revenue),
      draftOrders: number(summary.draft_orders),
      refundedOrders: number(summary.refunded_orders),
    },
  };
}

export async function getOrder({ branchId, id }) {
  const headerResult = await pool.query(
    `SELECT
       i.id, i.code, i.status, i.subtotal, i.discount, i.total, i.payment_method,
       i.sales_channel, i.issued_at, i.created_at,
       b.name AS branch_name,
       c.code AS customer_code, COALESCE(c.name, 'Khách lẻ') AS customer_name,
       c.phone AS customer_phone,
       s.code AS staff_code, s.name AS staff_name
     FROM invoices i
     JOIN branches b ON b.id = i.branch_id
     LEFT JOIN customers c ON c.id = i.customer_id
     LEFT JOIN staff s ON s.id = i.staff_id
     WHERE i.branch_id = $1 AND i.id = $2`,
    [branchId, id],
  );
  const row = headerResult.rows[0];
  if (!row) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng');

  const itemsResult = await pool.query(
    `SELECT
       ii.id, ii.item_type, ii.description, ii.quantity, ii.unit_price, ii.line_total,
       COALESCE(s.code, p.sku, '-') AS item_code,
       COALESCE(s.name, p.name, ii.description) AS item_name,
       CASE WHEN ii.item_type = 'service' THEN 'lần' ELSE COALESCE(p.unit, 'sản phẩm') END AS unit
     FROM invoice_items ii
     LEFT JOIN services s ON s.id = ii.service_id
     LEFT JOIN products p ON p.id = ii.product_id
     WHERE ii.invoice_id = $1
     ORDER BY ii.id`,
    [id],
  );

  return {
    id: number(row.id),
    code: row.code,
    status: row.status,
    subtotal: number(row.subtotal),
    discount: number(row.discount),
    total: number(row.total),
    paymentMethod: row.payment_method,
    salesChannel: row.sales_channel,
    issuedAt: row.issued_at,
    createdAt: row.created_at,
    branchName: row.branch_name,
    customer: {
      code: row.customer_code,
      name: row.customer_name,
      phone: row.customer_phone,
    },
    staff: {
      code: row.staff_code,
      name: row.staff_name,
    },
    items: itemsResult.rows.map((item) => ({
      id: number(item.id),
      itemType: item.item_type,
      code: item.item_code,
      name: item.item_name,
      description: item.description,
      unit: item.unit,
      quantity: number(item.quantity),
      unitPrice: number(item.unit_price),
      discount: Math.max(0, number(item.quantity) * number(item.unit_price) - number(item.line_total)),
      lineTotal: number(item.line_total),
    })),
  };
}
