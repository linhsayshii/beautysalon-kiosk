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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_products_branch_barcode
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_appointments_branch_starts ON appointments(branch_id, starts_at);
CREATE INDEX idx_appointments_branch_status ON appointments(branch_id, status);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_branch_issued ON invoices(branch_id, issued_at);
CREATE INDEX idx_invoices_staff_issued ON invoices(staff_id, issued_at);

CREATE TABLE invoice_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('service', 'product')),
  service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  description VARCHAR(220) NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0),
  CHECK (
    (item_type = 'service' AND service_id IS NOT NULL AND product_id IS NULL)
    OR (item_type = 'product' AND product_id IS NOT NULL AND service_id IS NULL)
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
  rate NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  occurred_on DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid'))
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

-- ============================================================================
-- 7. INITIAL SEED & DEMO DATA
-- ============================================================================
INSERT INTO branches (code, name, address, phone, email, latitude, longitude, attendance_radius_m)
VALUES
  ('CN-TT', 'AnnaChill Trung tâm', '123 Nguyễn Thị Minh Khai, Quận 1, TP.HCM', '02839301234', 'trungtam@annachill.vn', 10.7769000, 106.7009000, 100),
  ('CN-Q7', 'AnnaChill Quận 7', '456 Nguyễn Thị Thập, Quận 7, TP.HCM', '02837751234', 'quan7@annachill.vn', 10.7382000, 106.7118000, 100)
ON CONFLICT (code) DO NOTHING;

INSERT INTO staff (branch_id, code, name, role, avatar_tone, active)
SELECT b.id, x.code, x.name, x.role, x.avatar_tone, TRUE
FROM branches b
CROSS JOIN (VALUES
  ('NV-001', 'Nguyễn Minh Anh', 'Quản lý salon', 'purple'),
  ('NV-002', 'Trần Ngọc Hân', 'Kỹ thuật viên', 'blue'),
  ('NV-003', 'Lê Khánh Vy', 'Kỹ thuật viên', 'pink'),
  ('NV-004', 'Phạm Gia Linh', 'Lễ tân', 'green')
) AS x(code, name, role, avatar_tone)
WHERE b.code = 'CN-TT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO staff_settings (staff_id, salary_type, base_salary, hourly_rate, default_commission_rate, can_sell, can_manage_inventory)
SELECT s.id,
       CASE WHEN s.code = 'NV-004' THEN 'monthly' ELSE 'shift' END,
       CASE WHEN s.code = 'NV-001' THEN 14000000 WHEN s.code = 'NV-004' THEN 8500000 ELSE 7000000 END,
       45000,
       CASE WHEN s.code = 'NV-001' THEN 0.03 ELSE 0.05 END,
       TRUE,
       s.code = 'NV-001'
FROM staff s
WHERE s.code IN ('NV-001', 'NV-002', 'NV-003', 'NV-004')
ON CONFLICT (staff_id) DO NOTHING;

INSERT INTO user_accounts (branch_id, staff_id, username, password_hash, display_name, role)
SELECT b.id, s.id, 'admin',
  'scrypt$ksu9rphubN8cptjPBCPRkg$b8XM_6E3u4h9qG5nWevQJavEnawRVyWAKt6JCFIb1PCCFJj-jpoLXZ51ifcUjYtSmN2QUH8q6ac9M3SSczfFPQ',
  'Quản trị hệ thống', 'manager'
FROM branches b
LEFT JOIN staff s ON s.branch_id = b.id AND s.code = 'NV-001'
WHERE b.code = 'CN-TT'
ON CONFLICT DO NOTHING;

INSERT INTO user_accounts (branch_id, staff_id, username, password_hash, display_name, role)
SELECT s.branch_id, s.id, 'manager',
  'scrypt$ksu9rphubN8cptjPBCPRkg$b8XM_6E3u4h9qG5nWevQJavEnawRVyWAKt6JCFIb1PCCFJj-jpoLXZ51ifcUjYtSmN2QUH8q6ac9M3SSczfFPQ',
  s.name, 'manager'
FROM staff s WHERE s.code = 'NV-001'
ON CONFLICT DO NOTHING;

INSERT INTO user_accounts (branch_id, staff_id, username, password_hash, display_name, role)
SELECT s.branch_id, s.id, 'cashier',
  'scrypt$R-5j4weNgSw-iVUs97lNKw$Net9dLsyTc3hfvxu3-3gdaVAgDnBM9J46HClrk8js2cwQq0lAG0X9kBy-JRcBacnHuWHXTQYXqAP0h8_leuEWw',
  s.name, 'cashier'
FROM staff s WHERE s.code = 'NV-004'
ON CONFLICT DO NOTHING;

INSERT INTO user_accounts (branch_id, staff_id, username, password_hash, display_name, role)
SELECT s.branch_id, s.id, 'staff',
  'scrypt$DDCEV_DzVfDXUmXjeRsa7A$Gl3xhk8NlxjUAtzMyxXy4D-F2ptGDqOVZ0hfvCXypWUxsg6UVnXsxTHy0SYy6WRC9WLEkeyqLHayB8OZVRdCZw',
  s.name, 'staff'
FROM staff s WHERE s.code = 'NV-003'
ON CONFLICT DO NOTHING;

INSERT INTO customers (branch_id, code, name, phone, dob, gender, email, facebook, customer_type, customer_group, debt_balance)
SELECT b.id, x.code, x.name, x.phone, x.dob::date, x.gender, x.email, x.facebook, x.customer_type, x.customer_group, x.debt_balance
FROM branches b
CROSS JOIN (VALUES
  ('KH-001', 'Nguyễn Thảo My', '0901234567', '1995-05-15', 'Nữ', 'thaomy@gmail.com', 'facebook.com/thaomy', 'returning', 'Cá nhân', 0),
  ('KH-002', 'Đặng Hà Phương', '0912345678', '1998-10-20', 'Nữ', 'haphuong@gmail.com', 'facebook.com/haphuong', 'new', 'Cá nhân', 0),
  ('KH-003', 'Võ Thanh Tâm', '0987654321', '1992-03-08', 'Nữ', 'thanhtam@gmail.com', 'facebook.com/thanhtam', 'returning', 'Công ty', 350000),
  ('KH-004', 'Phan Ngọc Mai', '0938123456', '2000-12-01', 'Nữ', 'ngocmai@gmail.com', 'facebook.com/ngocmai', 'walk_in', 'Cá nhân', 0)
) AS x(code, name, phone, dob, gender, email, facebook, customer_type, customer_group, debt_balance)
WHERE b.code = 'CN-TT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO services (branch_id, code, name, category, price, cost_price, duration_minutes, description)
SELECT b.id, x.code, x.name, x.category, x.price, x.cost_price, x.duration_minutes, x.description
FROM branches b
CROSS JOIN (VALUES
  ('DV-001', 'Gội đầu dưỡng sinh 60 phút', 'Gội đầu', 250000, 50000, 60, 'Thư giãn da đầu và massage cổ vai gáy'),
  ('DV-002', 'Chăm sóc da cơ bản', 'Chăm sóc da', 350000, 90000, 75, 'Làm sạch, cấp ẩm và đắp mặt nạ'),
  ('DV-003', 'Chăm sóc da chuyên sâu', 'Chăm sóc da', 650000, 180000, 90, 'Liệu trình phục hồi và làm sáng da'),
  ('DV-004', 'Massage body thư giãn', 'Massage', 450000, 100000, 60, 'Massage toàn thân với tinh dầu thiên nhiên')
) AS x(code, name, category, price, cost_price, duration_minutes, description)
WHERE b.code = 'CN-TT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO products (branch_id, sku, barcode, name, category, brand, unit, sale_price, cost_price, last_purchase_price, min_stock, max_stock, description)
SELECT b.id, x.sku, x.barcode, x.name, x.category, x.brand, x.unit, x.sale_price, x.cost_price, x.cost_price, x.min_stock, x.max_stock, x.description
FROM branches b
CROSS JOIN (VALUES
  ('SP-001', '8938500010011', 'Dầu gội thảo mộc', 'Dầu gội', 'AnnaChill', 'chai', 180000, 95000, 5, 40, 'Dầu gội dịu nhẹ dùng tại nhà'),
  ('SP-002', '8938500010028', 'Mặt nạ cấp ẩm Hyaluronic', 'Mặt nạ', 'SkinCare Lab', 'hộp', 220000, 120000, 8, 50, 'Mặt nạ cấp ẩm cho da nhạy cảm'),
  ('SP-003', '8938500010035', 'Tinh dầu lavender', 'Tinh dầu', 'AnnaChill', 'lọ', 150000, 70000, 3, 30, 'Tinh dầu thư giãn dùng cho massage'),
  ('SP-004', '8938500010042', 'Kem chống nắng SPF50+', 'Chống nắng', 'Sun Daily', 'tuýp', 320000, 190000, 6, 35, 'Chống nắng phổ rộng, không gây bết dính')
) AS x(sku, barcode, name, category, brand, unit, sale_price, cost_price, min_stock, max_stock, description)
WHERE b.code = 'CN-TT'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO inventory_balances (branch_id, product_id, quantity)
SELECT p.branch_id, p.id,
       CASE p.sku WHEN 'SP-001' THEN 18 WHEN 'SP-002' THEN 4 WHEN 'SP-003' THEN 25 ELSE 12 END
FROM products p
WHERE p.sku IN ('SP-001', 'SP-002', 'SP-003', 'SP-004')
ON CONFLICT (branch_id, product_id) DO NOTHING;

INSERT INTO service_packages (branch_id, code, name, category, total_units, validity_days, list_price, cost_price)
SELECT b.id, 'GOI-001', 'Gói gội đầu dưỡng sinh 10 buổi', 'Gội đầu', 10, 90, 2000000, 450000
FROM branches b
WHERE b.code = 'CN-TT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO service_package_items (package_id, service_id, units, unit_price)
SELECT sp.id, s.id, 10, 200000
FROM service_packages sp
JOIN services s ON s.code = 'DV-001'
WHERE sp.code = 'GOI-001'
ON CONFLICT (package_id, service_id) DO NOTHING;

INSERT INTO account_cards (branch_id, code, name, category, sale_price, face_value, validity_days, allow_products, allow_services, allow_packages)
SELECT b.id, 'THE-001', 'Thẻ VIP chăm sóc da 5.000.000đ', 'Thẻ VIP', 4500000, 5000000, 180, TRUE, TRUE, TRUE
FROM branches b
WHERE b.code = 'CN-TT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO suppliers (branch_id, code, name, phone, email, address)
SELECT b.id, x.code, x.name, x.phone, x.email, x.address
FROM branches b
CROSS JOIN (VALUES
  ('NCC-001', 'Công ty Mỹ phẩm Thiên Nhiên', '0909112233', 'contact@thiennhien.vn', '12 Nguyễn Huệ, Q1, TP.HCM'),
  ('NCC-002', 'SkinCare Lab Vietnam', '0918223344', 'sales@skincarelab.vn', '88 Lê Duẩn, Q1, TP.HCM'),
  ('NCC-003', 'Công ty Thiết bị Spa Hoàng Gia', '0933556677', 'info@spahoanggia.vn', '105 Hai Bà Trưng, Q3, TP.HCM')
) AS x(code, name, phone, email, address)
WHERE b.code = 'CN-TT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO pricebooks (branch_id, code, name)
SELECT b.id, 'BG-1', 'Bảng giá chung'
FROM branches b
WHERE b.code = 'CN-TT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO pricebook_items (pricebook_id, item_type, item_id, sale_price)
SELECT pb.id, 'product', p.id, p.sale_price
FROM pricebooks pb
JOIN products p ON p.branch_id = pb.branch_id
WHERE pb.code = 'BG-1'
ON CONFLICT (pricebook_id, item_type, item_id) DO NOTHING;

INSERT INTO pricebook_items (pricebook_id, item_type, item_id, sale_price)
SELECT pb.id, 'service', s.id, s.price
FROM pricebooks pb
JOIN services s ON s.branch_id = pb.branch_id
WHERE pb.code = 'BG-1'
ON CONFLICT (pricebook_id, item_type, item_id) DO NOTHING;

INSERT INTO pricebook_items (pricebook_id, item_type, item_id, sale_price)
SELECT pb.id, 'package', sp.id, sp.list_price
FROM pricebooks pb
JOIN service_packages sp ON sp.branch_id = pb.branch_id
WHERE pb.code = 'BG-1'
ON CONFLICT (pricebook_id, item_type, item_id) DO NOTHING;

INSERT INTO customer_packages (branch_id, package_code, package_id, customer_id, sale_price, total_units, used_units, sold_at, expires_at, status)
SELECT c.branch_id, 'CP-001', sp.id, c.id, 2000000, 10, 3, NOW() - INTERVAL '15 days', NOW() + INTERVAL '75 days', 'active'
FROM customers c JOIN service_packages sp ON sp.code = 'GOI-001'
WHERE c.code = 'KH-001'
ON CONFLICT (package_code) DO NOTHING;

INSERT INTO customer_account_cards (branch_id, card_code, account_card_id, customer_id, sale_price, opening_balance, current_balance, sold_at, expires_at, status)
SELECT c.branch_id, 'CAC-001', ac.id, c.id, 4500000, 5000000, 4250000, NOW() - INTERVAL '10 days', NOW() + INTERVAL '170 days', 'active'
FROM customers c JOIN account_cards ac ON ac.code = 'THE-001'
WHERE c.code = 'KH-003'
ON CONFLICT (card_code) DO NOTHING;

INSERT INTO appointments (branch_id, customer_id, staff_id, service_id, starts_at, ends_at, status, note)
SELECT b.id, c.id, s.id, sv.id, x.starts_at::timestamptz, x.ends_at::timestamptz, x.status, x.note
FROM branches b
CROSS JOIN (VALUES
  ('KH-001', 'NV-002', 'DV-001', '2026-08-15 09:00:00+07', '2026-08-15 10:00:00+07', 'completed', 'Khách dùng gói liệu trình'),
  ('KH-002', 'NV-003', 'DV-002', '2026-08-15 10:30:00+07', '2026-08-15 11:45:00+07', 'completed', 'Khách mới chăm sóc da'),
  ('KH-003', 'NV-002', 'DV-003', '2026-08-15 14:00:00+07', '2026-08-15 15:30:00+07', 'confirmed', 'Hẹn chuyên sâu chiều'),
  ('KH-004', 'NV-003', 'DV-004', '2026-08-15 16:00:00+07', '2026-08-15 17:00:00+07', 'confirmed', 'Massage body')
) AS x(customer_code, staff_code, service_code, starts_at, ends_at, status, note)
JOIN customers c ON c.code = x.customer_code
JOIN staff s ON s.code = x.staff_code
JOIN services sv ON sv.code = x.service_code
WHERE b.code = 'CN-TT'
ON CONFLICT DO NOTHING;

INSERT INTO invoices (branch_id, customer_id, staff_id, code, status, subtotal, discount, total, payment_method, sales_channel, issued_at)
SELECT b.id, c.id, s.id, x.code, x.status, x.subtotal, x.discount, x.total, x.payment_method, x.sales_channel, x.issued_at::timestamptz
FROM branches b
CROSS JOIN (VALUES
  ('HD-001', 'KH-001', 'NV-004', 'paid', 250000, 0, 250000, 'cash', 'salon', '2026-08-15 10:05:00+07'),
  ('HD-002', 'KH-002', 'NV-004', 'paid', 350000, 0, 350000, 'bank_transfer', 'salon', '2026-08-15 11:50:00+07'),
  ('HD-003', 'KH-003', 'NV-001', 'paid', 4500000, 0, 4500000, 'card', 'salon', '2026-08-10 15:00:00+07')
) AS x(code, customer_code, staff_code, status, subtotal, discount, total, payment_method, sales_channel, issued_at)
JOIN customers c ON c.code = x.customer_code
JOIN staff s ON s.code = x.staff_code
WHERE b.code = 'CN-TT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO invoice_items (invoice_id, item_type, service_id, product_id, description, quantity, unit_price, line_total)
SELECT i.id, 'service', sv.id, NULL, sv.name, 1, 250000, 250000
FROM invoices i JOIN services sv ON sv.code = 'DV-001' WHERE i.code = 'HD-001'
ON CONFLICT DO NOTHING;

INSERT INTO invoice_items (invoice_id, item_type, service_id, product_id, description, quantity, unit_price, line_total)
SELECT i.id, 'service', sv.id, NULL, sv.name, 1, 350000, 350000
FROM invoices i JOIN services sv ON sv.code = 'DV-002' WHERE i.code = 'HD-002'
ON CONFLICT DO NOTHING;

COMMIT;
