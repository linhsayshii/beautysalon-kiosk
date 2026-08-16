# Mobile 5-Tab Navigation & "Nhiều hơn" (More) Hub with Full PWA Sub-pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the mobile navigation into a 5-tab bar (with Lotus quick-action center button and a dedicated "Nhiều hơn" hub for Managers) and ensure all administrative sub-pages are accessible and fully optimized for Mobile PWA responsive view.

**Architecture:** 
1. Re-structure `MobileBottomNav` to present 5 tabs: Manager receives `[Tổng quan, Lịch dịch vụ, Tạo mới, Thông báo, Nhiều hơn]`, while Staff and Cashier keep their tailored role-based flows.
2. Build the `MobileMoreView` feature and page (`/m/more`) with user info card, branch selector modal, and categorized 2-column bento grid cards following the UI reference.
3. Update routing in `router.tsx` and permissions in `authorization.ts` to register all missing `/m/...` routes (e.g. `/m/more`, `/m/notifications`, `/m/appointments`, `/m/products`, `/m/pricebooks`, `/m/purchase-orders`, `/m/customer-cards`, `/m/staff/schedule`, `/m/staff/attendance`, `/m/staff/payroll`, `/m/staff/commissions`, `/m/attendance/qr`).
4. Ensure all sub-pages have clean mobile responsive wrapping with fluid touch tables/cards, appropriate header back-navigation, and PWA styling.

**Tech Stack:** React 19, TypeScript, React Router v6, TanStack Query, Phosphor Icons (`@phosphor-icons/react` / CSS icons), Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-17-mobile-more-and-pwa-subpages-design.md`

## Global Constraints
- Target screen: Mobile PWA viewport (375px - 430px width standard).
- Touch target sizes: Minimum 44px for clickable elements.
- Clean role authorization: Manager has access to `/m/more` and all sub-pages; Cashier and Staff paths remain restricted as defined.
- Styling: Premium aesthetic with soft card surfaces, clean iconography, clear active states, matching the reference image.

---

### Task 1: Update MobileBottomNav Component and Tests for 5-Tab Layout

**Files:**
- Modify: `frontend/src/layouts/MobileAppLayout/MobileBottomNav.tsx`
- Modify: `frontend/src/styles/mobile.css`
- Modify: `frontend/src/layouts/MobileAppLayout/MobileBottomNav.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `@/features/auth/AuthProvider`
- Produces: `MobileBottomNav` component with Manager 5 tabs: `[Tổng quan (/m/dashboard), Lịch dịch vụ (/m/appointments), Nút Thêm mới, Thông báo (/m/notifications), Nhiều hơn (/m/more)]`.

- [ ] **Step 1: Write/update the failing unit test for Manager 5 tabs**

Update `frontend/src/layouts/MobileAppLayout/MobileBottomNav.test.tsx` to assert:
- `Tổng quan` -> `/m/dashboard`
- `Lịch dịch vụ` -> `/m/appointments`
- Center action button with lotus icon styling / aria-label `Tạo mới`
- `Thông báo` -> `/m/notifications`
- `Nhiều hơn` -> `/m/more`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/layouts/MobileAppLayout/MobileBottomNav.test.tsx`
Expected: FAIL due to tabs not matching.

- [ ] **Step 3: Implement 5-tab layout in MobileBottomNav.tsx and mobile.css**

Update `MobileBottomNav.tsx` for `role === 'manager'`:
- Link 1: `/m/dashboard` (`ph ph-squares-four` / `ph-chart-line-up`, label "Tổng quan")
- Link 2: `/m/appointments` (`ph ph-calendar-blank`, label "Lịch dịch vụ")
- Center: Button with class `mobile-nav-center-action lotus-btn` and lotus flower icon / plus icon.
- Link 4: `/m/notifications` (`ph ph-bell`, label "Thông báo")
- Link 5: `/m/more` (`ph ph-list`, label "Nhiều hơn")

Update `frontend/src/styles/mobile.css` with active indicator bar and lotus button gradient style if needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/layouts/MobileAppLayout/MobileBottomNav.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/layouts/MobileAppLayout/MobileBottomNav.tsx frontend/src/layouts/MobileAppLayout/MobileBottomNav.test.tsx frontend/src/styles/mobile.css
git commit -m "feat(mobile): implement 5-tab navigation bar with more hub tab"
```

---

### Task 2: Create MobileMoreView Component and Styling

**Files:**
- Create: `frontend/src/features/mobile-more/MobileMoreView.tsx`
- Create: `frontend/src/features/mobile-more/mobile-more.css`
- Create: `frontend/src/features/mobile-more/MobileMoreView.test.tsx`
- Create: `frontend/src/pages/more/MobileMorePage.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `getBranches()` from `@/features/branches/branches.api`
- Produces: `MobileMoreView` component displaying:
  1. Profile card with branch switcher trigger
  2. Store settings row link
  3. Grouped bento cards (Đơn hàng, Báo cáo, Thuế & Kế toán, Khách hàng, Hàng hóa & Kho, Nhân sự, Hệ thống)
  4. Quick switch to Desktop mode & Logout

- [ ] **Step 1: Write the failing unit test for MobileMoreView**

Create `frontend/src/features/mobile-more/MobileMoreView.test.tsx` testing:
- Renders profile card with current account name and branch.
- Renders category sections (Đơn hàng, Báo cáo, Khách hàng, Hàng hóa, Nhân sự...).
- Clicking on a category item navigates to the expected sub-route.
- Renders switch branch modal when clicked.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/features/mobile-more/MobileMoreView.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement MobileMoreView.tsx and mobile-more.css**

Build `MobileMoreView.tsx` and `mobile-more.css` faithfully reproducing the visual layout:
- Category items as 2-column cards with vivid icon badges (blue, green, violet, orange, pink).
- Branch switcher bottom sheet modal.
- Links to `/m/orders`, `/m/pos`, `/m/products`, `/m/pricebooks`, `/m/purchase-orders`, `/m/customers`, `/m/customer-cards`, `/m/staff`, `/m/staff/schedule`, `/m/staff/attendance`, `/m/staff/payroll`, `/m/staff/commissions`, `/m/attendance`, `/m/attendance/qr`.
- Create `MobileMorePage.tsx` lazy component export.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/features/mobile-more/MobileMoreView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile-more/ frontend/src/pages/more/
git commit -m "feat(mobile): add MobileMoreView with bento category grid hub"
```

---

### Task 3: Create Mobile Notifications and Appointments List Pages

**Files:**
- Create: `frontend/src/features/mobile-notifications/MobileNotificationsView.tsx`
- Create: `frontend/src/features/mobile-notifications/mobile-notifications.css`
- Create: `frontend/src/pages/notifications/MobileNotificationsPage.tsx`
- Create: `frontend/src/features/mobile-appointments/MobileAppointmentsListView.tsx`
- Create: `frontend/src/pages/appointments/MobileAppointmentsListPage.tsx`
- Create: `frontend/src/features/mobile-notifications/MobileNotificationsView.test.tsx`

**Interfaces:**
- Consumes: TanStack Query queries for appointments & notifications
- Produces: `MobileNotificationsPage` and `MobileAppointmentsListPage` components.

- [ ] **Step 1: Write unit tests for MobileNotificationsView and MobileAppointmentsListView**

Create test files verifying rendering of notification tabs and appointment cards.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix frontend test -- src/features/mobile-notifications/MobileNotificationsView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement MobileNotificationsView and MobileAppointmentsListView**

- `MobileNotificationsView`: Filter tabs (Tất cả, Lịch hẹn, Hệ thống), notification list with time, avatar, unread badges.
- `MobileAppointmentsListView`: Date picker selector, search by customer, booking cards with status tags (Chờ phục vụ, Đang làm, Hoàn thành, Đã hủy), and quick call / edit actions.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix frontend test -- src/features/mobile-notifications/MobileNotificationsView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile-notifications/ frontend/src/pages/notifications/ frontend/src/features/mobile-appointments/MobileAppointmentsListView.tsx frontend/src/pages/appointments/MobileAppointmentsListPage.tsx
git commit -m "feat(mobile): add mobile notifications and appointments list views"
```

---

### Task 4: Register Mobile Routes and Configure Authorization

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/features/auth/authorization.ts`
- Modify: `frontend/src/app/router.test.tsx`

**Interfaces:**
- Consumes: All mobile pages and layouts
- Produces: Router tree with all `/m/...` routes and `canAccessPath` rules.

- [ ] **Step 1: Update router.test.tsx to assert mobile routes accessibility**

Test `/m/more`, `/m/notifications`, `/m/appointments`, `/m/products`, `/m/pricebooks`, `/m/purchase-orders`, `/m/customer-cards`, `/m/staff/schedule`, `/m/staff/attendance`, `/m/staff/payroll`, `/m/staff/commissions`, `/m/attendance/qr`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/app/router.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update router.tsx and authorization.ts**

Register the routes under `/m` with appropriate lazy page loaders:
- `path: 'more'`, `path: 'notifications'`, `path: 'appointments'`
- `path: 'products'`, `path: 'pricebooks'`, `path: 'purchase-orders'`, `path: 'purchase-orders/new'`
- `path: 'customer-cards'`, `path: 'staff/schedule'`, `path: 'staff/attendance'`, `path: 'staff/payroll'`, `path: 'staff/commissions'`
- `path: 'attendance/qr'`

Update `permissionForPath(pathname)` in `authorization.ts` to map all `/m/...` paths properly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/app/router.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/router.tsx frontend/src/features/auth/authorization.ts frontend/src/app/router.test.tsx
git commit -m "feat(routing): register full pwa mobile routes and update permission map"
```

---

### Task 5: Sub-pages Mobile PWA Optimization & Responsive Styling

**Files:**
- Modify: `frontend/src/styles/mobile.css`
- Modify: `frontend/src/layouts/MobileAppLayout/MobileTopBar.tsx`
- Modify / Style: Sub-page components (Products, Pricebooks, PurchaseOrders, CustomerCards, Staff sub-pages) to guarantee seamless mobile experience.

**Interfaces:**
- Consumes: `MobileTopBar`, sub-page views
- Produces: Fluid mobile view with dynamic top bar titles, back button navigation, responsive data cards and tables.

- [ ] **Step 1: Update MobileTopBar to support dynamic title and back button for sub-pages**

When on a sub-page (e.g., `/m/products` or `/m/purchase-orders/new`), `MobileTopBar` displays a back button navigating back to `/m/more` or previous page, and sets an intuitive header title.

- [ ] **Step 2: Enhance CSS for Mobile PWA responsive tables and card wrappers**

Add responsive utilities in `mobile.css`:
- Data tables in mobile shell convert to horizontally scrollable swipe containers or clean stacked card views.
- Filters and search bars stack neatly on narrow screens without overflowing.
- Primary floating/sticky action buttons at bottom.

- [ ] **Step 3: Run full test suite to verify no regressions**

Run: `npm --prefix frontend test -- --run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/layouts/MobileAppLayout/MobileTopBar.tsx frontend/src/styles/mobile.css
git commit -m "feat(mobile): optimize pwa sub-pages responsive layouts and dynamic top bar navigation"
```

---

### Task 6: End-to-End Verification in Browser & Final Polish

**Files:**
- Verify via `preview_start` & browser inspect / screenshots.

- [ ] **Step 1: Start dev preview and test navigation across all 5 tabs on mobile viewport (375x812)**
- [ ] **Step 2: Verify More Hub page categories, icons, and branch switcher modal**
- [ ] **Step 3: Navigate from More Hub into sub-pages (/m/products, /m/purchase-orders, /m/customer-cards, /m/staff) and verify back button and responsive display**
- [ ] **Step 4: Final commit & wrap up**
