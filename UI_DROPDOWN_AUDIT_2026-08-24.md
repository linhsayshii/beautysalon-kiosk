# Báo cáo rà soát dropdown UI - 2026-08-24

## Phạm vi

- Toàn bộ mã UI React trong `frontend/src`, gồm desktop, mobile, filter, modal, drawer và bottom sheet.
- Tìm theo thẻ native (`select`, `option`, `datalist`, thuộc tính `list`), component chọn chuẩn, menu tự dựng, popover lịch và các container có `overflow`.
- Kiểm tra behavior Portal, hướng bung, giới hạn viewport, lớp nổi, click outside và bàn phím.

## Kết quả kiểm kê

- 38 thẻ `select` native tại 21 file đã được thay bằng `Select` chuẩn của website.
- 1 `datalist` native đã được thay bằng `Combobox` chuẩn, vẫn cho phép nhập giá trị mới.
- 3 menu lựa chọn tự dựng đã được quy về `Select`: sắp xếp mobile, trạng thái lịch hẹn mobile và trạng thái lịch hẹn POS desktop.
- 3 popover chuyên biệt được giữ nguyên hình thức nhưng chuyển qua `FloatingLayer` Portal: chọn chi nhánh mobile, chọn tuần desktop và menu tạo hàng hóa.
- Sau chỉnh sửa, quét tĩnh không còn `select`, `option`, `datalist` hoặc input có thuộc tính `list` trong TSX.

## Các vị trí desktop đã sửa

| Khu vực | File | Dropdown |
|---|---|---|
| Lịch làm việc | `features/staff/components/StaffScheduleView.tsx` | Kiểu xem theo nhân viên/ca |
| Chấm công | `features/staff/components/StaffAttendanceView.tsx` | Đơn vị tuần/tháng |
| Gán ca | `features/staff/components/AssignShiftForStaffModal.tsx` | Chọn ca làm |
| Bảng lương | `features/staff/components/StaffPayrollView.tsx` | Kỳ trả lương, số bản ghi |
| Thanh toán lương | `features/staff/components/StaffPayrollPaymentModal.tsx` | Nhân viên nhận lương |
| POS hóa đơn | `features/pos/components/PosView.tsx` | Nhân viên từng dòng hàng |
| POS lịch hẹn | `features/pos/components/PosView.tsx` | Nhân viên dịch vụ, trạng thái, thời lượng |
| Tạo hàng hóa | `features/inventory/components/GoodsCreateDialog.tsx` | Combobox nhóm hàng |
| Tạo hàng hóa | `features/inventory/components/GoodsCreateMenu.tsx` | Menu loại hàng qua Portal |
| Lịch nhân sự | `features/staff/components/WeekPicker.tsx` | Popover chọn tuần qua Portal |

## Các vị trí mobile đã sửa

| Khu vực | File | Dropdown |
|---|---|---|
| Danh sách lịch hẹn | `features/mobile-appointments/MobileAppointmentsListView.tsx` | Nhân viên, trạng thái lịch hẹn |
| Chọn ngày giờ | `features/mobile-common/MobileTimePickerSheet.tsx` | Ngày, giờ, phút trong dialog lồng |
| Đơn hàng | `features/mobile-orders/MobileOrdersView.tsx` | Thời gian, trạng thái, kênh bán, thanh toán |
| Khách hàng | `features/mobile-operations/MobileCustomersView.tsx` | Nhóm khách, công nợ trong filter sheet |
| Gói và thẻ | `features/mobile-operations/MobileCustomerCardsView.tsx` | Loại hàng, trạng thái trong filter sheet |
| Sửa khách hàng | `features/mobile-operations/MobileCustomerEditSheet.tsx` | Giới tính, nhóm khách |
| Hàng hóa | `features/mobile-inventory/MobileProductsView.tsx` | Loại hàng, nhóm hàng, tồn kho trong filter sheet |
| Sửa hàng hóa | `features/mobile-inventory/MobileProductEditSheet.tsx` | Nhóm hàng trong edit sheet |
| Phiếu nhập | `features/mobile-inventory/MobilePurchaseOrdersView.tsx` | Thời gian, trạng thái trong filter sheet |
| Bảng giá | `features/mobile-inventory/MobilePricebooksView.tsx` | Bảng giá, nhóm hàng, loại hàng trong filter sheet |
| POS | `features/mobile-pos/MobilePosView.tsx` | Nhóm hàng, nhân viên thực hiện |
| Giỏ POS | `features/mobile-pos/MobileCartBottomSheet.tsx` | Nhân viên từng dòng trong bottom sheet |
| Nhân sự | `features/mobile-staff/MobileStaffManagementView.tsx` | Vai trò/chức vụ |
| Lương cá nhân | `features/mobile-staff/MobileStaffSalaryView.tsx` | Kỳ lương |
| Quản trị lương | `features/mobile-staff/MobileStaffPayrollAdminView.tsx` | Kỳ lương |
| Dùng chung | `features/mobile-common/MobileSortDropdown.tsx` | Toàn bộ dropdown sắp xếp mobile |
| Thanh trên mobile | `layouts/MobileAppLayout/MobileTopBar.tsx` | Chọn chi nhánh qua Portal |

## Component nền đã hoàn thiện

### Select

- Menu render vào `document.body` bằng Portal và dùng `position: fixed`.
- Không còn phụ thuộc `overflow` hoặc stacking context của filter, modal, drawer và sheet cha.
- Tự đo khoảng trống trên/dưới và tự đổi hướng bung.
- Bám lại trigger khi scroll, resize hoặc visual viewport mobile thay đổi.
- Giữ khoảng cách an toàn 8px với mép viewport và giới hạn chiều rộng theo màn hình.
- Chiều cao menu tối đa 420px; chỉ danh sách thật sự dài mới cuộn bên trong menu.
- Bổ sung `aria-controls`, listbox semantics, điều hướng bàn phím và chặn Escape lan ra đóng dialog cha.

### FloatingLayer

- Primitive Portal dùng chung cho menu hành động và popover chuyên biệt không phù hợp với `Select`.
- Hỗ trợ căn trái/phải, tự bung lên/xuống, bám anchor và giới hạn theo visual viewport.

### Combobox

- Thay dropdown `datalist` native ở nhóm hàng.
- Cho phép vừa nhập tự do vừa chọn gợi ý chuẩn của website.
- Gợi ý dùng Portal, hỗ trợ bàn phím, click outside và semantics combobox/listbox.

## Các menu được giữ nguyên có chủ đích

- Mega menu điều hướng và menu tài khoản trong `layouts/AdminLayout/Header.tsx` không phải trường chọn dữ liệu. Chúng đã là fly-out nổi ra ngoài topbar, không nằm trong vùng scroll/filter/sheet và không có lỗi phải cuộn lớp cha.
- Date input native không được tính là dropdown lựa chọn của website vì đây là date picker theo nền tảng, không phải danh sách option.

## Xác minh

- TypeScript: đạt.
- Production build: đạt.
- Test: 61 file, 193 test đều đạt.
- `git diff --check`: đạt.
- Quét TSX sau sửa: 0 `select`, 0 `datalist`, 0 `option`, 0 input `list`.
- Chrome desktop 1440x1000: menu là con trực tiếp của `body`, bung xuống và nằm trọn viewport.
- Chrome mobile 390x844: menu là con trực tiếp của `body`, nằm ngoài sheet, tự bung lên; 12 lựa chọn chỉ cuộn trong menu vì danh sách dài.

## Kế hoạch đã thực hiện

1. Kiểm kê route, component và primitive.
2. Phân loại dropdown native, dropdown chuẩn, menu chọn tự dựng và popover chuyên biệt.
3. Sửa primitive Portal và collision handling trước.
4. Thay toàn bộ dropdown native từ ngoài vào sâu trong filter, modal và sheet.
5. Thay `datalist` bằng combobox và Portal hóa các popover có nguy cơ clipping.
6. Chạy quét tĩnh, typecheck, test, build và kiểm tra Chrome desktop/mobile.
