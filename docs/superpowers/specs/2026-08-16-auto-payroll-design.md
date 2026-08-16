# Thiết kế Chi tiết: Hệ thống Bảng lương Tự động & Giao diện KiotViet

## 1. Mục tiêu
Xây dựng tính năng Bảng lương hoàn chỉnh theo thiết kế chuẩn KiotViet Salon & Spa:
- **Tự động tạo kỳ lương:** Tự động khởi tạo bảng lương hàng tháng từ quá khứ đến đúng **tháng hiện tại** (tối đa đến tháng hiện tại, tuyệt đối KHÔNG tạo vượt quá sang tương lai) với trạng thái "Tạm tính" (Người tạo: `Auto`).
- **Tự động tính lương:**
  - Lương chính = (Lương cơ bản / Số ngày công chuẩn thực tế của tháng cấu hình từ lịch làm việc) * Số ca/ngày làm việc thực tế (đối với lương tháng) hoặc Tổng giờ làm * Lương/giờ (đối với lương theo giờ).
  - Hoa hồng = Tự động tổng hợp từ `commission_records` của nhân viên phát sinh trong kỳ lương.
  - Tổng thu nhập = Lương chính + Làm thêm + Hoa hồng + Phụ cấp + Thưởng.
  - Lương thực nhận = Tổng thu nhập - Giảm trừ.
- **Giao diện chuẩn KiotViet:**
  - Danh sách bảng lương có bộ lọc sidebar (Kỳ hạn trả, Trạng thái: Đang tạo, Tạm tính, Đã chốt lương, Đã hủy), thanh tìm kiếm, dòng tổng cộng số tiền ở header.
  - Bấm vào bất kỳ dòng nào mở rộng accordion 3 Tab: **Thông tin**, **Phiếu lương**, **Lịch sử thanh toán** với đầy đủ các action (*Hủy bỏ*, *Tải lại dữ liệu*, *Xem bảng lương*, *Xuất file*, *Thanh toán*).
  - Màn hình/Trang chi tiết **Cập nhật bảng tính lương** với bảng ma trận lương nhân viên đầy đủ các cột và các action (*Lưu tạm*, *Thanh toán*, *Chốt lương*).

---

## 2. Thiết kế Cơ sở dữ liệu (Database Schema)

### 2.1 Cập nhật bảng `branches` & `branch_settings`
Lưu trữ cấu hình ngày công chuẩn và ngày làm việc trong tuần của chi nhánh:
- `work_days_per_week` (Mặc định: `['T2','T3','T4','T5','T6','T7','CN']`)
- `holidays` (JSONB danh sách các ngày nghỉ lễ)

### 2.2 Nâng cấp bảng `payroll_periods`
```sql
ALTER TABLE payroll_periods 
  ADD COLUMN IF NOT EXISTS period_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS creator_type VARCHAR(20) NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS creator_name VARCHAR(100) DEFAULT 'Auto',
  ADD COLUMN IF NOT EXISTS approved_by_id BIGINT REFERENCES staff(id),
  ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_data_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
```

### 2.3 Nâng cấp bảng `payroll_records`
```sql
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
```

### 2.4 Bảng `payroll_payments`
```sql
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
```

---

## 3. Thiết kế Backend API

### 3.1 `GET /api/staff/payroll`
- Query params: `search`, `status` (mảng: draft, approved, cancelled), `periodType`, `limit`, `page`.
- Logic tự động sinh:
  1. Kiểm tra các tháng gần đây (12 tháng gần nhất đến tháng hiện tại).
  2. Nếu tháng nào chưa có `payroll_periods`, tự động tạo `BL0000xx` với tên `Bảng lương tháng MM/YYYY`, `starts_on = YYYY-MM-01`, `ends_on = Cuối tháng`, `creator_type = auto`, `status = draft`.
  3. Tự động tính toán các `payroll_records` cho toàn bộ nhân viên active trong chi nhánh.
- Trả về danh sách bảng lương kèm `summary` (Tổng lương, Đã trả nhân viên, Còn cần trả).

### 3.2 `GET /api/staff/payroll/:id`
- Lấy chi tiết bảng lương bao gồm:
  - Thông tin kỳ: `id`, `code`, `name`, `periodType`, `startsOn`, `endsOn`, `status`, `creatorName`, `approvedByName`, `approvedAt`, `updatedDataAt`, `note`.
  - Danh sách phiếu lương nhân viên: `payroll_records` kèm thông tin nhân viên, lương chính, làm thêm, hoa hồng, phụ cấp, thưởng, tổng thu nhập, giảm trừ, lương thực nhận, đã trả, còn cần trả.
  - Lịch sử thanh toán: `payroll_payments`.

### 3.3 `POST /api/staff/payroll/:id/recalculate`
- Tính toán lại toàn bộ dữ liệu tạm tính cho kỳ lương này (nếu chưa chốt):
  - Lấy số ngày công chuẩn của tháng (từ cấu hình chi nhánh).
  - Quét lịch làm việc / ca làm việc của từng nhân viên trong khoảng thời gian `starts_on` đến `ends_on`.
  - Quét doanh thu hoa hồng trong bảng `commission_records`.
  - Cập nhật lại `base_salary`, `commission`, `total_income`, `net_salary`, `remaining_amount`, `updated_data_at`.

### 3.4 `PUT /api/staff/payroll/:id`
- Cho phép chỉnh sửa thủ công các phiếu lương (phụ cấp, thưởng, phạt/giảm trừ, làm thêm, ghi chú).
- Cập nhật tổng thu nhập và lương thực nhận.

### 3.5 `POST /api/staff/payroll/:id/approve`
- Chốt lương: Đổi trạng thái sang `approved`, ghi nhận `approved_by_id`, `approved_by_name`, `approved_at`.

### 3.6 `POST /api/staff/payroll/:id/cancel`
- Hủy bảng lương: Đổi trạng thái sang `cancelled`.

### 3.7 `POST /api/staff/payroll/:id/pay`
- Thực hiện thanh toán lương: Tạo bản ghi vào `payroll_payments`, cập nhật `paid_amount` và `remaining_amount` trong `payroll_records`.

---

## 4. Thiết kế Frontend

### 4.1 Danh sách Bảng lương (`StaffPayrollView.tsx`)
- **Bộ lọc bên trái (Sidebar Filter):**
  - Select "Kỳ hạn trả lương" (Chọn kỳ hạn: Hàng tháng).
  - Nhóm checkbox "Trạng thái":
    - [x] Đang tạo
    - [x] Tạm tính
    - [x] Đã chốt lương
    - [ ] Đã hủy
- **Vùng bảng chính:**
  - Header: Thanh tìm kiếm theo mã hoặc tên bảng lương, nút `+ Bảng tính lương`, nút `Xuất file`.
  - Bảng dữ liệu:
    - Cột: Checkbox, Mã (BL0000xx), Tên (Bảng lương tháng x/2026), Kỳ hạn trả, Kỳ làm việc, Tổng lương, Đã trả nhân viên, Còn cần trả, Trạng thái (Badge).
    - Hàng Header phụ hiển thị số tổng: `Tổng lương`, `Đã trả nhân viên`, `Còn cần trả`.
  - **Accordion Row Detail (Click mở rộng dưới dòng):**
    - **Tab 1: Thông tin:**
      - Thông tin 2 cột: Mã, Tên, Kỳ hạn trả, Kỳ làm việc, Ngày tạo, Người tạo, Người lập bảng, Trạng thái, Tổng số nhân viên, Tổng lương, Đã trả nhân viên, Còn cần trả, Phạm vi áp dụng, Người chốt lương, Ghi chú.
      - Footer: Nút `🗑 Hủy bỏ` | Dữ liệu cập nhật vào: `DD/MM/YYYY HH:mm:ss` ℹ | Nút `🔄 Tải lại dữ liệu` | Nút `✔ Xem bảng lương` | Nút `📄 Xuất file`.
    - **Tab 2: Phiếu lương:**
      - Bảng danh sách phiếu lương nhân viên: Checkbox, Mã phiếu (PL00018x), Tên nhân viên, Tổng lương, Đã trả NV, Còn cần trả.
      - Footer: Nút `💳 Thanh toán`.
    - **Tab 3: Lịch sử thanh toán:**
      - Danh sách các giao dịch thanh toán lương đã thực hiện.

### 4.2 Trang / Modal Cập nhật Bảng tính lương (`StaffPayrollSheetView.tsx`)
- Top bar: Nút quay lại `← Cập nhật bảng tính lương`, Input tìm kiếm nhân viên, nút `💾 Lưu tạm`, `💳 Thanh toán`, `✔ Chốt lương`, menu mở rộng `⋮`.
- Bảng ma trận lương:
  - Cột: STT, Tên nhân viên (kèm mã NV), Lương chính, Làm thêm, Hoa hồng, Phụ cấp, Thưởng, Tổng thu nhập, Giảm trừ, Lương thực nhận, Đã trả, Còn cần trả.
  - Hàng tổng cộng đầu bảng tự động tính tổng từng cột.
  - Các ô có thể click nhập số tiền trực tiếp (Phụ cấp, Thưởng, Làm thêm, Giảm trừ).
