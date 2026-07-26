# Hướng Dẫn Sử Dụng & Phát Triển Ứng Dụng Anna Chill Beauty

Hệ thống được phát triển nhằm tái hiện mô hình quản lý và bán hàng của **salon.kiotviet.vn** dành riêng cho thương hiệu cá nhân của bạn.

## 1. Trải nghiệm Bản Live Prototype (Artifact)
Bạn có thể nhấp vào nút mở Artifact ở khung bên cạnh của ứng dụng Claude để dùng thử trực tiếp:
- **Trang chủ**: Giới thiệu dịch vụ chuẩn spa, làm tóc.
- **Đặt lịch**: Form chọn ngày, giờ và Kỹ thuật viên yêu thích.
- **Mua sắm**: Đặt hàng các dòng mỹ phẩm chăm sóc tại nhà.
- **KiotViet Admin Dashboard**: Quản lý doanh số bán hàng, xác nhận/hoàn tất lịch hẹn, quản lý đơn hàng.

## 2. Cách chạy ứng dụng trên máy tính của bạn
Vì môi trường sandbox giới hạn kết nối mạng để cài đặt các thư viện Node.js qua `npm`, phiên bản chạy Offline cục bộ đã được chuẩn bị sẵn thông qua một máy chủ web Python gọn nhẹ.

### Các bước thực hiện:
1. Mở phần mềm Terminal (trên macOS/Linux) hoặc Command Prompt (trên Windows).
2. Di chuyển vào thư mục dự án:
   ```bash
   cd "/Users/linhsayshii/Documents/PetProject/mợ hằng/annachillbeauty"
   ```
3. Khởi động server nội bộ:
   ```bash
   python3 -m http.server 8080
   ```
4. Mở trình duyệt web của bạn (Chrome, Safari, Edge) và truy cập địa chỉ:
   ```
   http://localhost:8080
   ```

*Lưu ý: Mọi lịch hẹn bạn đặt hoặc đơn hàng bạn duyệt sẽ được lưu trữ tạm thời trong bộ nhớ trình duyệt giúp bạn dễ dàng chạy demo.*

---
Chúc bạn xây dựng được một hệ thống kinh doanh salon thành công vượt trội!
