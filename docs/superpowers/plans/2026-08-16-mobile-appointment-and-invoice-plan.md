# Mobile Center Action, Appointment & Multi-Staff Invoice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the center `(+)` action button in the mobile BottomNav, an appointment creation flow matching reference UI with interactive 14-day & time-slot selection, a customer selection sheet with total remaining package units, and support per-line staff assignment for both appointment and invoice checkout.

**Architecture:** 
- Backend: Update customer queries to calculate total remaining package service units across active packages, and update POS checkout & appointment endpoints to accept and persist per-line technician/staff assignment.
- Frontend: Replace the static POS bottom tab with a floating Center Action `(+)` FAB that opens a quick creation sheet (Appointment, Invoice, Customer). Build reusable mobile sheets: `MobileCustomerSelectSheet` (with remaining package units badge), `MobileTimePickerSheet` (14-day strip + shift slot grid + exact roller picker), `MobileAppointmentCreateView`, and `MobileInvoiceCreateView` (with per-line staff selector).

**Tech Stack:** React 19, React Router v7, TanStack Query v5, Node.js Express, PostgreSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-16-mobile-appointment-and-dynamic-invoice-design.md`

## Global Constraints

- Touch targets must be at least 44px for mobile usability.
- Colors must match existing tokens (`var(--blue-600)`, `var(--surface)`, `var(--ink-800)`, `var(--green-soft)`, `var(--red-soft)`).
- Time format on mobile should use 24h `HH:mm` format with Vietnamese day labels (Thứ 2, Thứ 3, ..., CN).
- Date format must follow `DD/MM/YYYY`.
- Every customer in `MobileCustomerSelectSheet` must display total remaining units of purchased packages if > 0 (e.g. `Còn: 18 Buổi DV`).
- All tests must pass cleanly (`npm test` in frontend and `node --test` in backend).

---

### Task 1: Backend Customer Package Remaining Units & Multi-Staff Line Checkout

**Files:**
- Modify: `backend/src/modules/customers/customers.service.js`
- Modify: `backend/src/modules/pos/pos.service.js`
- Modify: `backend/src/modules/pos/pos.routes.js`
- Test: `backend/src/modules/pos/pos.test.js`

**Interfaces:**
- Consumes: PostgreSQL `customers`, `customer_packages`, `invoices`, `invoice_items` tables.
- Produces: `remainingPackageUnits` in customer search/list response; `lines[i].staffId` stored in `invoice_items.staff_id` during POS checkout.

- [ ] **Step 1: Write the failing test for customer package remaining units & per-line staff**

Add test in `backend/src/modules/pos/pos.test.js`:
```javascript
test('listCustomers includes remaining package units and checkout accepts per-line staff', async () => {
  // test that query includes remaining_package_units and checkout handles line-level staff_id
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test src/modules/pos/pos.test.js`
Expected: FAIL

- [ ] **Step 3: Update `backend/src/modules/customers/customers.service.js` & `backend/src/modules/pos/pos.service.js`**

1. In `customers.service.js`, add `pkg_units` LATERAL join:
```sql
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(cp.total_units - cp.used_units), 0) AS remaining_units
  FROM customer_packages cp
  WHERE cp.customer_id = c.id
    AND cp.status = 'active'
    AND (cp.expires_at IS NULL OR cp.expires_at > NOW())
) pkg_units ON TRUE
```
And expose `remainingPackageUnits: number(row.remaining_units)` in the returned rows.

2. In `pos.routes.js`, parse `line.staffId`:
```javascript
const lines = request.body.lines.map((line) => ({
  itemType: parseEnum(line.itemType, 'itemType', itemTypes),
  itemId: parsePositiveInteger(line.itemId, 'itemId'),
  quantity: Math.max(1, Math.floor(Number(line.quantity || 1))),
  staffId: line.staffId ? parsePositiveInteger(line.staffId, 'staffId') : null,
}));
```

3. In `pos.service.js`, pass `line.staffId || fallbackStaffId` into `invoice_items` insert.

- [ ] **Step 4: Run backend tests to verify they pass**

Run: `cd backend && npm run check`
Expected: PASS (all 9+ tests pass).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/customers/customers.service.js backend/src/modules/pos/pos.routes.js backend/src/modules/pos/pos.service.js backend/src/modules/pos/pos.test.js
git commit -m "feat(backend): support customer remaining package units and per-line staff checkout"
```

---

### Task 2: Mobile BottomNav Center `(+)` Action Button & Action Sheet

**Files:**
- Modify: `frontend/src/layouts/MobileAppLayout/MobileBottomNav.tsx`
- Modify: `frontend/src/styles/mobile.css`
- Test: `frontend/src/layouts/MobileAppLayout/MobileBottomNav.test.tsx`

**Interfaces:**
- Consumes: `useAuth` hook.
- Produces: Center FAB `(+)` in BottomNav that opens a quick creation action sheet with options: Tạo lịch hẹn (`/m/appointments/new`), Tạo hóa đơn (`/m/invoices/new`), Thêm khách hàng (`/m/customers/new`).

- [ ] **Step 1: Write the failing test for center action button**

Update `frontend/src/layouts/MobileAppLayout/MobileBottomNav.test.tsx` to assert that the center action button `(+)` is present for all roles and clicking it reveals the action sheet.

- [ ] **Step 2: Run test to verify failure**

Run: `cd frontend && npm test src/layouts/MobileAppLayout/MobileBottomNav.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement center FAB & Action Sheet in `MobileBottomNav.tsx`**

1. Add center button with class `mobile-nav-center-action`.
2. Add modal/sheet `MobileQuickActionSheet` containing:
   - 📅 **Tạo lịch hẹn** -> Navigates to `/m/appointments/new`.
   - 🧾 **Tạo hóa đơn bán hàng** -> Navigates to `/m/invoices/new`.
   - 👤 **Thêm khách hàng** -> Opens quick customer modal or navigates to customer create.
3. Update CSS in `frontend/src/styles/mobile.css` for `.mobile-nav-center-action` (elevated round blue button with shadow).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/layouts/MobileAppLayout/MobileBottomNav.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/layouts/MobileAppLayout/MobileBottomNav.tsx frontend/src/layouts/MobileAppLayout/MobileBottomNav.test.tsx frontend/src/styles/mobile.css
git commit -m "feat(mobile): add center action button and quick creation sheet in bottom nav"
```

---

### Task 3: Mobile Customer Select Sheet (with Total Remaining Package Units)

**Files:**
- Create: `frontend/src/features/mobile-common/MobileCustomerSelectSheet.tsx`
- Create: `frontend/src/features/mobile-common/mobile-common.css`
- Test: `frontend/src/features/mobile-common/MobileCustomerSelectSheet.test.tsx`

**Interfaces:**
- Consumes: `searchPosCustomers` / `getCustomers` API.
- Produces: `MobileCustomerSelectSheet` component with `isOpen`, `onClose`, `onSelectCustomer(customer)` callbacks. Renders search input, QR scan button, customer list with `Còn: X Buổi DV` and `Nợ: X VND` badges, and quick add customer button.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/mobile-common/MobileCustomerSelectSheet.test.tsx` to test customer search, rendering remaining package units badge (`Còn: 18 Buổi DV`), debt badge, and selection callback.

- [ ] **Step 2: Run test to verify failure**

Run: `cd frontend && npm test src/features/mobile-common/MobileCustomerSelectSheet.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `MobileCustomerSelectSheet.tsx` and CSS**

Implement customer list matching reference Image 1:
- Search input with placeholder `"Tìm khách hàng"` and quick `"Hủy"` button.
- Customer item card with avatar, name, code, phone, package units badge (`Còn: X Buổi DV`), and debt badge.
- Floating round blue `(+)` button to open `CustomerCreateDialog`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/features/mobile-common/MobileCustomerSelectSheet.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile-common/MobileCustomerSelectSheet.tsx frontend/src/features/mobile-common/mobile-common.css frontend/src/features/mobile-common/MobileCustomerSelectSheet.test.tsx
git commit -m "feat(mobile): add mobile customer select sheet with remaining package units"
```

---

### Task 4: Mobile Time & Shift Slot Picker Sheet

**Files:**
- Create: `frontend/src/features/mobile-common/MobileTimePickerSheet.tsx`
- Test: `frontend/src/features/mobile-common/MobileTimePickerSheet.test.tsx`

**Interfaces:**
- Consumes: Selected date and time string (ISO or Date).
- Produces: `MobileTimePickerSheet` component with 14-day horizontal strip, shift-based time grids (Sáng `08:00 - 13:00`, Chiều `14:00 - 18:00`, Tối `19:00 - 22:00`), custom hour/minute roller picker, and `onSelectTime(date: Date)` callback.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/mobile-common/MobileTimePickerSheet.test.tsx` to verify selecting date from strip, selecting slot from grid (e.g. `14:30`), and custom wheel picker.

- [ ] **Step 2: Run test to verify failure**

Run: `cd frontend && npm test src/features/mobile-common/MobileTimePickerSheet.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `MobileTimePickerSheet.tsx`**

Implement time picker matching reference Images 3 & 4:
- Horizontal date tabs for the next 14 days.
- Shift slot blocks: Morning (08:00 - 13:30), Afternoon (14:00 - 18:30), Evening (19:00 - 22:00) with 30-min slot buttons.
- Custom exact time roller modal.
- Fixed bottom action button `"Tiếp tục"` / `"Áp dụng"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/features/mobile-common/MobileTimePickerSheet.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile-common/MobileTimePickerSheet.tsx frontend/src/features/mobile-common/MobileTimePickerSheet.test.tsx
git commit -m "feat(mobile): add mobile time and shift slot picker sheet matching reference ui"
```

---

### Task 5: Mobile Appointment Creation View & Page

**Files:**
- Create: `frontend/src/features/mobile-appointments/MobileAppointmentCreateView.tsx`
- Create: `frontend/src/features/mobile-appointments/mobile-appointments.css`
- Create: `frontend/src/pages/appointments/MobileAppointmentCreatePage.tsx`
- Test: `frontend/src/features/mobile-appointments/MobileAppointmentCreateView.test.tsx`

**Interfaces:**
- Consumes: `createPosAppointment` API, `getPosStaff` API, `getPosCatalog` API.
- Produces: `/m/appointments/new` route view matching reference Image 2 with Customer card, Time card, Service items with per-service staff assignment, status pills, and submit mutation.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/mobile-appointments/MobileAppointmentCreateView.test.tsx` asserting rendering of Customer selection, Time selection, Item catalog picker, individual staff assignment per line, status selection, and appointment creation.

- [ ] **Step 2: Run test to verify failure**

Run: `cd frontend && npm test src/features/mobile-appointments/MobileAppointmentCreateView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `MobileAppointmentCreateView.tsx` & Page**

Implement matching reference Image 2:
- Header `< Tạo lịch` with note icon.
- Card 1: Customer row + Time row.
- Card 2: Services/products list with per-item technician dropdown selector (`👤 KTV thực hiện:`), quantity, price, and add service button.
- Card 3: Status pills (`Chờ xác nhận`, `Chưa tới`, `Đang chờ`, `Đang làm`, `Hoàn thành`).
- Sticky bottom `"Lưu"` button.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/features/mobile-appointments/MobileAppointmentCreateView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile-appointments/ frontend/src/pages/appointments/MobileAppointmentCreatePage.tsx
git commit -m "feat(mobile): add mobile appointment create screen with per-service technician assignment"
```

---

### Task 6: Mobile Quick Invoice Creation View (Immediate Checkout with Per-Line Staff)

**Files:**
- Create: `frontend/src/features/mobile-pos/MobileInvoiceCreateView.tsx`
- Create: `frontend/src/pages/pos/MobileInvoiceCreatePage.tsx`
- Modify: `frontend/src/features/mobile-pos/MobileCartBottomSheet.tsx`
- Test: `frontend/src/features/mobile-pos/MobileInvoiceCreateView.test.tsx`

**Interfaces:**
- Consumes: `checkoutPosInvoice` API, `getPosCatalog` API, `getPosStaff` API.
- Produces: `/m/invoices/new` route view allowing direct item selection from grouped catalog, per-item staff assignment, customer select, discount, payment method, and instant checkout.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/mobile-pos/MobileInvoiceCreateView.test.tsx` testing the quick invoice checkout flow with per-line staff.

- [ ] **Step 2: Run test to verify failure**

Run: `cd frontend && npm test src/features/mobile-pos/MobileInvoiceCreateView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `MobileInvoiceCreateView.tsx` & update `MobileCartBottomSheet.tsx`**

1. In `MobileCartBottomSheet.tsx` and `MobileInvoiceCreateView.tsx`, allow specifying `staffId` on each individual line item.
2. Provide method selector: Cash, VietQR (with live QR code rendering), Bank Card, Account Card balance.
3. Add instant submit button `[ Thanh toán & In hóa đơn ]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/features/mobile-pos/MobileInvoiceCreateView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile-pos/MobileInvoiceCreateView.tsx frontend/src/features/mobile-pos/MobileInvoiceCreateView.test.tsx frontend/src/pages/pos/MobileInvoiceCreatePage.tsx frontend/src/features/mobile-pos/MobileCartBottomSheet.tsx
git commit -m "feat(mobile): add quick invoice create screen with per-line technician assignment"
```

---

### Task 7: Route Integration & Full Regression Testing

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/features/auth/authorization.ts`
- Test: `frontend/src/app/router.test.tsx`

**Interfaces:**
- Consumes: React router config.
- Produces: Registered `/m/appointments/new` and `/m/invoices/new` routes with role permissions.

- [ ] **Step 1: Update routes in `router.tsx` & `authorization.ts`**

Register routes under `/m` route group:
- `/m/appointments/new` -> `MobileAppointmentCreatePage`
- `/m/invoices/new` -> `MobileInvoiceCreatePage`
Map permissions in `permissionForPath`: `/m/appointments/new` ('pos:use' or 'attendance:manage'), `/m/invoices/new` ('pos:use').

- [ ] **Step 2: Run all unit and integration tests**

Run: `cd frontend && npm test` and `cd backend && npm run check`
Expected: PASS (all tests green).

- [ ] **Step 3: Run production build**

Run: `cd frontend && npm run build`
Expected: PASS with zero TypeScript or bundling errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/router.tsx frontend/src/features/auth/authorization.ts frontend/src/app/router.test.tsx
git commit -m "feat(routing): register mobile appointment and invoice routes with role protection"
```
