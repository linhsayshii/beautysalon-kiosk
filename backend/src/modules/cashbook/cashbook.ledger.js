import { domainOptions } from '../../domain-options.js';
import { HttpError } from '../../lib/http.js';

// Distinct advisory-lock namespace so voucher numbering never waits on the
// branch-wide locks used for customer and purchase-order codes.
const CASHBOOK_LOCK_NAMESPACE = 7301;

export const cashCategories = domainOptions.cashbook.categories;
const categoryByKey = new Map(cashCategories.map((category) => [category.key, category]));

export function cashCategory(key) {
  return categoryByKey.get(key) ?? null;
}

/** Prepaid wallet payments return null: they move no real money. */
export function fundForPaymentMethod(paymentMethod) {
  if (paymentMethod === 'wallet') return null;
  if (['bank_transfer', 'card', 'transfer'].includes(paymentMethod)) return 'bank';
  return 'cash';
}

export function voucherPrefix(type) {
  return type === 'income' ? 'PT' : 'PC';
}

const fundLabels = { cash: 'tiền mặt', bank: 'ngân hàng' };

/**
 * Rejects a change that would leave a fund below zero. `changes` maps a fund
 * to the signed amount about to be applied (negative = money leaving). Takes
 * the branch cashbook lock first so two concurrent spends cannot both pass.
 */
export async function assertFundsCover(client, branchId, changes) {
  await client.query('SELECT pg_advisory_xact_lock($1, $2)', [CASHBOOK_LOCK_NAMESPACE, Number(branchId)]);
  for (const [fund, change] of Object.entries(changes)) {
    if (!(change < 0)) continue;
    const { rows } = await client.query(
      `SELECT COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE -amount END), 0) AS balance
       FROM cash_transactions WHERE branch_id = $1 AND fund = $2 AND status = 'active'`,
      [branchId, fund],
    );
    const balance = Number(rows[0].balance);
    if (balance + change < 0) {
      throw new HttpError(
        409,
        'INSUFFICIENT_FUND_BALANCE',
        `Quỹ ${fundLabels[fund] ?? fund} không đủ số dư (hiện có ${balance.toLocaleString('vi-VN')}đ, cần ${(-change).toLocaleString('vi-VN')}đ)`,
        { fund, balance, required: -change },
      );
    }
  }
}

async function nextVoucherCode(client, branchId, type) {
  const prefix = voucherPrefix(type);
  await client.query('SELECT pg_advisory_xact_lock($1, $2)', [CASHBOOK_LOCK_NAMESPACE, Number(branchId)]);
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(substring(code from 3)::integer), 0) + 1 AS next_number
     FROM cash_transactions WHERE branch_id = $1 AND code ~ $2`,
    [branchId, `^${prefix}[0-9]+$`],
  );
  return `${prefix}${String(Number(rows[0].next_number)).padStart(6, '0')}`;
}

/**
 * Writes one cashbook voucher inside the caller's transaction. Returns null
 * (and writes nothing) for wallet payments, which never reach a fund.
 */
export async function recordCashEntry(client, {
  branchId,
  type,
  categoryKey,
  amount,
  paymentMethod = null,
  fund,
  sourceType = 'manual',
  sourceId = null,
  counterpartyType = null,
  counterpartyId = null,
  counterpartyName = null,
  note = null,
  occurredAt = null,
  createdBy = null,
  transferGroup = null,
}) {
  const category = cashCategory(categoryKey);
  if (!category || category.type !== type) {
    throw new HttpError(400, 'INVALID_CASH_CATEGORY', 'Loại thu chi không hợp lệ');
  }
  const resolvedFund = fund === undefined ? fundForPaymentMethod(paymentMethod) : fund;
  if (resolvedFund === null) return null;
  if (!(Number(amount) > 0)) return null;

  const code = await nextVoucherCode(client, branchId, type);
  const { rows } = await client.query(
    `INSERT INTO cash_transactions (
       branch_id, transaction_type, category, amount, note, occurred_at,
       code, fund, payment_method, category_key, source_type, source_id,
       counterparty_type, counterparty_id, counterparty_name, created_by, transfer_group
     ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING id, code, fund, occurred_at`,
    [
      branchId, type, category.label, amount, note || null, occurredAt,
      code, resolvedFund, paymentMethod, categoryKey, sourceType, sourceId,
      counterpartyType, counterpartyId, counterpartyName, createdBy, transferGroup,
    ],
  );
  return { id: Number(rows[0].id), code: rows[0].code, fund: rows[0].fund, occurredAt: rows[0].occurred_at };
}
