# Kế hoạch & Đặc tả Thiết kế: Đồng nhất Trải nghiệm Toàn bộ Giao diện PWA Mobile (Unified PWA Mobile Experience)

- **Ngày tạo**: 2026-08-17
- **Trạng thái**: Bản thảo thiết kế hoàn thiện (Approved Design Spec)
- **Mục tiêu**: Chuyển đổi và chuẩn hóa toàn bộ các trang trong phân hệ Mobile PWA (`/m/*`) sang trải nghiệm Mobile-first thuần túy (Card List + Bottom Sheet + Metric Cards), loại bỏ triệt để các bảng dữ liệu cuộn ngang desktop và giao diện chắp vá, đồng nhất 100% về UI, icon, màu sắc, bo góc và tương tác chạm.

---

## 1. Bối cảnh & Hiện trạng Hệ thống

Hệ thống PWA hiện tại đang có sự phân hóa giữa 2 nhóm trang:
1. **Nhóm đã Mobile-first hoàn chỉnh**: Dashboard (`/m/dashboard`), Bán hàng POS (`/m/pos`), Hóa đơn mới (`/m/invoices/new`), Lịch hẹn (`/m/appointments`), Tạo lịch hẹn (`/m/appointments/new`), Đơn hàng (`/m/orders`), Menu mở rộng (`/m/more`), Thông báo (`/m/notifications`), Tài khoản (`/m/account`), Lịch làm việc cá nhân (`/m/schedule`), Bảng lương cá nhân (`/m/salary`), Quét chấm công QR (`/m/attendance`).
2. **Nhóm đang mượn component Desktop bọc trong shell Mobile** (gây vỡ bố cục, bảng dữ liệu phải cuộn ngang khó nhìn, filter desktop chiếm diện tích):
   - **Khách hàng**: Danh sách khách hàng (`/m/customers`), Gói & Thẻ đã bán (`/m/customer-cards`).
   - **Hàng hóa & Kho**: Danh mục hàng hóa (`/m/products`), Bảng giá (`/m/pricebooks`), Quản lý nhập hàng (`/m/purchase-orders`), Tạo phiếu nhập hàng (`/m/purchase-orders/new`).
   - **Quản trị Nhân sự**: Lịch làm việc chi nhánh (`/m/staff/schedule`), Bảng chấm công tổng hợp (`/m/staff/attendance`), Bảng tính lương quản trị (`/m/staff/payroll`), Bảng hoa hồng thợ (`/m/staff/commissions`), Tạo mã QR chấm công (`/m/attendance/qr`).

---

## 2. Chuẩn hóa Design System & Tokens cho Mobile

Tất cả các màn hình Mobile PWA tuân thủ nghiêm ngặt hệ thống Token sau:

### 2.1. Bảng màu Semantic (CSS Variables)
- **Background / Canvas**: `var(--canvas)` (`#f8fafc` / `#f4f6f9`) - nền dịu mắt, tăng độ tương phản cho card.
- **Card Surface**: `var(--surface)` (`#ffffff`) - nền thẻ trắng sáng, bo góc tinh tế.
- **Border / Divider**: `var(--line)` (`#e2e8f0` / `#cbd5e1`) - đường viền thanh mảnh `1px`.
- **Primary Brand**: `var(--blue-600)` (`#0062eb`), hover/active `var(--blue-700)` (`#004ecc`), nền sáng `var(--blue-50)` (`#f0f7ff`).
- **Trạng thái (Status Badges & Indicators)**:
  - **Thành công / Hoạt động / Có mặt**: `var(--green)` (`#16a34a`) | Nền: `var(--green-soft)` (`#dcfce7`)
  - **Chờ xử lý / Cảnh báo / Dưới định mức**: `var(--orange)` (`#d97706`) | Nền: `var(--orange-soft)` (`#fef3c7`)
  - **Hủy / Công nợ / Vắng mặt**: `var(--red)` (`#dc2626`) | Nền: `var(--red-soft)` (`#fee2e2`)
  - **Dịch vụ / Combo / Thẻ liệu trình**: `var(--violet)` (`#7c3aed`) | Nền: `var(--violet-soft)` (`#ede9fe`)
  - **Thông tin / Đang phục vụ**: `var(--sky)` (`#0284c7`) | Nền: `var(--sky-soft)` (`#e0f2fe`)

### 2.2. Bo góc (Border Radius) & Hiệu ứng Bóng (Shadows)
- **Thẻ danh sách (List Cards)**: `border-radius: 14px` (`--radius-card`), viền `1px solid var(--line)`, shadow: `0 1px 3px rgba(15, 23, 42, 0.04)`.
- **Bottom Sheet / Drawer**: `border-radius: 20px 20px 0 0`, shadow: `0 -4px 24px rgba(15, 23, 42, 0.12)`. Drag handle ở đỉnh: `width: 36px, height: 4px, border-radius: 2px, background: #cbd5e1`.
- **Button chính / Ô tìm kiếm**: `border-radius: 12px` (hoặc `20px` với thanh search), chiều cao tối thiểu `42px - 46px`.
- **Huy hiệu trạng thái (Status Pills)**: `border-radius: 999px`, font-size `11.5px - 12px`, padding `3px 8px`, `font-weight: 600`.

### 2.3. Quy chuẩn Icon & Kích thước chạm (Touch Target)
- **Icon Set**: 100% sử dụng **Phosphor Icons** (`ph ph-*` cho outline mặc định, `ph-fill ph-*` cho trạng thái được chọn/kích hoạt).
- **Kích thước Touch Target**: Vùng chạm tối thiểu `40px × 40px` cho mọi nút bấm, tránh chạm nhầm khi thao tác 1 tay trên điện thoại.
- **Phản hồi xúc giác thị giác**: Áp dụng `:active { transform: scale(0.985); background: var(--blue-50); }` cho các thành phần bấm được.

---

## 3. Bộ Component Mobile Dùng Chung (Shared Mobile Primitives)

Được đặt tại `frontend/src/features/mobile-common/`:

1. **`MobileSearchBar`**:
   - Thanh tìm kiếm bo tròn `radius: 20px` với icon kính lúp, nút xóa text nhanh (`x`).
   - Tích hợp nút mở bộ lọc kèm chấm đỏ báo hiệu số lượng điều kiện lọc đang active.
2. **`MobileFilterSheet`**:
   - Bottom Sheet chứa các tiêu chí lọc (theo danh mục, trạng thái, thời gian).
   - Nút "Đặt lại" và "Áp dụng" ghim đáy.
3. **`MobileMetricCards`**:
   - Dải thẻ tóm tắt KPI/chỉ số nhanh (thay thế `SummaryStrip` desktop).
   - Bố cục lưới 2 cột hoặc vuốt ngang, hiển thị số liệu nổi bật (`font-weight: 750`) kèm nhãn ngữ nghĩa màu sắc.
4. **`MobileCard`**:
   - Thẻ hiển thị dữ liệu đối tượng chuẩn (Avatar/Icon + Tiêu đề chính + Mã + Badge trạng thái + Chi tiết phụ + Giá tiền/Chỉ số + Icon mũi tên `ph ph-caret-right`).
5. **`MobileDetailSheet`**:
   - Bottom Sheet trượt lên (chiếm 80-90% màn hình) khi chạm vào một thẻ để xem thông tin chi tiết đầy đủ và thao tác hành động.
6. **`MobileSegmentedControl`**:
   - Thanh trượt chuyển Tab cảm ứng mượt mà (chuyển đổi nhanh giữa các chế độ xem).
7. **`MobileEmptyState`**:
   - Trạng thái rỗng chuẩn mobile với icon to, thông điệp rõ ràng và nút tạo mới.

---

## 4. Đặc tả Chuyển đổi Chi tiết Từng Trang (Page-by-Page Specs)

### 4.1. Phân hệ Khách hàng & Gói thẻ (`frontend/src/features/mobile-operations/`)
- **Trang Danh sách Khách hàng (`/m/customers`)**:
  - `MobileMetricCards`: Tổng khách, Khách đang nợ, Tổng công nợ, Khách có gói active.
  - `MobileSearchBar` + `MobileFilterSheet`: Lọc nhóm khách (Cá nhân/Công ty), trạng thái nợ.
  - Danh sách thẻ khách: Avatar chữ cái đầu, Tên khách hàng, Số điện thoại (chạm để gọi), Nhóm khách, Lần cuối đến, Số gói đang dùng, Dư nợ công nợ (màu đỏ nếu nợ > 0, xanh nếu 0đ).
  - Bottom Sheet Chi tiết KH: Tab Thông tin cơ bản, Lịch sử mua hàng, Gói thẻ đang sở hữu, Sổ công nợ.
  - Form thêm khách hàng mới tối ưu giao diện Mobile.
- **Trang Gói & Thẻ đã bán (`/m/customer-cards`)**:
  - Lọc loại hàng (Gói dịch vụ / Thẻ tài khoản), trạng thái (Đang dùng / Hết hạn / Đã dùng hết).
  - Thẻ gói/thẻ: Tên gói, Khách hàng, Thanh tiến độ `X/Y buổi` (với gói) hoặc `Số dư: XXX đ` (với thẻ tài khoản), Ngày hết hạn, Badge trạng thái.
  - Sheet xem lịch sử các buổi đã làm và trừ buổi nhanh.

### 4.2. Phân hệ Hàng hóa, Bảng giá & Nhập hàng (`frontend/src/features/mobile-inventory/`)
- **Trang Danh mục Hàng hóa (`/m/products`)**:
  - `MobileMetricCards`: Tổng hàng, Sản phẩm (tồn kho), Dịch vụ & Combo, Cảnh báo dưới định mức.
  - Danh sách thẻ hàng: Icon phân loại (Sản phẩm / Dịch vụ / Gói), Mã hàng, Tên hàng, Đơn vị tính, Giá bán nổi bật, Cảnh báo tồn kho đỏ nếu dưới định mức.
  - Sheet xem chi tiết hàng hóa & cập nhật nhanh.
- **Trang Thiết lập Bảng giá (`/m/pricebooks`)**:
  - Thanh chọn bảng giá (Bảng giá chung, Chi nhánh, Khách VIP...).
  - Danh sách mặt hàng kèm ô nhập giá `MoneyInput` dạng bàn phím số, so sánh trực quan Giá vốn vs Giá niêm yết vs Giá theo bảng giá.
  - Nút "Lưu bảng giá" ghim đáy khi có thay đổi.
- **Trang Quản lý Nhập hàng (`/m/purchase-orders`) & Tạo phiếu (`/m/purchase-orders/new`)**:
  - Danh sách phiếu nhập: Mã phiếu, Nhà cung cấp, Ngày nhận, Số lượng mặt hàng, Tổng tiền cần trả NCC, Trạng thái phiếu.
  - Form tạo phiếu nhập mới dạng wizard 3 bước: 1. Chọn NCC & Ngày -> 2. Chọn mặt hàng & Số lượng/Đơn giá -> 3. Thanh toán & Hoàn tất.

### 4.3. Phân hệ Quản trị Nhân sự, Ca làm & Lương hoa hồng (`frontend/src/features/mobile-staff/`)
- **Trang Lịch làm việc chi nhánh (`/m/staff/schedule`)**:
  - Thanh chọn tuần `WeekPicker` (T2 -> CN).
  - Chuyển đổi xem theo nhân viên hoặc theo ca làm việc.
  - Sheet gán ca làm việc nhanh cho nhân viên.
- **Trang Bảng chấm công tổng hợp (`/m/staff/attendance`)**:
  - Lọc theo tuần/tháng, thẻ từng nhân viên hiển thị Tổng giờ làm, Số ca chuẩn, Số lần đi trễ/về sớm.
  - Sheet xem chi tiết nhật ký chấm công từng ngày (ảnh GPS, giờ check-in/out, duyệt công).
- **Trang Bảng tính lương (`/m/staff/payroll`)**:
  - Thẻ kỳ lương (Tháng/Tuần), danh sách lương nhân viên: Lương cứng + Hoa hồng + Phụ cấp - Giảm trừ = **Thực lĩnh** nổi bật.
  - Trạng thái chốt lương / thanh toán và Sheet xem phiếu lương chi tiết từng người.
- **Trang Bảng hoa hồng thợ (`/m/staff/commissions`)**:
  - `MobileSegmentedControl`: Chuyển giữa 2 tab `Tổng hợp theo nhân viên` và `Chi tiết giao dịch`.
  - Tab 1: Doanh số cá nhân, Hoa hồng làm dịch vụ, Hoa hồng tư vấn mỹ phẩm, Tổng hoa hồng.
  - Tab 2: Dòng thời gian từng bill phát sinh hoa hồng.
- **Trang QR Chấm công cửa hàng (`/m/attendance/qr`)**:
  - Card hiển thị mã QR lớn, tự làm mới, hướng dẫn nhân viên quét vào ca.

### 4.4. Hệ thống Điều hướng & TopBar (`MobileTopBar.tsx` & `router.tsx`)
- Đăng ký đầy đủ các route mobile chuyên biệt trong `router.tsx`.
- Cấu hình `SUBPAGE_CONFIG` trong `MobileTopBar.tsx` để mọi trang con đều có tiêu đề tiếng Việt chuẩn và nút Back điều hướng về đúng trang cha.

---

## 5. Lộ trình Triển khai (5 Giai đoạn)

1. **Giai đoạn 1**: Xây dựng Bộ Shared Primitives (`MobileSearchBar`, `MobileFilterSheet`, `MobileMetricCards`, `MobileCard`, `MobileDetailSheet`, `MobileSegmentedControl`, `MobileEmptyState`) & Chuẩn hóa CSS Token.
2. **Giai đoạn 2**: Chuyển đổi Phân hệ Khách hàng & Gói thẻ dịch vụ (`/m/customers`, `/m/customer-cards`).
3. **Giai đoạn 3**: Chuyển đổi Phân hệ Hàng hóa, Bảng giá & Nhập hàng (`/m/products`, `/m/pricebooks`, `/m/purchase-orders`, `/m/purchase-orders/new`).
4. **Giai đoạn 4**: Chuyển đổi Phân hệ Quản trị Nhân sự, Ca làm & Lương hoa hồng (`/m/staff/schedule`, `/m/staff/attendance`, `/m/staff/payroll`, `/m/staff/commissions`, `/m/attendance/qr`).
5. **Giai đoạn 5**: Đồng bộ Navigation TopBar, Kiểm thử Toàn diện, Responsive & Unit Tests.

---

## 6. Chiến lược Kiểm thử & Đảm bảo Chất lượng
- **Unit Tests**: Kiểm thử render và tương tác cho tất cả component primitive và page views mới (`vitest`).
- **Responsive Testing**: Kiểm tra trên các breakpoint 360px, 375px (iPhone SE), 390px/412px (iPhone 14/Pixel), 768px (Tablet).
- **TypeScript & Build Check**: Đảm bảo 0 lỗi kiểu dữ liệu và lệnh `npm run build` thành công 100%.
