BEGIN;

ALTER TABLE customers
  ADD COLUMN customer_group VARCHAR(80) NOT NULL DEFAULT 'Cá nhân';

ALTER TABLE invoices
  ADD COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'bank_transfer', 'card', 'wallet', 'mixed')),
  ADD COLUMN sales_channel VARCHAR(30) NOT NULL DEFAULT 'salon'
    CHECK (sales_channel IN ('salon', 'online', 'phone'));

CREATE TABLE service_packages (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(220) NOT NULL,
  total_units INTEGER NOT NULL CHECK (total_units > 0),
  validity_days INTEGER CHECK (validity_days IS NULL OR validity_days > 0),
  list_price NUMERIC(14, 2) NOT NULL CHECK (list_price >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_packages (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  package_code VARCHAR(40) NOT NULL UNIQUE,
  package_id BIGINT NOT NULL REFERENCES service_packages(id) ON DELETE RESTRICT,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sale_price NUMERIC(14, 2) NOT NULL CHECK (sale_price >= 0),
  total_units INTEGER NOT NULL CHECK (total_units > 0),
  used_units INTEGER NOT NULL DEFAULT 0 CHECK (used_units >= 0 AND used_units <= total_units),
  sold_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE package_usages (
  id BIGSERIAL PRIMARY KEY,
  customer_package_id BIGINT NOT NULL REFERENCES customer_packages(id) ON DELETE CASCADE,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  units_used INTEGER NOT NULL DEFAULT 1 CHECK (units_used > 0),
  used_at TIMESTAMPTZ NOT NULL,
  note VARCHAR(250)
);

CREATE TABLE staff_schedules (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  shift_name VARCHAR(80) NOT NULL DEFAULT 'Ca làm việc',
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'leave', 'cancelled')),
  note VARCHAR(250),
  CHECK (ends_at > starts_at),
  UNIQUE (staff_id, shift_date, starts_at)
);

CREATE TABLE attendance_records (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  scheduled_minutes INTEGER NOT NULL DEFAULT 0 CHECK (scheduled_minutes >= 0),
  worked_minutes INTEGER NOT NULL DEFAULT 0 CHECK (worked_minutes >= 0),
  late_minutes INTEGER NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'late', 'leave', 'absent', 'working')),
  note VARCHAR(250),
  UNIQUE (staff_id, work_date)
);

CREATE TABLE payroll_periods (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  period_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'cancelled', 'paid')),
  creator_type VARCHAR(20) NOT NULL DEFAULT 'auto',
  creator_name VARCHAR(100) DEFAULT 'Auto',
  approved_by_id BIGINT REFERENCES staff(id) ON DELETE SET NULL,
  approved_by_name VARCHAR(100),
  approved_at TIMESTAMPTZ,
  updated_data_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE payroll_records (
  id BIGSERIAL PRIMARY KEY,
  payroll_period_id BIGINT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  code VARCHAR(40),
  base_salary NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  overtime_salary NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (overtime_salary >= 0),
  allowance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (allowance >= 0),
  bonus NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  commission NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (commission >= 0),
  deduction NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (deduction >= 0),
  total_income NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_income >= 0),
  net_salary NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (net_salary >= 0),
  paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  remaining_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (remaining_amount >= 0),
  work_units NUMERIC(10, 2) NOT NULL DEFAULT 0,
  standard_work_days NUMERIC(10, 2) NOT NULL DEFAULT 26,
  hourly_rate NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'cancelled', 'paid')),
  note TEXT,
  UNIQUE (payroll_period_id, staff_id)
);

CREATE TABLE payroll_payments (
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

CREATE INDEX idx_payroll_periods_branch ON payroll_periods(branch_id, starts_on DESC);
CREATE INDEX idx_payroll_records_period ON payroll_records(payroll_period_id);
CREATE INDEX idx_payroll_payments_period ON payroll_payments(payroll_period_id);

CREATE TABLE commission_records (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  invoice_id BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
  source_name VARCHAR(220) NOT NULL,
  revenue NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (revenue >= 0),
  rate NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  occurred_on DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid'))
);

CREATE TABLE staff_settings (
  staff_id BIGINT PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
  salary_type VARCHAR(30) NOT NULL DEFAULT 'monthly'
    CHECK (salary_type IN ('monthly', 'hourly', 'shift')),
  base_salary NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  hourly_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  default_commission_rate NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (default_commission_rate >= 0),
  can_sell BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_inventory BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_packages_branch_sold ON customer_packages(branch_id, sold_at DESC);
CREATE INDEX idx_customer_packages_customer ON customer_packages(customer_id, status);
CREATE INDEX idx_staff_schedules_branch_date ON staff_schedules(branch_id, shift_date);
CREATE INDEX idx_attendance_branch_date ON attendance_records(branch_id, work_date);
CREATE INDEX idx_commissions_branch_date ON commission_records(branch_id, occurred_on);

COMMIT;
