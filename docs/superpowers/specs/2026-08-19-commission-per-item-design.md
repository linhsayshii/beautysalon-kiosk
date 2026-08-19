# Thiết kế: Hoa hồng per-item với nhân viên riêng

## Tóm tắt

Cho phép mỗi sản phẩm/dịch vụ có hoa hồng riêng (% hoặc số tiền), và mỗi dòng trong hóa đơn gán nhân viên khác nhau. Mỗi nhân viên nhận hoa hồng trên phần việc của mình.

## Yêu cầu nghiệp vụ

- Mỗi sản phẩm có 3 chế độ hoa hồng: `% giá bán`, `số tiền cố định`, hoặc `không có`
- Mỗi dòng trong đơn hàng chọn nhân viên riêng
- Hoa hồng tính per-line: `revenue × rate` (% ) hoặc `quantity × fixed`
- Nhiều nhân viên có thể nhận hoa hồng trên 1 hóa đơn

## Database Schema

### Thêm vào `products`
```sql
commission_type VARCHAR(10) DEFAULT NULL,  -- 'percent' | 'fixed' | NULL
commission_rate NUMERIC(14,2) DEFAULT 0    -- % as decimal (0.10 = 10%) or fixed amount
```

### Thêm vào `invoice_items`
```sql
staff_id BIGINT REFERENCES staff(id) DEFAULT NULL
```

### Cập nhật `commission_records`
```sql
invoice_item_id BIGINT REFERENCES invoice_items(id)  -- thay cho việc chỉ reference invoice
```

## Backend Changes

### 1. POS Service (`pos.service.js`)

**Checkout flow:**
1. Client gửi `items[]` với mỗi item có `productId`, `quantity`, `staffId`
2. Insert `invoice_items` với `staff_id` per line
3. Với mỗi line có `staffId`:
   - Tính revenue = `unit_price × quantity`
   - Lấy `commission_type` và `commission_rate` từ `products`
   - Nếu `commission_type = 'percent'`: `amount = revenue × rate`
   - Nếu `commission_type = 'fixed'`: `amount = quantity × rate`
   - Insert `commission_records`

**Lấy danh sách sản phẩm POS:**
- Trả về `commissionType`, `commissionRate` để UI hiển thị

### 2. Staff Service (`staff.service.js`)

- List commissions: group by `staff_id`, sum `amount`
- Details: hiển thị `invoice_item_id`, `product_name`, `quantity`, `revenue`

### 3. Products API

- `POST/PATCH /inventory/products`: accept `commissionType`, `commissionRate`
- Validation: nếu `commissionType = 'percent'` → rate ≤ 1 (100%)

## Frontend Changes

### 1. Products Page

**Desktop:** Form thêm/sửa sản phẩm có fields:
- Toggle: "Có hoa hồng" on/off
- Khi on: Radio (% hoặc số tiền) + input rate/amount

**Mobile:** Tương tự, responsive layout

### 2. POS Page - Desktop

**Danh sách sản phẩm (cart):**
| Sản phẩm | SL | Đơn giá | Thành tiền | Nhân viên | HH |
|----------|----|---------|------------|-----------|----|
| [Tên sp] | [qty] | [price] | [total] | [dropdown ▼] | [calculated] |

- Dropdown nhân viên trên mỗi dòng
- Cột HH hiển thị số tiền hoa hồng dự kiến
- Dòng không chọn nhân viên → HH = 0

### 3. POS Page - Mobile

**Layout tối ưu cho mobile:**
```
┌─────────────────────────────────┐
│  🛒 Đơn hàng mới        [Tạo KH] │
├─────────────────────────────────┤
│ [Search sản phẩm............🔍] │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ [Danh mục] [Dịch vụ] [SP] │ │
│ └─────────────────────────────┘ │
│ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │ S1  │ │ S2  │ │ S3  │ ...   │ ← Grid sản phẩm
│ └─────┘ └─────┘ └─────┘       │
├─────────────────────────────────┤
│ Giỏ hàng (3)              [▼] │ ← Expandable
│ ┌─────────────────────────────┐ │
│ │ Haircut        ×1    150k  │ │
│ │ NV: [dropdown ▼� Lan]      │ │
│ │ HH: 15.000đ                │ │
│ │─────────────────────────────│ │
│ │ Massage       ×2    300k   │ │
│ │ NV: [dropdown ▼▼ Minh]     │ │
│ │ HH: 30.000đ                │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│  Tạm tính: 450.000đ           │
│  HH dự kiến: 45.000đ          │
├─────────────────────────────────┤
│ [💳 Thanh toán]               │
└─────────────────────────────────┘
```

**Mobile UI optimizations:**
- Cart panel collapsible (mở rộng/thu gọn)
- Mỗi item trong cart hiển thị: tên, SL, giá, dropdown NV, HH
- Dropdown NV dùng native select hoặc bottom sheet
- Tổng HH hiển thị trước nút thanh toán
- Số lượng items hiển thị badge trên cart toggle

### 4. Staff Commissions Page

- List chi tiết: hiển thị tên sản phẩm, số lượng, nhân viên, HH
- Filter theo date range giữ nguyên

## Files to Modify

### Database
- `database/init/001_schema.sql` - ALTER TABLE products, invoice_items

### Backend
- `backend/src/modules/pos/pos.service.js` - checkout flow, per-line commission
- `backend/src/modules/pos/catalog.service.js` - return commission info
- `backend/src/modules/staff/staff.service.js` - commission listing
- `backend/src/modules/inventory/inventory.service.js` - products CRUD with commission
- `backend/src/modules/inventory/inventory.routes.js` - API routes

### Frontend
- `frontend/src/features/pos/` - POS cart component with staff dropdown
- `frontend/src/features/mobile-pos/` - Mobile POS with optimized layout
- `frontend/src/features/inventory/` - Product form with commission fields
- `frontend/src/features/staff/` - Commission list

## Testing

1. Tạo sản phẩm với hoa hồng % (10%)
2. Tạo sản phẩm với hoa hồng cố định (50.000đ)
3. Tạo sản phẩm không có hoa hồng
4. Tạo đơn với 3 sp khác nhau, mỗi sp gán NV khác nhau
5. Verify: mỗi NV nhận đúng hoa hồng của sp được gán
6. Verify: commission_records đúng per line
