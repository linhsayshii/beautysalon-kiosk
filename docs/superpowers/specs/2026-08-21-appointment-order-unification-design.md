# Spec: Đồng nhất Lịch hẹn — Tạo đơn hàng tự động

## Context

Nhân viên salon phản ánh rằng lịch hẹn và đơn hàng hiện tách biệt hoàn toàn: tạo lịch hẹn xong, khi khách đến phải tạo đơn lại từ đầu. Ngoài ra, nhân viên không có view riêng để xem lịch và đơn của mình trên mobile — phải thấy tất cả hoặc dùng staff dropdown.

**Goal:** Mỗi lịch hẹn tự tạo một đơn hàng draft. Nhân viên mở "Lịch của tôi" trên mobile, thấy cả lịch lẫn đơn chờ của mình, bấm "Thanh toán" để hoàn tất.

---

## 1. Database

### 1.1 Thêm `appointment_id` vào `invoices`

```sql
-- File: database/init/003_appointment_invoice_link.sql
ALTER TABLE invoices ADD COLUMN appointment_id BIGINT REFERENCES appointments(id);
CREATE INDEX idx_invoices_appointment ON invoices(appointment_id) WHERE appointment_id IS NOT NULL;
```

**Lý do:** Invoice biết nó đến từ lịch hẹn nào. Không cần constraint FK cho cả 2 chiều (appointment không cần biết invoice_id — không có cycle).

### 1.2 Thêm `invoice_id` vào `appointments` (nullable)

```sql
ALTER TABLE appointments ADD COLUMN invoice_id BIGINT REFERENCES invoices(id);
CREATE INDEX idx_appointments_invoice ON appointments(invoice_id) WHERE invoice_id IS NOT NULL;
```

**Lý do:** Appointment biết đơn nào đang chờ. Khi checkout thành công → cập nhật appointment.invoice_id.

---

## 2. Backend

### 2.1 `POST /pos/appointments` → tự động tạo invoice draft

**File:** `backend/src/modules/dashboard/dashboard.service.js` — sửa `createAppointment()`

**Thêm bước sau khi appointment được insert thành công:**

```javascript
// Tạo invoice draft cho appointment
const invoiceResult = await client.query(`
  INSERT INTO invoices (branch_id, customer_id, staff_id, code, status, subtotal, discount, total, payment_method, issued_at)
  VALUES ($1, $2, $3, $4, 'draft', 0, 0, 0, 'cash', $5)
  RETURNING id
`, [branchId, customerId, staffId, generateInvoiceCode(), startsAt]);

const invoiceId = invoiceResult.rows[0].id;

// Gắn invoice vào appointment
await client.query(`UPDATE appointments SET invoice_id = $1 WHERE id = $2`, [invoiceId, appointmentId]);

// Tạo invoice_item cho service đã đặt
await client.query(`
  INSERT INTO invoice_items (invoice_id, item_type, service_id, description, quantity, unit_price, line_total)
  VALUES ($1, 'service', $2, $3, 1, 0, 0)
`, [invoiceId, serviceId, serviceName]);
```

**Lưu ý:** `subtotal=0, line_total=0` — chỉ ghi nhận service đã đặt, chưa tính tiền. Giá tính lại khi checkout với `unit_price` hiện tại từ `services` table.

### 2.2 `POST /pos/checkout` → hỗ trợ appointmentId

**File:** `backend/src/modules/pos/pos.service.js` — sửa `checkoutPosInvoice()`

**Thêm logic khi payload có `appointmentId`:**

```javascript
if (appointmentId) {
  // Verify appointment tồn tại và thuộc branch
  const apt = await client.query(`
    SELECT id, invoice_id, status, customer_id FROM appointments
    WHERE id = $1 AND branch_id = $2
  `, [appointmentId, branchId]);

  if (!apt.rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy lịch hẹn');
  if (apt.rows[0].invoice_id && apt.rows[0].invoice_id !== invoiceId) {
    // Có invoice cũ từ appointment → dùng invoice đó
    // Xóa invoice mới vừa tạo
    await client.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
    invoiceId = apt.rows[0].invoice_id;
  }

  // Cập nhật appointment status → completed
  await client.query(`
    UPDATE appointments SET status = 'completed', invoice_id = $1 WHERE id = $2
  `, [invoiceId, appointmentId]);
}
```

### 2.3 `GET /pos/appointments` → trả thêm `invoiceId`

**Thêm vào response của mỗi appointment:**
```javascript
invoiceId: row.invoice_id || null
```

### 2.4 Fix `no_show` status

**File:** `backend/src/modules/dashboard/dashboard.service.js`

`updateAppointment()` hiện không xử lý `no_show`. Thêm:
```javascript
if (status === 'no_show') {
  await client.query(`UPDATE appointments SET status = 'no_show' WHERE id = $1`, [id]);
}
```

---

## 3. Frontend — "Lịch của tôi" (Mobile)

### 3.1 Tạo `MobileMyScheduleView.tsx`

**Vị trí:** `frontend/src/features/mobile-my-schedule/MobileMyScheduleView.tsx`

**Layout:** Single page, tab-less. Một danh sách unified hiển thị cả lịch hẹn và đơn draft theo thời gian.

**Data flow:**
```typescript
// 1. Fetch appointments của staff trong tuần
const appointments = useQuery({
  queryKey: ['pos-appointments', dateRange, account?.staffId],
  queryFn: () => getPosAppointments(dateFrom, dateTo).then(
    items => items.filter(a => a.staff?.id === account?.staffId)
  ),
});

// 2. Fetch invoices draft của staff trong tuần
const drafts = useQuery({
  queryKey: ['orders-drafts', dateRange, account?.staffId],
  queryFn: () => getOrders({ status: 'draft', staffId: account?.staffId, dateFrom, dateTo }),
});

// 3. Gộp và sắp xếp theo thời gian
const items = useMemo(() => {
  const aptItems = appointments.data?.map(apt => ({
    type: 'appointment' as const,
    id: apt.id,
    time: apt.startsAt,
    customer: apt.customer?.name,
    service: apt.service?.name,
    status: apt.status,
    invoiceId: apt.invoiceId,
  })) ?? [];

  const draftItems = drafts.data?.map(inv => ({
    type: 'invoice' as const,
    id: inv.id,
    time: inv.issuedAt,
    customer: inv.customer?.name,
    items: inv.items,
    status: 'draft',
    appointmentId: inv.appointmentId,
  })) ?? [];

  return [...aptItems, ...draftItems].sort((a, b) =>
    new Date(a.time).getTime() - new Date(b.time).getTime()
  );
}, [appointments.data, drafts.data]);
```

**UI per item:**
- Icon: 📅 cho appointment, 📄 cho invoice draft
- Thời gian, tên khách, tên dịch vụ
- Status badge (pending/confirmed/waiting/in_service/draft)
- Nếu là appointment + có invoice draft → hiện nút "Thanh toán" để đi đến checkout

### 3.2 Thêm route cho "Lịch của tôi"

**File:** `frontend/src/app/router.tsx`

```tsx
// Thêm vào staff routes
{
  path: '/my-schedule',
  element: <MobileMyScheduleView />,
  loader: authenticatedGuard, // yêu cầu đăng nhập
},
```

**Sidebar navigation:** Thêm menu item "Lịch của tôi" trong `MobileMoreView` hoặc sidebar — điều này cần kiểm tra xem sidebar mobile ở đâu trong codebase.

### 3.3 Sửa `MobileAppointmentsListView.tsx`

**Fix `no_show` label:**
```typescript
const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Chờ phục vụ',
  waiting: 'Đang chờ',
  in_service: 'Đang làm',
  completed: 'Đã xong',
  cancelled: 'Đã hủy',
  no_show: 'Không đến',  // ← THÊM
};
```

### 3.4 API — thêm `GET /orders` filter `status`

**File:** `frontend/src/features/orders/orders.api.ts`

```typescript
export async function getOrders(filters: {
  status?: string;
  staffId?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<Order[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.staffId) params.set('staffId', filters.staffId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  const res = await api.get(`/orders?${params}`);
  return res.data;
}
```

---

## 4. Điều chỉnh thêm

### 4.1 Khi tạo lịch hẹn có `invoice_id`

**Desktop POS Calendar:** Khi click vào appointment đã có invoice, hiện nút "Mở đơn" thay vì "Tạo đơn".

### 4.2 `staffId` nullable

- Staff role: `staffId` luôn có giá trị → hiện lịch của mình
- Cashier role: có thể có hoặc không → cho chọn staff filter
- Manager: thấy tất cả, không filter

---

## 5. Verification

### Manual test checklist

1. **Tạo lịch hẹn** (mobile hoặc desktop) → kiểm tra `invoices` table có record mới với `appointment_id` và `status='draft'`
2. **Mở "Lịch của tôi"** → thấy appointment + invoice draft của mình
3. **Bấm "Thanh toán"** → POS checkout → invoice chuyển `draft` → `paid`
4. **Verify appointment** → `invoice_id` đã được set, status `completed`
5. **Tạo lịch hẹn cho khác** → checkout → kiểm tra không tạo invoice trùng
6. **Bug `no_show`** → tạo appointment, đánh dấu `no_show` → hiển thị "Không đến" thay vì raw enum

---

## 6. Files to modify

| File | Change |
|------|--------|
| `database/init/003_appointment_invoice_link.sql` | **New** — migration thêm columns |
| `backend/src/modules/dashboard/dashboard.service.js` | Auto-create draft invoice on appointment create; add no_show handling |
| `backend/src/modules/pos/pos.service.js` | Handle appointmentId in checkout |
| `backend/src/modules/pos/pos.routes.js` | Return invoiceId in appointment response |
| `frontend/src/features/mobile-appointments/MobileAppointmentsListView.tsx` | Fix no_show label |
| `frontend/src/features/mobile-my-schedule/MobileMyScheduleView.tsx` | **New** — unified schedule view |
| `frontend/src/features/mobile-my-schedule/mobile-my-schedule.css` | **New** — styling |
| `frontend/src/features/orders/orders.api.ts` | Add filters (status, staffId, dateFrom, dateTo) |
| `frontend/src/app/router.tsx` | Add `/my-schedule` route |
| `frontend/src/features/mobile-more/MobileMoreView.tsx` | Add "Lịch của tôi" nav item |
