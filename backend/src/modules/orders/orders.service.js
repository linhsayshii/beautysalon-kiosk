import { listSort } from '../../lib/list-sort.js';
import { pool } from '../../db.js';
import { HttpError } from '../../lib/http.js';

const number = (value) => Number(value ?? 0);

export async function listOrders({ branchId, search, status, paymentMethod, staffId, dateFrom, dateTo, page, pageSize, offset, sort, salesChannel = '' }) {
  const orderBy = listSort(sort, {
    date_desc: 'i.issued_at DESC',
    date_asc: 'i.issued_at ASC',
    total_desc: 'i.total DESC',
    total_asc: 'i.total ASC',
    code_asc: 'i.code ASC',
    code_desc: 'i.code DESC',
  }, 'i.issued_at DESC');
  const parameters = [branchId, search, status, paymentMethod, staffId, dateFrom, dateTo, salesChannel];
  const filters = `
    i.branch_id = $1
    AND ($2 = '' OR i.code ILIKE '%' || $2 || '%' OR c.name ILIKE '%' || $2 || '%' OR c.phone ILIKE '%' || $2 || '%')
    AND ($3 = '' OR i.status = $3)
    AND ($4 = '' OR i.payment_method = $4)
    AND ($5::bigint IS NULL OR i.staff_id = $5
      OR EXISTS (SELECT 1 FROM invoice_items fi WHERE fi.invoice_id = i.id AND fi.staff_id = $5))
    AND ($6::date IS NULL OR i.issued_at >= $6::date)
    AND ($7::date IS NULL OR i.issued_at < $7::date + INTERVAL '1 day')
    AND ($8 = '' OR i.sales_channel = $8)
  `;

  const [rowsResult, summaryResult] = await Promise.all([
    pool.query(
      `SELECT
         i.id, i.code, i.status, i.subtotal, i.discount, i.total, i.amount_paid, i.payment_status, i.payment_method, i.sales_channel, i.issued_at,
         i.appointment_id,
         c.code AS customer_code, COALESCE(c.name, 'Khách lẻ') AS customer_name, c.phone AS customer_phone,
         -- POS sales carry staff per line; fall back to those names.
         COALESCE(s.name, (
           SELECT string_agg(DISTINCT ls.name, ', ' ORDER BY ls.name)
           FROM invoice_items li JOIN staff ls ON ls.id = li.staff_id
           WHERE li.invoice_id = i.id
         )) AS staff_name,
         COUNT(*) OVER() AS filtered_total
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       LEFT JOIN staff s ON s.id = i.staff_id
       WHERE ${filters}
       ORDER BY ${orderBy}, i.id DESC
       LIMIT $9 OFFSET $10`,
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
      amountPaid: number(row.amount_paid),
      paidAmount: number(row.amount_paid),
      debtAmount: row.status === 'paid' ? Math.max(0, number(row.total)-number(row.amount_paid)) : 0,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      salesChannel: row.sales_channel,
      issuedAt: row.issued_at,
      appointmentId: row.appointment_id ? number(row.appointment_id) : null,
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
       i.id, i.code, i.status, i.subtotal, i.discount, i.total, i.amount_paid, i.payment_status, i.payment_method,
       i.sales_channel, i.note, i.issued_at, i.created_at,
       EXISTS (SELECT 1 FROM appointments linked WHERE linked.invoice_id=i.id) AS from_appointment,
       b.name AS branch_name,
       c.id AS customer_id, c.code AS customer_code, COALESCE(c.name, 'Khách lẻ') AS customer_name,
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
       ii.service_id, ii.product_id, ii.package_id, ii.customer_package_id, ii.account_card_id,
       ii.staff_id, st.name AS line_staff_name, ii.appointment_id,
       a.status AS appointment_status, a.starts_at AS appointment_starts_at, a.ends_at AS appointment_ends_at,
       ast.id AS appointment_staff_id, ast.name AS appointment_staff_name,
       s.commission_type AS service_commission_type, s.commission_rate AS service_commission_rate,
       redeemed_package.name AS customer_package_name,
       COALESCE(s.code, p.sku, '-') AS item_code,
       COALESCE(s.name, p.name, ii.description) AS item_name,
       CASE WHEN ii.item_type = 'service' THEN 'lần' ELSE COALESCE(p.unit, 'sản phẩm') END AS unit
     FROM invoice_items ii
     LEFT JOIN services s ON s.id = ii.service_id
     LEFT JOIN products p ON p.id = ii.product_id
     LEFT JOIN customer_packages cp ON cp.id = ii.customer_package_id
     LEFT JOIN service_packages redeemed_package ON redeemed_package.id = cp.package_id
     LEFT JOIN staff st ON st.id = ii.staff_id
     LEFT JOIN appointments a ON a.id = ii.appointment_id
     LEFT JOIN staff ast ON ast.id = a.staff_id
     WHERE ii.invoice_id = $1
     ORDER BY ii.id`,
    [id],
  );

  const items = itemsResult.rows.map((item) => ({
    id: number(item.id),
    itemType: item.item_type,
    code: item.item_code,
    name: item.item_name,
    description: item.description,
    serviceId: item.service_id ? number(item.service_id) : null,
    productId: item.product_id ? number(item.product_id) : null,
    packageId: item.package_id ? number(item.package_id) : null,
    customerPackageId: item.customer_package_id ? number(item.customer_package_id) : null,
    customerPackageName: item.customer_package_name || null,
    accountCardId: item.account_card_id ? number(item.account_card_id) : null,
    staffId: item.staff_id ? number(item.staff_id) : null,
    staffName: item.line_staff_name || null,
    unit: item.unit,
    quantity: number(item.quantity),
    unitPrice: number(item.unit_price),
    discount: Math.max(0, number(item.quantity) * number(item.unit_price) - number(item.line_total)),
    lineTotal: number(item.line_total),
    commissionType: item.service_commission_type,
    commissionRate: number(item.service_commission_rate),
    appointment: item.appointment_id ? {
      id: number(item.appointment_id),
      status: item.appointment_status,
      startsAt: item.appointment_starts_at,
      endsAt: item.appointment_ends_at,
      staff: {
        id: item.appointment_staff_id ? number(item.appointment_staff_id) : null,
        name: item.appointment_staff_name || item.line_staff_name || null,
      },
    } : null,
  }));
  const scheduledServices = items.filter((item) => item.itemType === 'service' && item.appointment);

  return {
    id: number(row.id),
    code: row.code,
    status: row.status,
    subtotal: number(row.subtotal),
    discount: number(row.discount),
    total: number(row.total),
      amountPaid: number(row.amount_paid),
      paidAmount: number(row.amount_paid),
      debtAmount: row.status === 'paid' ? Math.max(0, number(row.total)-number(row.amount_paid)) : 0,
      paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    salesChannel: row.sales_channel,
    note: row.note || '',
    issuedAt: row.issued_at,
    createdAt: row.created_at,
    branchName: row.branch_name,
    customer: {
      id: row.customer_id ? number(row.customer_id) : null,
      code: row.customer_code,
      name: row.customer_name,
      phone: row.customer_phone,
    },
    staff: {
      code: row.staff_code,
      name: row.staff_name,
    },
    fromAppointment: Boolean(row.from_appointment),
    serviceProgress: {
      total: scheduledServices.length,
      completed: scheduledServices.filter((item) => item.appointment.status === 'completed').length,
    },
    items,
  };
}
