-- MINJI - MINIMAL INITIAL DATASET
-- Requires database/init/001_schema.sql on an empty database.
-- Run manually instead of anna_seed.sql; do not load both seeds.
-- Initial logins: admin, minji_my, minji_lan, minji_giang / 12345678. Change this password before production.

BEGIN;

-- Initial dataset only: never overwrite an existing salon or another seed.
-- Serialize initializers so two simultaneous seed commands cannot both pass.
LOCK TABLE branches, user_accounts IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM branches) OR EXISTS (SELECT 1 FROM user_accounts) THEN
    RAISE EXCEPTION 'minji_seed.sql requires an empty database; existing data was not changed';
  END IF;
END;
$$;

INSERT INTO branches (code, name, address, timezone, active)
VALUES ('CN-MINJI', 'Minji - Mipec Rubik', 'Mipec Rubik 360, 122 Xuân Thủy, Hà Nội', 'Asia/Ho_Chi_Minh', TRUE);

-- Salon staff with attendance/sales accounts.
INSERT INTO staff (branch_id, code, name, role, avatar_tone, active)
SELECT b.id, x.code, x.name, 'Nhân viên', x.avatar_tone, TRUE
FROM branches b
CROSS JOIN (VALUES
  ('NV000001', 'My', 'pink'),
  ('NV000002', 'Lan', 'blue'),
  ('NV000003', 'Giang', 'green')
) AS x(code, name, avatar_tone)
WHERE b.code = 'CN-MINJI';

INSERT INTO staff_settings (staff_id, salary_type, base_salary, hourly_rate, default_commission_rate, can_sell, can_manage_inventory)
SELECT id, 'monthly', 0, 0, 0, TRUE, FALSE FROM staff;

-- The application uses role "manager" for administrators. No staff row is needed.
INSERT INTO user_accounts (branch_id, username, password_hash, display_name, role, active)
SELECT id, 'admin', 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ', 'Quản trị Minji', 'manager', TRUE
FROM branches
WHERE code = 'CN-MINJI';

INSERT INTO user_accounts (branch_id, staff_id, username, password_hash, display_name, role, active)
SELECT b.id, s.id, x.username, x.password_hash, s.name, 'staff', TRUE
FROM branches b
JOIN (VALUES
  ('NV000001', 'minji_my', 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ'),
  ('NV000002', 'minji_lan', 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ'),
  ('NV000003', 'minji_giang', 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ')
) AS x(staff_code, username, password_hash) ON TRUE
JOIN staff s ON s.code = x.staff_code AND s.branch_id = b.id
WHERE b.code = 'CN-MINJI';

COMMIT;
