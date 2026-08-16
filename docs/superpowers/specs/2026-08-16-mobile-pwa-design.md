# Đặc Tả Thiết Kế Hệ Thống Mobile PWA - AnnaChill Beauty

- **Ngày tạo:** 2026-08-16
- **Trạng thái:** Bản thảo đề xuất (Draft)
- **Tác giả:** Claude Code Assistant & linhsayshii

---

## 1. Tổng Quan Mục Tiêu & Yêu Cầu

### 1.1. Mục Tiêu
Phát triển phiên bản **Mobile Progressive Web App (PWA)** tách biệt hoàn toàn về mặt trải nghiệm giao diện người dùng (Touch-first UI/UX, tối ưu thao tác một tay trên điện thoại), đồng thời tái sử dụng và chia sẻ 100% tầng dữ liệu, xác thực phiên đăng nhập (Session Auth), bộ nhớ đệm (TanStack Query Cache) và các dịch vụ API hiện có của hệ thống AnnaChill Beauty.

### 1.2. Các Yêu Cầu Cốt Lõi
1. **Phân tách không gian định tuyến:** Không gian di động nằm dưới tiền tố `/m/*` (ví dụ: `/m/dashboard`, `/m/pos`, `/m/orders`, `/m/attendance`, `/m/staff`, `/m/account`).
2. **PWA Standalone & Dynamic Store Name:**
   - Ứng dụng hỗ trợ cài đặt về màn hình chính (Add to Home Screen) trên cả iOS và Android.
   - Tên ứng dụng (`name`) và tên hiển thị ngắn (`short_name`) được đồng bộ động theo biến môi trường `STORE_NAME` trong `.env` (thông qua endpoint API `/api/v1/meta`).
   - Hỗ trợ đầy đủ Web App Manifest, Service Worker caching cho static assets, và Safe-Area Inset (Notch / Home Bar).
3. **Phục vụ đầy đủ 3 vai trò người dùng:**
   - **Quản lý (Manager):** Xem báo cáo dashboard, duyệt đơn hàng, quản lý chấm công & ca làm việc, cài đặt chi nhánh.
   - **Thu ngân (Cashier):** POS bán hàng di động tinh gọn, tra cứu khách hàng, xuất hóa đơn, tạo mã VietQR thanh toán.
   - **Nhân viên (Staff):** Quét QR chấm công với GPS, xem lịch làm việc cá nhân, tra cứu bảng lương và hoa hồng.
4. **Mobile POS Touch-Friendly (Theo mẫu thiết kế thực tế):**
   - Header tìm kiếm hàng hóa, tab phân loại ngang (*Tất cả, Dịch vụ, Gói DV, Thẻ TK, Sản phẩm*), dropdown lọc nhóm hàng.
   - Danh sách món dạng List thẻ nhóm (Grouped Card List) với icon nhận diện, tên, thời lượng/mô tả và giá bán rõ nét.
   - Giỏ hàng & Thanh toán dạng Bottom Sheet trượt mượt mà.
5. **Nghiên cứu & Tích hợp Real-time WebSocket cho POS:**
   - Đồng bộ tức thời trạng thái hóa đơn, giỏ hàng và lịch hẹn giữa các thiết bị di động và máy tính tại cùng chi nhánh.

---

## 2. Kiến Trúc Kỹ Thuật

### 2.1. Cấu Trúc Định Tuyến (Routing Architecture)
```
/                           -> AdminLayout (Desktop UI)
  ├── /dashboard
  ├── /pos
  ├── /orders
  ├── /customers
  ├── /products
  ├── /staff
  └── ...

/m                          -> MobileAppLayout (Mobile PWA UI)
  ├── /m/dashboard          -> MobileDashboardView (Manager)
  ├── /m/pos                -> MobilePosView (Manager, Cashier)
  ├── /m/orders             -> MobileOrdersView (Manager, Cashier)
  ├── /m/customers          -> MobileCustomersView (Manager, Cashier)
  ├── /m/attendance         -> MobileAttendanceScanView (All Roles)
  ├── /m/schedule           -> MobileStaffScheduleView (Staff, Manager)
  ├── /m/salary             -> MobileStaffSalaryView (Staff, Manager)
  ├── /m/staff              -> MobileStaffManagementView (Manager)
  └── /m/account            -> MobileAccountView (All Roles)
```

- **Tự động điều hướng thiết bị (Auto Device Detection):**
  - Người dùng truy cập bằng thiết bị di động (màn hình `< 768px` hoặc `window.matchMedia('(display-mode: standalone)').matches`) sẽ tự động được gợi ý/chuyển hướng sang `/m/*`.
  - Trong phần Cài đặt / Footer, luôn có nút bấm cho phép chuyển đổi qua lại giữa *"Giao diện di động"* và *"Giao diện máy tính"*, lưu trạng thái ưu tiên vào `localStorage.setItem('annachill-ui-mode', 'mobile' | 'desktop')`.

### 2.2. Kiến Trúc PWA & Dynamic WebManifest
- **Backend Endpoint `/manifest.json` (hoặc Dynamic Manifest Link trong Frontend):**
  - Trả về JSON manifest với:
    ```json
    {
      "name": "STORE_NAME từ .env",
      "short_name": "STORE_NAME từ .env",
      "start_url": "/m/dashboard",
      "display": "standalone",
      "background_color": "#f4f6f9",
      "theme_color": "#0062eb",
      "orientation": "portrait",
      "icons": [
        { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
        { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
        { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
      ]
    }
    ```
- **Service Worker (`sw.js`):**
  - Cache First cho Fonts, Icons, Stylesheets, JS Chunks.
  - Network First cho API endpoints (`/api/v1/*`).
  - Cache versioning và skipWaiting khi có bản build mới.

### 2.3. Kiến Trúc WebSocket cho POS & Vận Hành Real-time
- **Tầng Backend (`ws` module):**
  - Tích hợp WebSocket Server trực tiếp vào `httpServer` trong `backend/src/server.js`.
  - Xác thực kết nối WebSocket qua Cookie Session hiện tại (`sid`).
  - Phân vùng Room theo `branchId` (ví dụ room `branch:1`, `branch:2`).
  - Broadcast các sự kiện khi có thay đổi dữ liệu:
    - `pos:order_created` -> Kèm tóm tắt đơn và thông tin thanh toán.
    - `pos:appointment_updated` -> Kèm thông tin cập nhật slot làm việc.
    - `pos:cart_sync` -> Cho phép chia sẻ giỏ hàng tạm giữa các máy.
- **Tầng Frontend (`usePosSocket` hook):**
  - Tự động duy trì kết nối WebSocket, tự động reconnect với exponential backoff.
  - Khi nhận sự kiện, tự động invalidate các query tương ứng của TanStack Query:
    - `queryClient.invalidateQueries({ queryKey: ['orders'] })`
    - `queryClient.invalidateQueries({ queryKey: ['pos-appointments'] })`
    - `queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })`
  - Hiển thị Toast thông báo nhẹ góc màn hình khi có hóa đơn mới được chốt tại quầy.

---

## 3. Thiết Kế Chi Tiết Giao Diện Mobile PWA

### 3.1. Mobile Shell Layout (`MobileAppLayout.tsx`)
- **Top Bar (Cao 50px, Safe Area Top):**
  - Logo và Store Name đồng bộ theo metadata.
  - Tên chi nhánh hiện tại kèm icon mũi tên chuyển đổi chi nhánh nhanh.
  - Trạng thái kết nối Socket (chấm xanh Online).
  - Avatar tài khoản.
- **Vùng nội dung chính (`<Outlet />`):**
  - Độn đáy bằng chiều cao của Bottom Bar + Safe Area Bottom (`padding-bottom: calc(64px + env(safe-area-inset-bottom))`).
  - Cuộn dọc mượt mà (`-webkit-overflow-scrolling: touch`).
- **Bottom Navigation Bar (Cố định ở đáy, Safe Area Bottom):**
  - Chiều cao 60px, nền trắng đổ bóng mờ, biểu tượng Phosphor Icon kèm nhãn chữ 10px.
  - Tự động hiển thị đúng bộ Tab theo vai trò:
    - **Quản lý:** `[Tổng quan] [Thu ngân POS] [Đơn hàng] [Nhân viên] [Tài khoản]`
    - **Thu ngân:** `[Thu ngân POS] [Đơn hàng] [Khách hàng] [Tài khoản]`
    - **Nhân viên:** `[Chấm công] [Lịch làm] [Lương & Thưởng] [Tài khoản]`

### 3.2. Màn Hình Mobile POS (`MobilePosView.tsx`) - Chuẩn Mẫu Thực Tế
- **Header:**
  - Nút đóng/clear `ph-x`.
  - Ô input tìm kiếm hàng hóa `"Tìm hàng hóa"` dạng pill bo tròn.
  - Nút sắp xếp `ph-arrows-down-up` và nút tùy chọn hiển thị `ph-list-checks`.
- **Thanh phân loại (Horizontal Category Tabs):**
  - Cuộn ngang: `Tất cả` | `Dịch vụ` | `Gói DV` | `Thẻ TK` | `Sản phẩm`.
  - Tab đang chọn có viền gạch chân xanh dương đậm (`var(--blue-600)`).
- **Dropdown Nhóm hàng phụ:**
  - Nút pill *"Tất cả nhóm hàng ▼"* để lọc nhanh theo danh mục con.
- **Danh sách hàng hóa (Grouped Item List):**
  - Tiêu đề nhóm chữ xám nhỏ (vd: `gói dịch vụ`, `dầu gội`...).
  - Thẻ sản phẩm nền trắng, bo góc 12px, margin-bottom 8px:
    - **Icon phân loại bên trái (40x40px, nền xanh nhạt `#e8f1fc`):**
      - Dịch vụ / Gói: `ph-user` hoặc `ph-sparkle`
      - Thẻ tài khoản: `ph-credit-card`
      - Sản phẩm: `ph-package`
    - **Cột thông tin ở giữa:**
      - Tên hàng hóa: font 14px, đậm, màu `#0f172a`.
      - Dòng phụ: `Thời lượng: 1h30'`, `Mệnh giá: 12,000,000`, `Gói dịch vụ, liệu trình` (font 12px, màu `#64748b`).
    - **Cột giá bên phải:**
      - Giá bán định dạng tiền tệ Việt Nam (vd: `2,500,000`, `30,000`), font 15px, in đậm.
- **Thanh Giỏ Hàng Nổi (Bottom Cart Bar):**
  - Khi có ít nhất 1 món trong giỏ: xuất hiện thanh nổi màu xanh `var(--blue-600)` phía trên Bottom Bar.
  - Hiển thị: Số lượng món + Tổng tiền tạm tính + Nút *"Xem giỏ & Thanh toán"*.
- **Giỏ Hàng & Thanh Toán (Bottom Sheet Modal):**
  - Kéo vuốt trượt từ dưới lên (Spring Animation / CSS Transition).
  - Chọn khách hàng (Tìm kiếm nhanh hoặc thêm khách mới).
  - Chọn nhân viên kỹ thuật thực hiện dịch vụ để tính hoa hồng.
  - Tùy chọn chiết khấu / giảm giá.
  - Chọn phương thức thanh toán: Tiền mặt, VietQR (hiển thị mã QR thanh toán chuẩn VietQR), Chuyển khoản, Thẻ.
  - Nút bấm lớn *"Xác nhận & Hoàn tất đơn hàng"*.

### 3.3. Màn Hình Chấm Công Mobile (`MobileAttendanceScanView.tsx`)
- Tối ưu camera quét mã QR toàn màn hình điện thoại với khung vuông bắt góc chuẩn nét.
- Nút bật/tắt đèn pin flash (nếu thiết bị hỗ trợ).
- Xác thực vị trí GPS tự động theo bán kính cho phép của chi nhánh.
- Timeline hiển thị giờ vào ca và giờ ra ca trong ngày.

### 3.4. Màn Hình Báo Cáo Dashboard Mobile (`MobileDashboardView.tsx`)
- Thẻ doanh thu ngày/tháng/năm, số lượng đơn hoàn tất, khách hàng mới.
- Biểu đồ đường & cột tối ưu cảm ứng (kéo vuốt xem tooltip).
- Danh sách top dịch vụ và bảng xếp hạng nhân viên xuất sắc.

### 3.5. Màn Hình Quản Lý Đơn Hàng Mobile (`MobileOrdersView.tsx`)
- Danh sách đơn hàng dạng Card (Mã đơn, tên khách, tổng tiền, phương thức, trạng thái).
- Bấm vào đơn mở Bottom Sheet xem chi tiết từng món và thông tin thanh toán.

---

## 4. Kế Hoạch Kiểm Thử & Đảm Bảo Chất Lượng (Quality Assurance)
1. **Kiểm tra tương thích thiết bị & Responsive:**
   - Safari iOS (iPhone SE, iPhone 13/14/15/16 Pro Max với Dynamic Island & Home Bar).
   - Chrome Android (Samsung Galaxy, Pixel).
2. **Kiểm tra PWA Manifest & Service Worker:**
   - Kiểm tra dynamic title/short_name cập nhật đúng theo `STORE_NAME` trong `.env`.
   - Kiểm tra khả năng hoạt động offline / mất mạng đột ngột.
3. **Kiểm tra Real-time WebSocket:**
   - Mở đồng thời 1 trình duyệt Desktop và 1 điện thoại di động: tạo đơn ở điện thoại -> Desktop cập nhật tức thời; chốt bill ở Desktop -> điện thoại nhận thông báo.
4. **Kiểm thử tự động:**
   - Viết Unit/Integration Test cho Mobile POS Layout, WebSocket hook, Cart state reducer, và Service Worker registration.
   - Đảm bảo toàn bộ 50+ test cases hiện tại của dự án vẫn Pass 100%.

---

## 5. Danh Sách Các File Sẽ Triển Khai / Chỉnh Sửa

### Backend:
- `backend/src/server.js`: Khởi tạo WebSocket Server gắn cùng HTTP Server, quản lý kết nối và broadcast event theo branch.
- `backend/src/modules/pos/pos.service.js` & `backend/src/modules/orders/orders.service.js`: Gửi thông báo WebSocket event khi tạo hóa đơn / đơn hàng mới.
- `backend/src/app.js`: Cung cấp route manifest dynamic hoặc header dynamic cho store name.

### Frontend:
- `frontend/public/manifest.webmanifest`: Cấu hình PWA manifest.
- `frontend/public/sw.js`: Service worker xử lý cache.
- `frontend/src/pwa/`: Đăng ký service worker, tiện ích nhận diện thiết bị.
- `frontend/src/services/websocket.ts`: WebSocket client quản lý kết nối real-time.
- `frontend/src/layouts/MobileAppLayout/`: Layout chuẩn mobile với TopBar và Bottom Navigation Bar.
- `frontend/src/features/mobile-pos/`: Giao diện POS di động theo đúng mẫu thiết kế thực tế.
- `frontend/src/features/mobile-dashboard/`: Giao diện Dashboard tối ưu mobile.
- `frontend/src/features/mobile-orders/`: Danh sách và chi tiết đơn hàng mobile.
- `frontend/src/features/mobile-staff/`: Lịch làm việc, bảng lương và chấm công mobile.
- `frontend/src/app/router.tsx`: Bổ sung nhánh route `/m/*` cho giao diện di động.
- `frontend/src/styles/mobile.css`: Bộ stylesheet chuyên biệt cho Mobile PWA (tokens, bottom bar, bottom sheet, touch cards).
