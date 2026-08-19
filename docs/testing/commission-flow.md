# Commission Flow Test Cases

Test checklist for the commission per-item feature.

## Test 1: Product with percent commission

1. Tạo sản phẩm A với hoa hồng 10%
2. Tạo đơn hàng với sản phẩm A, qty=2, price=100.000
3. Gán nhân viên Lan cho sản phẩm A
4. Checkout
5. Verify: commission_records có amount = 200.000 × 0.10 = 20.000

**Expected:** 1 commission record created with amount = 20,000

---

## Test 2: Product with fixed commission

1. Tạo sản phẩm B với hoa hồng cố định 50.000đ
2. Tạo đơn hàng với sản phẩm B, qty=3
3. Gán nhân viên Minh cho sản phẩm B
4. Checkout
5. Verify: commission_records có amount = 3 × 50.000 = 150.000

**Expected:** 1 commission record created with amount = 150,000

---

## Test 3: Multiple staff, same invoice

1. Tạo đơn hàng với 3 sản phẩm, mỗi sp gán NV khác
2. Checkout
3. Verify: có 3 commission_records, mỗi record với staff_id khác nhau

**Expected:** 3 commission records, each with a different staff_id

---

## Test 4: Product without commission

1. Tạo sản phẩm C không có hoa hồng
2. Tạo đơn hàng với sản phẩm C
3. Checkout
4. Verify: không có commission record cho sản phẩm C

**Expected:** No commission records created

---

## Test 5: Empty staff assignment

1. Tạo đơn hàng, không gán nhân viên cho dòng nào
2. Checkout
3. Verify: không có commission record nào

**Expected:** No commission records created

---

## Test Execution Notes

- Run tests after each checkout operation
- Verify in `commission_records` table
- Check `staff_commissions` view for display verification
