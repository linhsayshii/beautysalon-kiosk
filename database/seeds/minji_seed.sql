-- MINJI - MINIMAL INITIAL DATASET
-- Requires database/init/001_schema.sql on an empty database.
-- Run manually instead of anna_seed.sql; do not load both seeds.
-- Initial login: admin / 12345678. Change this password before production.

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

-- The application uses role "manager" for administrators. No staff row is needed.
INSERT INTO user_accounts (branch_id, username, password_hash, display_name, role, active)
SELECT id, 'admin', 'scrypt$_6JsIiDp2GDJrZs1B2xKFg$VxLtnWDXsfk2UDdKRttaiphUquyvEja1Ew1KitMa3BCvoAekfQoLGfQBPVFUEgHWYEIyQO67dq2fzZ2DuvKWWQ', 'Quản trị Minji', 'manager', TRUE
FROM branches
WHERE code = 'CN-MINJI';

COMMIT;
