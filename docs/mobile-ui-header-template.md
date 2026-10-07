# Mobile UI: header, trang và sheet

Tài liệu này mô tả cách dựng trang mobile (`/m/*`) bằng template chung của AnnaChill. Mọi thành phần dưới đây đã có sẵn, nên không tự dựng header, nút, sheet hay trạng thái dữ liệu cho từng module.

- Chuẩn hình thức theo Evon: giữ màu xanh và font hệ thống hiện tại, control bo 12px, cao 40px desktop/44px mobile, ô nhập mobile 16px, card không bóng, scrollbar 4px. Nút và link vẫn có focus rõ theo yêu cầu accessibility của dự án.
- Class chuẩn nằm trong `frontend/src/styles/ui/` (`page.css` cho `m-*`, `modal.css` cho `sheet-*`).
- Xem mẫu sống ở `/ui-kit/mobile` khi chạy `npm run dev`. Trang này chỉ có trong bản DEV.
- Mật độ cảm ứng tự áp dụng trong `.mobile-app-shell` và `.sheet`: control cao 44px, chip 40px, lề trang 16px. Màu, bo góc và typography giống desktop.

## 1. Các loại trang

| Loại | Dùng cho | Khung |
| --- | --- | --- |
| M1 · Tab gốc có thanh thương hiệu | Tổng quan, Nhiều hơn, POS, Chấm công | `MobileTopBar` của layout (logo, chi nhánh, avatar) |
| M1' · Tab gốc làm việc | Lịch dịch vụ, Thông báo, Lịch của tôi, Lương (nhân viên), Tài khoản (thu ngân) | `MobilePageHeader` **không** nút quay lại; nút tạo của trang đặt ở header (`MobileHeaderAction tone="soft"`), không dùng FAB vì thanh tab đã có “+” |
| M2 · Danh sách | Hàng hóa, Khách hàng, Đơn hàng, Nhập hàng, Bảng giá, Nhân viên… | `MobilePageHeader` có nút quay lại + thanh tìm kiếm + dải chip → danh sách → `.m-fab` |
| M3 · Form toàn màn hình | Tạo lịch hẹn, Tạo hóa đơn, Tạo phiếu nhập | `MobilePageHeader` có nút quay lại → các card form → `.m-footer` dính đáy |
| M4 · Chi tiết, bộ lọc, chọn | Hồ sơ, phiếu lương, bộ lọc, chọn khách | `BottomSheet` (hoặc `MobileDetailSheet`, `MobileFilterSheet` dựng trên nó) |

Khung tự điều chỉnh theo header của trang, không có danh sách route nào phải khai báo (`styles/mobile.css`):

- Trang có `MobilePageHeader` (`.m-header`): thanh thương hiệu ẩn, nội dung tràn lề, header tự chừa vùng tai thỏ (`safe-area-inset-top`, app dùng `black-translucent`).
- Header có nút quay lại (`.m-header-back`) là trang con: thanh tab ẩn, FAB/footer/toast tính từ mép màn hình, footer tự chừa vùng home indicator.
- Trang vừa là tab của vai trò này vừa là trang con của vai trò khác (Lịch của tôi, Tài khoản) dùng `useIsTabRoot()` (`MobileBottomNav.tsx`) để chỉ hiện nút quay lại khi không phải tab.

Layout tự cuộn về đầu khi đổi route.

## 2. Trang danh sách (M2)

```tsx
import { MobileHeaderAction, MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { LoadingState, ErrorState } from '@/components/data-display/DataState';
import { MobileEmptyState, MobileSearchBar } from '@/features/mobile-common';

<div className="m-page">
  <MobilePageHeader
    title="Khách hàng"
    backTo="/m/more"
    actions={<MobileHeaderAction icon="ph ph-magnifying-glass" label="Tìm kiếm" active={isSearchVisible} onClick={() => { if (isSearchVisible) setSearch(''); setIsSearchVisible(!isSearchVisible); }} />}
  >
    {isSearchVisible && <MobileSearchBar value={search} placeholder="Tìm tên, SĐT…" onChange={setSearch} autoFocus />}
    <div className="m-chip-strip">
      <button type="button" className="chip chip-icon" aria-label="Bộ lọc" onClick={openFilter}><i className="ph ph-faders" /></button>
      <button type="button" className="chip" aria-pressed={Boolean(group)} onClick={openFilter}>{group || 'Tất cả nhóm'} <i className="ph ph-caret-down" /></button>
    </div>
  </MobilePageHeader>

  <div className="m-body">
    {query.isPending ? <LoadingState compact />
      : query.error ? <ErrorState compact error={query.error} onRetry={() => query.refetch()} />
      : !rows.length ? <MobileEmptyState title="Chưa có khách hàng" />
      : <div className="m-list">{rows.map((row) => <button key={row.id} type="button" className="m-list-row" onClick={() => openDetail(row.id)}><span className="m-list-copy"><strong>{row.name}</strong><small>{row.code}</small></span><span className="m-list-value">{formatMoney(row.amount)}</span></button>)}</div>}
  </div>

  <button type="button" className="m-fab" aria-label="Thêm khách hàng" onClick={openCreate}><i className="ph ph-plus" /></button>
</div>
```

- `MobilePageHeader` sticky khi sử dụng bình thường; vùng bàn phím dưới 400px cho phép header cuộn đi để dành chỗ nhập liệu. `children` là các hàng phụ dưới tiêu đề: ô tìm kiếm, dải chip, `.tabs`, thanh tóm tắt. `.m-header-extra` đã có lề 16px và khoảng cách giữa các hàng, nên các hàng này không tự thêm padding ngang, viền hay nền.
- `MobileHeaderAction` là nút icon 44px; `badge` hiện chấm đếm, `active` tô trạng thái bật.
- Chip lọc dùng `.chip` với `aria-pressed`; nhóm chip trong sheet bọc bằng `.chip-group`.
- Chip mở menu chọn dùng `<Select variant="pill" … />` (truyền `triggerClassName="is-active"` khi đang lọc). Muốn đặt icon trước chữ, bọc trong `.chip` và dùng `variant="ghost"`.
- Thanh tóm tắt dưới dải chip: `.m-summary-bar` chứa bên trái `MobileSortDropdown` hoặc `.m-summary-title` (nhãn kỳ, ngày), bên phải `.m-summary-count` (số lượng · tổng, `<strong>` cho con số). Hai bên luôn trên **một hàng**: số liệu không xuống dòng, ô sắp xếp tự cắt “…” khi màn quá hẹp. Vì vậy nhãn sắp xếp ngắn (“Mới nhất”, “Giá bán cao”, “Tên A → Z”) và số liệu gọn (“3 đơn · Doanh thu **3.900.000đ**”). Không lặp lại nhãn đã hiện ở control ngay phía trên.
- Ô tìm kiếm mở bằng nút kính lúp: `MobileSearchBar` có `autoFocus` (một chạm là bàn phím bật) và đóng ô thì xóa từ khóa, để danh sách không lọc ngầm.
- Phân trang (`Pagination`) chỉ hiện khi có hơn một trang. Câu gợi ý “Thử từ khóa khác hoặc đổi bộ lọc.” chỉ hiện khi đang tìm kiếm.
- Dòng phụ trong danh sách dùng dấu `·` và thứ tự mã → nhóm (`SP000158 · Thẻ dịch vụ`). Màu icon loại hàng dùng chung `m-list-avatar is-<loại>`: sản phẩm xanh dương, dịch vụ xanh lá, gói tím, thẻ cam (desktop `GoodsTypeBadge` cùng bảng màu).

```tsx
<div className="m-summary-bar">
  <MobileSortDropdown value={sort} options={sortOptions} onChange={setSort} />
  <span className="m-summary-count">{rows.length} khách hàng · Nợ: <strong>{formatMoney(debt)}</strong></span>
</div>
```
- Trạng thái dữ liệu luôn dùng `LoadingState` / `ErrorState` với `compact`, và `MobileEmptyState`. Không tự viết khối "Đang tải…".

## 3. Form toàn màn hình (M3)

```tsx
<div className="m-page">
  <MobilePageHeader title="Tạo lịch hẹn" onBack={() => navigate(-1)}
    actions={<MobileHeaderAction icon="ph ph-note" label="Ghi chú" active={Boolean(note)} onClick={openNote} />} />

  <div className="m-body">
    <section className="card card-body">
      <div className="m-section">
        <div className="m-section-head">
          <span className="m-section-title">Chiết khấu</span>
          <div className="segmented"><button type="button" aria-pressed>VNĐ</button><button type="button" aria-pressed={false}>%</button></div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="discount">Giảm giá</label>
          <MoneyInput id="discount" suffix="đ" value={discount} onChange={setDiscount} />
        </div>
      </div>
    </section>
  </div>

  <footer className="m-footer">
    <button type="submit" className="btn btn-primary btn-lg btn-block">Lưu lịch hẹn</button>
  </footer>
</div>
```

- Field dùng `.field` + `.field-label` + `.input` / `.textarea` / `Select` / `MoneyInput`; ô 44px trên mobile và chữ 16px để iOS không tự phóng to.
- `.m-footer` dính trên thanh điều hướng đáy, đã tính vùng an toàn. FAB tự nhích lên khi có footer.
- Ghi chú ngắn trong danh sách rỗng dùng `.m-note`.

## 4. Sheet (M4)

```tsx
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';

<BottomSheet
  open={open}
  onClose={close}
  title="Chọn khách hàng"
  headerExtra={<div className="sheet-toolbar"><MobileSearchBar … /></div>}
  footer={<><button className="btn btn-secondary" type="button" onClick={close}>Hủy</button><button className="btn btn-primary" type="button" onClick={save}>Lưu</button></>}
>
  …
</BottomSheet>
```

- `BottomSheet` lo Escape, giữ focus, khóa cuộn nền và nút đóng. Không tự dựng backdrop.
- Nút trong `footer` truyền trực tiếp (không bọc `div`) để `.sheet-footer > .btn` chia đều bề ngang.
- `height="full"` cho sheet dài (danh mục, giỏ hàng); `tone="muted"` cho sheet chi tiết có các card trắng trên nền canvas.
- Sheet chồng sheet dùng `nested`.
- Ô tìm khách dùng `MobileSearchBar`; `autoFocus` khi mở bộ chọn, `ariaLabel` cho nhãn đầy đủ nếu placeholder cần ngắn. Nút xóa giữ focus; nút Hủy dùng `.btn`, kết quả dùng `.m-list-row` và hiển thị cả tên/SĐT.
- POS tiếp tục gọi `searchPosCustomers` theo quyền bán hàng. `MobileCustomerSelectSheet` dùng API khách hàng cho lịch hẹn/hóa đơn; không đổi API giữa hai luồng chỉ để dùng chung hình thức.

## 5. Quy tắc chung

- Không dùng màu hex hay inline style trang trí; contract test `src/styles/styles.contract.test.ts` sẽ báo lỗi. Màu nhấn dùng `.text-primary`, `.text-success`, `.text-danger`, `.text-warning`, `.text-muted`, `.text-strong`.
- Trạng thái lịch hẹn lấy màu từ token `--appt-*` (chờ xác nhận, chưa tới, đang chờ, đang làm, đã xong, đã hủy, không đến), dùng chung cho POS và mobile. Trạng thái bảng lương, đơn hàng… dùng `StatusBadge` như desktop để nhãn và màu khớp nhau.
- Ngày hiển thị dạng `dd/mm/yyyy` (hoặc `dd/mm`) qua `formatDateOnly`; không in chuỗi ISO `2026-09-25` ra giao diện.
- Icon chỉ dùng nét regular (`ph ph-…`); `ph-fill`, `ph-bold`… không được nạp và hiện ô trống.
- CSS riêng của module đặt trong file CSS của module, tên có tiền tố module, và chỉ chứa bố cục riêng. Tên chuẩn (`.btn`, `.card`, `.chip`, `.sheet*`, `.m-*`…) chỉ được định nghĩa trong `styles/ui/`.

## 6. Danh sách và nghiệp vụ hàng hóa

Dùng `.m-list` → `.m-list-row` → `.m-list-avatar` / `.m-list-copy` / `.m-list-value` cho hàng hóa, bảng giá, khách hàng, gói/thẻ, đơn hàng, nhập hàng. Tên dài được xuống dòng. Row không có hành động con dùng `<button type="button">`; row có liên kết gọi điện dùng `role="button"`, `tabIndex={0}` và chỉ xử lý Enter/Space nếu `event.target === event.currentTarget`.

Giữ nguyên thứ tự API trả về, không gom lại theo loại/nhóm/ngày sau khi sắp xếp. API sắp xếp trước LIMIT/OFFSET; tổng lấy từ `meta.pagination`/`meta.summary`. Khi lỗi mạng dùng ErrorState và thử lại, không hiển thị danh sách rỗng như dữ liệu thật.

- `getInventoryCatalog`: tải đủ các trang cho bộ chọn dịch vụ trong gói và phạm vi thẻ; tìm theo tên/mã không làm mất các lựa chọn đã chọn.
- `GoodsCreateDialog`: một form tạo/sửa cho desktop/mobile, đủ bốn loại hàng. Refetch không xóa nội dung đang nhập. Sửa thông tin không gửi lại tồn kho nếu người dùng không thay đổi trường tồn.
- `InventoryItemDetails`: một chi tiết dùng dữ liệu lưu thật; sản phẩm có tồn, dịch vụ có thời lượng, gói/thẻ có thời hạn và phạm vi phù hợp.
- `PricebookDialog`: một form bảng giá cho hai giao diện. Đổi giá trên điện thoại cần bấm Lưu giá. Bảng giá chung và giá gốc hàng hóa cập nhật trong cùng transaction; bảng giá riêng không thay giá gốc.
- `usePurchaseOrderForm`: dùng chung phép tính/kiểm tra phiếu nhập. Phiếu tạm ghi ý định; nhận hàng mới cộng kho và ghi chi. API hoàn tất phiếu có khóa hàng để bấm lại không ghi hai lần. Không cho trả vượt giá trị phiếu hoặc vượt quỹ.
- `inventory:updated`: cập nhật các cache danh mục, bảng giá, POS, nhập hàng trên những phiên đang mở; kết nối lại cũng đọc lại dữ liệu.

`useVisualViewport` và `styles/keyboard.css` xử lý vùng màn hình bị bàn phím chiếm: ẩn bottom nav/FAB, đưa field vào vùng nhìn thấy và cho form/footer cuộn khi màn hình thấp. Khi đang gõ trong header danh sách, thanh tóm tắt tạm ẩn; ở POS, thanh thương hiệu, hàng lọc nhóm và giỏ hàng dính đáy tạm ẩn để kết quả tìm kiếm có chỗ. Dải chip lọc vẫn hiện vì nó quyết định phạm vi tìm. Kiểm tra tối thiểu 320px/390px, focus ô cuối form rồi thu viewport xuống 460–480px (bàn phím iPhone); kiểm tra riêng thiết bị Safari/Chrome thực khi phát hành.
