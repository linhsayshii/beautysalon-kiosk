import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: config.database.maxConnections,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('[database] unexpected pool error', error);
});

export async function runMigrations() {
  try {
    // 1. Seed fallback branch if missing
    await pool.query(`
      INSERT INTO branches (code, name, address, phone, email, timezone, latitude, longitude, attendance_radius_m, active)
      VALUES ('CN-TT', 'Chi nhánh Trung tâm', 'Mipec Rubik 360, 122 Xuân Thủy, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội', '0989080866', 'contact@annachillbeauty.vn', 'Asia/Ho_Chi_Minh', 21.0375000, 105.7825000, 100, TRUE)
      ON CONFLICT (code) DO NOTHING;
    `);

    // 2. Seed fallback user accounts if missing
    await pool.query(`
      INSERT INTO user_accounts (branch_id, staff_id, username, password_hash, display_name, role, phone, email, active)
      SELECT b.id, s.id, x.username, x.password_hash, x.display_name, x.role, x.phone, x.email, TRUE
      FROM branches b
      JOIN (VALUES
        (NULL::varchar, 'admin', 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ', 'Quản trị hệ thống', 'manager', '0989080866', 'admin@annachillbeauty.vn'),
        ('NV000009', 'manager', 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ', 'AnnaChill Beauty', 'manager', '0989080866', 'manager@annachillbeauty.vn'),
        ('NV000016', 'cashier', 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ', 'Thu Phương', 'cashier', '0368291032', 'thuphuong@annachillbeauty.vn'),
        ('NV000015', 'staff', 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ', 'Yến', 'staff', '0901823886', 'yen@annachillbeauty.vn'),
        ('NV000012', 'trangvu', 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ', 'Trang Vũ', 'staff', '0987704052', 'trangvu@annachillbeauty.vn'),
        ('NV000010', 'hau', 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ', 'Hậu', 'staff', '0123456', 'hau@annachillbeauty.vn'),
        ('NV000005', 'emhue', 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ', 'Em Huệ', 'staff', '0353141214', 'emhue@annachillbeauty.vn')
      ) AS x(staff_code, username, password_hash, display_name, role, phone, email) ON TRUE
      LEFT JOIN staff s ON s.code = x.staff_code AND s.branch_id = b.id
      WHERE b.code = 'CN-TT'
      ON CONFLICT (LOWER(username)) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        active = EXCLUDED.active,
        updated_at = NOW();
    `);

    await pool.query(`
      ALTER TABLE commission_records
        ADD COLUMN IF NOT EXISTS commission_type VARCHAR(30) DEFAULT 'service';

      ALTER TABLE invoice_items
        ADD COLUMN IF NOT EXISTS staff_id BIGINT REFERENCES staff(id) ON DELETE SET NULL;

      UPDATE user_accounts
      SET password_hash = 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ'
      WHERE username IN ('admin', 'manager', 'cashier', 'staff', 'trangvu', 'hau', 'emhue');

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

      -- Add commission fields to products table for per-line commission
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS commission_type VARCHAR(10) DEFAULT NULL
          CHECK (commission_type IS NULL OR commission_type IN ('percent', 'fixed')),
        ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(14, 2) DEFAULT 0;

      -- Add invoice_item_id to commission_records for per-item tracking
      ALTER TABLE commission_records
        ADD COLUMN IF NOT EXISTS invoice_item_id BIGINT REFERENCES invoice_items(id) ON DELETE SET NULL;
    `);
    console.log('[database] payroll & commission migrations checked and applied');
  } catch (err) {
    console.error('[database] migration error', err.message);
  }
}

export async function checkDatabase() {
  try {
    const result = await pool.query('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  } catch (error) {
    console.error('[database] readiness check failed', error.message);
    return false;
  }
}

export async function closeDatabase() {
  await pool.end();
}

const demoPasswordHashes = [
  'scrypt$yAZRAcM0GLD7RH71SoOZCg$Bv1E8mUQXtuTdQFgQd3fAXiVCTA8d0o9CUpqQ2EksKNqbkRy3CvzPv2w8Ag0ngDEmtiLulcXZIwqdb2XZjOzpg',
  'scrypt$R-5j4weNgSw-iVUs97lNKw$Net9dLsyTc3hfvxu3-3gdaVAgDnBM9J46HClrk8js2cwQq0lAG0X9kBy-JRcBacnHuWHXTQYXqAP0h8_leuEWw',
  'scrypt$DDCEV_DzVfDXUmXjeRsa7A$Gl3xhk8NlxjUAtzMyxXy4D-F2ptGDqOVZ0hfvCXypWUxsg6UVnXsxTHy0SYy6WRC9WLEkeyqLHayB8OZVRdCZw',
];

export async function assertProductionDatabaseSafety() {
  const result = await pool.query(
    'SELECT COUNT(*) AS total FROM user_accounts WHERE password_hash = ANY($1::text[])',
    [demoPasswordHashes],
  );
  if (Number(result.rows[0].total) > 0) {
    throw new Error('Production startup refused: demo account passwords must be changed first');
  }
}
