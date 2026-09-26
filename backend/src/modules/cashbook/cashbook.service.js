import { randomUUID } from 'node:crypto';
import { pool } from '../../db.js';
import { HttpError } from '../../lib/http.js';
import { broadcastToBranch, realtimeEvents } from '../../lib/ws.js';
import { beginPaymentRequest, finishPaymentRequest, money } from '../debts/debts.service.js';
import { cashCategory, recordCashEntry } from './cashbook.ledger.js';

const number = (value) => Number(value ?? 0);
const TRANSFER_CATEGORIES = ['fund_transfer_in', 'fund_transfer_out'];
// Only vouchers created on the cashbook itself can be cancelled there; the
// others belong to an invoice, debt payment, payroll or purchase order.
const CANCELLABLE_SOURCES = ['manual', 'transfer', 'opening'];

const boundsCte = `
  WITH bounds AS (
    SELECT ($2::date AT TIME ZONE b.timezone) AS range_start,
           (($3::date + 1) AT TIME ZONE b.timezone) AS range_end
    FROM branches b WHERE b.id = $1
  )`;

async function readOnly(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function positiveAmount(value) {
  const amount = money(value);
  if (amount <= 0) throw new HttpError(400, 'INVALID_AMOUNT', 'Số tiền phải lớn hơn 0');
  return amount;
}

function assertNotFuture(occurredAt) {
  if (occurredAt && occurredAt.getTime() > Date.now() + 60_000) {
    throw new HttpError(400, 'INVALID_ARGUMENT', 'Thời gian phiếu không được ở tương lai');
  }
}

function emptyFund(fund) {
  return { fund, opening: 0, income: 0, expense: 0, closing: 0, currentBalance: 0 };
}

export async function getCashbookSummary({ branchId, dateFrom, dateTo }) {
  return readOnly(async (client) => {
    const { rows } = await client.query(
      `${boundsCte}
       SELECT c.fund,
         COALESCE(SUM(CASE WHEN c.transaction_type = 'income' THEN c.amount ELSE -c.amount END)
           FILTER (WHERE c.occurred_at < bounds.range_start), 0) AS opening,
         COALESCE(SUM(c.amount) FILTER (WHERE c.transaction_type = 'income'
           AND c.occurred_at >= bounds.range_start AND c.occurred_at < bounds.range_end), 0) AS income,
         COALESCE(SUM(c.amount) FILTER (WHERE c.transaction_type = 'expense'
           AND c.occurred_at >= bounds.range_start AND c.occurred_at < bounds.range_end), 0) AS expense,
         COALESCE(SUM(c.amount) FILTER (WHERE c.category_key = ANY($4::text[])
           AND c.occurred_at >= bounds.range_start AND c.occurred_at < bounds.range_end), 0) AS transfers,
         COALESCE(SUM(CASE WHEN c.transaction_type = 'income' THEN c.amount ELSE -c.amount END), 0) AS current_balance
       FROM cash_transactions c CROSS JOIN bounds
       WHERE c.branch_id = $1 AND c.fund IS NOT NULL AND c.status = 'active'
       GROUP BY c.fund`,
      [branchId, dateFrom, dateTo, TRANSFER_CATEGORIES],
    );
    const funds = ['cash', 'bank'].map((fund) => {
      const row = rows.find((candidate) => candidate.fund === fund);
      if (!row) return emptyFund(fund);
      const opening = number(row.opening);
      const income = number(row.income);
      const expense = number(row.expense);
      return { fund, opening, income, expense, closing: opening + income - expense, currentBalance: number(row.current_balance), transfers: number(row.transfers) };
    });
    // Transfers move money between funds: they net to zero and are left out
    // of the combined income/expense totals.
    const transfers = funds.reduce((sum, fund) => sum + (fund.transfers ?? 0), 0) / 2;
    const total = {
      opening: funds.reduce((sum, fund) => sum + fund.opening, 0),
      income: funds.reduce((sum, fund) => sum + fund.income, 0) - transfers,
      expense: funds.reduce((sum, fund) => sum + fund.expense, 0) - transfers,
      closing: funds.reduce((sum, fund) => sum + fund.closing, 0),
      currentBalance: funds.reduce((sum, fund) => sum + fund.currentBalance, 0),
    };
    return { dateFrom, dateTo, funds: funds.map(({ transfers: _transfers, ...fund }) => fund), total };
  });
}

const voucherSelect = `
  SELECT c.id, c.code, c.transaction_type, c.fund, c.payment_method, c.category, c.category_key,
    c.amount, c.note, c.occurred_at, c.created_at, c.source_type, c.source_id,
    c.counterparty_type, c.counterparty_id, c.counterparty_name, c.status,
    c.cancelled_at, c.cancel_reason, c.transfer_group,
    creator.display_name AS created_by_name, canceller.display_name AS cancelled_by_name,
    CASE c.source_type
      WHEN 'invoice' THEN i.code
      WHEN 'purchase_order' THEN po.code
      WHEN 'payroll_payment' THEN pp_period.code
      ELSE NULL END AS source_code
  FROM cash_transactions c
  LEFT JOIN user_accounts creator ON creator.id = c.created_by
  LEFT JOIN user_accounts canceller ON canceller.id = c.cancelled_by
  LEFT JOIN invoices i ON c.source_type = 'invoice' AND i.id = c.source_id
  LEFT JOIN purchase_orders po ON c.source_type = 'purchase_order' AND po.id = c.source_id
  LEFT JOIN payroll_payments pp ON c.source_type = 'payroll_payment' AND pp.id = c.source_id
  LEFT JOIN payroll_periods pp_period ON pp_period.id = pp.payroll_period_id`;

function mapVoucher(row) {
  return {
    id: number(row.id),
    code: row.code,
    type: row.transaction_type,
    fund: row.fund,
    paymentMethod: row.payment_method,
    categoryKey: row.category_key,
    categoryLabel: cashCategory(row.category_key)?.label ?? row.category,
    amount: number(row.amount),
    note: row.note ?? '',
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    sourceType: row.source_type,
    sourceId: row.source_id == null ? null : number(row.source_id),
    sourceCode: row.source_code ?? null,
    counterpartyType: row.counterparty_type,
    counterpartyId: row.counterparty_id == null ? null : number(row.counterparty_id),
    counterpartyName: row.counterparty_name ?? '',
    status: row.status,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason ?? '',
    cancelledByName: row.cancelled_by_name ?? null,
    createdByName: row.created_by_name ?? null,
    cancellable: row.status === 'active' && CANCELLABLE_SOURCES.includes(row.source_type),
  };
}

export async function listVouchers({ branchId, dateFrom, dateTo, type = '', fund = '', category = '', status = '', search = '', page, pageSize, offset }) {
  return readOnly(async (client) => {
    const parameters = [branchId, dateFrom, dateTo, type, fund, category, status, search];
    const filters = `
      c.branch_id = $1 AND c.fund IS NOT NULL
      AND c.occurred_at >= bounds.range_start AND c.occurred_at < bounds.range_end
      AND ($4 = '' OR c.transaction_type = $4)
      AND ($5 = '' OR c.fund = $5)
      AND ($6 = '' OR c.category_key = $6)
      AND ($7 = '' OR c.status = $7)
      AND ($8 = '' OR c.code ILIKE '%' || $8 || '%' OR c.counterparty_name ILIKE '%' || $8 || '%' OR c.note ILIKE '%' || $8 || '%')`;
    const rowsResult = await client.query(
      `${boundsCte}
       , page_ids AS (
         SELECT c.id, COUNT(*) OVER() AS filtered_total
         FROM cash_transactions c CROSS JOIN bounds
         WHERE ${filters}
         ORDER BY c.occurred_at DESC, c.id DESC
         LIMIT $9 OFFSET $10
       )
       ${voucherSelect}
       JOIN page_ids ON page_ids.id = c.id
       ORDER BY c.occurred_at DESC, c.id DESC`,
      [...parameters, pageSize, offset],
    );
    const summaryResult = await client.query(
      `${boundsCte}
       SELECT COUNT(*) AS total,
         COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'active' AND c.transaction_type = 'income'), 0) AS income,
         COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'active' AND c.transaction_type = 'expense'), 0) AS expense
       FROM cash_transactions c CROSS JOIN bounds
       WHERE ${filters}`,
      parameters,
    );
    const summary = summaryResult.rows[0];
    const totalItems = number(summary.total);
    return {
      items: rowsResult.rows.map(mapVoucher),
      pagination: { page, pageSize, total: totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) },
      summary: { total: totalItems, income: number(summary.income), expense: number(summary.expense) },
    };
  });
}

async function findVoucher(client, branchId, id) {
  const { rows } = await client.query(`${voucherSelect} WHERE c.branch_id = $1 AND c.id = $2 AND c.fund IS NOT NULL`, [branchId, id]);
  if (!rows[0]) throw new HttpError(404, 'VOUCHER_NOT_FOUND', 'Không tìm thấy phiếu thu chi');
  return mapVoucher(rows[0]);
}

export async function getVoucher({ branchId, id }) {
  return readOnly((client) => findVoucher(client, branchId, id));
}

export async function createVoucher({ branchId, actorAccountId, type, fund, categoryKey, amount, occurredAt = null, counterpartyName = '', note = '', requestKey }) {
  const category = cashCategory(categoryKey);
  if (!category || category.type !== type || !category.manual) {
    throw new HttpError(400, 'INVALID_CASH_CATEGORY', 'Loại thu chi không hợp lệ');
  }
  const value = positiveAmount(amount);
  assertNotFuture(occurredAt);
  const voucher = await inTransaction(async (client) => {
    const payload = { operation: 'cash-voucher', type, fund, categoryKey, amount: value, occurredAt: occurredAt?.toISOString() ?? null, counterpartyName, note, actorAccountId };
    const replay = await beginPaymentRequest(client, branchId, requestKey, payload);
    if (replay) return { ...replay, replayed: true };
    const entry = await recordCashEntry(client, {
      branchId, type, categoryKey, amount: value, fund,
      paymentMethod: fund === 'cash' ? 'cash' : 'bank_transfer',
      sourceType: 'manual',
      counterpartyType: counterpartyName ? 'other' : null,
      counterpartyName: counterpartyName || null,
      note, occurredAt, createdBy: actorAccountId,
    });
    const created = await findVoucher(client, branchId, entry.id);
    await finishPaymentRequest(client, branchId, requestKey, created);
    return created;
  });
  if (!voucher.replayed) broadcastToBranch(branchId, realtimeEvents.cashbookUpdated, { voucherId: voucher.id, action: 'created' });
  const { replayed: _replayed, ...result } = voucher;
  return result;
}

export async function createTransfer({ branchId, actorAccountId, fromFund, toFund, amount, occurredAt = null, note = '', requestKey }) {
  if (fromFund === toFund) throw new HttpError(400, 'INVALID_ARGUMENT', 'Quỹ chuyển và quỹ nhận phải khác nhau');
  const value = positiveAmount(amount);
  assertNotFuture(occurredAt);
  const result = await inTransaction(async (client) => {
    const payload = { operation: 'cash-transfer', fromFund, toFund, amount: value, occurredAt: occurredAt?.toISOString() ?? null, note, actorAccountId };
    const replay = await beginPaymentRequest(client, branchId, requestKey, payload);
    if (replay) return { ...replay, replayed: true };
    const transferGroup = randomUUID();
    // Both halves share one timestamp so neither fund briefly shows the move alone.
    const at = occurredAt ?? new Date();
    const common = { branchId, amount: value, sourceType: 'transfer', note, occurredAt: at, createdBy: actorAccountId, transferGroup };
    const out = await recordCashEntry(client, { ...common, type: 'expense', categoryKey: 'fund_transfer_out', fund: fromFund });
    const into = await recordCashEntry(client, { ...common, type: 'income', categoryKey: 'fund_transfer_in', fund: toFund });
    const response = { transferGroup, vouchers: [await findVoucher(client, branchId, out.id), await findVoucher(client, branchId, into.id)] };
    await finishPaymentRequest(client, branchId, requestKey, response);
    return response;
  });
  if (!result.replayed) broadcastToBranch(branchId, realtimeEvents.cashbookUpdated, { transferGroup: result.transferGroup, action: 'created' });
  const { replayed: _replayed, ...response } = result;
  return response;
}

export async function createOpeningBalance({ branchId, actorAccountId, fund, amount, occurredAt = null, note = '', requestKey }) {
  const value = positiveAmount(amount);
  assertNotFuture(occurredAt);
  const voucher = await inTransaction(async (client) => {
    const payload = { operation: 'cash-opening', fund, amount: value, occurredAt: occurredAt?.toISOString() ?? null, note, actorAccountId };
    const replay = await beginPaymentRequest(client, branchId, requestKey, payload);
    if (replay) return { ...replay, replayed: true };
    const entry = await recordCashEntry(client, {
      branchId, type: 'income', categoryKey: 'opening_balance', amount: value, fund,
      sourceType: 'opening', note, occurredAt, createdBy: actorAccountId,
    });
    const created = await findVoucher(client, branchId, entry.id);
    await finishPaymentRequest(client, branchId, requestKey, created);
    return created;
  });
  if (!voucher.replayed) broadcastToBranch(branchId, realtimeEvents.cashbookUpdated, { voucherId: voucher.id, action: 'created' });
  const { replayed: _replayed, ...result } = voucher;
  return result;
}

export async function cancelVoucher({ branchId, actorAccountId, id, reason }) {
  if (!reason) throw new HttpError(400, 'CANCEL_REASON_REQUIRED', 'Vui lòng nhập lý do hủy phiếu');
  const voucher = await inTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, status, source_type, transfer_group FROM cash_transactions
       WHERE branch_id = $1 AND id = $2 AND fund IS NOT NULL FOR UPDATE`,
      [branchId, id],
    );
    const row = rows[0];
    if (!row) throw new HttpError(404, 'VOUCHER_NOT_FOUND', 'Không tìm thấy phiếu thu chi');
    if (row.status === 'cancelled') throw new HttpError(409, 'VOUCHER_ALREADY_CANCELLED', 'Phiếu đã bị hủy trước đó');
    if (!CANCELLABLE_SOURCES.includes(row.source_type)) {
      throw new HttpError(409, 'VOUCHER_HAS_SOURCE', 'Phiếu tạo tự động từ chứng từ khác, không thể hủy tại sổ quỹ');
    }
    await client.query(
      `UPDATE cash_transactions
       SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $3, cancel_reason = $4
       WHERE branch_id = $1 AND status = 'active'
         AND (id = $2 OR ($5::uuid IS NOT NULL AND transfer_group = $5::uuid))`,
      [branchId, id, actorAccountId, reason, row.transfer_group],
    );
    return findVoucher(client, branchId, id);
  });
  broadcastToBranch(branchId, realtimeEvents.cashbookUpdated, { voucherId: voucher.id, action: 'cancelled' });
  return voucher;
}
