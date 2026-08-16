# Design Spec: Mobile PWA 5-Tab Navigation & "Nhiều hơn" (More) Hub with Full Sub-page Responsive PWA Support

## 1. Overview & Goals
- **Objective:** Upgrade the mobile navigation experience for Anna Chill Beauty salon app to follow modern mobile app standards.
- **Bottom Navigation Structure:**
  - Manager: 5 tabs: **Tổng quan** (`/m/dashboard`), **Lịch dịch vụ** (`/m/appointments`), **Thêm mới** (Center Lotus Action Button), **Thông báo** (`/m/notifications`), **Nhiều hơn** (`/m/more`).
  - Cashier: 5 tabs: **Bán hàng** (`/m/pos`), **Đơn hàng** (`/m/orders`), **Thêm mới**, **Khách hàng** (`/m/customers`), **Tài khoản** (`/m/account`).
  - Staff: 5 tabs: **Chấm công** (`/m/attendance`), **Lịch làm** (`/m/schedule`), **Thêm mới**, **Lương** (`/m/salary`), **Tài khoản** (`/m/account`).
- **"Nhiều hơn" (More) Hub:**
  - Dedicated page (`/m/more`) for Managers containing categorized, 2-column bento grid cards matching the design screenshot.
  - Quick access to profile, switch branch modal, store settings, desktop mode switch, logout.
  - Complete grouped links to all system modules:
    - **Đơn hàng & Thu ngân:** Hóa đơn bán lẻ (`/m/orders`), Bán hàng POS (`/m/pos`), Hóa đơn điện tử / Trả hàng.
    - **Hàng hóa & Kho:** Hàng hóa (`/m/products`), Bảng giá (`/m/pricebooks`), Nhập hàng (`/m/purchase-orders`).
    - **Khách hàng:** Danh sách khách hàng (`/m/customers`), Gói & thẻ đã bán (`/m/customer-cards`).
    - **Nhân sự & Lương thưởng:** Quản lý nhân viên (`/m/staff`), Lịch làm việc (`/m/staff/schedule`), Bảng chấm công (`/m/staff/attendance`), Bảng lương (`/m/staff/payroll`), Bảng hoa hồng (`/m/staff/commissions`).
    - **Báo cáo & Sổ quỹ:** Báo cáo tổng quan, Sổ quỹ thu chi, Phân tích doanh thu.
    - **Cài đặt & Tiện ích:** Quét mã chấm công (`/m/attendance`), Tạo mã QR chấm công (`/m/attendance/qr`), Giao diện máy tính, Đăng xuất.
- **Sub-pages Mobile PWA Optimization:**
  - All sub-pages linked from `/m/...` will render within `MobileAppLayout` with full mobile responsive touch-friendly UI (card-based layout, horizontal overflow scrolling with smooth inertia, touch targets >= 44px, sticky action buttons).
  - Routes registered in `router.tsx` and protected in `authorization.ts`.

---

## 2. Architecture & Components

### 2.1 Navigation & Layout
- `MobileBottomNav.tsx`:
  - Support Manager 5-tab bar with active indicator styling, badge counts (optional for notifications), and center Lotus floating button.
  - Center button retains `MobileQuickActionSheet` for fast invoice/appointment/customer creation.
- `MobileTopBar.tsx`:
  - Dynamic page title and contextual back button when navigating deep into sub-pages (e.g. from `/m/more` into `/m/products` or `/m/purchase-orders/new`).

### 2.2 Feature Pages & Views
- `frontend/src/features/mobile-more/`:
  - `MobileMoreView.tsx`: User profile card, branch switcher sheet, category sections with custom colored icon badges, 2-column grid cards.
  - `mobile-more.css`: High-fidelity styling matching the reference screenshot with soft rounded borders, crisp icons, subtle shadows.
- `frontend/src/pages/more/MobileMorePage.tsx`: Lazy route wrapper.
- `frontend/src/pages/notifications/MobileNotificationsPage.tsx` + `MobileNotificationsView.tsx`: Notification list (appointments, shifts, reminders).
- `frontend/src/pages/appointments/MobileAppointmentsListPage.tsx`: Calendar/list view of service bookings.
- **Sub-page Mobile Adaptation:**
  - Ensure `/m/products`, `/m/pricebooks`, `/m/purchase-orders`, `/m/customer-cards`, `/m/staff/schedule`, `/m/staff/attendance`, `/m/staff/payroll`, `/m/staff/commissions`, `/m/attendance/qr` render seamlessly inside the mobile shell with responsive table/card conversions.

---

## 3. Data & State Flow
- Authentication & Authorization:
  - Role check (`canAccessPath`) updated in `authorization.ts` for all new `/m/...` routes.
  - Branch switching reacts seamlessly via `useAuth().switchBranch(branchId)` with cache invalidation across React Query.
- Responsive Behavior:
  - Sub-pages detect mobile mode or adapt automatically via CSS media queries / mobile wrappers.

---

## 4. Test & Verification Plan
- Unit tests for `MobileBottomNav`, `MobileMoreView`, routing and authorization rules.
- Visual & functional verification on simulated mobile viewport (375x812 iPhone / PWA resolution).
