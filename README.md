# AnnaChill Salon Admin

Dashboard quản trị salon theo kiến trúc client-server, gồm frontend Nginx, backend Node.js REST API và PostgreSQL. Toàn bộ hệ thống chạy bằng Docker Compose.

## Yêu cầu

- Docker Desktop hoặc Docker Engine có Compose v2.
- Các cổng mặc định còn trống: `8080`, `3000`, `5432`.

## Khởi chạy

```bash
cp .env.example .env
docker compose up --build
```

Mở:

- Dashboard: [http://localhost:8080](http://localhost:8080)
- API health: [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)
- API readiness: [http://localhost:3000/api/v1/ready](http://localhost:3000/api/v1/ready)

### Tài khoản mẫu

Sau khi khởi tạo database mới, có ba tài khoản demo (mật khẩu chung `Anna@123`):

- `manager` — Quản lý, truy cập toàn bộ các phân hệ và màn hình QR chấm công.
- `cashier` — Thu ngân, chỉ truy cập `/pos`.
- `staff` — Nhân viên, chỉ truy cập `/attendance` để quét QR chấm công.

Quản lý có thể tạo hoặc khóa tài khoản tại `/staff/accounts`. Trước khi sử dụng chấm công, mở `/attendance/qr` tại salon và chọn **Dùng vị trí hiện tại** để lưu GPS chi nhánh. Camera và GPS cần HTTPS khi chạy ngoài `localhost`.

Database được tạo schema và dữ liệu khởi tạo tự động trong lần đầu tạo volume. Frontend chỉ hiển thị dữ liệu do API trả về và không có mock/fallback data.

Môi trường local có sẵn dữ liệu mẫu trong `database/init/006_demo_data.sql`. Nếu volume database đã tồn tại từ trước, chạy `docker compose down -v && docker compose up --build` để PostgreSQL chạy lại toàn bộ seed.

Các trang đã có:

- `/dashboard` - Tổng quan.
- `/orders` - Đơn hàng salon.
- `/customers` - Danh sách khách hàng và công nợ.
- `/customer-cards` - Gói, thẻ đã bán và lượt sử dụng còn lại.
- `/products` - Danh sách hàng hóa, dịch vụ, gói dịch vụ và tồn kho.
- `/pricebooks` - Thiết lập và cập nhật giá bán.
- `/purchase-orders` - Danh sách và chi tiết phiếu nhập.
- `/purchase-orders/new` - Tạo phiếu nhập, lưu tạm hoặc hoàn thành.
- `/staff` - Danh sách nhân viên.
- `/staff/schedule` - Lịch làm việc.
- `/staff/attendance` - Bảng chấm công.
- `/staff/payroll` - Bảng lương.
- `/staff/commissions` - Bảng hoa hồng.
- `/staff/settings` - Thiết lập nhân viên.
- `/staff/accounts` - Tài khoản và phân quyền.
- `/branches` - Thêm, chỉnh sửa, chuyển đổi và ngừng hoạt động chi nhánh; chọn GPS trực tiếp trên bản đồ.
- `/account/settings` - Cập nhật hồ sơ và đổi mật khẩu cho mọi loại tài khoản.
- `/attendance/qr` - Mã QR chấm công dành cho quản lý, tự đổi mỗi 15 giây.
- `/attendance` - Quét QR và xác minh GPS dành cho nhân viên.

## Các lệnh thường dùng

```bash
# Chạy frontend React ở chế độ development
npm --prefix frontend run dev

# Typecheck, test và build toàn bộ frontend/backend
npm run check

# Xem log
docker compose logs -f

# Dừng service, giữ database
docker compose down

# Xóa cả database và khởi tạo schema trống từ đầu
docker compose down -v
docker compose up --build

# Kiểm tra cú pháp JavaScript
npm run check
```

## Quy ước lỗi API

Mọi API lỗi trả cùng một cấu trúc để frontend hiển thị và đội vận hành truy vết:

```json
{
  "error": {
    "status": 400,
    "code": "INVALID_ARGUMENT",
    "message": "Dữ liệu không hợp lệ",
    "requestId": "b3d8598d-4c44-4acd-8a7f-2a65e75f87d3"
  }
}
```

Frontend hiển thị theo dạng `Dữ liệu không hợp lệ (400 · INVALID_ARGUMENT) · Mã tra cứu: ...`. Mất kết nối, timeout và phản hồi sai JSON lần lượt dùng `503 · NETWORK_ERROR`, `504 · REQUEST_TIMEOUT` và `502 · INVALID_RESPONSE`.

## Cấu trúc dự án

```text
.
├── backend/
│   ├── src/
│   │   ├── modules/dashboard/
│   │   ├── modules/inventory/
│   │   ├── app.js
│   │   ├── config.js
│   │   ├── db.js
│   │   └── server.js
│   └── Dockerfile
├── database/init/
│   ├── 001_schema.sql
│   ├── 002_seed.sql          # Chỉ tạo chi nhánh bootstrap
│   ├── 003_operations.sql
│   └── 004_inventory_purchasing.sql
├── frontend/
│   ├── src/
│   │   ├── app/              # Router và providers
│   │   ├── layouts/          # App shell và navigation
│   │   ├── pages/            # Một TSX page cho mỗi route
│   │   ├── features/         # API, types và UI theo nghiệp vụ
│   │   ├── components/       # Shared UI, forms và data display
│   │   ├── services/         # Typed API client
│   │   └── styles/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── nginx.conf
│   └── Dockerfile
├── docs/architecture/
├── compose.yaml
└── .env.example
```

Chi tiết quyết định kỹ thuật nằm trong [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md). Nghiên cứu và tiến độ phân hệ kho nằm trong [docs/inventory-purchasing/](docs/inventory-purchasing/).

Nếu volume database đã được tạo trước khi có các trang vận hành mới, chạy lệnh sau để tạo lại schema trống:

```bash
docker compose down -v
docker compose up --build
```

## Lưu ý production

- Đổi toàn bộ credentials mặc định và mật khẩu ba tài khoản demo; API sẽ từ chối khởi động ở `NODE_ENV=production` nếu còn hash mật khẩu demo.
- Không public cổng PostgreSQL ra internet.
- Dùng managed database hoặc volume có backup.
- Kết thúc TLS tại reverse proxy, đặt `AUTH_COOKIE_SECURE=true`, khai báo chính xác `AUTH_TRUSTED_ORIGINS` và dùng secret manager.
- Đặt `ATTENDANCE_QR_SECRET` ngẫu nhiên tối thiểu 32 ký tự và `DB_PASSWORD` tối thiểu 16 ký tự.
- API áp dụng RBAC ở server; dữ liệu nghiệp vụ luôn bị khóa theo chi nhánh trong phiên, không tin `branchId` từ client.
- Chuyển từ init script sang migration versioned trước khi có dữ liệu thật.
