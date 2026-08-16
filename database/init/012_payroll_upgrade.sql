-- Migration 012: Upgrade Payroll Periods, Records and Payments Schema
-- Run automatically on startup to ensure existing PostgreSQL database volume is migrated

ALTER TABLE payroll_periods
  ADD COLUMN IF NOT EXISTS period_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS creator_type VARCHAR(20) NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS creator_name VARCHAR(100) DEFAULT 'Auto',
  ADD COLUMN IF NOT EXISTS approved_by_id BIGINT REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_data_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_status_check;
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_status_check
  CHECK (status IN ('draft', 'approved', 'cancelled', 'paid'));

ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS code VARCHAR(40),
  ADD COLUMN IF NOT EXISTS overtime_salary NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_income NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_units NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standard_work_days NUMERIC(10, 2) NOT NULL DEFAULT 26,
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE payroll_records DROP CONSTRAINT IF EXISTS payroll_records_status_check;
ALTER TABLE payroll_records ADD CONSTRAINT payroll_records_status_check
  CHECK (status IN ('draft', 'approved', 'cancelled', 'paid'));

CREATE TABLE IF NOT EXISTS payroll_payments (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  payroll_period_id BIGINT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  payroll_record_id BIGINT REFERENCES payroll_records(id) ON DELETE SET NULL,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'transfer',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_staff_id BIGINT REFERENCES staff(id) ON DELETE SET NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_branch ON payroll_periods(branch_id, starts_on DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON payroll_records(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_period ON payroll_payments(payroll_period_id);
