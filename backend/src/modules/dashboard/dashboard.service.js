import { pool } from '../../db.js';

function number(value) {
  return Number(value ?? 0);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function fillHourly(rows, valueKey) {
  const byHour = new Map(rows.filter((row) => row.period === 'hour').map((row) => [Number(row.bucket), number(row[valueKey])]));
  return Array.from({ length: 15 }, (_, index) => {
    const hour = index + 8;
    return {
      label: `${String(hour).padStart(2, '0')}:00`,
      value: byHour.get(hour) ?? 0,
    };
  });
}

function rangeDays(date, period) {
  const end = new Date(`${date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(end);
  if (period === 'yesterday') {
    start.setUTCDate(start.getUTCDate() - 2);
    end.setUTCDate(end.getUTCDate() - 1);
  } else if (period === 'last_7_days') start.setUTCDate(start.getUTCDate() - 7);
  else if (period === 'this_month') start.setUTCDate(1);
  else if (period === 'last_month') {
    end.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 1, 1);
  } else start.setUTCDate(end.getUTCDate() - 1);
  return { start, end };
}

function fillDaily(rows, valueKey, date, period) {
  const { start, end } = rangeDays(date, period);
  const byDay = new Map(rows.filter((row) => row.period === 'day').map((row) => [row.bucket, number(row[valueKey])]));
  const result = [];
  for (const cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10);
    result.push({ label: `${String(cursor.getUTCDate()).padStart(2, '0')}/${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`, value: byDay.get(key) ?? 0 });
  }
  return result;
}

function fillWeekday(rows, valueKey) {
  const labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
  const byWeekday = new Map(rows.filter((row) => row.period === 'weekday').map((row) => [Number(row.bucket), number(row[valueKey])]));
  return labels.map((label, index) => ({ label, value: byWeekday.get(index + 1) ?? 0 }));
}

export async function listAppointments({ branchId, dateFrom, dateTo }) {
  const result = await pool.query(
    `WITH bounds AS (
       SELECT
         ($2::date AT TIME ZONE b.timezone) AS range_start,
         (($3::date + 1) AT TIME ZONE b.timezone) AS range_end
       FROM branches b WHERE b.id = $1
     )
     SELECT a.id, a.starts_at, a.ends_at, a.status, a.note, a.invoice_id,
            ii.id AS invoice_item_id, i.status AS invoice_status, i.payment_requested_at,
            c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
            s.id AS staff_id, s.name AS staff_name,
            sv.id AS service_id, sv.name AS service_name
     FROM appointments a
     CROSS JOIN bounds
     LEFT JOIN customers c ON c.id = a.customer_id
     LEFT JOIN staff s ON s.id = a.staff_id
     LEFT JOIN services sv ON sv.id = a.service_id
     LEFT JOIN invoice_items ii ON ii.appointment_id = a.id
     LEFT JOIN invoices i ON i.id = a.invoice_id
     WHERE a.branch_id = $1
       AND a.starts_at >= bounds.range_start
       AND a.starts_at < bounds.range_end
       AND a.status <> 'cancelled'
     ORDER BY a.starts_at, a.id`,
    [branchId, dateFrom, dateTo],
  );

  return result.rows.map((row) => ({
    id: number(row.id),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    note: row.note,
    invoiceId: row.invoice_id || null,
    invoiceItemId: row.invoice_item_id ? number(row.invoice_item_id) : null,
    invoiceStatus: row.invoice_status || null,
    paymentRequestedAt: row.payment_requested_at || null,
    customer: { id: row.customer_id ? number(row.customer_id) : null, name: row.customer_name ?? 'Khách lẻ', phone: row.customer_phone },
    staff: { id: row.staff_id ? number(row.staff_id) : null, name: row.staff_name },
    service: { id: row.service_id ? number(row.service_id) : null, name: row.service_name },
  }));
}

function appError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function draftInvoiceCode() {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

async function recalculateDraftInvoice(client, invoiceId) {
  await client.query(
    `UPDATE invoices i
     SET subtotal = totals.subtotal,
         discount = LEAST(i.discount, totals.subtotal),
         total = GREATEST(0, totals.subtotal - LEAST(i.discount, totals.subtotal))
     FROM (
       SELECT COALESCE(SUM(line_total), 0) AS subtotal
       FROM invoice_items
       WHERE invoice_id = $1
     ) totals
     WHERE i.id = $1 AND i.status = 'draft'`,
    [invoiceId],
  );
}

async function refreshInvoicePaymentReadiness(client, { invoiceId, triggeredByStaffId = null }) {
  if (!invoiceId) return { paymentRequestedAt: null };

  const invoiceResult = await client.query(
    `SELECT id, status, payment_requested_at
     FROM invoices WHERE id = $1 FOR UPDATE`,
    [invoiceId],
  );
  const invoice = invoiceResult.rows[0];
  if (!invoice || invoice.status !== 'draft') return { paymentRequestedAt: null };

  const progressResult = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE ii.item_type = 'service' AND ii.appointment_id IS NOT NULL) AS total,
       COUNT(*) FILTER (
         WHERE ii.item_type = 'service' AND ii.appointment_id IS NOT NULL AND a.status = 'completed'
       ) AS completed
     FROM invoice_items ii
     LEFT JOIN appointments a ON a.id = ii.appointment_id
     WHERE ii.invoice_id = $1`,
    [invoiceId],
  );
  const total = number(progressResult.rows[0]?.total);
  const completed = number(progressResult.rows[0]?.completed);

  if (total > 0 && total === completed) {
    const updated = await client.query(
      `UPDATE invoices
       SET payment_requested_at = COALESCE(payment_requested_at, NOW()),
           payment_requested_by_staff_id = COALESCE(payment_requested_by_staff_id, $2)
       WHERE id = $1
       RETURNING payment_requested_at`,
      [invoiceId, triggeredByStaffId],
    );
    return { paymentRequestedAt: updated.rows[0]?.payment_requested_at || null };
  }

  await client.query(
    `UPDATE invoices
     SET payment_requested_at = NULL, payment_requested_by_staff_id = NULL
     WHERE id = $1`,
    [invoiceId],
  );
  return { paymentRequestedAt: null };
}

async function syncDraftInvoiceItemForAppointment(client, {
  invoiceId,
  appointmentId,
  customerId,
  staffId,
  service,
  status,
}) {
  if (!invoiceId) return;

  const invoiceResult = await client.query(
    'SELECT id, customer_id, status FROM invoices WHERE id = $1 FOR UPDATE',
    [invoiceId],
  );
  const invoice = invoiceResult.rows[0];
  if (!invoice || invoice.status !== 'draft') return;

  if (invoice.customer_id && Number(invoice.customer_id) !== Number(customerId)) {
    throw appError(409, 'INVOICE_CUSTOMER_LOCKED', 'Không thể đổi khách của một dịch vụ trong hóa đơn chung');
  }

  if (status === 'cancelled') {
    await client.query(
      'DELETE FROM invoice_items WHERE invoice_id = $1 AND appointment_id = $2',
      [invoiceId, appointmentId],
    );
    await recalculateDraftInvoice(client, invoiceId);
    const remainingItems = await client.query('SELECT COUNT(*) AS total FROM invoice_items WHERE invoice_id = $1', [invoiceId]);
    if (number(remainingItems.rows[0]?.total) === 0) {
      await client.query("UPDATE invoices SET status = 'cancelled', subtotal = 0, discount = 0, total = 0 WHERE id = $1", [invoiceId]);
    }
    return;
  }

  if (!service) return;
  const itemResult = await client.query(
    `UPDATE invoice_items
     SET service_id = $1, staff_id = $2, description = $3,
         unit_price = $4, line_total = $4 * quantity
     WHERE invoice_id = $5 AND appointment_id = $6 AND item_type = 'service'
     RETURNING id`,
    [service.id, staffId, service.name, service.price, invoiceId, appointmentId],
  );
  if (itemResult.rows[0]) await recalculateDraftInvoice(client, invoiceId);
}

export async function createAppointments({ branchId, customerId, items, status, note, invoiceId = null }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw appError(400, 'SERVICES_REQUIRED', 'Cần chọn ít nhất một dịch vụ');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const customerResult = await client.query(
      'SELECT id, name, phone FROM customers WHERE id = $1 AND branch_id = $2',
      [customerId, branchId],
    );
    if (!customerResult.rows[0]) {
      throw appError(404, 'CUSTOMER_NOT_FOUND', 'Không tìm thấy khách hàng');
    }

    const normalizedItems = [];
    for (const item of items) {
      const { serviceId, staffId, startsAt, endsAt } = item;
      const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
      const [serviceResult, staffResult] = await Promise.all([
        client.query('SELECT id, name, price FROM services WHERE id = $1 AND branch_id = $2 AND active', [serviceId, branchId]),
        staffId ? client.query('SELECT id, name FROM staff WHERE id = $1 AND branch_id = $2 AND active', [staffId, branchId]) : Promise.resolve({ rows: [] }),
      ]);
      if (!serviceResult.rows[0]) throw appError(404, 'SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ');
      if (staffId && !staffResult.rows[0]) throw appError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');

      if (staffId) {
        const overlap = await client.query(
          `SELECT id FROM appointments
           WHERE branch_id = $1 AND staff_id = $2 AND status NOT IN ('cancelled', 'no_show')
             AND starts_at < $4 AND ends_at > $3
           LIMIT 1`,
          [branchId, staffId, startsAt, endsAt],
        );
        if (overlap.rows[0]) throw appError(409, 'STAFF_SCHEDULE_CONFLICT', 'Nhân viên đã có lịch trong khung giờ này');
      }

      const conflictsWithRequest = normalizedItems.some((existing) => (
        staffId && existing.staffId === staffId && existing.startsAt < endsAt && existing.endsAt > startsAt
      ));
      if (conflictsWithRequest) {
        throw appError(409, 'STAFF_SCHEDULE_CONFLICT', 'Nhân viên bị trùng lịch giữa các dịch vụ đang tạo');
      }

      normalizedItems.push({
        serviceId,
        staffId: staffId || null,
        startsAt,
        endsAt,
        quantity,
        service: serviceResult.rows[0],
        staff: staffResult.rows[0] || null,
      });
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + number(item.service.price) * item.quantity, 0);
    let invoice;
    if (invoiceId) {
      const existingInvoice = await client.query(
        `SELECT id, code, status, subtotal, discount, total, payment_method, sales_channel, issued_at
         FROM invoices
         WHERE id = $1 AND branch_id = $2 AND customer_id = $3 AND status = 'draft'
         FOR UPDATE`,
        [invoiceId, branchId, customerId],
      );
      invoice = existingInvoice.rows[0];
      if (!invoice) throw appError(409, 'INVOICE_NOT_EDITABLE', 'Hóa đơn không còn có thể thêm dịch vụ');
    } else {
      const invoiceResult = await client.query(
        `INSERT INTO invoices (
           branch_id, customer_id, staff_id, code, status, subtotal, discount, total,
           payment_method, sales_channel, issued_at
         ) VALUES ($1, $2, NULL, $3, 'draft', $4, 0, $4, 'cash', 'salon', $5)
         RETURNING id, code, status, subtotal, discount, total, payment_method, sales_channel, issued_at`,
        [branchId, customerId, draftInvoiceCode(), subtotal, normalizedItems[0].startsAt],
      );
      invoice = invoiceResult.rows[0];
    }
    const appointments = [];

    for (const item of normalizedItems) {
      const appointmentResult = await client.query(
        `INSERT INTO appointments (
           branch_id, customer_id, staff_id, service_id, starts_at, ends_at, status, note, invoice_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, starts_at, ends_at, status, note`,
        [branchId, customerId, item.staffId, item.serviceId, item.startsAt, item.endsAt, status, note || null, invoice.id],
      );
      const appointment = appointmentResult.rows[0];
      const invoiceItemResult = await client.query(
        `INSERT INTO invoice_items (
           invoice_id, item_type, service_id, staff_id, appointment_id,
           description, quantity, unit_price, line_total
         ) VALUES ($1, 'service', $2, $3, $4, $5, $6, $7, $6 * $7)
         RETURNING id`,
        [invoice.id, item.serviceId, item.staffId, appointment.id, item.service.name, item.quantity, item.service.price],
      );
      appointments.push({
        id: number(appointment.id),
        startsAt: appointment.starts_at,
        endsAt: appointment.ends_at,
        status: appointment.status,
        note: appointment.note,
        invoiceId: number(invoice.id),
        invoiceItemId: number(invoiceItemResult.rows[0].id),
        customer: { id: customerId, name: customerResult.rows[0].name, phone: customerResult.rows[0].phone },
        staff: { id: item.staffId, name: item.staff?.name ?? null },
        service: { id: item.serviceId, name: item.service.name },
      });
    }

    if (status === 'completed') {
      await refreshInvoicePaymentReadiness(client, {
        invoiceId: invoice.id,
        triggeredByStaffId: normalizedItems.at(-1)?.staffId || null,
      });
    }

    if (invoiceId) {
      await recalculateDraftInvoice(client, invoice.id);
      const refreshedInvoice = await client.query(
        `SELECT id, code, status, subtotal, discount, total, payment_method, sales_channel, issued_at
         FROM invoices WHERE id = $1`,
        [invoice.id],
      );
      invoice = refreshedInvoice.rows[0];
    }

    await client.query('COMMIT');
    return {
      invoice: {
        id: number(invoice.id), code: invoice.code, status: invoice.status,
        subtotal: number(invoice.subtotal), discount: number(invoice.discount), total: number(invoice.total),
      },
      appointments,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createAppointment(input) {
  const result = await createAppointments({
    branchId: input.branchId,
    customerId: input.customerId,
    status: input.status,
    note: input.note,
    items: [{ serviceId: input.serviceId, staffId: input.staffId, startsAt: input.startsAt, endsAt: input.endsAt }],
  });
  return result.appointments[0];
}

export async function transitionAppointmentWorkStatus({ branchId, staffId, id, status }) {
  const expectedCurrentStatuses = status === 'in_service' ? ['confirmed', 'waiting'] : ['in_service'];
  if (!['in_service', 'completed'].includes(status)) {
    throw appError(400, 'INVALID_WORK_STATUS', 'Trạng thái công việc không hợp lệ');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE appointments
       SET status = $1
       WHERE id = $2 AND branch_id = $3 AND staff_id = $4
         AND status = ANY($5::varchar[])
       RETURNING id, status, invoice_id`,
      [status, id, branchId, staffId, expectedCurrentStatuses],
    );
    if (!result.rows[0]) {
      throw appError(409, 'WORK_STATUS_TRANSITION_INVALID', 'Công việc không còn ở trạng thái có thể cập nhật');
    }
    const paymentReadiness = await refreshInvoicePaymentReadiness(client, {
      invoiceId: result.rows[0].invoice_id,
      triggeredByStaffId: status === 'completed' ? staffId : null,
    });
    await client.query('COMMIT');
    return {
      id: number(result.rows[0].id),
      status: result.rows[0].status,
      paymentRequestedAt: paymentReadiness.paymentRequestedAt,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAppointment({ branchId, id, customerId, serviceId, staffId, startsAt, endsAt, status, note }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingResult = await client.query(
    'SELECT id, customer_id, service_id, staff_id, starts_at, ends_at, status, note, invoice_id FROM appointments WHERE id = $1 AND branch_id = $2',
      [id, branchId],
    );
    if (!existingResult.rows[0]) {
      const error = new Error('Không tìm thấy lịch hẹn');
      error.status = 404;
      error.code = 'APPOINTMENT_NOT_FOUND';
      throw error;
    }
    const existing = existingResult.rows[0];

    const targetCustomerId = customerId !== undefined ? customerId : existing.customer_id;
    const targetServiceId = serviceId !== undefined ? serviceId : existing.service_id;
    const targetStaffId = staffId !== undefined ? staffId : existing.staff_id;
    const targetStartsAt = startsAt || existing.starts_at;
    const targetEndsAt = endsAt || existing.ends_at;
    const targetStatus = status || existing.status;
    const targetNote = note !== undefined ? (note || null) : existing.note;

    if (existing.invoice_id && !targetServiceId) {
      throw appError(409, 'INVOICE_SERVICE_REQUIRED', 'Không thể bỏ dịch vụ khi lịch hẹn đang thuộc hóa đơn');
    }

    const [customerResult, serviceResult, staffResult] = await Promise.all([
      targetCustomerId ? client.query('SELECT id, name, phone FROM customers WHERE id = $1 AND branch_id = $2', [targetCustomerId, branchId]) : Promise.resolve({ rows: [] }),
      targetServiceId ? client.query('SELECT id, name, price FROM services WHERE id = $1 AND branch_id = $2 AND active', [targetServiceId, branchId]) : Promise.resolve({ rows: [] }),
      targetStaffId ? client.query('SELECT id, name FROM staff WHERE id = $1 AND branch_id = $2 AND active', [targetStaffId, branchId]) : Promise.resolve({ rows: [] }),
    ]);

    if (targetCustomerId && !customerResult.rows[0]) {
      const error = new Error('Không tìm thấy khách hàng');
      error.status = 404;
      error.code = 'CUSTOMER_NOT_FOUND';
      throw error;
    }
    if (targetServiceId && !serviceResult.rows[0]) {
      const error = new Error('Không tìm thấy dịch vụ');
      error.status = 404;
      error.code = 'SERVICE_NOT_FOUND';
      throw error;
    }
    if (targetStaffId && !staffResult.rows[0]) {
      const error = new Error('Không tìm thấy nhân viên');
      error.status = 404;
      error.code = 'STAFF_NOT_FOUND';
      throw error;
    }

    if (targetStaffId && targetStatus !== 'cancelled' && targetStatus !== 'no_show') {
      const overlap = await client.query(
        `SELECT id FROM appointments
         WHERE branch_id = $1 AND staff_id = $2 AND status <> 'cancelled' AND id <> $3
           AND starts_at < $5 AND ends_at > $4
         LIMIT 1`,
        [branchId, targetStaffId, id, targetStartsAt, targetEndsAt],
      );
      if (overlap.rows[0]) {
        const error = new Error('Nhân viên đã có lịch trong khung giờ này');
        error.status = 409;
        error.code = 'STAFF_SCHEDULE_CONFLICT';
        throw error;
      }
    }

    const result = await client.query(
      `UPDATE appointments
       SET customer_id = $1, staff_id = $2, service_id = $3, starts_at = $4, ends_at = $5, status = $6, note = $7
       WHERE id = $8 AND branch_id = $9
       RETURNING id, starts_at, ends_at, status, note`,
      [targetCustomerId, targetStaffId, targetServiceId, targetStartsAt, targetEndsAt, targetStatus, targetNote, id, branchId],
    );

    await syncDraftInvoiceItemForAppointment(client, {
      invoiceId: existing.invoice_id,
      appointmentId: id,
      customerId: targetCustomerId,
      staffId: targetStaffId,
      service: serviceResult.rows[0] || null,
      status: targetStatus,
    });
    await refreshInvoicePaymentReadiness(client, {
      invoiceId: existing.invoice_id,
      triggeredByStaffId: null,
    });

    await client.query('COMMIT');
    const appointment = result.rows[0];
    return {
      id: number(appointment.id),
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      status: appointment.status,
      note: appointment.note,
      customer: { id: targetCustomerId, name: customerResult.rows[0]?.name ?? 'Khách lẻ', phone: customerResult.rows[0]?.phone },
      staff: { id: targetStaffId, name: staffResult.rows[0]?.name ?? null },
      service: { id: targetServiceId, name: serviceResult.rows[0]?.name ?? null },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getDashboard({ branchId, date, period = 'this_month' }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN READ ONLY');

    const [branchResult, appointmentResult, customerResult, cashResult, monthResult] = await Promise.all([
      client.query(
        'SELECT id, code, name, timezone FROM branches WHERE id = $1',
        [branchId],
      ),
      client.query(
        `WITH bounds AS (
           SELECT
             ($2::date AT TIME ZONE b.timezone) AS day_start,
             (($2::date + 1) AT TIME ZONE b.timezone) AS day_end,
             (($2::date - 1) AT TIME ZONE b.timezone) AS previous_start
           FROM branches b WHERE b.id = $1
         )
         SELECT
           COUNT(*) FILTER (WHERE a.starts_at >= bounds.day_start AND a.starts_at < bounds.day_end) AS total,
           COUNT(*) FILTER (
             WHERE a.starts_at >= bounds.day_start AND a.starts_at < bounds.day_end AND a.status = 'completed'
           ) AS completed,
           COUNT(*) FILTER (
             WHERE a.starts_at >= bounds.previous_start AND a.starts_at < bounds.day_start
           ) AS previous_total
         FROM appointments a CROSS JOIN bounds
         WHERE a.branch_id = $1 AND a.status <> 'cancelled'`,
        [branchId, date],
      ),
      client.query(
        `WITH bounds AS (
           SELECT
             ($2::date AT TIME ZONE b.timezone) AS day_start,
             (($2::date + 1) AT TIME ZONE b.timezone) AS day_end
           FROM branches b WHERE b.id = $1
         ), daily_customers AS (
           SELECT DISTINCT c.id, c.customer_type
           FROM appointments a
           JOIN customers c ON c.id = a.customer_id
           CROSS JOIN bounds
           WHERE a.branch_id = $1
             AND a.starts_at >= bounds.day_start
             AND a.starts_at < bounds.day_end
             AND a.status <> 'cancelled'
         )
         SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE customer_type = 'new') AS new_count,
           COUNT(*) FILTER (WHERE customer_type = 'returning') AS returning_count,
           COUNT(*) FILTER (WHERE customer_type = 'walk_in') AS walk_in_count
         FROM daily_customers`,
        [branchId, date],
      ),
      client.query(
        `WITH bounds AS (
           SELECT
             ($2::date AT TIME ZONE b.timezone) AS day_start,
             (($2::date + 1) AT TIME ZONE b.timezone) AS day_end
           FROM branches b WHERE b.id = $1
         )
         SELECT
           COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'income'), 0) AS income,
           COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'expense'), 0) AS expense
         FROM cash_transactions c CROSS JOIN bounds
         WHERE c.branch_id = $1 AND c.occurred_at >= bounds.day_start AND c.occurred_at < bounds.day_end`,
        [branchId, date],
      ),
      client.query(
        `WITH bounds AS (
           SELECT
             (CASE $3
               WHEN 'today' THEN $2::date
               WHEN 'yesterday' THEN $2::date - 1
               WHEN 'last_7_days' THEN $2::date - 6
               WHEN 'last_month' THEN (date_trunc('month', $2::date) - INTERVAL '1 month')::date
               ELSE date_trunc('month', $2::date)::date
             END AT TIME ZONE b.timezone) AS range_start,
             (CASE $3
               WHEN 'yesterday' THEN $2::date
               WHEN 'last_month' THEN date_trunc('month', $2::date)::date
               ELSE $2::date + 1
             END AT TIME ZONE b.timezone) AS range_end
           FROM branches b WHERE b.id = $1
         )
         SELECT
           (SELECT COUNT(*) FROM appointments a CROSS JOIN bounds
             WHERE a.branch_id = $1 AND a.starts_at >= bounds.range_start AND a.starts_at < bounds.range_end
               AND a.status <> 'cancelled') AS customers,
           COALESCE(SUM(i.total) FILTER (WHERE i.status = 'paid'), 0) AS revenue,
           COUNT(*) FILTER (WHERE i.status = 'paid') AS invoices,
           COUNT(*) FILTER (WHERE i.status = 'refunded') AS returns
         FROM invoices i CROSS JOIN bounds
         WHERE i.branch_id = $1 AND i.issued_at >= bounds.range_start AND i.issued_at < bounds.range_end`,
        [branchId, date, period],
      ),
    ]);

    if (branchResult.rowCount === 0) {
      const error = new Error('Branch not found');
      error.status = 404;
      error.code = 'BRANCH_NOT_FOUND';
      throw error;
    }

    const [customerChartResult, revenueChartResult, topGoodsResult, upcomingResult, remindersResult, activitiesResult] = await Promise.all([
      client.query(
        `WITH bounds AS (
           SELECT
             (CASE $3
               WHEN 'today' THEN $2::date
               WHEN 'yesterday' THEN $2::date - 1
               WHEN 'last_7_days' THEN $2::date - 6
               WHEN 'last_month' THEN (date_trunc('month', $2::date) - INTERVAL '1 month')::date
               ELSE date_trunc('month', $2::date)::date
             END AT TIME ZONE b.timezone) AS range_start,
             (CASE $3 WHEN 'yesterday' THEN $2::date WHEN 'last_month' THEN date_trunc('month', $2::date)::date ELSE $2::date + 1 END AT TIME ZONE b.timezone) AS range_end,
             b.timezone
           FROM branches b WHERE b.id = $1
         ), base AS (
           SELECT a.starts_at AT TIME ZONE bounds.timezone AS local_time
           FROM appointments a CROSS JOIN bounds
           WHERE a.branch_id = $1 AND a.starts_at >= bounds.range_start AND a.starts_at < bounds.range_end
             AND a.status <> 'cancelled'
         )
         SELECT 'hour'::text AS period, EXTRACT(HOUR FROM local_time)::int::text AS bucket, COUNT(*) AS visits
         FROM base GROUP BY bucket
         UNION ALL
         SELECT 'day', TO_CHAR(local_time, 'YYYY-MM-DD'), COUNT(*) FROM base GROUP BY 2
         UNION ALL
         SELECT 'weekday', EXTRACT(ISODOW FROM local_time)::int::text, COUNT(*) FROM base GROUP BY 2
         ORDER BY period, bucket`,
        [branchId, date, period],
      ),
      client.query(
        `WITH bounds AS (
           SELECT
             (CASE $3
               WHEN 'today' THEN $2::date
               WHEN 'yesterday' THEN $2::date - 1
               WHEN 'last_7_days' THEN $2::date - 6
               WHEN 'last_month' THEN (date_trunc('month', $2::date) - INTERVAL '1 month')::date
               ELSE date_trunc('month', $2::date)::date
             END AT TIME ZONE b.timezone) AS range_start,
             (CASE $3 WHEN 'yesterday' THEN $2::date WHEN 'last_month' THEN date_trunc('month', $2::date)::date ELSE $2::date + 1 END AT TIME ZONE b.timezone) AS range_end,
             b.timezone
           FROM branches b WHERE b.id = $1
         ), base AS (
           SELECT i.issued_at AT TIME ZONE bounds.timezone AS local_time, i.total
           FROM invoices i CROSS JOIN bounds
           WHERE i.branch_id = $1 AND i.issued_at >= bounds.range_start AND i.issued_at < bounds.range_end
             AND i.status = 'paid'
         )
         SELECT 'hour'::text AS period, EXTRACT(HOUR FROM local_time)::int::text AS bucket, COALESCE(SUM(total), 0) AS revenue
         FROM base GROUP BY bucket
         UNION ALL
         SELECT 'day', TO_CHAR(local_time, 'YYYY-MM-DD'), COALESCE(SUM(total), 0) FROM base GROUP BY 2
         UNION ALL
         SELECT 'weekday', EXTRACT(ISODOW FROM local_time)::int::text, COALESCE(SUM(total), 0) FROM base GROUP BY 2
         ORDER BY period, bucket`,
        [branchId, date, period],
      ),
      client.query(
        `WITH bounds AS (
           SELECT
             (CASE $3
               WHEN 'today' THEN $2::date
               WHEN 'yesterday' THEN $2::date - 1
               WHEN 'last_7_days' THEN $2::date - 6
               WHEN 'last_month' THEN (date_trunc('month', $2::date) - INTERVAL '1 month')::date
               ELSE date_trunc('month', $2::date)::date
             END AT TIME ZONE b.timezone) AS range_start,
             (CASE $3 WHEN 'yesterday' THEN $2::date WHEN 'last_month' THEN date_trunc('month', $2::date)::date ELSE $2::date + 1 END AT TIME ZONE b.timezone) AS range_end
           FROM branches b WHERE b.id = $1
         ), goods AS (
           SELECT ii.item_type::text, COALESCE(s.id, p.id) AS item_id,
                  COALESCE(s.code, p.sku) AS code, COALESCE(s.name, p.name, ii.description) AS name,
                  SUM(ii.quantity) AS quantity, SUM(ii.line_total) AS revenue
           FROM invoices i
           JOIN invoice_items ii ON ii.invoice_id = i.id
           LEFT JOIN services s ON ii.item_type = 'service' AND s.id = ii.service_id
           LEFT JOIN products p ON ii.item_type = 'product' AND p.id = ii.product_id
           CROSS JOIN bounds
           WHERE i.branch_id = $1 AND i.status = 'paid'
             AND i.issued_at >= bounds.range_start AND i.issued_at < bounds.range_end
           GROUP BY ii.item_type, COALESCE(s.id, p.id), COALESCE(s.code, p.sku), COALESCE(s.name, p.name, ii.description)
           UNION ALL
           SELECT 'package', sp.id, sp.code, sp.name, COUNT(*)::numeric, SUM(cp.sale_price)
           FROM customer_packages cp JOIN service_packages sp ON sp.id = cp.package_id CROSS JOIN bounds
           WHERE cp.branch_id = $1 AND cp.status <> 'cancelled'
             AND cp.sold_at >= bounds.range_start AND cp.sold_at < bounds.range_end
           GROUP BY sp.id, sp.code, sp.name
           UNION ALL
           SELECT 'account_card', ac.id, ac.code, ac.name, COUNT(*)::numeric, SUM(cac.sale_price)
           FROM customer_account_cards cac JOIN account_cards ac ON ac.id = cac.account_card_id CROSS JOIN bounds
           WHERE cac.branch_id = $1 AND cac.status <> 'cancelled'
             AND cac.sold_at >= bounds.range_start AND cac.sold_at < bounds.range_end
           GROUP BY ac.id, ac.code, ac.name
         ), ranked AS (
           SELECT goods.*,
                  ROW_NUMBER() OVER (PARTITION BY item_type ORDER BY revenue DESC, quantity DESC, item_id) AS revenue_rank,
                  ROW_NUMBER() OVER (PARTITION BY item_type ORDER BY quantity DESC, revenue DESC, item_id) AS quantity_rank
           FROM goods
         )
         SELECT item_type, item_id, code, name, quantity, revenue
         FROM ranked WHERE revenue_rank <= 5 OR quantity_rank <= 5
         ORDER BY item_type, revenue DESC, quantity DESC`,
        [branchId, date, period],
      ),
      client.query(
        `WITH bounds AS (
           SELECT
             ($2::date AT TIME ZONE b.timezone) AS day_start,
             (($2::date + 1) AT TIME ZONE b.timezone) AS day_end,
             b.timezone
           FROM branches b WHERE b.id = $1
         )
         SELECT a.id, c.name AS customer_name, s.name AS service_name, a.note,
                TO_CHAR(a.starts_at AT TIME ZONE bounds.timezone, 'HH24:MI') AS time
         FROM appointments a
         JOIN customers c ON c.id = a.customer_id
         LEFT JOIN services s ON s.id = a.service_id
         CROSS JOIN bounds
         WHERE a.branch_id = $1 AND a.starts_at >= bounds.day_start AND a.starts_at < bounds.day_end
           AND a.status IN ('pending', 'confirmed', 'in_service')
         ORDER BY a.starts_at LIMIT 5`,
        [branchId, date],
      ),
      client.query(
        `SELECT
           (SELECT COUNT(*) FROM customers WHERE branch_id = $1 AND debt_balance > 0) AS customers_in_debt,
           (SELECT COUNT(*) FROM inventory_balances ib JOIN products p ON p.id = ib.product_id
             WHERE ib.branch_id = $1 AND ib.quantity < p.min_stock) AS products_below_stock,
           (SELECT COUNT(*) FROM inventory_balances ib JOIN products p ON p.id = ib.product_id
             WHERE ib.branch_id = $1 AND p.max_stock IS NOT NULL AND ib.quantity > p.max_stock) AS products_above_stock`,
        [branchId],
      ),
      client.query(
        `SELECT a.id, a.action, a.object_type, a.object_code, a.description, a.occurred_at,
                COALESCE(s.name, 'Lễ tân') AS actor_name, COALESCE(s.avatar_tone, 'blue') AS avatar_tone
         FROM activities a LEFT JOIN staff s ON s.id = a.actor_staff_id
         WHERE a.branch_id = $1 ORDER BY a.occurred_at DESC LIMIT 3`,
        [branchId],
      ),
    ]);

    const appointment = appointmentResult.rows[0];
    const customer = customerResult.rows[0];
    const cash = cashResult.rows[0];
    const month = monthResult.rows[0];
    const previousTotal = number(appointment.previous_total);
    const appointmentTotal = number(appointment.total);
    const completed = number(appointment.completed);

    await client.query('COMMIT');

    return {
      meta: {
        branch: branchResult.rows[0],
        date,
        period,
        generatedAt: new Date().toISOString(),
      },
      summary: {
        appointments: {
          total: appointmentTotal,
          completed,
          completionRate: appointmentTotal ? round((completed / appointmentTotal) * 100) : 0,
          previousTotal,
          changePercent: previousTotal ? round(((appointmentTotal - previousTotal) / previousTotal) * 100) : 0,
        },
        customers: {
          total: number(customer.total),
          new: number(customer.new_count),
          returning: number(customer.returning_count),
          walkIn: number(customer.walk_in_count),
        },
        cash: {
          income: number(cash.income),
          expense: number(cash.expense),
        },
      },
      month: {
        customers: number(month.customers),
        revenue: number(month.revenue),
        invoices: number(month.invoices),
        returns: number(month.returns),
      },
      charts: {
        customersByHour: fillHourly(customerChartResult.rows, 'visits'),
        customersByDay: fillDaily(customerChartResult.rows, 'visits', date, period),
        customersByWeekday: fillWeekday(customerChartResult.rows, 'visits'),
        revenueByHour: fillHourly(revenueChartResult.rows, 'revenue'),
        revenueByDay: fillDaily(revenueChartResult.rows, 'revenue', date, period),
        revenueByWeekday: fillWeekday(revenueChartResult.rows, 'revenue'),
      },
      topGoods: topGoodsResult.rows.map((row) => ({
        itemType: row.item_type,
        id: number(row.item_id),
        code: row.code,
        name: row.name,
        quantity: number(row.quantity),
        revenue: number(row.revenue),
      })),
      upcomingAppointments: upcomingResult.rows.map((row) => ({
        id: number(row.id),
        customerName: row.customer_name,
        serviceName: row.service_name,
        note: row.note,
        time: row.time,
      })),
      reminders: {
        customersInDebt: number(remindersResult.rows[0].customers_in_debt),
        productsBelowStock: number(remindersResult.rows[0].products_below_stock),
        productsAboveStock: number(remindersResult.rows[0].products_above_stock),
      },
      activities: activitiesResult.rows.map((row) => ({
        id: number(row.id),
        action: row.action,
        objectType: row.object_type,
        objectCode: row.object_code,
        description: row.description,
        actorName: row.actor_name,
        avatarTone: row.avatar_tone,
        occurredAt: row.occurred_at,
      })),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
