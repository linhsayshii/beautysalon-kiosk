// NULL marks legacy rows; restarts must never reset live balances.
export const customerDebtMigration = `
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14,2);
UPDATE invoices SET amount_paid = CASE WHEN status = 'paid' THEN total ELSE 0 END WHERE amount_paid IS NULL;
ALTER TABLE invoices ALTER COLUMN amount_paid SET DEFAULT 0;
ALTER TABLE invoices ALTER COLUMN amount_paid SET NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20)
 GENERATED ALWAYS AS (CASE WHEN amount_paid >= total THEN 'paid' WHEN amount_paid > 0 THEN 'partial' ELSE 'unpaid' END) STORED;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS opening_debt NUMERIC(14,2);
UPDATE customers SET opening_debt = debt_balance WHERE opening_debt IS NULL;
ALTER TABLE customers ALTER COLUMN opening_debt SET DEFAULT 0;
ALTER TABLE customers ALTER COLUMN opening_debt SET NOT NULL;
CREATE TABLE IF NOT EXISTS customer_payments (
 id BIGSERIAL PRIMARY KEY, branch_id BIGINT NOT NULL REFERENCES branches(id),
 customer_id BIGINT NOT NULL REFERENCES customers(id), amount NUMERIC(14,2) NOT NULL CHECK(amount > 0),
 payment_method VARCHAR(30) NOT NULL CHECK(payment_method IN ('cash','bank_transfer','card','wallet')),
 actor_account_id BIGINT REFERENCES user_accounts(id), note TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS customer_payment_allocations (
 id BIGSERIAL PRIMARY KEY, payment_id BIGINT NOT NULL REFERENCES customer_payments(id),
 invoice_id BIGINT REFERENCES invoices(id), amount NUMERIC(14,2) NOT NULL CHECK(amount > 0)
);
CREATE TABLE IF NOT EXISTS customer_debt_entries (
 id BIGSERIAL PRIMARY KEY, branch_id BIGINT NOT NULL REFERENCES branches(id),
 customer_id BIGINT NOT NULL REFERENCES customers(id), invoice_id BIGINT REFERENCES invoices(id),
 payment_id BIGINT REFERENCES customer_payments(id), kind VARCHAR(20) NOT NULL CHECK(kind IN ('opening','charge','collection')),
 amount NUMERIC(14,2) NOT NULL, balance_after NUMERIC(14,2) NOT NULL CHECK(balance_after >= 0),
 actor_account_id BIGINT REFERENCES user_accounts(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_debt_opening_unique ON customer_debt_entries(customer_id) WHERE kind = 'opening';
INSERT INTO customer_debt_entries(branch_id,customer_id,kind,amount,balance_after)
 SELECT branch_id,id,'opening',opening_debt,opening_debt FROM customers WHERE opening_debt > 0
 ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS customer_debt_history ON customer_debt_entries(branch_id,customer_id,id DESC);
CREATE INDEX IF NOT EXISTS customer_payments_history ON customer_payments(branch_id,customer_id,id DESC);
CREATE INDEX IF NOT EXISTS invoices_outstanding ON invoices(branch_id,customer_id,issued_at,id) WHERE status = 'paid' AND amount_paid < total;
CREATE TABLE IF NOT EXISTS payment_requests (
 branch_id BIGINT NOT NULL REFERENCES branches(id), request_key VARCHAR(100) NOT NULL,
 fingerprint TEXT NOT NULL, response JSONB, PRIMARY KEY(branch_id,request_key)
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_amount_paid_bounds') THEN
  ALTER TABLE invoices ADD CONSTRAINT invoices_amount_paid_bounds CHECK(amount_paid >= 0 AND amount_paid <= total);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_opening_debt_bounds') THEN
  ALTER TABLE customers ADD CONSTRAINT customers_opening_debt_bounds CHECK(opening_debt >= 0);
 END IF;
END $$;
`;
