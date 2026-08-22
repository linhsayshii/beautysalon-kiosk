BEGIN;

-- ============================================================================
-- 1. CORE BRANCHES & SETTINGS
-- ============================================================================
CREATE TABLE branches (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  address VARCHAR(300),
  phone VARCHAR(30),
  email VARCHAR(160),
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  attendance_radius_m INTEGER NOT NULL DEFAULT 100 CHECK (attendance_radius_m BETWEEN 10 AND 1000),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. CUSTOMERS
-- ============================================================================
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(30),
  dob DATE,
  gender VARCHAR(20) DEFAULT NULL CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'Nam', 'Nữ', 'Khác')),
  email VARCHAR(160),
  facebook VARCHAR(255),
  customer_type VARCHAR(20) NOT NULL DEFAULT 'returning'
    CHECK (customer_type IN ('new', 'returning', 'walk_in')),
  customer_group VARCHAR(80) NOT NULL DEFAULT 'Cá nhân'
    CHECK (customer_group IN ('Cá nhân', 'Công ty')),
  debt_balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (debt_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_branch_debt ON customers(branch_id, debt_balance);

-- ============================================================================
-- 3. STAFF & HR
-- ============================================================================
CREATE TABLE staff (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  role VARCHAR(120) NOT NULL,
  avatar_tone VARCHAR(30) NOT NULL DEFAULT 'blue',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE TABLE user_accounts (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  staff_id BIGINT REFERENCES staff(id) ON DELETE SET NULL,
  username VARCHAR(80) NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('manager', 'cashier', 'staff')),
  phone VARCHAR(30),
  email VARCHAR(160),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_user_accounts_username_lower ON user_accounts (LOWER(username));
CREATE UNIQUE INDEX uq_user_accounts_staff ON user_accounts (staff_id) WHERE staff_id IS NOT NULL;

CREATE TABLE auth_sessions (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_sessions_expires ON auth_sessions(expires_at);

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

CREATE INDEX idx_staff_schedules_branch_date ON staff_schedules(branch_id, shift_date);

CREATE TABLE attendance_records (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  check_in_latitude NUMERIC(10, 7),
  check_in_longitude NUMERIC(10, 7),
  check_out_latitude NUMERIC(10, 7),
  check_out_longitude NUMERIC(10, 7),
  scheduled_minutes INTEGER NOT NULL DEFAULT 0 CHECK (scheduled_minutes >= 0),
  worked_minutes INTEGER NOT NULL DEFAULT 0 CHECK (worked_minutes >= 0),
  late_minutes INTEGER NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'late', 'leave', 'absent', 'working')),
  note VARCHAR(250),
  UNIQUE (staff_id, work_date)
);

CREATE INDEX idx_attendance_branch_date ON attendance_records(branch_id, work_date);

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

-- ============================================================================
-- 4. SERVICES & PRODUCTS & INVENTORY
-- ============================================================================
CREATE TABLE services (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Dịch vụ',
  brand VARCHAR(100),
  price NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
  cost_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  image_url TEXT,
  description TEXT,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  commission_type VARCHAR(20) CHECK (commission_type IN ('percent', 'fixed')),
  commission_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  sku VARCHAR(60) NOT NULL UNIQUE,
  barcode VARCHAR(80),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Chăm sóc salon',
  brand VARCHAR(100),
  unit VARCHAR(30) NOT NULL DEFAULT 'chai',
  sale_price NUMERIC(14, 2) NOT NULL CHECK (sale_price >= 0),
  cost_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  last_purchase_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (last_purchase_price >= 0),
  min_stock NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  max_stock NUMERIC(12, 2) CHECK (max_stock IS NULL OR max_stock >= min_stock),
  image_url TEXT,
  description TEXT,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  commission_type VARCHAR(20) CHECK (commission_type IN ('percent', 'fixed')),
  commission_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_branch_barcode
  ON products(branch_id, barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

CREATE INDEX idx_products_branch_category ON products(branch_id, category);

CREATE TABLE inventory_balances (
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (branch_id, product_id)
);

CREATE TABLE service_packages (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(220) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Gói dịch vụ',
  brand VARCHAR(100),
  total_units INTEGER NOT NULL CHECK (total_units > 0),
  validity_days INTEGER CHECK (validity_days IS NULL OR validity_days > 0),
  list_price NUMERIC(14, 2) NOT NULL CHECK (list_price >= 0),
  cost_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  usage_schedule VARCHAR(30) NOT NULL DEFAULT 'flexible'
    CHECK (usage_schedule IN ('flexible', 'scheduled')),
  image_url TEXT,
  description TEXT,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  commission_type VARCHAR(20) CHECK (commission_type IN ('percent', 'fixed')),
  commission_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE service_package_items (
  id BIGSERIAL PRIMARY KEY,
  package_id BIGINT NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
  service_id BIGINT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
  unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  UNIQUE (package_id, service_id)
);

CREATE INDEX idx_service_package_items_package ON service_package_items(package_id, service_id);

CREATE TABLE account_cards (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(220) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Thẻ tài khoản',
  brand VARCHAR(100),
  sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  face_value NUMERIC(14, 2) NOT NULL CHECK (face_value > 0),
  validity_days INTEGER CHECK (validity_days IS NULL OR validity_days > 0),
  allow_products BOOLEAN NOT NULL DEFAULT TRUE,
  allow_services BOOLEAN NOT NULL DEFAULT TRUE,
  allow_packages BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT,
  description TEXT,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  commission_type VARCHAR(20) CHECK (commission_type IN ('percent', 'fixed')),
  commission_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE account_card_scope_items (
  id BIGSERIAL PRIMARY KEY,
  account_card_id BIGINT NOT NULL REFERENCES account_cards(id) ON DELETE CASCADE,
  item_type VARCHAR(24) NOT NULL CHECK (item_type IN ('product', 'service', 'package')),
  item_id BIGINT NOT NULL,
  UNIQUE (account_card_id, item_type, item_id)
);

CREATE INDEX idx_account_card_scope_items_card ON account_card_scope_items(account_card_id, item_type, item_id);

-- ============================================================================
-- 5. PURCHASING & SUPPLIERS & PRICEBOOKS
-- ============================================================================
CREATE TABLE suppliers (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(160),
  address VARCHAR(300),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_branch_name ON suppliers(branch_id, name);

CREATE TABLE pricebooks (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pricebook_items (
  id BIGSERIAL PRIMARY KEY,
  pricebook_id BIGINT NOT NULL REFERENCES pricebooks(id) ON DELETE CASCADE,
  item_type VARCHAR(24) NOT NULL CHECK (item_type IN ('product', 'service', 'package', 'account_card')),
  item_id BIGINT NOT NULL,
  sale_price NUMERIC(14, 2) NOT NULL CHECK (sale_price >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pricebook_id, item_type, item_id)
);

CREATE INDEX idx_pricebook_items_book ON pricebook_items(pricebook_id, item_type, item_id);

CREATE TABLE purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
  code VARCHAR(40) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'cancelled')),
  received_at TIMESTAMPTZ,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  other_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (other_cost >= 0),
  amount_due NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_due >= 0),
  amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'card')),
  created_by BIGINT REFERENCES staff(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_orders_branch_received ON purchase_orders(branch_id, received_at DESC, created_at DESC);

CREATE TABLE purchase_order_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(14, 2) NOT NULL CHECK (unit_cost >= 0),
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  line_total NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);

-- ============================================================================
-- 6. APPOINTMENTS, INVOICES & CUSTOMER PACKAGES
-- ============================================================================
CREATE TABLE appointments (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  staff_id BIGINT REFERENCES staff(id) ON DELETE SET NULL,
  service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'in_service', 'completed', 'cancelled', 'no_show')),
  note TEXT,
  invoice_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_appointments_branch_starts ON appointments(branch_id, starts_at);
CREATE INDEX idx_appointments_branch_status ON appointments(branch_id, status);
CREATE INDEX idx_appointments_invoice ON appointments(invoice_id) WHERE invoice_id IS NOT NULL;

CREATE TABLE invoices (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  staff_id BIGINT REFERENCES staff(id) ON DELETE SET NULL,
  code VARCHAR(40) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'paid'
    CHECK (status IN ('draft', 'paid', 'refunded', 'cancelled')),
  subtotal NUMERIC(14, 2) NOT NULL CHECK (subtotal >= 0),
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total NUMERIC(14, 2) NOT NULL CHECK (total >= 0),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'bank_transfer', 'card', 'wallet', 'mixed')),
  sales_channel VARCHAR(30) NOT NULL DEFAULT 'salon'
    CHECK (sales_channel IN ('salon', 'online', 'phone')),
  issued_at TIMESTAMPTZ NOT NULL,
  appointment_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_branch_issued ON invoices(branch_id, issued_at);
CREATE INDEX idx_invoices_staff_issued ON invoices(staff_id, issued_at);
CREATE INDEX idx_invoices_appointment ON invoices(appointment_id) WHERE appointment_id IS NOT NULL;

CREATE TABLE invoice_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('service', 'product', 'package', 'account_card')),
  service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  package_id BIGINT REFERENCES service_packages(id) ON DELETE SET NULL,
  account_card_id BIGINT REFERENCES account_cards(id) ON DELETE SET NULL,
  staff_id BIGINT REFERENCES staff(id) ON DELETE SET NULL,
  description VARCHAR(220) NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0),
  CHECK (
    (item_type = 'service' AND service_id IS NOT NULL AND product_id IS NULL AND package_id IS NULL AND account_card_id IS NULL)
    OR (item_type = 'product' AND product_id IS NOT NULL AND service_id IS NULL AND package_id IS NULL AND account_card_id IS NULL)
    OR (item_type = 'package' AND package_id IS NOT NULL AND service_id IS NULL AND product_id IS NULL AND account_card_id IS NULL)
    OR (item_type = 'account_card' AND account_card_id IS NOT NULL AND service_id IS NULL AND product_id IS NULL AND package_id IS NULL)
  )
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

CREATE INDEX idx_customer_packages_branch_sold ON customer_packages(branch_id, sold_at DESC);
CREATE INDEX idx_customer_packages_customer ON customer_packages(customer_id, status);

CREATE TABLE package_usages (
  id BIGSERIAL PRIMARY KEY,
  customer_package_id BIGINT NOT NULL REFERENCES customer_packages(id) ON DELETE CASCADE,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  units_used INTEGER NOT NULL DEFAULT 1 CHECK (units_used > 0),
  used_at TIMESTAMPTZ NOT NULL,
  note VARCHAR(250)
);

CREATE TABLE customer_account_cards (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  card_code VARCHAR(40) NOT NULL UNIQUE,
  account_card_id BIGINT NOT NULL REFERENCES account_cards(id) ON DELETE RESTRICT,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  opening_balance NUMERIC(14, 2) NOT NULL CHECK (opening_balance >= 0),
  current_balance NUMERIC(14, 2) NOT NULL CHECK (current_balance >= 0),
  sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'depleted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_account_cards_customer ON customer_account_cards(customer_id, status);

CREATE TABLE commission_records (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  invoice_id BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
  source_name VARCHAR(220) NOT NULL,
  revenue NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (revenue >= 0),
  rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  rate_type VARCHAR(10) CHECK (rate_type IN ('percent', 'fixed')),
  occurred_on DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid')),
  commission_type VARCHAR(30) DEFAULT 'service'
);

CREATE INDEX idx_commissions_branch_date ON commission_records(branch_id, occurred_on);

CREATE TABLE cash_transactions (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  transaction_type VARCHAR(12) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  category VARCHAR(100) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_transactions_branch_occurred ON cash_transactions(branch_id, occurred_at);

CREATE TABLE activities (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  actor_staff_id BIGINT REFERENCES staff(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  object_type VARCHAR(60),
  object_code VARCHAR(60),
  description VARCHAR(300) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_branch_occurred ON activities(branch_id, occurred_at DESC);


COMMIT;
