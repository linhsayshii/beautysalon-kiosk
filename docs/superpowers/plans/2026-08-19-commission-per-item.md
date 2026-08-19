# Commission Per-Item Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép mỗi sản phẩm có hoa hồng riêng (% hoặc số tiền), và mỗi dòng trong hóa đơn gán nhân viên khác nhau.

**Architecture:** Mở rộng bảng products để lưu commission_type/commission_rate. Thêm staff_id vào invoice_items. Tính hoa hồng per-line trong POS checkout thay vì flat 5%.

**Tech Stack:** PostgreSQL, Express.js, React + TypeScript, TanStack Query

**Spec:** `docs/superpowers/specs/2026-08-19-commission-per-item-design.md`

---

## Global Constraints

- Commission type: `'percent'` (rate ≤ 1) hoặc `'fixed'` (số tiền)
- Database timezone: Asia/Ho_Chi_Minh
- API prefix: `/api/v1`
- Error format: `{ error: { status, code, message, requestId } }`

---

## File Structure

```
database/init/001_schema.sql          # ALTER TABLE products, invoice_items, commission_records
backend/src/modules/
  pos/pos.service.js                  # Checkout: per-line commission calculation
  pos/catalog.service.js              # Return commission info in product list
  inventory/inventory.service.js      # CRUD products with commission fields
  inventory/inventory.routes.js       # API routes for products
  staff/staff.service.js             # Commission listing by staff
frontend/src/features/
  pos/components/CartItems.tsx        # Desktop: cart with staff dropdown per line
  mobile-pos/MobilePOSView.tsx        # Mobile: optimized layout with collapsible cart
  inventory/components/ProductForm.tsx # Product form with commission fields
  staff/components/StaffCommissionsView.tsx # Commission list display
```

---

## Task 1: Database Schema — Add Commission Columns to Products

**Files:**
- Modify: `database/init/001_schema.sql`

**Changes:**

```sql
-- Add to products table (after line ~50)
commission_type VARCHAR(10) DEFAULT NULL,  -- 'percent' | 'fixed' | NULL
commission_rate NUMERIC(14,2) DEFAULT 0,   -- % as decimal or fixed amount

-- Add to invoice_items table
staff_id BIGINT REFERENCES staff(id) DEFAULT NULL,

-- Add to commission_records (change existing column or add new)
invoice_item_id BIGINT REFERENCES invoice_items(id) DEFAULT NULL,
```

- [ ] **Step 1: Add commission columns to products table**

Add after `category_id` or similar field in products table definition:
```sql
commission_type VARCHAR(10) DEFAULT NULL CHECK (commission_type IN ('percent', 'fixed', NULL)),
commission_rate NUMERIC(14,2) DEFAULT 0 CHECK (commission_type != 'percent' OR (commission_rate >= 0 AND commission_rate <= 1)),
```

- [ ] **Step 2: Add staff_id to invoice_items table**

Add column:
```sql
staff_id BIGINT REFERENCES staff(id) ON DELETE SET NULL,
```

- [ ] **Step 3: Add invoice_item_id to commission_records**

Add column referencing the new invoice_items.staff_id chain:
```sql
invoice_item_id BIGINT REFERENCES invoice_items(id) ON DELETE SET NULL,
```

- [ ] **Step 4: Update seed data for existing products**

In `002_seed.sql`, add commission data for sample products:
```sql
-- Give some products commission
UPDATE products SET commission_type = 'percent', commission_rate = 0.10 WHERE code IN ('DV001', 'DV002');
UPDATE products SET commission_type = 'fixed', commission_rate = 50000 WHERE code IN ('SP001');
```

- [ ] **Step 5: Commit**

```bash
git add database/init/001_schema.sql database/init/002_seed.sql
git commit -m "feat(db): add commission columns to products and invoice_items"
```

---

## Task 2: Backend — POS Catalog Service

**Files:**
- Modify: `backend/src/modules/pos/catalog.service.js`

**Goal:** Return commission info when listing products for POS

**Changes:**

- [ ] **Step 1: Add commission fields to catalog query**

In the product listing query (around line 50-80), add:
```sql
p.commission_type,
p.commission_rate,
```

- [ ] **Step 2: Map commission fields in response**

In the response mapping, include:
```javascript
commissionType: row.commission_type,
commissionRate: parseFloat(row.commission_rate) || 0,
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/pos/catalog.service.js
git commit -m "feat(api): return commission info in POS catalog"
```

---

## Task 3: Backend — POS Checkout with Per-Line Commission

**Files:**
- Modify: `backend/src/modules/pos/pos.service.js`

**Goal:** Create invoice_items with staff_id, calculate commission per line

**Changes:**

- [ ] **Step 1: Update createInvoiceItems function**

Find the existing `createInvoiceItems` function and add `staffId` parameter:
```javascript
async function createInvoiceItems(client, invoiceId, items) {
  for (const item of items) {
    await client.query(
      `INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, staff_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [invoiceId, item.productId, item.quantity, item.unitPrice, item.staffId || null]
    );
  }
}
```

- [ ] **Step 2: Create helper to calculate commission per line**

Add function after imports:
```javascript
function calculateCommission(revenue, commissionType, commissionRate) {
  if (!commissionType || !commissionRate) return 0;
  if (commissionType === 'percent') {
    return Math.round(revenue * commissionRate);
  }
  return 0; // fixed amount handled in next step
}
```

- [ ] **Step 3: Update checkout flow to create per-line commissions**

In the checkout transaction (around where commission is currently created), replace the single commission record with per-item:

```javascript
// After creating invoice_items, fetch them back with product info
const itemsResult = await client.query(
  `SELECT ii.id as item_id, ii.product_id, ii.quantity, ii.unit_price, ii.staff_id,
          p.commission_type, p.commission_rate
   FROM invoice_items ii
   JOIN products p ON p.id = ii.product_id
   WHERE ii.invoice_id = $1`,
  [invoiceId]
);

// Create commission for each line with assigned staff
for (const item of itemsResult.rows) {
  if (!item.staff_id) continue;
  
  const revenue = item.unit_price * item.quantity;
  let amount = 0;
  
  if (item.commission_type === 'percent') {
    amount = Math.round(revenue * item.commission_rate);
  } else if (item.commission_type === 'fixed') {
    amount = item.quantity * parseFloat(item.commission_rate);
  }
  
  if (amount > 0) {
    await client.query(
      `INSERT INTO commission_records (branch_id, staff_id, invoice_id, invoice_item_id, source_name, revenue, rate, amount, occurred_on, status, commission_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, 'pending', 
               CASE WHEN $7 < 1 THEN 'service' ELSE 'consulting' END)`,
      [branchId, item.staff_id, invoiceId, item.item_id, `Thực hiện dịch vụ`, revenue, item.commission_rate || 0, amount]
    );
  }
}
```

- [ ] **Step 4: Remove old flat commission code**

Delete the existing 5% flat commission block (around line 319-329).

- [ ] **Step 5: Update API input validation**

In `pos.routes.js`, ensure the checkout request accepts `staffId` per item:
```javascript
// In validateCheckoutItems or similar
if (!item.staffId || typeof item.staffId !== 'number') {
  item.staffId = null; // Optional field
}
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/pos/pos.service.js backend/src/modules/pos/pos.routes.js
git commit -m "feat(pos): per-line commission with staff assignment"
```

---

## Task 4: Backend — Staff Commissions API

**Files:**
- Modify: `backend/src/modules/staff/staff.service.js`

**Goal:** Return commission details including product name and invoice_item_id

**Changes:**

- [ ] **Step 1: Update listCommissions query to include product info**

In `listCommissions` function, join with invoice_items and products:
```javascript
SELECT 
  cr.id,
  cr.staff_id,
  cr.invoice_id,
  cr.invoice_item_id,
  cr.source_name,
  cr.revenue,
  cr.rate,
  cr.amount,
  cr.occurred_on,
  cr.status,
  cr.commission_type,
  -- New fields
  ii.quantity as item_quantity,
  p.name as product_name,
  i.code as invoice_code
FROM commission_records cr
LEFT JOIN invoice_items ii ON ii.id = cr.invoice_item_id
LEFT JOIN products p ON p.id = ii.product_id
LEFT JOIN invoices i ON i.id = cr.invoice_id
WHERE ...
```

- [ ] **Step 2: Map new fields in response**

```javascript
{
  id: row.id,
  // ... existing fields
  invoiceItemId: row.invoice_item_id,
  itemQuantity: parseInt(row.item_quantity) || 1,
  productName: row.product_name,
  invoiceCode: row.invoice_code,
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/staff/staff.service.js
git commit -m "feat(api): include product details in commission records"
```

---

## Task 5: Frontend — Product Form with Commission Fields

**Files:**
- Modify: `frontend/src/features/inventory/components/ProductForm.tsx` (or create if not exists)

**Goal:** Form to edit product with commission_type and commission_rate

**Changes:**

- [ ] **Step 1: Add commission section to product form**

In the product form, add after price fields:
```tsx
<div className="commission-section">
  <label className="checkbox-label">
    <input
      type="checkbox"
      checked={commissionType !== null}
      onChange={(e) => {
        setCommissionType(e.target.checked ? 'percent' : null);
        setCommissionRate(0);
      }}
    />
    <span>Có hoa hồng</span>
  </label>
  
  {commissionType !== null && (
    <div className="commission-fields">
      <div className="radio-group">
        <label>
          <input
            type="radio"
            name="commissionType"
            value="percent"
            checked={commissionType === 'percent'}
            onChange={() => setCommissionType('percent')}
          />
          <span>% giá bán</span>
        </label>
        <label>
          <input
            type="radio"
            name="commissionType"
            value="fixed"
            checked={commissionType === 'fixed'}
            onChange={() => setCommissionType('fixed')}
          />
          <span>Số tiền cố định</span>
        </label>
      </div>
      
      <div className="rate-input">
        <input
          type="number"
          value={commissionRate}
          onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
          step={commissionType === 'percent' ? 0.01 : 1000}
          min={0}
          max={commissionType === 'percent' ? 1 : undefined}
        />
        <span>{commissionType === 'percent' ? '%' : 'đ'}</span>
      </div>
      
      {commissionType === 'percent' && (
        <span className="preview">
          = {formatCurrency(price * commissionRate)}đ
        </span>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 2: Update form state and submission**

```tsx
// State
const [commissionType, setCommissionType] = useState<string | null>(null);
const [commissionRate, setCommissionRate] = useState(0);

// In form data
{
  // ... other fields
  commissionType: commissionType,
  commissionRate: commissionType === 'percent' ? commissionRate : commissionRate,
}
```

- [ ] **Step 3: Load commission data in edit mode**

In useEffect for loading product data:
```tsx
if (product.commissionType) {
  setCommissionType(product.commissionType);
  setCommissionRate(product.commissionRate);
}
```

- [ ] **Step 4: Add styles**

```css
.commission-section {
  padding: 12px;
  background: var(--canvas);
  border-radius: 8px;
  margin-top: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.radio-group {
  display: flex;
  gap: 16px;
  margin: 8px 0;
}

.rate-input {
  display: flex;
  align-items: center;
  gap: 4px;
}

.rate-input input {
  width: 100px;
}

.preview {
  color: var(--ink-600);
  font-size: 12px;
  margin-left: 8px;
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/inventory/components/ProductForm.tsx
git commit -m "feat(ui): add commission fields to product form"
```

---

## Task 6: Frontend — POS Cart with Staff Dropdown (Desktop)

**Files:**
- Modify: `frontend/src/features/pos/components/CartView.tsx` (or relevant cart component)

**Goal:** Show staff dropdown per line item in cart

**Changes:**

- [ ] **Step 1: Add staff dropdown column in cart table**

In the cart items rendering:
```tsx
<table className="cart-table">
  <thead>
    <tr>
      <th>Sản phẩm</th>
      <th>SL</th>
      <th>Đơn giá</th>
      <th>Thành tiền</th>
      <th>Nhân viên</th>
      <th>HH</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    {items.map((item) => (
      <tr key={item.id}>
        <td>{item.productName}</td>
        <td>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
          />
        </td>
        <td>{formatCurrency(item.unitPrice)}</td>
        <td>{formatCurrency(item.unitPrice * item.quantity)}</td>
        <td>
          <select
            value={item.staffId || ''}
            onChange={(e) => updateStaff(item.id, e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">-- Chọn NV --</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </td>
        <td className="commission-cell">
          {calculateExpectedCommission(item)}
        </td>
        <td>
          <button onClick={() => removeItem(item.id)}>×</button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

- [ ] **Step 2: Add expected commission calculation**

```tsx
function calculateExpectedCommission(item: CartItem): string {
  if (!item.staffId) return '-';
  if (!item.commissionType || !item.commissionRate) return '0đ';
  
  const revenue = item.unitPrice * item.quantity;
  let amount = 0;
  
  if (item.commissionType === 'percent') {
    amount = revenue * item.commissionRate;
  } else {
    amount = item.quantity * item.commissionRate;
  }
  
  return formatCurrency(Math.round(amount));
}
```

- [ ] **Step 3: Update cart state to include staffId**

In the cart context/store:
```tsx
interface CartItem {
  id: string;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  staffId: number | null;
  commissionType: 'percent' | 'fixed' | null;
  commissionRate: number;
}
```

- [ ] **Step 4: Update add to cart**

When adding product to cart:
```tsx
function addToCart(product: Product) {
  dispatch({
    type: 'ADD_ITEM',
    payload: {
      ...product,
      quantity: 1,
      staffId: null,
    }
  });
}
```

- [ ] **Step 5: Add styles**

```css
.cart-table select {
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  min-width: 120px;
}

.commission-cell {
  color: var(--green);
  font-variant-numeric: tabular-nums;
}

.cart-table td:nth-child(5),
.cart-table th:nth-child(5) {
  min-width: 140px;
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/pos/components/CartView.tsx
git commit -m "feat(pos): add staff dropdown per cart item"
```

---

## Task 7: Frontend — Mobile POS with Collapsible Cart

**Files:**
- Modify: `frontend/src/features/mobile-pos/MobilePOSView.tsx`

**Goal:** Optimized mobile layout with collapsible cart, staff dropdown per item

**Changes:**

- [ ] **Step 1: Collapsible cart header**

```tsx
<div className="mobile-pos">
  {/* Product grid */}
  <div className="product-grid">
    {products.map((p) => (
      <ProductCard key={p.id} product={p} onAdd={addToCart} />
    ))}
  </div>

  {/* Collapsible cart */}
  <div className={`mobile-cart ${isCartExpanded ? 'expanded' : 'collapsed'}`}>
    <button 
      className="cart-header"
      onClick={() => setIsCartExpanded(!isCartExpanded)}
    >
      <span className="cart-title">
        Giỏ hàng ({itemCount})
      </span>
      <span className="cart-toggle">
        {isCartExpanded ? '▼' : '▲'}
      </span>
    </button>
    
    {isCartExpanded && (
      <div className="cart-items">
        {cartItems.map((item) => (
          <CartItemRow 
            key={item.id} 
            item={item}
            staffList={staffList}
            onUpdateStaff={updateStaff}
            onUpdateQuantity={updateQuantity}
            onRemove={removeItem}
          />
        ))}
      </div>
    )}
    
    {/* Always visible summary */}
    <div className="cart-summary">
      <div className="summary-row">
        <span>Tạm tính:</span>
        <span className="amount">{formatCurrency(subtotal)}</span>
      </div>
      <div className="summary-row commission">
        <span>HH dự kiến:</span>
        <span className="amount">{formatCurrency(totalCommission)}</span>
      </div>
    </div>
    
    <button 
      className="checkout-btn"
      disabled={cartItems.length === 0}
      onClick={handleCheckout}
    >
      💳 Thanh toán
    </button>
  </div>
</div>
```

- [ ] **Step 2: Cart item row component**

```tsx
function CartItemRow({ item, staffList, onUpdateStaff, onUpdateQuantity, onRemove }) {
  return (
    <div className="cart-item">
      <div className="item-main">
        <div className="item-info">
          <span className="item-name">{item.productName}</span>
          <span className="item-price">{formatCurrency(item.unitPrice)} × {item.quantity}</span>
        </div>
        <button className="remove-btn" onClick={() => onRemove(item.id)}>×</button>
      </div>
      
      <div className="item-meta">
        <div className="staff-select">
          <label>NV:</label>
          <select
            value={item.staffId || ''}
            onChange={(e) => onUpdateStaff(item.id, e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">-- Chọn --</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        
        <div className="commission-badge">
          HH: {calculateExpectedCommission(item)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Mobile styles**

```css
.mobile-pos {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding-bottom: 200px; /* Space for fixed cart */
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 12px;
  flex: 1;
  overflow-y: auto;
}

.mobile-cart {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface);
  border-top: 1px solid var(--line);
  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
}

.cart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 12px 16px;
  background: var(--blue-100);
  border: none;
  cursor: pointer;
  font-weight: 600;
}

.cart-items {
  max-height: 200px;
  overflow-y: auto;
  border-bottom: 1px solid var(--line);
}

.cart-item {
  padding: 10px 16px;
  border-bottom: 1px solid var(--line);
}

.item-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}

.staff-select {
  display: flex;
  align-items: center;
  gap: 6px;
}

.staff-select select {
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: 13px;
  min-width: 100px;
}

.commission-badge {
  font-size: 12px;
  color: var(--green);
  background: var(--blue-100);
  padding: 2px 8px;
  border-radius: 10px;
}

.cart-summary {
  padding: 10px 16px;
  background: var(--canvas);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.summary-row.commission {
  color: var(--green);
  font-weight: 600;
}

.checkout-btn {
  width: calc(100% - 32px);
  margin: 12px 16px;
  padding: 14px;
  background: var(--blue-600);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
}
```

- [ ] **Step 4: Calculate total commission**

```tsx
const totalCommission = cartItems.reduce((sum, item) => {
  if (!item.staffId) return sum;
  return sum + calculateCommissionAmount(item);
}, 0);
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile-pos/MobilePOSView.tsx
git commit -m "feat(mobile-pos): collapsible cart with staff dropdown"
```

---

## Task 8: Frontend — Staff Commissions View

**Files:**
- Modify: `frontend/src/features/staff/components/StaffCommissionsView.tsx`

**Goal:** Display commission details including product name

**Changes:**

- [ ] **Step 1: Update commission details table**

In the "Chi tiết giao dịch" tab:
```tsx
<table className="commission-details-table">
  <thead>
    <tr>
      <th>Ngày</th>
      <th>Mã đơn</th>
      <th>Sản phẩm</th>
      <th>SL</th>
      <th>Doanh thu</th>
      <th>Tỷ lệ</th>
      <th>Hoa hồng</th>
    </tr>
  </thead>
  <tbody>
    {commissions.map((c) => (
      <tr key={c.id}>
        <td>{formatDate(c.occurredOn)}</td>
        <td>{c.invoiceCode}</td>
        <td>{c.productName || c.sourceName}</td>
        <td>{c.itemQuantity}</td>
        <td className="amount">{formatCurrency(c.revenue)}</td>
        <td>{formatPercent(c.rate)}</td>
        <td className="amount commission">{formatCurrency(c.amount)}</td>
      </tr>
    ))}
  </tbody>
</table>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/staff/components/StaffCommissionsView.tsx
git commit -m "feat(staff): show product details in commission list"
```

---

## Task 9: Integration Testing

**Files:**
- Create: `docs/testing/commission-flow.md` (test checklist)

**Test Cases:**

- [ ] **Test 1: Product with percent commission**
  1. Tạo sản phẩm A với hoa hồng 10%
  2. Tạo đơn hàng với sản phẩm A, qty=2, price=100.000
  3. Gán nhân viên Lan cho sản phẩm A
  4. Checkout
  5. Verify: commission_records có amount = 200.000 × 0.10 = 20.000

- [ ] **Test 2: Product with fixed commission**
  1. Tạo sản phẩm B với hoa hồng cố định 50.000đ
  2. Tạo đơn hàng với sản phẩm B, qty=3
  3. Gán nhân viên Minh cho sản phẩm B
  4. Checkout
  5. Verify: commission_records có amount = 3 × 50.000 = 150.000

- [ ] **Test 3: Multiple staff, same invoice**
  1. Tạo đơn hàng với 3 sản phẩm, mỗi sp gán NV khác
  2. Checkout
  3. Verify: có 3 commission_records, mỗi record với staff_id khác nhau

- [ ] **Test 4: Product without commission**
  1. Tạo sản phẩm C không có hoa hồng
  2. Tạo đơn hàng với sản phẩm C
  3. Checkout
  4. Verify: không có commission record cho sản phẩm C

- [ ] **Test 5: Empty staff assignment**
  1. Tạo đơn hàng, không gán nhân viên cho dòng nào
  2. Checkout
  3. Verify: không có commission record nào

- [ ] **Commit test checklist**

```bash
git add docs/testing/commission-flow.md
git commit -m "docs: add commission flow test cases"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | DB Schema | `001_schema.sql`, `002_seed.sql` |
| 2 | Catalog Service | `catalog.service.js` |
| 3 | POS Checkout | `pos.service.js` |
| 4 | Staff Commissions API | `staff.service.js` |
| 5 | Product Form | `ProductForm.tsx` |
| 6 | Desktop Cart | `CartView.tsx` |
| 7 | Mobile POS | `MobilePOSView.tsx` |
| 8 | Staff Commissions UI | `StaffCommissionsView.tsx` |
| 9 | Testing | Test checklist |

---

## Spec Coverage Check

- [x] Commission per product (% or fixed) → Tasks 1, 5
- [x] Staff assignment per line → Tasks 3, 6, 7
- [x] Per-line commission calculation → Task 3
- [x] Mobile optimized layout → Task 7
- [x] Commission display in product form → Task 5
- [x] Commission details with product name → Tasks 4, 8
