# Kiểm tra giao diện, nghiệp vụ và dọn dự án — 07/10/2026

## Kết quả và phạm vi

Đợt này chuẩn hóa giao diện trên bộ component/CSS hiện có, áp dụng `frontend-ui-engineering` và bổ sung `evon:ui-ux`. Giữ nhận diện xanh, font hệ thống và light theme. Màu nhấn (`--blue-600`) và font (`--font-sans`) chỉnh tại `frontend/src/styles/tokens.css`; không dựng dark mode mới. Không thêm thư viện UI. Template có hướng dẫn trong [mobile-ui-header-template.md](../mobile-ui-header-template.md), mẫu sống DEV ở `/ui-kit` và `/ui-kit/mobile`.

Thay đổi chính:

- Hàng hóa, bảng giá, khách hàng, gói/thẻ đã bán, đơn hàng và nhập hàng dùng cùng khuôn danh sách mobile; tên dài xuống dòng, mã/giá/trạng thái theo cùng thứ bậc. Trang dùng cùng header, body, footer, sheet và trạng thái tải/lỗi/rỗng.
- Desktop/mobile dùng chung form hàng hóa, form bảng giá, chi tiết hàng hóa và logic tạo phiếu nhập. Bốn loại hàng hiển thị đúng các trường riêng: tồn kho; thời lượng/hoa hồng; dịch vụ/số buổi; mệnh giá/phạm vi.
- Control bo 12px, cao 40px desktop/44px mobile. Ô nhập trên mobile, kể cả ô tiền có hậu tố, dùng 16px. Card trong trang không bóng; scrollbar chung 4px. Giữ focus bàn phím theo quy ước accessibility của dự án.
- Form gói/thẻ tải đủ mọi trang danh mục; trước đây chỉ có 100 mục đầu. Có tìm theo tên/mã, lựa chọn đã chọn không mất khi tìm. Ô số buổi và nút xóa đủ vùng bấm trên điện thoại.
- Bộ chọn khách hàng ở POS/lịch hẹn/hóa đơn dùng cùng thanh tìm kiếm và dòng danh sách. Sửa ô POS bị thiếu CSS thành input trình duyệt mặc định; giữ API dành cho quyền bán hàng. Phân biệt đang tải, rỗng và lỗi, có thử lại; xóa tìm kiếm giữ focus.
- Refetch không xóa nội dung form đang nhập; sửa thông tin sản phẩm không gửi lại tồn kho khi người dùng chưa đổi trường tồn. Bảng giá mobile chỉ cập nhật khi bấm “Lưu giá”.

## Các lỗi nghiệp vụ đã sửa

| Trước | Sau |
| --- | --- |
| Sắp xếp trong phần dữ liệu đã tải rồi gom nhóm lại | API sắp xếp trước phân trang; giao diện giữ thứ tự API, lọc loại bảng giá trên server |
| Đổi bảng giá chung nhưng giá gốc còn cũ | Cập nhật bảng giá chung và giá gốc trong cùng transaction; bảng giá riêng không đổi giá gốc |
| Phiếu tạm được tính như công nợ thực, chưa có đường nhận hàng | Phiếu tạm chưa cộng kho/ghi chi/tính nợ thực; có thao tác nhận hàng trên desktop/mobile |
| Thiếu bảo vệ luồng nhận hàng khi thao tác lại | Khóa phiếu trong transaction, retry không cộng kho/ghi chi lần hai; lỗi thiếu quỹ rollback cả luồng |
| Trả vượt tiền cần trả bị tự cắt bớt | Từ chối bằng lỗi rõ ràng; kiểm tra quỹ trước khi hoàn tất |
| Cache tồn/giá giữa các màn có thể cũ | Sự kiện inventory sau COMMIT và invalidation dùng chung; cập nhật lại sau bán hàng/kết nối lại |
| Đăng nhập từ đường dẫn mobile quay sang desktop | Trở lại đường dẫn được phép, chặn đường dẫn ngoài hệ thống và kiểm tra quyền |
| Lỗi tải bị hiển thị như không có dữ liệu | ErrorState/thử lại ở các màn được chỉnh, không thay bằng số nghiệp vụ giả |

Các mục không có dữ liệu người tạo hiển thị “Chưa ghi nhận”; không giả tên quản lý. Cột người tạo của phiếu nhập hiện vẫn dùng dữ liệu staff trong schema cũ; đợt này không đổi schema lịch sử.

## Đã tự sử dụng app

Chạy frontend Vite và backend/PostgreSQL trong môi trường QA riêng `anna_ui_audit`, sử dụng Anna seed. Các thao tác ghi dữ liệu chỉ diễn ra ở môi trường này; không nạp seed vào `./data` hay ghi dữ liệu production.

| Khổ kiểm tra | Màn/luồng |
| --- | --- |
| 390×844 | Hàng hóa, bảng giá, khách hàng, gói/thẻ, đơn hàng, nhập hàng, nhân viên, lịch dịch vụ, sổ quỹ, báo cáo, tài khoản |
| 320×700 | Hàng hóa, bảng giá, đơn hàng, khách hàng, tạo phiếu nhập; lịch làm/chấm công/lương/hoa hồng; QR quản lý; tạo lịch hẹn/hóa đơn; POS; form tạo dịch vụ/gói/thẻ |
| 375×812 | Danh sách hàng hóa/bảng giá; lưu giá; đăng xuất rồi đăng nhập lại từ `/m/products` |
| 375, 768, 1024, 1280, 1440px | Đo bề rộng hàng hóa; không tràn ngang document ở các khổ này |
| 1280×800 | Hàng hóa, bảng giá, nhập hàng/tạo phiếu, đơn hàng, khách hàng, lịch làm, chấm công, bảng lương, hoa hồng, sổ quỹ, báo cáo, `/account/settings` |
| 320/390×350 | Focus trường cuối form hàng hóa/phiếu nhập và ô tìm phạm vi thẻ; vùng nhập tự cuộn vào phần nhìn thấy, modal nằm trong viewport |

Luồng ghi đã thực hiện:

1. Tạo `QA-UI-01`, giá bán 150.000đ, giá vốn 80.000đ, tồn 5; lưu và mở lại mô tả/ghi chú.
2. Tạo phiếu tạm `PN000001`, 2 sản phẩm × 80.000đ, dự kiến trả 0đ. Tổng cần trả thực trong danh sách còn 0đ.
3. Nhận hàng: phiếu chuyển “Đã nhập hàng”, cần trả thực 160.000đ, tồn sản phẩm tăng lên 7. Không chi tiền vì số trả là 0đ.
4. Đổi giá trong bảng giá chung thành 160.000đ; mở chi tiết desktop xác nhận giá 160.000đ, giá vốn 80.000đ, tồn 7.
5. Mở form thẻ, tìm `QA-UI-01`: sau sửa, chọn được hàng ngoài 100 mục đầu. Mở form gói, tìm `SP000153`, thêm thử dịch vụ và số buổi; bỏ qua form chưa lưu.
6. Đăng nhập lại từ `/m/products`: quay lại đúng `/m/products`.
7. POS tìm đúng giá mới 160.000đ; thử trạng thái tìm khách không khớp rồi chọn khách có sẵn và lưu hóa đơn QA `HD071026-6408`. Tồn giảm 7 → 6, sổ quỹ ghi phiếu thu `PT000001` 160.000đ; nợ cũ 150.000đ vẫn tách khỏi khoản thu hóa đơn mới.

## Kiểm chứng tự động

- `npm --prefix frontend test`: **102 file / 401 test qua**.
- `npm --prefix frontend run build`: TypeScript và Vite production build qua.
- `npm --prefix backend run check`: kiểm tra cú pháp và **186 test qua**, không skip/fail.
- `git diff --check`: qua.
- Test bổ sung bao phủ phân trang/sắp xếp/chi nhánh, giá chung/giá riêng, trả vượt tiền, rollback thiếu quỹ, phiếu tạm và nhận lại; mất dữ liệu nhập khi refetch, tồn không bị ghi đè; sự kiện inventory; chuyển hướng đăng nhập; tải đủ catalog và lỗi trang sau.

Đo giao diện và thao tác trình duyệt dùng CUA theo ràng buộc môi trường; không chạy trình duyệt riêng qua `probe.mjs` của Evon. Đã xem ảnh thực và đo DOM, không coi việc đọc CSS là kiểm thử giao diện.

## Dọn phần thừa

Đã xóa các component không còn được import: `PropagateModal`, `PercentInput`, `MobileProductEditSheet`, `MobileCustomerEditSheet`, `useComingSoon`; xóa test của hai sheet cũ. Xóa CSS/form/danh sách trùng, các nút Import/Export/duyệt giả, ghi chú POS giả và thao tác in/tải/chia sẻ QR 15 giây không hợp lý. Xóa checkbox chọn hàng/phiếu không có luồng xử lý.

Giữ các thư viện camera/QR/bản đồ đang dùng. Giữ tài liệu lịch sử và dữ liệu thật. Chỉ mở theo dõi Git cho hướng dẫn template và biên bản này trong thư mục docs; các tài liệu cá nhân khác tiếp tục được ignore.

## Giới hạn kiểm tra

Bàn phím điện thoại được mô phỏng bằng focus trường nhập và thu viewport, **chưa kiểm chứng trên bàn phím native iOS/Android**. Chưa cấp quyền camera/GPS và chưa thử quét QR trên thiết bị thực. Các màn trống được quan sát theo dữ liệu QA/kỳ lọc hiện tại; test tự động kiểm các trạng thái lỗi và dữ liệu khác. Kết quả là phạm vi kiểm chứng ở trên, không phải bảo đảm mọi tình huống vận hành thực đã được chạy.

---

## Đợt 2 — tiếp tục đại tu (cùng ngày)

Đợt này tự dùng lại toàn bộ app ở khổ điện thoại (375×812, 320×700) với ba vai trò quản lý, thu ngân và nhân viên, mô phỏng bàn phím bằng cách focus ô nhập rồi thu chiều cao viewport xuống 460–480px. Song song, ba lượt rà soát độc lập kiểm logic backend, logic frontend và code thừa; mọi phát hiện đều được đọc lại trong code trước khi sửa, và mỗi lỗi nghiệp vụ có test đi kèm.

### Khung mobile thành template tự điều chỉnh

| Trước | Sau |
| --- | --- |
| Hai danh sách route phải giữ đồng bộ (`FULL_BLEED_PREFIXES`, `SUBPAGE_CONFIG`); tiêu đề trong danh sách đã lệch so với trang thật | Khung đọc header của trang: có `MobilePageHeader` thì ẩn thanh thương hiệu và tràn lề; header có nút quay lại thì là trang con. Không còn danh sách route |
| Trang con vẫn hiện thanh tab: hai nút “+” chồng nhau (FAB + nút giữa), form có hai lớp chrome đáy (footer + thanh tab) | Trang con ẩn thanh tab; FAB, footer và toast tính từ mép màn hình; footer tự chừa vùng home indicator |
| `.m-header` không chừa `safe-area-inset-top` dù app dùng `black-translucent` + `viewport-fit=cover`: khi cài PWA trên iPhone, nút quay lại và tiêu đề nằm dưới tai thỏ | Header chừa vùng an toàn phía trên |
| Thông báo, Lịch của tôi, Lương hiển thị header lọt trong khung có lề; Lương dùng header `position: fixed` với chiều cao đo tay 154px; tab gốc của nhân viên có nút quay lại | Ba trang dùng header phẳng như các trang khác; nút quay lại chỉ hiện khi trang không phải tab của vai trò đó (`useIsTabRoot`) |
| Tab Lịch dịch vụ có FAB cạnh nút “+” của thanh tab | Nút tạo lịch nằm ở header, giống trang Bảng giá |
| Trang “Ca làm của tôi” (`/m/schedule`) không có đường vào; hiện giờ và tên ca giả (“08:30”, “Ca sáng chuẩn”) khi dữ liệu trống | Mở từ nút lịch trên header “Lịch của tôi”; chỉ hiện dữ liệu thật |

### Bàn phím điện thoại

| Màn | Lỗi thấy được | Sửa |
| --- | --- | --- |
| Mọi danh sách có kính lúp (14 màn) | Chạm kính lúp mở ô tìm nhưng không focus: chữ gõ bị mất, trên điện thoại bàn phím không bật, phải chạm thêm lần nữa. Đóng ô tìm vẫn giữ từ khóa và lọc ngầm danh sách | Ô tìm tự focus khi mở; đóng ô thì xóa từ khóa |
| POS | Bàn phím bật thì thanh thương hiệu, ô tìm, chip, hàng lọc nhóm và giỏ hàng dính đáy chiếm gần hết chỗ: chỉ còn ~30px cho kết quả | Khi đang gõ, thanh thương hiệu, hàng lọc nhóm và giỏ hàng tạm ẩn; thấy 4 kết quả ở 375×480 |
| Header danh sách | Header chiếm ~45% vùng còn lại khi gõ | Thanh tóm tắt tạm ẩn khi đang gõ; chip lọc vẫn hiện vì chúng quyết định phạm vi tìm |
| Form hóa đơn, phiếu thu chi, tạo hàng hóa, tạo phiếu nhập, bộ chọn khách | Ô đang gõ tự cuộn vào vùng thấy, ô tiền dùng bàn phím số | Không cần sửa |

### Đồng nhất giao diện

- Hàng đơn hàng: badge trạng thái đè lên số điện thoại; mã và tên bị cắt. Hàng được dựng lại theo khuôn `m-list-row` (tên → mã · giờ → nhân viên · kênh; tiền và trạng thái bên phải). Số điện thoại xem trong chi tiết.
- Thanh tóm tắt: số liệu bị đẩy xuống hàng riêng. Nhãn sắp xếp rút gọn (“Mới nhất”, “Giá bán cao”, “Tên A → Z”), số liệu gọn (“3 đơn · Doanh thu **3.910.000đ**”); hai bên luôn trên một hàng, màn quá hẹp thì ô sắp xếp cắt “…”.
- Phân trang chỉ hiện khi hơn một trang (trước đây hiện cả “Hiển thị 0-0 trên tổng số 0” khi rỗng). Câu “thử từ khóa khác” chỉ hiện khi đang tìm.
- Icon loại hàng có ba bảng màu khác nhau (danh sách, POS, menu tạo). Nay dùng chung: sản phẩm xanh dương, dịch vụ xanh lá, gói tím, thẻ cam, áp cho cả badge desktop. Danh sách POS và menu chọn loại hàng chuyển sang `m-list`.
- Chữ viết tắt avatar: thanh trên cùng lấy 1 chữ (“Q”), trang Nhiều hơn lấy 2 chữ (“HT”). Nay dùng chung `initials()` ở mobile và desktop; avatar nhân viên một tông trên mọi màn.
- Dấu phân cách dòng phụ thống nhất `·`; thứ tự mã → nhóm ở danh mục hóa đơn và lịch hẹn.
- Card Tổng quan bỏ vệt gradient trang trí; “↑ 0%” xanh khi không đổi nay là “0%” trung tính. Thẻ số liệu Sổ quỹ/Báo cáo bỏ viền trái 4 màu, chỉ lợi nhuận dùng xanh/đỏ, thẻ lẻ cuối chiếm đủ hàng. Nút đăng nhập, card lương phẳng; số “Thực lĩnh” bị class desktop ghi màu tối trên nền xanh, nay trắng rõ.
- Trang Tài khoản: tab có icon và nhãn dài bị tràn; nhãn rút gọn (“Cá nhân”, “Chi nhánh”, “Tài khoản & quyền”), bỏ dòng phụ lặp lại tab.
- Chữ trên form: “Thêm khách hàng / Chọn hoặc tạo khách hàng mới” (lịch hẹn) và “Chọn khách hàng / Chạm để tìm…” (hóa đơn) thống nhất; tiêu đề nhóm form dùng `m-section-title`; tiêu đề “Tạo lịch hẹn”, “Sửa lịch hẹn”; giỏ POS dùng icon thay ký tự ▼ và ghi đủ “Hoa hồng dự kiến”.

### Lỗi nghiệp vụ backend đã sửa

| Lỗi | Sửa | Test |
| --- | --- | --- |
| Mã hàng hóa, khách, phiếu nhập, kỳ lương là UNIQUE toàn hệ thống nhưng bộ sinh mã chỉ đếm trong một chi nhánh: chi nhánh thứ hai tạo hàng/khách bị 409, tạo phiếu nhập và mở bảng lương bị 500 | Khóa toàn cục và đếm chung một dãy (theo mẫu mã nhân viên); kỳ lương tháng của chi nhánh thứ hai có hậu tố `-<branchId>` | `auto-codes.integration.test.js`, `staff.payroll-safeguards.integration.test.js` |
| Mỗi lần mở bảng lương, tháng hiện tại được tính lại và ghi đè lương cơ bản/hoa hồng quản lý đã sửa; cột khấu trừ không được cập nhật nên thực lĩnh ≠ thu nhập − khấu trừ; khấu trừ chỉ tăng | Dòng quản lý đã sửa (`payroll_records.adjusted_at`) không bị làm mới tự động; “Tải lại dữ liệu” tính lại toàn bộ (có hỏi xác nhận); khấu trừ lưu đúng giá trị dùng để tính | như trên |
| Chi lương: không kiểm chi nhánh, trả được kỳ nháp/đã hủy, chi vượt số còn lại, không khóa dòng, không kiểm quỹ; chốt lương đưa dòng đã trả về “đã chốt”; hủy được kỳ đã chi | Chỉ chi khi kỳ đã chốt, trong số còn lại và số dư quỹ, có khóa dòng; chốt chỉ áp cho kỳ nháp; kỳ đã có khoản chi không hủy được. Nút “Thanh toán” chỉ hiện khi đã chốt | như trên |
| Checkout chỉ kiểm tổng buổi của gói, không kiểm số buổi từng dịch vụ (gói 2 buổi chăm da dùng được 6 buổi) | Kiểm cả giới hạn từng dịch vụ, cộng dồn các dòng trong cùng hóa đơn; kiểm gói thuộc chi nhánh | `checkout-limits.integration.test.js` |
| Phạm vi thanh toán của thẻ tài khoản (loại hàng, hàng cụ thể) lưu được nhưng checkout bỏ qua | Phân bổ thanh toán thẻ theo từng dòng (`wallet-allocation.js`), khóa dòng thẻ khi trừ; dòng không thẻ nào trả được thì báo rõ tên | `wallet-allocation.test.js`, `checkout-limits.integration.test.js` |
| Hai giao dịch bán cùng lúc có thể làm tồn âm | Trừ tồn bằng `UPDATE … WHERE quantity >= n` | `checkout-limits.integration.test.js` |
| Thu ngân mở được mọi phiếu quỹ qua `GET /vouchers/:id` dù danh sách chỉ cho xem trong ngày | Phiếu ngoài ngày trả 404 với thu ngân | `cashbook.routes.test.js` |
| Form gói/thẻ có ô hoa hồng nhưng checkout không bao giờ trả | Ẩn ô với gói/thẻ, không gửi giá trị | — |
| Thông báo chấm công trỏ tới trang quản lý không mở được; thông báo hóa đơn gửi thu ngân link Đơn hàng không có quyền | Trỏ `/m/staff/attendance`; thu ngân nhận thông báo không kèm link | — |

Một báo cáo rà soát nói các sự kiện realtime `payroll:*`, `staff:*` “không bao giờ phát”. Kiểm lại thì `broadcastToBranch` phát mọi tên sự kiện, frontend hỗ trợ ký tự đại diện và các sự kiện đều phát sau COMMIT, nên không sửa.

### Lỗi logic frontend đã sửa

- Tạo hóa đơn mobile gửi nhân viên của dòng đầu làm nhân viên chung: dòng chưa chọn người bị ghi cho người đó và tính hoa hồng. Nay không gửi nhân viên chung (có test).
- POS gộp buổi trừ gói với dòng trả tiền cùng dịch vụ: bấm thêm dịch vụ đó sẽ trừ hai buổi gói mà không thu tiền. Nay hai loại dòng tách riêng (`posLineKey`, có test).
- Thu ngân không chọn được khách nên không tạo được lịch hẹn/hóa đơn trên mobile (sheet gọi API cần quyền quản lý khách). Sheet dùng API POS như desktop; đã thử tạo `HD071026-1512` bằng tài khoản thu ngân.
- Bỏ các control giả: nút “Xuất bảng lương” chỉ hiện toast tải xong; tab “Lưới thời gian/Lưới nhân viên” không đổi nội dung; ô “Chọn vị trí” (Giường 1, Phòng VIP…) không lưu đi đâu; ô giờ/thời lượng trong Tạo hóa đơn bị bỏ khi chốt; cột checkbox “Chọn” không gắn thao tác ở 5 bảng desktop.
- Bảng lương mobile tải kỳ #1 khi danh sách đang tải/rỗng và hiển thị lỗi như “Chưa có bảng lương”: nay chờ kỳ thật và có trạng thái lỗi/thử lại.
- Link dẫn tới trang vai trò không có quyền (bị đẩy về trang chủ): “Quét mã chấm công” cho quản lý, “Xem hóa đơn” cho thu ngân/nhân viên; nhấn thông báo cũ cũng được chặn theo quyền. Lọc nhân viên ở Lịch dịch vụ dùng API POS nên thu ngân/nhân viên có danh sách.
- Ngày hoa hồng mobile hiện chuỗi UTC lệch một ngày; backend trả `occurred_on` dạng `YYYY-MM-DD`. Ngày trong chi tiết lịch hẹn lấy theo múi giờ chi nhánh.
- Sheet danh mục ở Tạo hóa đơn/Tạo lịch hiện “Không tìm thấy” lúc đang tải hoặc lỗi; nay có trạng thái tải/lỗi.
- Sổ quỹ: nút nhanh “Lập phiếu thu chi” không mở khi đang ở Sổ quỹ; danh sách dừng ở 100 phiếu. Nay mở theo URL và tải thêm theo trang không giới hạn.
- Màn QR chấm công gọi API mỗi giây; nay chỉ gọi khi mã sắp hết hạn (salon dùng chung một IP với giới hạn 300 request/phút).

### Dọn phần thừa

- Frontend: 7 export không dùng, `export default` thừa ở 19 trang, khoảng 300 dòng CSS chết (bộ “Mobile Form Sheet” cũ, class picker vị trí, selector checkbox, keyframes, alias token `--color-*`, biến `--mobile-layer-*`), 58 comment mồ côi.
- Backend: `assignShiftSchedule`, `getPayroll`, `scheduleExists`, `calculateShiftDurationHours`, `updateSchedule` và route `PUT /staff/schedule/:id` (không còn nơi gọi), `createAppointment` và hai route trùng `POST/GET /dashboard/appointments`, import thừa; test của các hàm đã xóa.

### Kiểm chứng

- `npm --prefix frontend test`: **102 file / 399 test qua**. `npm --prefix frontend run build` qua.
- `npm --prefix backend run check`: **192 test qua**, không skip/fail.
- `git diff --check` qua.
- Môi trường QA `anna_ui_audit` (volume riêng, không đụng `./data`) được dựng lại với backend mới; migration `adjusted_at` áp thành công, dữ liệu giữ nguyên. Đã chạy trên app: các màn mobile ở 375px và 320px; tìm kiếm + bàn phím ở Khách hàng, POS, bộ chọn khách, Tạo hóa đơn, Phiếu thu chi, Tạo hàng hóa, Tạo phiếu nhập; thu ngân chọn khách và chốt hóa đơn tiền mặt (DB: dòng không gán nhân viên, không hoa hồng, phiếu thu `PT000001` 10.000đ); nhân viên vào Chấm công, Lịch của tôi, Ca làm, Lương.

### Giới hạn còn lại

- Bàn phím vẫn mô phỏng bằng thu viewport, chưa kiểm trên bàn phím native iOS/Android; camera/GPS chưa thử trên máy thật.
- Ở khổ giả lập 320px, khung trình duyệt báo `innerWidth` 324 cho mọi trang; ở 375px không tràn. Cần xác nhận lại trên máy 320px thật.
- Tab “Chi tiết giao dịch” của Bảng hoa hồng vẫn giới hạn 100 dòng ở backend (tổng theo nhân viên đúng); cần phân trang nếu một kỳ có hơn 100 giao dịch.
- Sổ quỹ/Báo cáo dùng dải chip kỳ (một chạm đổi kỳ), Đơn hàng/Nhập hàng dùng chip “Khoảng ngày” mở bộ lọc, Bảng hoa hồng dùng hai ô ngày tùy chọn. Giữ nguyên vì mức độ dùng khác nhau; chưa gộp thành một kiểu.
- Desktop chỉ được soát lại ở các phần liên quan (bảng lương, form hàng hóa, cột checkbox); chưa đi lại toàn bộ desktop như mobile.
- Kỳ lương đã trả từ trước đợt này mà kỳ còn ở trạng thái nháp vẫn giữ nguyên dữ liệu; quy tắc mới chỉ áp cho thao tác từ nay.
