# AnnaChill Salon Admin

Dashboard quản trị salon theo kiến trúc client-server, gồm frontend Nginx, backend Node.js REST API và PostgreSQL. Toàn bộ hệ thống chạy bằng Docker Compose.

## Yêu cầu

- Docker Desktop hoặc Docker Engine có Compose v2.
- Các cổng mặc định còn trống: `8080`, `3000`, `5432`.

## Khởi chạy lần đầu

PostgreSQL chỉ tự chạy `database/init/001_schema.sql` khi thư mục dữ liệu `./data` còn trống. Dữ liệu khởi tạo phải được nạp **thủ công**, chọn một trong hai file:

| File seed | Dữ liệu được tạo | Tài khoản ban đầu |
| --- | --- | --- |
| `database/seeds/minji_seed.sql` | Một chi nhánh **Minji - Mipec Rubik**, Mipec Rubik 360, 122 Xuân Thủy, Hà Nội; không có dữ liệu nghiệp vụ mẫu | `admin` / `12345678`, quyền quản lý |
| `database/seeds/anna_seed.sql` | Bộ dữ liệu Anna trước đây: chi nhánh, nhân viên, tài khoản, hàng hóa, dịch vụ, tồn kho và nghiệp vụ mẫu | Các tài khoản mẫu bên dưới |

Hai seed là **hai lựa chọn thay thế nhau**, không chạy nối tiếp. Chúng yêu cầu schema đã được tạo và chưa có chi nhánh/tài khoản. Chạy lại hoặc nạp seed khác vào database đã có dữ liệu sẽ báo lỗi trước khi ghi dữ liệu, không ghi đè mật khẩu hay dữ liệu đang dùng.

Chạy từ thư mục gốc repository. Ví dụ khởi tạo Minji:

```bash
# Chỉ tạo .env nếu chưa có
test -f .env || cp .env.example .env

# Đợi PostgreSQL và schema sẵn sàng, nạp seed, rồi mới chạy ứng dụng.
# Chuỗi && dừng nếu một bước thất bại.
docker compose up -d --wait database &&
docker compose exec -T database sh -c \
  'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < database/seeds/minji_seed.sql &&
docker compose up -d --build --wait api frontend
```

Để dùng bộ dữ liệu Anna, thay `minji_seed.sql` bằng `anna_seed.sql` trong lệnh trên. Bỏ qua bước seed nếu database đã có dữ liệu; dùng `docker compose up -d --build --wait` để khởi động lại.

Mở:

- Dashboard: [http://localhost:8080](http://localhost:8080)
- API health: [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)
- API readiness: [http://localhost:3000/api/v1/ready](http://localhost:3000/api/v1/ready)

### Tài khoản ban đầu

`minji_seed.sql` chỉ tạo `admin` với mật khẩu `12345678`, vai trò `manager` (quản lý toàn hệ thống). Không tạo nhân viên, khách hàng, danh mục hoặc giao dịch mẫu. GPS chi nhánh để trống; mở `/attendance/qr` tại salon và chọn **Dùng vị trí hiện tại** trước khi sử dụng chấm công.

`anna_seed.sql` tạo các tài khoản mẫu cùng mật khẩu `12345678`:

- `admin`, `manager` — Quản lý.
- `cashier` — Thu ngân.
- `staff`, `trangvu`, `hau`, `emhue` — Nhân viên.

Đổi mật khẩu tại `/account/settings` sau lần đăng nhập đầu. Quản lý tạo hoặc khóa tài khoản tại `/staff/accounts`. Mật khẩu trong database đang chạy có thể đã được đổi; seed không được dùng để reset mật khẩu. API ở `NODE_ENV=production` từ chối khởi động nếu còn hash mật khẩu mặc định của **bất kỳ** tài khoản nào; cần thay mật khẩu trước khi chuyển sang production. Camera và GPS cần HTTPS khi chạy ngoài `localhost`.

Frontend chỉ hiển thị dữ liệu do API trả về và không có mock/fallback data.

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

## Nạp seed bằng docker exec

Sau khi `docker compose up -d --wait database` hoàn tất, có thể dùng lệnh sau thay cho bước `docker compose exec` ở trên (chỉ chọn một cách nạp):

```bash
docker exec -i "$(docker compose ps -q database)" sh -c \
  'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < database/seeds/minji_seed.sql
```

Thay đường dẫn sau `<` bằng `database/seeds/anna_seed.sql` nếu cần bộ dữ liệu Anna. File nằm trên máy host nên không cần copy hoặc mount seed vào container. `-i` giữ stdin cho `docker exec`; với Compose dùng `exec -T` để tắt TTY. Biến `POSTGRES_USER`/`POSTGRES_DB` được đọc trong container, tương ứng cấu hình `DB_USER`/`DB_NAME`.

`ON_ERROR_STOP=1` dừng và trả mã lỗi khác 0 khi SQL lỗi. Mỗi seed có transaction `BEGIN`/`COMMIT` và khóa bảng trong lúc kiểm tra database trống, nên lỗi sẽ rollback dữ liệu và hai lệnh seed đồng thời không thể cùng khởi tạo. Không tiếp tục bước khởi động ứng dụng khi seed thất bại.

## Database đang có dữ liệu

Không cần nạp lại dữ liệu khi chuyển sang seed thủ công. Giữ nguyên `./data`, cập nhật mã nguồn/cấu hình rồi chạy `docker compose up -d --build --wait`. Restart và rebuild không tự nạp seed. API vẫn chạy `runMigrations()` để nâng cấp database hiện có; migration không tạo tài khoản mẫu. API với schema trống vẫn có thể sẵn sàng nhưng chưa đăng nhập được khi chưa nạp seed.

Local dùng bind mount `./data:/var/lib/postgresql/data`: `docker compose down -v` **không xóa `./data`**, không reset database và không làm init script chạy lại. Không chạy lại `001_schema.sql` hay seed để nâng cấp. Nếu muốn thử seed khác, dùng database thử nghiệm riêng có thư mục dữ liệu/volume trống.

Trước khi triển khai lên database đang dùng, tạo bản sao lưu và kiểm tra phục hồi trên database riêng:

```bash
docker compose exec -T database sh -c \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "annachill-before-update-$(date +%Y%m%d-%H%M%S).dump"
```

## Seed trong CI

CI (`.github/workflows/ci.yml`) có ba job: `frontend` (typecheck, vitest, build), `backend` (`npm run check`) và `smoke`. Job `smoke` dùng volume riêng qua `compose.ci.yaml`, nạp `anna_seed.sql` rồi chạy `scripts/ci-smoke.mjs` (đăng nhập, phân quyền, khách hàng, thanh toán POS) và kiểm tra Nginx proxy; sau đó xoá volume, nạp `minji_seed.sql` và chạy lại script ở chế độ `SMOKE_SEED=minji`. Mỗi lần nạp seed đều đợi database sẵn sàng và dùng `ON_ERROR_STOP=1` trước khi khởi động API.

Kiểm thử seed chạy với PostgreSQL nhúng (PGlite), không đụng tới database local:

```bash
node --test backend/src/database-seeds.test.js
```

Kiểm thử bao gồm schema trống, nội dung hai seed, đăng nhập admin, tương thích migration, chặn mật khẩu mặc định trong production, từ chối nạp lại/nạp chéo và rollback khi SQL lỗi.

## Các lệnh thường dùng

```bash
# Chạy frontend React ở chế độ development
npm --prefix frontend run dev

# Kiểm tra backend, frontend và build
npm --prefix backend run check
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build

# Xem log
docker compose logs -f

# Dừng service, giữ database
docker compose down

# Khởi động lại với dữ liệu hiện có
docker compose up -d --build
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
├── database/
│   ├── init/
│   │   └── 001_schema.sql   # Tự tạo schema trên database mới
│   └── seeds/
│       ├── anna_seed.sql    # Bộ dữ liệu Anna đầy đủ, nạp thủ công
│       └── minji_seed.sql   # Admin và chi nhánh Minji, nạp thủ công
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

## Lưu ý production

- Đổi toàn bộ credentials mặc định và mật khẩu các tài khoản demo; API sẽ từ chối khởi động ở `NODE_ENV=production` nếu còn hash mật khẩu demo.
- Không public cổng PostgreSQL ra internet.
- Dùng managed database hoặc volume có backup.
- Kết thúc TLS tại reverse proxy, đặt `AUTH_COOKIE_SECURE=true`, khai báo chính xác `AUTH_TRUSTED_ORIGINS` và dùng secret manager.
- Đặt `ATTENDANCE_QR_SECRET` ngẫu nhiên tối thiểu 32 ký tự và `DB_PASSWORD` tối thiểu 16 ký tự.
- API áp dụng RBAC ở server; dữ liệu nghiệp vụ luôn bị khóa theo chi nhánh trong phiên, không tin `branchId` từ client.
- Schema mới được tạo bằng init script; database hiện có được nâng cấp bởi migration của API. Seed thủ công không thay thế migration. Chuẩn hóa migration có version và kiểm tra phục hồi backup trước khi triển khai thay đổi schema lên production.
