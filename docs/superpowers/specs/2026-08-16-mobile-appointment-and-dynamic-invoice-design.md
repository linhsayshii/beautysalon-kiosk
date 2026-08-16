# Đặc Tả Thiết Kế: Mobile Center Action, Đặt Lịch Hẹn & Tạo Hóa Đơn

- **Ngày:** 2026-08-16
- **Trạng thái:** Approved
- **Tác giả:** Claude Code Assistant & linhsayshii

---

## 1. Mục Tiêu & Yêu Cầu

### 1.1. Thay đổi Thanh Điều Hướng Đáy (Bottom Navigation)
- Bỏ nút cố định *"Bán hàng"*.
- Thêm **Nút Tạo Mới `( + )`** nổi bật ở chính giữa thanh Bottom Navigation Bar.
- Khi chạm vào nút `( + )`, mở Action Sheet trượt lên với các tùy chọn:
  1. 📅 **Tạo lịch hẹn** (Đặt trước lịch cho khách)
  2. 🧾 **Tạo hóa đơn bán hàng** (Làm dịch vụ / mua hàng thu tiền ngay)
  3. 👤 **Thêm khách hàng mới**

### 1.2. Màn Hình Chọn Khách Hàng (`MobileCustomerSelectSheet`) - *Khớp Ảnh 1*
- Ô tìm kiếm khách hàng `"Tìm khách hàng"` + icon quét mã QR/Barcode + nút `"Hủy"`.
- Danh sách khách hàng hiển thị:
  - Avatar đại diện.
  - Tên khách hàng (in đậm) + Mã KH (vd `KH000407`).
  - Số điện thoại (`0375467268`).
  - **Badge TỔNG số buổi dịch vụ còn lại của các gói thẻ đã mua:** `Còn: 18 Buổi DV` (tính từ tổng số lượt còn lại của tất cả gói thẻ khách đã mua).
  - Badge công nợ: `Nợ: 225,000` (nếu khách có dư nợ).
- Nút tròn `( + )` xanh nổi ở góc dưới để thêm nhanh khách hàng mới.

### 1.3. Bộ Chọn Thời Gian Lịch Hẹn (`MobileTimePickerSheet`) - *Khớp Ảnh 3 & 4*
- Header `< Chọn thời gian` + icon ⚙️.
- Dải ngày cuộn ngang (14 ngày tới): `Thứ 2 17/08`, `Thứ 3 18/08` (active highlight), `Thứ 4 19/08`...
- Nút `"Chọn ngày giờ cụ thể"`: Chạm vào mở con lăn cuộn Giờ : Phút và Ngày với 2 nút `"Hủy bỏ"` / `"Áp dụng"`.
- Lưới các khung giờ 30 phút theo ca làm việc:
  - ☀️ Ca sáng: `08:00 - 13:00`
  - 🌤️ Ca chiều: `14:00 - 18:00`
  - 🌙 Ca tối: `19:00 - 22:00`
- Nút cố định ở đáy: `"Tiếp tục"` / `"Áp dụng"`.

### 1.4. Màn Hình Chi Tiết Dịch Vụ / Phân Công KTV (`MobileServiceItemDetailSheet`) - *Khớp Ảnh 5*
Sau khi chọn một dịch vụ/sản phẩm từ catalog hàng hóa (hoặc khi bấm chỉnh sửa một món trong lịch hẹn/hóa đơn), màn hình **"Chi tiết lịch dịch vụ"** sẽ mở ra:
- **Header:** `< Chi tiết lịch dịch vụ`.
- **Thẻ thông tin dịch vụ phía trên:**
  - Icon dịch vụ nền xanh nhạt + Tên dịch vụ in đậm (vd: `RF Needle Skinlip 1 buổi`) + Thời lượng (`Thời lượng: 1h30'`).
- **Bộ đếm số lượng & Thành tiền:**
  - `Số lượng`: Bộ nút `[ -  1  + ]` bo tròn tinh tế.
  - `Thành tiền`: Khung hiển thị giá tiền nổi bật màu xanh (`2,500,000`).
- **Khối `LỊCH LÀM DỊCH VỤ`:**
  - Hai ô Ngày & Khung giờ: `Thứ 3, 18/08 📅` và `14:30 - 16:00 🕒` (tự động cộng thời lượng dịch vụ từ giờ bắt đầu).
  - Ô **Chọn nhân viên >**: Chạm vào mở danh sách nhân viên để gán KTV thực hiện dịch vụ này.
  - Ô **Chọn vị trí >**: Chạm vào chọn giường / phòng / vị trí làm dịch vụ (hoặc ghi chú vị trí).
- **Nút hành động cố định ở đáy:** `[ Xong ]` (lưu món kèm KTV và thời gian vào danh sách của lịch hẹn / hóa đơn).

### 1.5. Màn Hình Tạo Lịch Hẹn (`MobileAppointmentCreateView`) - *Khớp Ảnh 2*
- **Card 1 (Khách hàng & Thời gian):**
  - Hàng chọn khách hàng (`👤 Thêm khách hàng`).
  - Hàng chọn thời gian (`📅 Bắt đầu làm 14:30 - Thứ ba, 18/08`).
- **Card 2 (Dịch vụ & Kỹ thuật viên):**
  - Danh sách các dịch vụ đã chọn (hiển thị tên, thời lượng, giá và KTV thực hiện).
  - Chạm vào món để mở lại `MobileServiceItemDetailSheet` chỉnh sửa KTV / số lượng.
  - Nút `"Thêm dịch vụ, sản phẩm"`.
- **Card 3 (Trạng thái & Lưu):**
  - Bộ chọn trạng thái: `Chờ xác nhận` | `Chưa tới` | `Đang chờ` | `Đang làm` | `Hoàn thành`.
  - Nút `"Lưu"` màu xanh ở đáy.

### 1.6. Màn Hình Tạo Hóa Đơn Bán Hàng (`MobileInvoiceCreateView`)
- Các bước tương tự:
  - Chọn Khách hàng (hoặc Khách vãng lai).
  - Chọn Dịch vụ / Sản phẩm từ Catalog -> Mở `MobileServiceItemDetailSheet` để chọn số lượng & gán Nhân viên bán/thực hiện.
  - *Bỏ qua bước chọn thời gian lịch hẹn* (lấy thời gian hiện tại).
  - Nhập chiết khấu / giảm giá.
  - Chọn phương thức thanh toán (`Tiền mặt`, `VietQR`, `Thẻ`, `Thẻ tài khoản`).
  - Nút `"Thanh toán & Xuất hóa đơn"`.

---

## 2. Cập Nhật Backend API
1. **API `GET /api/v1/pos/customers` & `GET /api/v1/customers`:**
   - Bổ sung subquery tính tổng số buổi dịch vụ còn lại của các gói thẻ:
     ```sql
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(cp.total_units - cp.used_units), 0) AS remaining_units
       FROM customer_packages cp
       WHERE cp.customer_id = c.id AND cp.status = 'active' AND (cp.expires_at IS NULL OR cp.expires_at > NOW())
     ) pkg_units ON TRUE
     ```
   - Trả về trường `remainingPackageUnits` trong payload danh sách khách hàng.
2. **API `POST /api/v1/pos/checkout` & `POST /api/v1/pos/appointments`:**
   - Cho phép `lines` nhận `staffId` theo từng item: `[{ itemType, itemId, quantity, staffId }]`.
