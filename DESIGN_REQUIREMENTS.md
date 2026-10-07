# Đặc tả thiết kế AnnaChill Salon Admin

## 1. Mục tiêu

Xây dựng bộ giao diện quản trị salon lấy cảm hứng từ bố cục KiotViet trong ảnh tham chiếu, nhưng sử dụng nhận diện AnnaChill. Sản phẩm cần dễ đọc trong ca làm việc, thao tác nhanh, thân thiện và có thể mở rộng thành đầy đủ các phân hệ quản lý salon.

Phạm vi hiện tại: toàn bộ giao diện quản trị và mobile. Template triển khai dùng chung nằm trong [Mobile UI: header, trang và sheet](docs/mobile-ui-header-template.md); các khối Dashboard bên dưới mô tả định hướng ban đầu.

## 2. Design read

Đây là dashboard quản trị dành cho chủ salon, thu ngân và nhân viên vận hành hằng ngày. Ngôn ngữ thị giác là SaaS sáng, thân thiện, dày dữ liệu vừa phải, sử dụng nhiều bề mặt bo tròn và một màu xanh xuyên suốt để chỉ dẫn thao tác.

- `DESIGN_VARIANCE: 3` - bố cục ổn định, ưu tiên khả năng quét dữ liệu nhanh.
- `MOTION_INTENSITY: 2` - chỉ dùng hover, nhấn, dropdown và phản hồi trạng thái.
- `VISUAL_DENSITY: 7` - nhiều số liệu nhưng vẫn có khoảng thở rõ giữa các nhóm.
- Chế độ giao diện: light theme cố định vì đây là màn hình vận hành nội bộ và ảnh tham chiếu dùng nền sáng.

## 3. Nguyên tắc thị giác

### 3.1 Hình khối

- Card lớn: bo góc `16px`.
- Card con và item danh sách: bo góc `12px`.
- Badge và chip: dạng pill, bo góc tối đa.
- Button, input và select: bo góc `12px` (`--radius-control`), cao 40px trên desktop và 44px trên mobile/sheet.
- Viền card: `1px` với màu xanh xám rất nhạt.
- Card trong trang dùng viền mảnh, không bóng; bóng chỉ tách các lớp nổi như dropdown, modal và sheet.
- Không dùng góc vuông, glow neon hoặc glassmorphism.

### 3.2 Màu sắc

| Token | Giá trị | Mục đích |
| --- | --- | --- |
| `--blue-600` | `#0756CC` | Accent chính, nav, dữ liệu quan trọng |
| `--blue-700` | `#0647AD` | Hover và active |
| `--blue-100` | `#E5EFFF` | Badge và trạng thái nhẹ |
| `--ink-950` | `#111827` | Tiêu đề, số liệu |
| `--ink-600` | `#526178` | Mô tả và nhãn phụ |
| `--surface` | `#FFFFFF` | Card |
| `--canvas` | `#F1F4F8` | Nền ứng dụng |
| `--line` | `#DFE6EF` | Viền và đường chia |
| `--green` | `#087A44` | Kết quả tích cực |
| `--orange` | `#B45309` | Cảnh báo nhẹ |
| `--red` | `#C6283D` | Giảm sút hoặc lỗi |

Màu xanh là accent duy nhất cho hành động. Xanh lá, cam và đỏ chỉ biểu thị trạng thái dữ liệu.

Mỗi tông trạng thái (`green`, `orange`, `red`, `violet`, `sky`, `pink`, `mint`) có ba token: `--x` cho chữ và điểm màu, `--x-soft` cho nền nhạt, `--x-line` cho viền trên nền nhạt. Trạng thái lịch hẹn dùng chung bộ `--appt-*` cho lịch POS, chấm trạng thái trên desktop và mobile:

| Trạng thái | Token | Màu |
| --- | --- | --- |
| Chờ xác nhận | `--appt-pending` | xám `--ink-300` |
| Chưa tới / Chờ phục vụ | `--appt-confirmed` | `--mint` |
| Đang chờ (khách đã tới) | `--appt-waiting` | `--orange` |
| Đang làm | `--appt-in-service` | `--blue-600` |
| Đã xong | `--appt-completed` | `--green` (khối lịch POS nhạt đi: nền `--green-soft`) |
| Đã hủy / Không đến | `--appt-cancelled` / `--appt-no-show` | `--red` / `--ink-500` |

Không viết mã màu hex ngoài `tokens.css`; test contract sẽ báo lỗi.

### 3.3 Typography

- Font: hệ thống sans-serif ưu tiên `SF Pro Display`, `SF Pro Text`, `Segoe UI`, `Arial`.
- Tiêu đề trang dùng token 22px/weight 600 trên desktop; control nhập trên mobile luôn ít nhất 16px để tránh iOS tự zoom.
- Tiêu đề card: 16-18px, weight 700.
- KPI chính: 28-34px, weight 750.
- Body: 14px, line-height 1.5.
- Metadata: 12-13px, weight 500.
- Số liệu dùng `font-variant-numeric: tabular-nums` để thẳng hàng.

### 3.4 Khoảng cách

- Khoảng cách trang: 14px ở desktop, 12px ở tablet; mobile shell dùng 16px.
- Padding card: 13-15px ở desktop, 12-15px ở mobile.
- Gap giữa card: 9-10px.
- Chiều cao thanh điều hướng: 56px ở desktop và 52px ở mobile.

### 3.5 Chính sách dữ liệu giao diện

- Frontend không chứa mock data hoặc fallback data nghiệp vụ.
- Mọi KPI, bảng, biểu đồ và danh sách chỉ được render từ REST API.
- Trước khi API phản hồi, giao diện hiển thị skeleton hoặc placeholder phi dữ liệu.
- Khi API lỗi, giao diện hiển thị error state và nút thử lại, không thay thế bằng số liệu giả.

## 4. Cấu trúc Dashboard

### 4.1 Thanh điều hướng

- Logo AnnaChill bên trái.
- Menu chính tinh gọn: Tổng quan, Hàng hóa, Đơn hàng, Khách hàng, Nhân viên, Tài chính (Sổ quỹ, Báo cáo lãi lỗ). Không hiển thị Vị trí và Phân tích.
- Khu vực hành động bên phải: Bán online, Thu ngân, thông báo, trợ giúp, cài đặt, tài khoản.
- Mục đang chọn có nền trắng mờ và underline trắng.
- Menu Hàng hóa mở bằng hover, click hoặc bàn phím; dropdown có nhóm Danh mục, Kho hàng, Nhập hàng.
- Các trang Nhân viên không lặp lại thanh sub-navigation ngang trong nội dung; chuyển trang qua dropdown Nhân viên trên topbar.
- Trên màn hình nhỏ hơn 1120px, menu chính chuyển thành nút hamburger và panel trượt xuống.

### 4.2 Lưới nội dung

- Desktop từ 1280px: khu vực chính chiếm phần còn lại, sidebar rộng 310px.
- Tablet: sidebar chuyển thành lưới hai cột dưới biểu đồ.
- Mobile: toàn bộ card xếp một cột, KPI cuộn ngang khi cần.

### 4.3 Nhóm KPI

Ba card đầu trang:

1. Lịch hẹn hôm nay: tổng số, tỷ lệ thay đổi và vòng tiến độ.
2. Khách hàng hôm nay: khách mới, khách quay lại, khách lẻ và biểu đồ donut.
3. Thu chi hôm nay: tổng thu, tổng chi và biểu đồ cột nhỏ.

### 4.4 Biểu đồ

- Lượng khách hàng: line chart theo giờ, có tab Theo giờ, Theo ngày, Theo thứ.
- Doanh thu thuần: bar chart theo giờ, có badge tổng doanh thu, hóa đơn và trả hàng.
- Dropdown thời gian mặc định là Tháng này.
- Tooltip xuất hiện khi hover hoặc focus vào điểm dữ liệu.
- Biểu đồ cần có nhãn trục, đường lưới nhẹ và màu accent đồng nhất.

### 4.5 Sidebar

- Quick actions: Vay vốn, Thanh toán.
- Banner tiện ích nhân viên.
- Nhắc việc gồm công nợ khách hàng và tồn kho.
- Lịch hẹn sắp tới.
- Hoạt động gần đây.

## 5. Trạng thái tương tác

- Hover: nền đổi nhẹ, icon hoặc label tăng tương phản.
- Active: phần tử dịch xuống `1px` hoặc scale `0.98`.
- Focus: outline xanh 3px có độ trong suốt, không loại bỏ focus mặc định nếu chưa có thay thế.
- Dropdown: fade và dịch chuyển 6px trong 160ms.
- Tab: đổi nội dung biểu đồ và cập nhật `aria-selected`.
- Loading: skeleton theo đúng hình dạng card.
- Empty: thông báo ngắn kèm hành động phù hợp.
- Error: hiển thị inline trong khu vực dữ liệu, không che toàn màn hình.

### 5.1 Bộ chọn thời gian dùng chung

- Trigger là control bo tròn có nhãn khoảng thời gian và icon lịch.
- Preset chia 5 cột: ngày, tuần, tháng, quý, năm; mỗi cột có kỳ hiện tại và kỳ trước.
- Có `Toàn thời gian` và `Lựa chọn khác`.
- Khoảng tùy chọn dùng calendar hai tháng trên desktop, một tháng trên mobile; có Quay lại, Đặt lại và Áp dụng.
- Component phát cùng một contract `dateFrom/dateTo` và được dùng cho Dashboard, Đơn hàng, Lịch làm, Chấm công, Hoa hồng và Nhập hàng.

## 6. Responsive

| Breakpoint | Hành vi |
| --- | --- |
| `>= 1440px` | Dashboard 2 vùng, 3 KPI, 2 biểu đồ song song |
| `1120-1439px` | Nav rút gọn hành động, sidebar xuống dưới |
| `768-1119px` | Menu hamburger, KPI 2 cột, biểu đồ 1 cột |
| `< 768px` | Một cột, card padding 16px, quick action cố định ở đáy nếu cần |

## 7. Khả năng truy cập

- Contrast tối thiểu WCAG AA.
- Toàn bộ button, tab và menu dùng được bằng bàn phím.
- Icon chỉ trang trí có `aria-hidden="true"`; icon button có `aria-label`.
- Không dùng màu là tín hiệu duy nhất cho trạng thái.
- Hỗ trợ `prefers-reduced-motion`.
- Biểu đồ có mô tả văn bản hoặc bảng dữ liệu ẩn cho trình đọc màn hình.

## 8. Cấu trúc trang dự kiến

1. `/dashboard` - Tổng quan.
2. `/products` - Danh sách hàng hóa.
3. `/pricebooks` - Thiết lập giá.
4. `/purchase-orders` - Danh sách/chi tiết phiếu nhập.
5. `/purchase-orders/new` - Tạo phiếu nhập.
6. `/orders` - Đơn hàng và hóa đơn.
7. `/customers` - Khách hàng, nhóm khách, công nợ.
8. `/customer-cards` - Gói, thẻ đã bán.
9. `/staff/*` - Nhân viên, lịch làm, chấm công, lương, hoa hồng và thiết lập.

## 9. Tiêu chí hoàn thành Dashboard

- Bố cục và mật độ dữ liệu nhận ra ngay từ ảnh tham chiếu nhưng có nhận diện AnnaChill.
- Menu Hàng hóa hoạt động bằng chuột và bàn phím.
- Tab biểu đồ, dropdown thời gian, menu mobile và toast phản hồi hoạt động.
- Không có tràn ngang ở 390px, 768px, 1280px và 1536px.
- Giao diện hiển thị skeleton khi JavaScript hoặc API chậm; không nhúng dữ liệu nghiệp vụ vào HTML.
- Không có lỗi console nghiêm trọng.

## 10. Template UI thống nhất

Mọi màn desktop và mobile dựng từ cùng một bộ primitive trong `frontend/src/styles/ui/` và component React tương ứng. Chi tiết thiết kế ở `docs/superpowers/specs/2026-09-25-unified-ui-template-design.md`; công thức trang mobile ở `docs/mobile-ui-header-template.md`; mẫu sống ở `/ui-kit` và `/ui-kit/mobile` (chỉ bản DEV).

| Nhu cầu | Dùng |
| --- | --- |
| Tiêu đề trang desktop | `PageHeader` (`backTo` hoặc `onBack` cho trang con) |
| Trang danh sách desktop | `.page` → `PageHeader` → `.page-grid` gồm `.filter-panel` và `.data-panel` (`SearchToolbar`, `.data-table`, `.table-footer`) |
| Chi tiết mở dưới một dòng bảng | `InlineDetail` + `DetailHead` + `ValueStrip` + `DetailFacts`, bảng con `.detail-table` |
| Hộp thoại | `Modal` (sm 420 / md 560 / lg 760 / xl 960); dưới 640px tự thành bottom sheet |
| Sheet mobile | `BottomSheet` |
| Header mobile | `MobilePageHeader` + `MobileHeaderAction` |
| Nút | `.btn` + `btn-primary / secondary / soft / ghost / danger / danger-soft / success / link`, cỡ `btn-sm / btn-lg / btn-block / btn-icon`; nút bật/tắt dùng `aria-pressed` |
| Form | `.field` + `.field-label` + `.input` / `.textarea` / `Select` / `MoneyInput` (`.input-suffix`); `.field-row` cho nhãn nằm ngang; `.form-grid`; `.form-section` (thêm `is-card` hoặc `is-collapsible`); `.switch`; `.check` |
| Trạng thái & thông báo | `LoadingState` / `EmptyState` / `ErrorState` (`compact` trên mobile); `.alert` + `alert-danger / warning / success` |
| Nhãn | `.badge` (+ tông), `.status-badge`, `.chip` + `aria-pressed`, `.chip-group` |
| Nhấn màu chữ | `.text-primary / success / danger / warning / violet / muted / faint / strong / right` |

Quy tắc bắt buộc, được kiểm tra tự động trong `src/styles/styles.contract.test.ts`:

- Chỉ `tokens.css` chứa mã màu. TSX không truyền mã hex (trừ màu giao cho thư viện vẽ ngoài CSS: mã QR, Leaflet).
- Inline style chỉ mang giá trị tính lúc chạy (tọa độ, kích thước, phần trăm). Màu, chữ và khoảng cách đi qua class.
- Class chuẩn chỉ được định nghĩa trong `styles/ui/`. CSS của module chỉ chứa bố cục riêng, tên có tiền tố module.
- Mọi file CSS được nạp một lần từ `styles/index.css`; component không tự import CSS.
