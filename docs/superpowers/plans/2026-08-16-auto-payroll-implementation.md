# Kế hoạch Triển khai: Hệ thống Bảng lương Tự động & Giao diện KiotViet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng tính năng Bảng lương tự động theo từng tháng (tối đa đến tháng hiện tại) với công thức tính dựa trên số ngày công chuẩn thực tế cấu hình từ lịch làm việc + hoa hồng tự động, kèm giao diện chuẩn KiotViet (danh sách bảng lương, row accordion detail 3 tabs, và màn hình cập nhật bảng tính lương).

**Architecture:** 
- **Database:** Mở rộng bảng `payroll_periods`, `payroll_records` và tạo mới bảng `payroll_payments`.
- **Backend:** Module `staff.service.js` & `staff.routes.js` quản lý logic tự động sinh kỳ lương theo tháng đến tháng hiện tại, tự động quét chấm công/lịch làm việc/hoa hồng, hỗ trợ recalculate, update thủ công, chốt lương, thanh toán.
- **Frontend:** Xây dựng `StaffPayrollView` (Giao diện danh sách chuẩn KiotViet với sidebar filter, accordion 3 tabs "Thông tin", "Phiếu lương", "Lịch sử thanh toán") và `StaffPayrollSheetView` (Ma trận chi tiết lương nhân viên với các nút Lưu tạm, Chốt lương, Thanh toán).

**Tech Stack:** Node.js (Express), PostgreSQL, React 19, TypeScript, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-16-auto-payroll-design.md`

## Global Constraints
- Chỉ tự động tạo bảng lương từ quá khứ đến đúng **tháng hiện tại**, tuyệt đối không tạo bảng lương cho các tháng tương lai.
- Công thức tính lương chính phải chia cho số ngày công chuẩn thực tế trong tháng cấu hình từ lịch làm việc (không hardcode cố định 26 ngày).
- Lương thực nhận = Lương chính + Làm thêm + Hoa hồng + Phụ cấp + Thưởng - Giảm trừ.
- Giữ vững tính tương thích của API và các test hiện tại.

---

### Task 1: Nâng cấp Database Schema cho Bảng lương

**Files:**
- Modify: `database/schema.sql:139-164`
- Modify: `database/init/003_operations.sql:80-104`

- [ ] **Step 1: Cập nhật `database/schema.sql` và `database/init/003_operations.sql`**
  Thêm các cột mới cho `payroll_periods` (`period_type`, `creator_type`, `creator_name`, `approved_by_id`, `approved_by_name`, `approved_at`, `updated_data_at`, `note`), `payroll_records` (`code`, `overtime_salary`, `bonus`, `total_income`, `paid_amount`, `remaining_amount`, `work_units`, `standard_work_days`, `hourly_rate`, `note`), và tạo bảng `payroll_payments`.

- [ ] **Step 2: Chạy kiểm tra cú pháp schema**
  Run: `npm run check:api`
  Expected: PASS

- [ ] **Step 3: Commit**
  ```bash
  git add database/schema.sql database/init/003_operations.sql
  git commit -m "feat(db): update payroll periods, records and payments schema"
  ```

---

### Task 2: Cập nhật Backend Service tính lương tự động & APIs

**Files:**
- Modify: `backend/src/modules/staff/staff.service.js`
- Modify: `backend/src/modules/staff/staff.routes.js`
- Test: `backend/src/modules/staff/staff.test.js`

- [ ] **Step 1: Viết test cho logic tự động sinh kỳ lương & tính toán lương theo ngày công chuẩn thực tế**
  Tạo hoặc cập nhật test kiểm tra:
  - Sinh kỳ lương tháng hiện tại và các tháng trước (không sinh tháng tương lai).
  - Tính lương cho nhân viên tháng (lương cơ bản / ngày công chuẩn thực tế * số ca).
  - Tính lương cho nhân viên theo giờ (giờ làm * lương/giờ).
  - Tự động cộng dồn hoa hồng từ `commission_records`.

- [ ] **Step 2: Chạy test để xác nhận fail**
  Run: `npm --prefix backend test`
  Expected: FAIL

- [ ] **Step 3: Cập nhật `staff.service.js`**
  - Hàm `ensureMonthlyPayrollPeriods(branchId)`: quét từ 12 tháng trước đến tháng hiện tại, tạo tự động nếu chưa có.
  - Hàm `calculatePeriodPayroll(branchId, periodId)`: quét ca làm trong tháng, hoa hồng, tính lương từng nhân viên và lưu vào `payroll_records`.
  - Hàm `listPayrollPeriods({ branchId, search, status, periodType })`.
  - Hàm `getPayrollPeriodDetail({ branchId, periodId })`.
  - Hàm `updatePayrollRecordItems({ branchId, periodId, records })`.
  - Hàm `approvePayrollPeriod({ branchId, periodId, staffId, staffName })`.
  - Hàm `cancelPayrollPeriod({ branchId, periodId })`.
  - Hàm `createPayrollPayment({ branchId, periodId, staffId, amount, paymentMethod, note, actorStaffId })`.

- [ ] **Step 4: Cập nhật `staff.routes.js`**
  - `GET /api/staff/payroll`
  - `GET /api/staff/payroll/:id`
  - `POST /api/staff/payroll/:id/recalculate`
  - `PUT /api/staff/payroll/:id`
  - `POST /api/staff/payroll/:id/approve`
  - `POST /api/staff/payroll/:id/cancel`
  - `POST /api/staff/payroll/:id/pay`

- [ ] **Step 5: Chạy test backend và lint check**
  Run: `npm --prefix backend run check`
  Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git add backend/src/modules/staff/
  git commit -m "feat(api): implement auto payroll calculation and management endpoints"
  ```

---

### Task 3: Cập nhật Frontend API Client & Utilities

**Files:**
- Modify: `frontend/src/features/staff/staff.api.ts`
- Modify: `frontend/src/features/staff/salary-calc.ts`
- Modify: `frontend/src/features/staff/salary-calc.test.ts`

- [ ] **Step 1: Viết test cho `salary-calc.ts` với dynamic work days**
  Đảm bảo test bao phủ trường hợp số ngày công chuẩn thay đổi linh hoạt theo từng tháng (vd 31 ngày, 26 ngày, 22 ngày).

- [ ] **Step 2: Chạy test frontend**
  Run: `npm --prefix frontend test`
  Expected: PASS

- [ ] **Step 3: Cập nhật `staff.api.ts`**
  Thêm các hàm gọi API:
  - `getPayrollList(params)`
  - `getPayrollDetail(id)`
  - `recalculatePayroll(id)`
  - `updatePayroll(id, data)`
  - `approvePayroll(id)`
  - `cancelPayroll(id)`
  - `payPayroll(id, data)`

- [ ] **Step 4: Chạy typecheck frontend**
  Run: `npm --prefix frontend run typecheck`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add frontend/src/features/staff/staff.api.ts frontend/src/features/staff/salary-calc.ts frontend/src/features/staff/salary-calc.test.ts
  git commit -m "feat(frontend): add payroll api functions and salary calc support"
  ```

---

### Task 4: Xây dựng Giao diện Danh sách Bảng lương (`StaffPayrollView.tsx`) & Accordion Row Detail

**Files:**
- Modify: `frontend/src/features/staff/components/StaffPayrollView.tsx`
- Create: `frontend/src/features/staff/components/StaffPayrollDetailAccordion.tsx`
- Create: `frontend/src/features/staff/components/StaffPayrollPaymentModal.tsx`
- Modify: `frontend/src/features/staff/components/AttendanceTimekeeping.css`

- [ ] **Step 1: Xây dựng `StaffPayrollDetailAccordion.tsx`**
  - Tab 1: **Thông tin**: Chi tiết 2 cột (Mã, Tên, Kỳ hạn trả, Kỳ làm việc, Ngày tạo, Người tạo: Auto, Người lập bảng, Trạng thái, Tổng số nhân viên, Tổng lương, Đã trả NV, Còn cần trả, Phạm vi, Người chốt, Ghi chú) + Các action (Hủy bỏ, Tải lại dữ liệu, Xem bảng lương, Xuất file).
  - Tab 2: **Phiếu lương**: Bảng danh sách nhân viên trong kỳ (Mã phiếu PL000xxx, Tên nhân viên, Tổng lương, Đã trả NV, Còn cần trả) + Nút Thanh toán.
  - Tab 3: **Lịch sử thanh toán**: Danh sách phiếu chi trả lương (Mã phiếu chi, Ngày chi, Số tiền, Người nhận, Phương thức, Ghi chú).

- [ ] **Step 2: Xây dựng `StaffPayrollPaymentModal.tsx`**
  Modal thanh toán chi trả lương cho 1 hoặc nhiều nhân viên (Số tiền, Phương thức thanh toán Tiền mặt / Chuyển khoản, Ghi chú).

- [ ] **Step 3: Cập nhật `StaffPayrollView.tsx` chuẩn giao diện KiotViet**
  - Sidebar bên trái: Chọn kỳ hạn trả lương (Hàng tháng), Trạng thái checkbox (Đang tạo, Tạm tính, Đã chốt lương, Đã hủy).
  - Top header: Tìm kiếm theo mã hoặc tên bảng lương, Nút `+ Bảng tính lương`, Nút `Xuất file`.
  - Bảng dữ liệu: Cột Mã, Tên, Kỳ hạn trả, Kỳ làm việc, Tổng lương, Đã trả nhân viên, Còn cần trả, Trạng thái. Hàng header phụ tổng cộng số tiền.
  - Click vào dòng bất kỳ để toggle mở rộng `StaffPayrollDetailAccordion`.

- [ ] **Step 4: Thêm CSS hoàn thiện style KiotViet trong `AttendanceTimekeeping.css`**

- [ ] **Step 5: Chạy typecheck và test**
  Run: `npm --prefix frontend run typecheck && npm --prefix frontend test`
  Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git add frontend/src/features/staff/components/
  git commit -m "feat(frontend): build KiotViet-style payroll list with accordion tabs"
  ```

---

### Task 5: Xây dựng Giao diện Cập nhật Bảng tính lương Ma trận (`StaffPayrollSheetView.tsx`)

**Files:**
- Create: `frontend/src/features/staff/components/StaffPayrollSheetView.tsx`
- Modify: `frontend/src/pages/staff/StaffPayrollPage.tsx`
- Modify: `frontend/src/app/router.tsx`

- [ ] **Step 1: Xây dựng `StaffPayrollSheetView.tsx`**
  - Top Bar: Nút quay lại `← Cập nhật bảng tính lương`, Tìm kiếm nhân viên, Nút `💾 Lưu tạm`, `💳 Thanh toán`, `✔ Chốt lương`.
  - Bảng ma trận lương nhân viên: STT, Tên nhân viên (kèm mã NV), Lương chính, Làm thêm, Hoa hồng, Phụ cấp, Thưởng, Tổng thu nhập, Giảm trừ, Lương thực nhận, Đã trả, Còn cần trả.
  - Hàng tổng cộng đầu bảng tự động tính tổng từng cột.
  - Hỗ trợ nhập trực tiếp hoặc click chỉnh sửa Phụ cấp, Thưởng, Làm thêm, Giảm trừ, Ghi chú.

- [ ] **Step 2: Cập nhật router & trang `StaffPayrollPage.tsx`**
  Hỗ trợ điều hướng chuyển đổi linh hoạt giữa màn hình Danh sách và màn hình Cập nhật bảng tính lương (bằng route `/staff/payroll/:id` hoặc state view).

- [ ] **Step 3: Chạy typecheck & test**
  Run: `npm --prefix frontend run typecheck && npm --prefix frontend test`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/
  git commit -m "feat(frontend): build detailed payroll calculation sheet view"
  ```

---

### Task 6: Kiểm thử toàn diện & Xác thực hoạt động (Verification)

**Files:**
- Test all components and integration

- [ ] **Step 1: Chạy toàn bộ test suites của dự án**
  Run: `npm run check`
  Expected: PASS (cả API và Frontend)

- [ ] **Step 2: Chạy dev server và kiểm tra giao diện bằng Browser tool**
  Kiểm tra:
  - Tự động tạo bảng lương tháng hiện tại (không vượt quá tháng hiện tại).
  - Click mở accordion chi tiết dòng (Tab Thông tin, Tab Phiếu lương, Tab Lịch sử thanh toán).
  - Thao tác Tải lại dữ liệu (Recalculate).
  - Chuyển sang màn hình Cập nhật bảng tính lương và thử chỉnh sửa, lưu tạm, chốt lương.

- [ ] **Step 3: Commit hoàn thiện**
  ```bash
  git commit -m "chore: complete payroll feature verification"
  ```
