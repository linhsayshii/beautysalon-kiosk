import { createHash } from 'node:crypto';
import { pool } from '../../db.js';
import { HttpError } from '../../lib/http.js';
import { broadcastToBranch, realtimeEvents } from '../../lib/ws.js';

export function money(value, field = 'Số tiền') {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') throw new HttpError(400, 'INVALID_AMOUNT', `${field} không hợp lệ`);
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999999999.99 || Number(amount.toFixed(2)) !== amount) throw new HttpError(400, 'INVALID_AMOUNT', `${field} không hợp lệ`);
  return amount;
}
export const roundMoney = (n) => Math.round(n * 100) / 100;
export function settlement(total, amountPaid, method, allowDebt) {
  total = money(total, 'Tổng hóa đơn');
  const tendered = amountPaid == null ? total : money(amountPaid);
  if (method === 'mixed') throw new HttpError(400, 'PAYMENT_METHOD_UNSUPPORTED', 'Vui lòng chọn một phương thức thanh toán');
  if (method === 'wallet' && tendered !== total) throw new HttpError(400, 'WALLET_FULL_PAYMENT_REQUIRED', 'Thẻ tài khoản cần thanh toán đủ');
  if (method !== 'cash' && tendered > total) throw new HttpError(400, 'OVERPAYMENT', 'Số tiền thanh toán vượt tổng hóa đơn');
  const paid = Math.min(total, tendered);
  const debt = roundMoney(total - paid);
  if (debt > 0 && allowDebt !== true) throw new HttpError(400, 'DEBT_CONFIRMATION_REQUIRED', 'Vui lòng cho phép ghi nợ phần còn lại');
  return { paid, debt, tendered, change: roundMoney(tendered - paid), paymentStatus: debt === 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid' };
}

export async function beginPaymentRequest(client, branchId, key, payload) {
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new HttpError(400, 'REQUEST_KEY_REQUIRED', 'Thiếu mã giao dịch hợp lệ, vui lòng tải lại màn hình');
  const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  await client.query('INSERT INTO payment_requests(branch_id,request_key,fingerprint) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [branchId,key,fingerprint]);
  const { rows } = await client.query('SELECT fingerprint,response FROM payment_requests WHERE branch_id=$1 AND request_key=$2 FOR UPDATE', [branchId,key]);
  if (rows[0].fingerprint !== fingerprint) throw new HttpError(409, 'REQUEST_KEY_CONFLICT', 'Mã giao dịch đã dùng cho nội dung khác');
  return rows[0].response;
}
export async function finishPaymentRequest(client, branchId, key, response) {
  await client.query('UPDATE payment_requests SET response=$3 WHERE branch_id=$1 AND request_key=$2', [branchId,key,JSON.stringify(response)]);
}
export async function recordPayment(client, { branchId, customerId, amount, paymentMethod, actorAccountId, note }) {
  const { rows } = await client.query(`INSERT INTO customer_payments(branch_id,customer_id,amount,payment_method,actor_account_id,note) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [branchId,customerId,amount,paymentMethod,actorAccountId || null,note || '']);
  return Number(rows[0].id);
}
export async function getCustomerDebt({ branchId, customerId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const customer = await client.query('SELECT debt_balance,opening_debt FROM customers WHERE id=$1 AND branch_id=$2', [customerId,branchId]);
    if (!customer.rows[0]) throw new HttpError(404,'CUSTOMER_NOT_FOUND','Không tìm thấy khách hàng');
    const invoices = await client.query(`SELECT id,code,total,amount_paid,issued_at FROM invoices WHERE branch_id=$1 AND customer_id=$2 AND status='paid' AND amount_paid<total ORDER BY issued_at,id`, [branchId,customerId]);
    const entries = await client.query(`SELECT e.*,i.code AS invoice_code,a.display_name AS actor_name,p.payment_method,p.note, COALESCE((SELECT json_agg(json_build_object('invoiceCode', ai.code, 'amount', pa.amount) ORDER BY pa.id) FROM customer_payment_allocations pa LEFT JOIN invoices ai ON ai.id=pa.invoice_id WHERE pa.payment_id=e.payment_id), '[]'::json) AS allocations FROM customer_debt_entries e LEFT JOIN invoices i ON i.id=e.invoice_id LEFT JOIN user_accounts a ON a.id=e.actor_account_id LEFT JOIN customer_payments p ON p.id=e.payment_id WHERE e.branch_id=$1 AND e.customer_id=$2 ORDER BY e.id DESC LIMIT 200`, [branchId,customerId]);
    await client.query('COMMIT');
    return { balance: Number(customer.rows[0].debt_balance), openingDebt: Number(customer.rows[0].opening_debt), invoices: invoices.rows.map(r=>({id:Number(r.id),code:r.code,total:Number(r.total),amountPaid:Number(r.amount_paid),debtAmount:roundMoney(Number(r.total)-Number(r.amount_paid)),issuedAt:r.issued_at})), entries: entries.rows.map(r=>({id:Number(r.id),kind:r.kind,amount:Number(r.amount),balanceAfter:Number(r.balance_after),invoiceCode:r.invoice_code,actorName:r.actor_name,paymentMethod:r.payment_method,note:r.note,allocations:r.allocations,createdAt:r.created_at})) };
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally {client.release();}
}

export async function collectCustomerDebt({branchId,customerId,actorAccountId,amount,paymentMethod,note='',invoiceId=null,requestKey}) {
  amount = money(amount);
  if (amount <= 0) throw new HttpError(400,'INVALID_AMOUNT','Số tiền thu phải lớn hơn 0');
  if (!['cash','bank_transfer','card'].includes(paymentMethod)) throw new HttpError(400,'INVALID_PAYMENT_METHOD','Phương thức thu nợ không hợp lệ');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const replay = await beginPaymentRequest(client,branchId,requestKey,{operation:'collect',customerId,actorAccountId,amount,paymentMethod,note,invoiceId});
    if (replay) {await client.query('COMMIT');return replay;}
    const { rows } = await client.query('SELECT debt_balance,opening_debt FROM customers WHERE id=$1 AND branch_id=$2 FOR UPDATE',[customerId,branchId]);
    if (!rows[0]) throw new HttpError(404,'CUSTOMER_NOT_FOUND','Không tìm thấy khách hàng');
    if (amount > Number(rows[0].debt_balance)) throw new HttpError(409,'DEBT_CHANGED','Số tiền thu vượt dư nợ hiện tại, vui lòng tải lại');
    const invoices = await client.query(`SELECT id,total,amount_paid FROM invoices WHERE branch_id=$1 AND customer_id=$2 AND status='paid' AND amount_paid<total AND ($3::bigint IS NULL OR id=$3) ORDER BY issued_at,id FOR UPDATE`,[branchId,customerId,invoiceId]);
    const opening = invoiceId ? 0 : Number(rows[0].opening_debt);
    const available = roundMoney(opening + invoices.rows.reduce((s,r)=>s+Number(r.total)-Number(r.amount_paid),0));
    if (amount > available) throw new HttpError(409,'DEBT_CHANGED','Số tiền vượt khoản nợ được chọn');
    const paymentId = await recordPayment(client,{branchId,customerId,amount,paymentMethod,actorAccountId,note});
    let remaining = amount;
    const allocations = [];
    if (opening > 0) {
      const applied = Math.min(opening,remaining);
      await client.query('UPDATE customers SET opening_debt=opening_debt-$2 WHERE id=$1',[customerId,applied]);
      allocations.push({invoiceId:null,amount:applied});remaining=roundMoney(remaining-applied);
    }
    for (const invoice of invoices.rows) {
      if (remaining <= 0) break;
      const applied = Math.min(remaining,roundMoney(Number(invoice.total)-Number(invoice.amount_paid)));
      await client.query('UPDATE invoices SET amount_paid=amount_paid+$2 WHERE id=$1',[invoice.id,applied]);
      allocations.push({invoiceId:Number(invoice.id),amount:applied});remaining=roundMoney(remaining-applied);
    }
    for (const allocation of allocations) await client.query('INSERT INTO customer_payment_allocations(payment_id,invoice_id,amount) VALUES($1,$2,$3)',[paymentId,allocation.invoiceId,allocation.amount]);
    const balance = roundMoney(Number(rows[0].debt_balance)-amount);
    await client.query('UPDATE customers SET debt_balance=$2 WHERE id=$1',[customerId,balance]);
    await client.query(`INSERT INTO customer_debt_entries(branch_id,customer_id,payment_id,invoice_id,kind,amount,balance_after,actor_account_id) VALUES($1,$2,$3,$4,'collection',$5,$6,$7)`,[branchId,customerId,paymentId,invoiceId,-amount,balance,actorAccountId]);
    await client.query(`INSERT INTO cash_transactions(branch_id,transaction_type,category,amount,note,occurred_at) VALUES($1,'income','Thu công nợ khách hàng',$2,$3,NOW())`,[branchId,amount,`Thu nợ KH #${customerId} · Phiếu #${paymentId} (${paymentMethod}) ${note}`]);
    const response = {paymentId,amount,balance,allocations};
    await finishPaymentRequest(client,branchId,requestKey,response);
    await client.query('COMMIT');
    broadcastToBranch(branchId,realtimeEvents.invoiceUpdated,{customerId,action:'debt-collected'});
    return response;
  } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
}
