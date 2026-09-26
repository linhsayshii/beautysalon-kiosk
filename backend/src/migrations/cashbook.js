// Upgrades the legacy cash journal into the cashbook ledger. Every step is
// idempotent: backfills only touch rows whose new columns are still NULL, so a
// restart never rewrites vouchers or resets balances.
export const cashbookMigration = `
ALTER TABLE cash_transactions
 ADD COLUMN IF NOT EXISTS code VARCHAR(20),
 ADD COLUMN IF NOT EXISTS fund VARCHAR(10),
 ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30),
 ADD COLUMN IF NOT EXISTS category_key VARCHAR(40),
 ADD COLUMN IF NOT EXISTS source_type VARCHAR(30),
 ADD COLUMN IF NOT EXISTS source_id BIGINT,
 ADD COLUMN IF NOT EXISTS counterparty_type VARCHAR(20),
 ADD COLUMN IF NOT EXISTS counterparty_id BIGINT,
 ADD COLUMN IF NOT EXISTS counterparty_name VARCHAR(200),
 ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES user_accounts(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS status VARCHAR(12) NOT NULL DEFAULT 'active',
 ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS cancelled_by BIGINT REFERENCES user_accounts(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
 ADD COLUMN IF NOT EXISTS transfer_group UUID;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_transactions_fund_check') THEN
  ALTER TABLE cash_transactions ADD CONSTRAINT cash_transactions_fund_check CHECK (fund IS NULL OR fund IN ('cash','bank'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_transactions_status_check') THEN
  ALTER TABLE cash_transactions ADD CONSTRAINT cash_transactions_status_check CHECK (status IN ('active','cancelled'));
 END IF;
END $$;

-- Legacy rows kept the payment method only inside the note text.
UPDATE cash_transactions
SET payment_method = substring(note from '\\((cash|bank_transfer|card|transfer|wallet)\\)')
WHERE category_key IS NULL AND payment_method IS NULL;

UPDATE cash_transactions SET payment_method = 'wallet'
WHERE category_key IS NULL AND category = 'Thu tiền qua thẻ tài khoản';

UPDATE cash_transactions c
SET payment_method = COALESCE((
  SELECT p.payment_method FROM payroll_payments p
  WHERE p.branch_id = c.branch_id AND p.amount = c.amount
  ORDER BY ABS(EXTRACT(EPOCH FROM p.paid_at - c.created_at)) LIMIT 1
), 'transfer')
WHERE c.category_key IS NULL AND c.payment_method IS NULL AND c.category = 'Chi trả lương nhân viên';

UPDATE cash_transactions SET
 fund = CASE
   WHEN payment_method = 'wallet' THEN NULL
   WHEN payment_method IN ('bank_transfer','card','transfer') THEN 'bank'
   ELSE 'cash' END,
 source_type = CASE category
   WHEN 'Thu tiền bán hàng POS' THEN 'invoice'
   WHEN 'Thu tiền qua thẻ tài khoản' THEN 'invoice'
   WHEN 'Thu công nợ khách hàng' THEN 'customer_payment'
   WHEN 'Chi trả lương nhân viên' THEN 'payroll_payment'
   ELSE 'manual' END,
 category_key = CASE category
   WHEN 'Thu tiền bán hàng POS' THEN 'sales'
   WHEN 'Thu tiền qua thẻ tài khoản' THEN 'wallet_payment'
   WHEN 'Thu công nợ khách hàng' THEN 'debt_collection'
   WHEN 'Chi trả lương nhân viên' THEN 'salary'
   ELSE CASE WHEN transaction_type = 'income' THEN 'other_income' ELSE 'other_expense' END END
WHERE category_key IS NULL;

UPDATE cash_transactions c
SET source_id = i.id, counterparty_type = 'customer', counterparty_id = cu.id, counterparty_name = cu.name
FROM invoices i LEFT JOIN customers cu ON cu.id = i.customer_id
WHERE c.source_type = 'invoice' AND c.source_id IS NULL AND i.branch_id = c.branch_id
  AND c.note LIKE 'Thu tiền hóa đơn ' || i.code || ' %';

UPDATE cash_transactions c
SET source_id = substring(c.note from 'Phiếu #([0-9]+)')::bigint,
    counterparty_type = 'customer', counterparty_id = cu.id, counterparty_name = cu.name
FROM customers cu
WHERE c.source_type = 'customer_payment' AND c.source_id IS NULL
  AND c.note ~ '^Thu nợ KH #[0-9]+ · Phiếu #[0-9]+'
  AND cu.id = substring(c.note from 'KH #([0-9]+)')::bigint AND cu.branch_id = c.branch_id;

WITH numbered AS (
  SELECT id, branch_id, CASE WHEN transaction_type = 'income' THEN 'PT' ELSE 'PC' END AS prefix,
    ROW_NUMBER() OVER (PARTITION BY branch_id, transaction_type ORDER BY occurred_at, id) AS rn
  FROM cash_transactions WHERE code IS NULL AND fund IS NOT NULL
)
UPDATE cash_transactions c
SET code = n.prefix || LPAD((COALESCE(m.max_no, 0) + n.rn)::text, 6, '0')
FROM numbered n
LEFT JOIN LATERAL (
  SELECT MAX(substring(x.code from 3)::integer) AS max_no FROM cash_transactions x
  WHERE x.branch_id = n.branch_id AND x.code ~ ('^' || n.prefix || '[0-9]+$')
) m ON TRUE
WHERE c.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cash_transactions_branch_code ON cash_transactions(branch_id, code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_transactions_fund ON cash_transactions(branch_id, fund, occurred_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_cash_transactions_source ON cash_transactions(source_type, source_id);
`;
