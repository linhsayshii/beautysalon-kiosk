# Kế hoạch Triển khai: Đồng nhất Trải nghiệm Toàn bộ Giao diện PWA Mobile (Unified PWA Mobile Experience)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi và chuẩn hóa toàn bộ các trang trong phân hệ Mobile PWA (`/m/*`) sang trải nghiệm Mobile-first thuần túy (Card List + Bottom Sheet + Metric Cards), đồng nhất hoàn toàn về UI, icon Phosphor, màu sắc Semantic Tokens, bo góc và tương tác chạm.

**Architecture:** Xây dựng bộ Primitive Components mobile dùng chung tại `frontend/src/features/mobile-common/` (SearchBar, FilterSheet, MetricCards, Card, DetailSheet, SegmentedControl), sau đó áp dụng để tái cấu trúc các màn hình nghiệp vụ (Khách hàng, Gói thẻ, Hàng hóa, Bảng giá, Nhập hàng, Lịch làm, Chấm công, Bảng lương, Hoa hồng, QR chấm công) và đồng bộ router + TopBar subpage navigation.

**Tech Stack:** React 19, TypeScript, TanStack Query v5, React Router v7, Phosphor Icons, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-17-unified-pwa-mobile-experience-design.md`

## Global Constraints
- Nền tảng: CSS Variables (`var(--canvas)`, `var(--surface)`, `var(--line)`, `var(--blue-600)`, `var(--green)`, `var(--orange)`, `var(--red)`, `var(--violet)`, `var(--sky)`).
- Bo góc: Card `14px`, Bottom Sheet `20px 20px 0 0`, Button `12px`, Badges `999px`.
- Icons: 100% sử dụng Phosphor Icons (`ph ph-*` / `ph-fill ph-*`).
- Vùng chạm cảm ứng: Tối thiểu 40px × 40px cho mọi nút bấm.
- Tất cả các trang `/m/*` đều phải có tiêu đề tiếng Việt chuẩn và điều hướng quay lại (`backTo`) mượt mà trong `MobileTopBar`.

---

## File Structure Map

```
frontend/src/
├── features/
│   ├── mobile-common/
│   │   ├── mobile-common.css           # Cập nhật animation, shadow, tokens
│   │   ├── MobileSearchBar.tsx         # Thanh search bo tròn + nút lọc + badge
│   │   ├── MobileSearchBar.test.tsx
│   │   ├── MobileFilterSheet.tsx       # Bottom sheet bộ lọc đa tiêu chí
│   │   ├── MobileFilterSheet.test.tsx
│   │   ├── MobileMetricCards.tsx       # Dải thẻ tóm tắt KPI 2 cột / scroll
│   │   ├── MobileMetricCards.test.tsx
│   │   ├── MobileCard.tsx              # Thẻ hiển thị dữ liệu chuẩn mobile
│   │   ├── MobileCard.test.tsx
│   │   ├── MobileDetailSheet.tsx       # Bottom sheet xem chi tiết & action
│   │   ├── MobileDetailSheet.test.tsx
│   │   ├── MobileSegmentedControl.tsx  # Thanh chuyển tab cảm ứng mượt mà
│   │   ├── MobileSegmentedControl.test.tsx
│   │   └── MobileEmptyState.tsx        # Trạng thái rỗng mobile
│   ├── mobile-operations/
│   │   ├── mobile-operations.css
│   │   ├── MobileCustomersView.tsx     # Danh sách & chi tiết khách hàng mobile
│   │   ├── MobileCustomersView.test.tsx
│   │   ├── MobileCustomerCardsView.tsx # Gói & thẻ khách hàng đã bán mobile
│   │   └── MobileCustomerCardsView.test.tsx
│   ├── mobile-inventory/
│   │   ├── mobile-inventory.css
│   │   ├── MobileProductsView.tsx      # Danh mục hàng hóa & cảnh báo tồn kho
│   │   ├── MobileProductsView.test.tsx
│   │   ├── MobilePricebooksView.tsx    # Thiết lập bảng giá & nhập giá nhanh
│   │   ├── MobilePricebooksView.test.tsx
│   │   ├── MobilePurchaseOrdersView.tsx # Quản lý phiếu nhập hàng mobile
│   │   └── MobilePurchaseOrdersView.test.tsx
│   └── mobile-staff/
│       ├── mobile-staff.css
│       ├── MobileStaffScheduleAdminView.tsx   # Quản lý lịch tuần chi nhánh
│       ├── MobileStaffAttendanceAdminView.tsx # Bảng chấm công tổng hợp
│       ├── MobileStaffPayrollAdminView.tsx    # Bảng tính lương quản trị
│       ├── MobileStaffCommissionsAdminView.tsx# Bảng hoa hồng thợ
│       └── MobileAttendanceQrAdminView.tsx    # Mã QR chấm công cửa hàng
├── pages/
│   ├── customers/MobileCustomersPage.tsx
│   ├── customer-cards/MobileCustomerCardsPage.tsx
│   ├── products/MobileProductsPage.tsx
│   ├── pricebooks/MobilePricebooksPage.tsx
│   ├── purchase-orders/MobilePurchaseOrdersPage.tsx
│   ├── staff/
│   │   ├── MobileStaffScheduleAdminPage.tsx
│   │   ├── MobileStaffAttendanceAdminPage.tsx
│   │   ├── MobileStaffPayrollAdminPage.tsx
│   │   └── MobileStaffCommissionsAdminPage.tsx
│   └── attendance/MobileAttendanceQrAdminPage.tsx
├── layouts/MobileAppLayout/
│   └── MobileTopBar.tsx                 # Cập nhật SUBPAGE_CONFIG đầy đủ routes
└── app/
    └── router.tsx                       # Cập nhật map routes /m/* tới mobile pages
```

---

## Tasks

### Task 1: Xây dựng Bộ Shared Mobile Primitives (Giai đoạn 1)

**Files:**
- Modify: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/features/mobile-common/mobile-common.css`
- Create: `frontend/src/features/mobile-common/MobileSearchBar.tsx`
- Create: `frontend/src/features/mobile-common/MobileSearchBar.test.tsx`
- Create: `frontend/src/features/mobile-common/MobileFilterSheet.tsx`
- Create: `frontend/src/features/mobile-common/MobileFilterSheet.test.tsx`
- Create: `frontend/src/features/mobile-common/MobileMetricCards.tsx`
- Create: `frontend/src/features/mobile-common/MobileMetricCards.test.tsx`
- Create: `frontend/src/features/mobile-common/MobileCard.tsx`
- Create: `frontend/src/features/mobile-common/MobileCard.test.tsx`
- Create: `frontend/src/features/mobile-common/MobileDetailSheet.tsx`
- Create: `frontend/src/features/mobile-common/MobileDetailSheet.test.tsx`
- Create: `frontend/src/features/mobile-common/MobileSegmentedControl.tsx`
- Create: `frontend/src/features/mobile-common/MobileSegmentedControl.test.tsx`
- Create: `frontend/src/features/mobile-common/MobileEmptyState.tsx`

**Interfaces:**
- Produces:
  - `MobileSearchBar`: `{ value: string; placeholder?: string; onChange: (v: string) => void; onFilterClick?: () => void; activeFilterCount?: number; action?: ReactNode }`
  - `MobileFilterSheet`: `{ isOpen: boolean; title?: string; onClose: () => void; onReset?: () => void; onApply: () => void; children: ReactNode }`
  - `MobileMetricCards`: `{ items: Array<{ label: string; value: string | number; note?: string; tone?: 'blue' | 'green' | 'orange' | 'red' | 'violet' }> }`
  - `MobileCard`: `{ title: string; subtitle?: string; badge?: { text: string; tone?: string }; avatar?: ReactNode; details?: Array<{ label: string; value: string | ReactNode }>; action?: ReactNode; onClick?: () => void }`
  - `MobileDetailSheet`: `{ isOpen: boolean; title: string; subtitle?: string; onClose: () => void; children: ReactNode; footerActions?: ReactNode }`
  - `MobileSegmentedControl`: `<T extends string>({ options: Array<{ value: T; label: string; icon?: string; badge?: number }>; value: T; onChange: (val: T) => void })`

- [ ] **Step 1: Cập nhật CSS variables & animation trong `tokens.css` và `mobile-common.css`**
- [ ] **Step 2: Viết test cho `MobileSearchBar` và cài đặt component**
- [ ] **Step 3: Viết test cho `MobileFilterSheet` và cài đặt component**
- [ ] **Step 4: Viết test cho `MobileMetricCards` và cài đặt component**
- [ ] **Step 5: Viết test cho `MobileCard` và cài đặt component**
- [ ] **Step 6: Viết test cho `MobileDetailSheet` và `MobileSegmentedControl`, cài đặt components**
- [ ] **Step 7: Cài đặt `MobileEmptyState`**
- [ ] **Step 8: Chạy `npm --prefix frontend test` xác nhận toàn bộ test primitives pass**
- [ ] **Step 9: Commit**
```bash
git add frontend/src/features/mobile-common/ frontend/src/styles/
git commit -m "feat(mobile): implement shared mobile primitive components and styles"
```

---

### Task 2: Chuyển đổi Phân hệ Khách hàng & Gói thẻ dịch vụ (Giai đoạn 2)

**Files:**
- Create: `frontend/src/features/mobile-operations/mobile-operations.css`
- Create: `frontend/src/features/mobile-operations/MobileCustomersView.tsx`
- Create: `frontend/src/features/mobile-operations/MobileCustomersView.test.tsx`
- Create: `frontend/src/features/mobile-operations/MobileCustomerCardsView.tsx`
- Create: `frontend/src/features/mobile-operations/MobileCustomerCardsView.test.tsx`
- Create: `frontend/src/pages/customers/MobileCustomersPage.tsx`
- Create: `frontend/src/pages/customer-cards/MobileCustomerCardsPage.tsx`
- Modify: `frontend/src/styles/index.css` (import mobile-operations.css)

**Interfaces:**
- Consumes: `getCustomers`, `getCustomerCards` from `@/features/operations/operations.api`, Primitives from `@/features/mobile-common`
- Produces: `MobileCustomersView`, `MobileCustomerCardsView`

- [ ] **Step 1: Viết test cho `MobileCustomersView` (hiển thị metric cards, search, filter sheet, danh sách card và sheet chi tiết)**
- [ ] **Step 2: Cài đặt `MobileCustomersView.tsx`**
- [ ] **Step 3: Viết test cho `MobileCustomerCardsView` (hiển thị tiến trình lượt dùng/số dư thẻ, badge trạng thái, sheet chi tiết gói)**
- [ ] **Step 4: Cài đặt `MobileCustomerCardsView.tsx`**
- [ ] **Step 5: Tạo các page wrappers `MobileCustomersPage.tsx` và `MobileCustomerCardsPage.tsx`**
- [ ] **Step 6: Chạy test kiểm tra phân hệ operations mobile**
- [ ] **Step 7: Commit**
```bash
git add frontend/src/features/mobile-operations/ frontend/src/pages/customers/ frontend/src/pages/customer-cards/ frontend/src/styles/index.css
git commit -m "feat(mobile): implement mobile views for customers and customer cards"
```

---

### Task 3: Chuyển đổi Phân hệ Hàng hóa, Bảng giá & Nhập hàng (Giai đoạn 3)

**Files:**
- Create: `frontend/src/features/mobile-inventory/mobile-inventory.css`
- Create: `frontend/src/features/mobile-inventory/MobileProductsView.tsx`
- Create: `frontend/src/features/mobile-inventory/MobileProductsView.test.tsx`
- Create: `frontend/src/features/mobile-inventory/MobilePricebooksView.tsx`
- Create: `frontend/src/features/mobile-inventory/MobilePricebooksView.test.tsx`
- Create: `frontend/src/features/mobile-inventory/MobilePurchaseOrdersView.tsx`
- Create: `frontend/src/features/mobile-inventory/MobilePurchaseOrdersView.test.tsx`
- Create: `frontend/src/pages/products/MobileProductsPage.tsx`
- Create: `frontend/src/pages/pricebooks/MobilePricebooksPage.tsx`
- Create: `frontend/src/pages/purchase-orders/MobilePurchaseOrdersPage.tsx`
- Modify: `frontend/src/styles/index.css` (import mobile-inventory.css)

**Interfaces:**
- Consumes: `getProducts`, `getPricebooks`, `updatePrice`, `getPurchaseOrders` from `@/features/inventory/inventory.api`
- Produces: `MobileProductsView`, `MobilePricebooksView`, `MobilePurchaseOrdersView`

- [ ] **Step 1: Viết test và cài đặt `MobileProductsView.tsx` (danh sách thẻ sản phẩm/dịch vụ, badge cảnh báo dưới định mức tồn kho, lọc theo nhóm hàng)**
- [ ] **Step 2: Viết test và cài đặt `MobilePricebooksView.tsx` (chọn bảng giá, ô nhập giá nhanh MoneyInput trên mobile, so sánh giá vốn)**
- [ ] **Step 3: Viết test và cài đặt `MobilePurchaseOrdersView.tsx` (danh sách phiếu nhập hàng, tổng tiền nợ NCC, trạng thái thanh toán)**
- [ ] **Step 4: Tạo các page wrappers trong `frontend/src/pages/`**
- [ ] **Step 5: Chạy test xác nhận phân hệ inventory mobile**
- [ ] **Step 6: Commit**
```bash
git add frontend/src/features/mobile-inventory/ frontend/src/pages/products/ frontend/src/pages/pricebooks/ frontend/src/pages/purchase-orders/ frontend/src/styles/index.css
git commit -m "feat(mobile): implement mobile views for products, pricebooks and purchase orders"
```

---

### Task 4: Chuyển đổi Phân hệ Quản trị Nhân sự, Ca làm & Bảng lương hoa hồng (Giai đoạn 4)

**Files:**
- Modify: `frontend/src/features/mobile-staff/mobile-staff.css`
- Create: `frontend/src/features/mobile-staff/MobileStaffScheduleAdminView.tsx`
- Create: `frontend/src/features/mobile-staff/MobileStaffScheduleAdminView.test.tsx`
- Create: `frontend/src/features/mobile-staff/MobileStaffAttendanceAdminView.tsx`
- Create: `frontend/src/features/mobile-staff/MobileStaffAttendanceAdminView.test.tsx`
- Create: `frontend/src/features/mobile-staff/MobileStaffPayrollAdminView.tsx`
- Create: `frontend/src/features/mobile-staff/MobileStaffPayrollAdminView.test.tsx`
- Create: `frontend/src/features/mobile-staff/MobileStaffCommissionsAdminView.tsx`
- Create: `frontend/src/features/mobile-staff/MobileStaffCommissionsAdminView.test.tsx`
- Create: `frontend/src/features/mobile-staff/MobileAttendanceQrAdminView.tsx`
- Create: `frontend/src/pages/staff/MobileStaffScheduleAdminPage.tsx`
- Create: `frontend/src/pages/staff/MobileStaffAttendanceAdminPage.tsx`
- Create: `frontend/src/pages/staff/MobileStaffPayrollAdminPage.tsx`
- Create: `frontend/src/pages/staff/MobileStaffCommissionsAdminPage.tsx`
- Create: `frontend/src/pages/attendance/MobileAttendanceQrAdminPage.tsx`

**Interfaces:**
- Consumes: `getStaff`, `getSchedule`, `getAttendance`, `getPayrollList`, `getCommissions` from `@/features/staff/staff.api`
- Produces: `MobileStaffScheduleAdminView`, `MobileStaffAttendanceAdminView`, `MobileStaffPayrollAdminView`, `MobileStaffCommissionsAdminView`, `MobileAttendanceQrAdminView`

- [ ] **Step 1: Viết test và cài đặt `MobileStaffScheduleAdminView.tsx` (lịch tuần vuốt ngang, phân ca nhanh theo thợ hoặc theo ca)**
- [ ] **Step 2: Viết test và cài đặt `MobileStaffAttendanceAdminView.tsx` (bảng công tổng hợp tuần/tháng, xem giờ check-in GPS & duyệt công)**
- [ ] **Step 3: Viết test và cài đặt `MobileStaffPayrollAdminView.tsx` (kỳ tính lương, danh sách thực lĩnh từng thợ, sheet chi tiết phiếu lương)**
- [ ] **Step 4: Viết test và cài đặt `MobileStaffCommissionsAdminView.tsx` (SegmentedControl 2 tab: theo thợ & chi tiết giao dịch)**
- [ ] **Step 5: Cài đặt `MobileAttendanceQrAdminView.tsx` (mã QR chấm công cỡ lớn kèm nút chia sẻ/tải ảnh)**
- [ ] **Step 6: Tạo các page wrappers tương ứng**
- [ ] **Step 7: Chạy test xác nhận phân hệ quản trị staff mobile**
- [ ] **Step 8: Commit**
```bash
git add frontend/src/features/mobile-staff/ frontend/src/pages/staff/ frontend/src/pages/attendance/
git commit -m "feat(mobile): implement admin mobile views for staff schedule, attendance, payroll and commissions"
```

---

### Task 5: Đồng bộ Navigation TopBar, Router & Kiểm thử Hoàn thiện (Giai đoạn 5)

**Files:**
- Modify: `frontend/src/layouts/MobileAppLayout/MobileTopBar.tsx`
- Modify: `frontend/src/layouts/MobileAppLayout/MobileTopBar.test.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/app/router.test.tsx`

**Interfaces:**
- Consumes: All Mobile Pages
- Produces: Full Mobile Routing & Dynamic Subpage Header

- [ ] **Step 1: Cập nhật `SUBPAGE_CONFIG` trong `MobileTopBar.tsx` cho tất cả các đường dẫn `/m/*` mới**
- [ ] **Step 2: Cập nhật `router.tsx` để định tuyến tất cả subroutes `/m/*` tới các Mobile Pages chuyên biệt**
- [ ] **Step 3: Cập nhật và chạy `MobileTopBar.test.tsx` & `router.test.tsx`**
- [ ] **Step 4: Chạy toàn bộ test suite `npm --prefix frontend test` và `npm --prefix frontend run typecheck`**
- [ ] **Step 5: Commit**
```bash
git add frontend/src/layouts/MobileAppLayout/ frontend/src/app/
git commit -m "feat(routing): integrate all mobile pages into router and synchronize topbar navigation"
```

---

## Plan Self-Review
1. **Spec Coverage**: 100% các trang trong spec (Customers, Customer-cards, Products, Pricebooks, Purchase-orders, Staff schedule/attendance/payroll/commissions, QR code) đều có Task cụ thể và chi tiết component.
2. **No Placeholders**: Tất cả các file, path và interface đều rõ ràng, không có TODO hay TBD.
3. **Type Consistency**: Sử dụng thống nhất các kiểu dữ liệu từ `@/types/api`, TanStack Query Hooks và React components.
