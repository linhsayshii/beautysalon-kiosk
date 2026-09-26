import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { MobileHeaderAction, MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { Modal } from '@/components/ui/Modal/Modal';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { DetailFacts, DetailHead, InlineDetail, ValueStrip } from '@/components/data-display/InlineDetail';
import { MobileCard, MobileFilterSheet, MobileSearchBar } from '@/features/mobile-common';

/*
 * Development-only reference of the unified UI template (styles/ui/*).
 * /ui-kit shows the desktop primitives, /ui-kit/mobile renders inside the
 * mobile shell so touch density applies. Not registered in production builds.
 */

const sampleError = new Error('Máy chủ không phản hồi. Vui lòng thử lại.');
// Layout for the kit itself only; kept inline so no kit CSS ships with the app.
const stack = { display: 'grid', gap: 14 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <header className="card-header"><h2 className="card-title">{title}</h2></header>
      <div className="card-body" style={stack}>{children}</div>
    </section>
  );
}

function DesktopKit() {
  const [modal, setModal] = useState<'sm' | 'lg' | null>(null);
  const [tab, setTab] = useState('list');
  const [mode, setMode] = useState('week');
  const [detailTab, setDetailTab] = useState<'items' | 'info'>('items');
  return (
    <main className="page">
      <div className="page-stack">
        <PageHeader
          title="UI kit — Desktop"
          subtitle="Mọi thành phần chuẩn của template AnnaChill"
          extraActions={<button className="btn btn-secondary" type="button"><i className="ph ph-export" />Xuất file</button>}
          actionLabel="Thêm mới"
          onAction={() => setModal('lg')}
        />

        <div className="summary-strip">
          <div className="summary-tile"><span>Doanh thu</span><strong>12.450.000đ</strong><small>Tháng này</small></div>
          <div className="summary-tile green"><span>Đã thu</span><strong>10.200.000đ</strong><small>82%</small></div>
          <div className="summary-tile orange"><span>Công nợ</span><strong>2.250.000đ</strong><small>5 khách</small></div>
          <div className="summary-tile violet"><span>Lịch hẹn</span><strong>36</strong><small>Tuần này</small></div>
        </div>

        <Section title="Nút">
          <div className="btn-group">
            <button className="btn btn-primary" type="button"><i className="ph ph-plus" />Chính</button>
            <button className="btn btn-secondary" type="button">Phụ</button>
            <button className="btn btn-soft" type="button">Nhẹ</button>
            <button className="btn btn-ghost" type="button">Ghost</button>
            <button className="btn btn-danger" type="button">Xóa</button>
            <button className="btn btn-danger-soft" type="button">Hủy phiếu</button>
            <button className="btn btn-success" type="button">Thu tiền</button>
            <button className="btn btn-link" type="button">Liên kết</button>
            <button className="btn btn-primary" type="button" disabled>Vô hiệu</button>
          </div>
          <div className="btn-group">
            <button className="btn btn-primary btn-sm" type="button">Nhỏ</button>
            <button className="btn btn-primary" type="button">Mặc định</button>
            <button className="btn btn-primary btn-lg" type="button">Lớn</button>
            <button className="btn btn-secondary btn-icon" type="button" aria-label="Lọc"><i className="ph ph-faders" /></button>
            <button className="btn btn-ghost btn-icon" type="button" aria-label="Thêm"><i className="ph ph-dots-three" /></button>
          </div>
        </Section>

        <Section title="Trường nhập">
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="kit-name">Tên khách hàng <span className="field-required">*</span></label>
              <input className="input" id="kit-name" placeholder="Nguyễn Thị Lan" />
              <p className="field-hint">Hiển thị trên hóa đơn.</p>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="kit-phone">Số điện thoại</label>
              <input className="input" id="kit-phone" defaultValue="09123" aria-invalid="true" />
              <p className="field-error">Số điện thoại chưa đúng định dạng.</p>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="kit-group">Nhóm</label>
              <select className="input" id="kit-group"><option>Khách thân thiết</option><option>Khách mới</option></select>
            </div>
            <div className="field">
              <span className="field-label">Tìm kiếm</span>
              <label className="input-group"><i className="ph ph-magnifying-glass" /><input placeholder="Mã, tên, số điện thoại" /></label>
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="kit-note">Ghi chú</label>
            <textarea className="textarea" id="kit-note" placeholder="Ghi chú nội bộ" />
          </div>
          <label className="check"><input type="checkbox" defaultChecked />Gửi tin nhắn xác nhận</label>
        </Section>

        <Section title="Badge, chip, tab">
          <div className="btn-group">
            <span className="badge badge-success">Đã thanh toán</span>
            <span className="badge badge-info">Chờ xác nhận</span>
            <span className="badge badge-warning">Trả một phần</span>
            <span className="badge badge-danger">Đã hủy</span>
            <span className="badge badge-violet">Hoàn thành</span>
            <span className="badge badge-neutral">Nháp</span>
            <span className="status-badge paid">status-badge paid</span>
          </div>
          <div className="btn-group">
            <button className="chip chip-icon" type="button" aria-label="Bộ lọc"><i className="ph ph-faders" /></button>
            <button className="chip is-active" type="button">Tháng này <i className="ph ph-caret-down" /></button>
            <button className="chip" type="button">Tất cả nhân viên <i className="ph ph-caret-down" /></button>
          </div>
          <div className="tabs" role="tablist">
            {['list', 'timeline', 'staff'].map((key) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={`tab${tab === key ? ' is-active' : ''}`} onClick={() => setTab(key)}>
                {key === 'list' ? 'Danh sách' : key === 'timeline' ? 'Lưới thời gian' : 'Lưới nhân viên'}
              </button>
            ))}
          </div>
          <div className="segmented">
            {['day', 'week', 'month'].map((key) => (
              <button key={key} type="button" className={mode === key ? 'is-active' : ''} onClick={() => setMode(key)}>
                {key === 'day' ? 'Ngày' : key === 'week' ? 'Tuần' : 'Tháng'}
              </button>
            ))}
          </div>
        </Section>

        <section className="data-panel">
          <div className="data-toolbar">
            <label className="search-control"><i className="ph ph-magnifying-glass" /><input placeholder="Tìm theo mã hoặc tên" /></label>
            <div className="table-actions">
              <button className="btn btn-secondary btn-icon" type="button" aria-label="Làm mới"><i className="ph ph-arrows-clockwise" /></button>
              <button className="btn btn-primary" type="button"><i className="ph ph-plus" />Thêm hàng</button>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Mã</th><th>Tên hàng</th><th>Nhóm</th><th>Giá bán</th><th>Trạng thái</th></tr></thead>
              <tbody>
                <tr><td data-label="Mã">SP0001</td><td data-label="Tên"><span className="cell-main">Gội đầu dưỡng sinh</span><span className="cell-sub">60 phút</span></td><td data-label="Nhóm">Dịch vụ</td><td data-label="Giá" className="money-cell">250.000đ</td><td data-label="Trạng thái"><span className="badge badge-success">Đang bán</span></td></tr>
                <tr><td data-label="Mã">SP0002</td><td data-label="Tên"><span className="cell-main">Sơn gel</span><span className="cell-sub">45 phút</span></td><td data-label="Nhóm">Nail</td><td data-label="Giá" className="money-cell">180.000đ</td><td data-label="Trạng thái"><span className="badge badge-neutral">Ngừng bán</span></td></tr>
              </tbody>
            </table>
          </div>
          <footer className="table-footer"><span>Hiển thị 2 / 2 hàng hóa</span><div className="pagination"><button type="button" disabled>‹</button><strong>1</strong><button type="button" disabled>›</button></div></footer>
        </section>

        <div style={grid}>
          <section className="card">
            <header className="card-header"><div><h2 className="card-title">Chi tiết hóa đơn</h2><p className="card-subtitle">HD000123 · 25/09/2026</p></div><span className="badge badge-success">Đã thanh toán</span></header>
            <div className="card-body">
              <div className="detail-list">
                <div className="detail-row"><span>Khách hàng</span><strong>Nguyễn Thị Lan</strong></div>
                <div className="detail-row"><span>Tổng tiền</span><strong>1.800.000đ</strong></div>
                <div className="detail-row"><span>Nhân viên</span><strong>Hằng</strong></div>
              </div>
            </div>
            <footer className="card-footer"><button className="btn btn-secondary" type="button">In</button><button className="btn btn-primary" type="button">Mở hóa đơn</button></footer>
          </section>
          <section className="card"><LoadingState /></section>
          <section className="card"><EmptyState action={<button className="btn btn-primary" type="button">Thêm mới</button>} /></section>
          <section className="card"><ErrorState error={sampleError} onRetry={() => undefined} /></section>
        </div>

        <Section title="Form: field-row, switch, form-section, alert">
          <div className="alert alert-danger" role="alert"><i className="ph ph-warning-circle" /><div><strong>Không thể lưu</strong><small>Số điện thoại đã tồn tại.</small></div></div>
          <div className="alert"><i className="ph ph-info" /><div>Ca hiện tại: <strong>Ca sáng</strong></div></div>
          <div className="field-row"><label className="field-label" htmlFor="k-shift">Tên ca</label><div className="field-row-control"><input className="input" id="k-shift" placeholder="VD: Ca sáng" /></div></div>
          <div className="field-row"><span className="field-label">Giờ làm việc <i className="ph ph-info" /></span><div className="field-row-control"><input className="input" defaultValue="08:00" aria-label="Từ" /><span className="field-hint">Đến</span><input className="input" defaultValue="17:00" aria-label="Đến" /></div></div>
          <div className="field"><label className="field-label" htmlFor="k-salary">Mức lương</label><div className="input-suffix"><input id="k-salary" defaultValue="7.000.000" /><span>đ</span></div></div>
          <section className="form-section">
            <div className="form-section-head">
              <div><h3 className="form-section-title">Phụ cấp</h3><p className="form-section-text">Ăn trưa, đi lại, điện thoại…</p></div>
              <label className="switch"><input type="checkbox" role="switch" aria-label="Áp dụng phụ cấp" defaultChecked /><span className="switch-track" aria-hidden="true" /></label>
            </div>
          </section>
          <section className="form-section is-card">
            <div className="form-section-head"><div><h3 className="form-section-title">Tồn kho</h3><p className="form-section-text">.form-section.is-card</p></div></div>
            <div className="form-grid form-grid-3">
              <div className="field"><label className="field-label" htmlFor="k-stock">Tồn</label><input className="input" id="k-stock" defaultValue="12" /></div>
              <div className="field"><label className="field-label" htmlFor="k-min">Tối thiểu</label><input className="input" id="k-min" defaultValue="2" /></div>
              <div className="field"><label className="field-label" htmlFor="k-max">Tối đa</label><input className="input" id="k-max" /></div>
            </div>
          </section>
          <div className="chip-group">
            <button className="chip" type="button" aria-pressed>Tất cả</button>
            <button className="chip" type="button" aria-pressed={false}>Đang làm việc</button>
            <button className="btn btn-secondary btn-sm" type="button" aria-pressed>Tuần này (btn aria-pressed)</button>
          </div>
          <p>
            <span className="text-primary">text-primary</span> · <span className="text-success">text-success</span> · <span className="text-danger">text-danger</span> · <span className="text-warning">text-warning</span> · <span className="text-muted">text-muted</span> · <span className="text-strong">text-strong</span>
          </p>
        </Section>

        <table className="data-table">
          <tbody>
            <tr className="expandable-data-row is-expanded"><td data-label="Mã"><span className="cell-main link">HD000123</span></td><td data-label="Khách">Nguyễn Thị Lan</td><td data-label="Tổng" className="money-cell">1.800.000đ</td></tr>
            <tr className="expandable-detail-row">
              <td colSpan={3}>
                <InlineDetail label="Chi tiết hóa đơn HD000123" tabs={[{ value: 'items', label: 'Hàng hóa' }, { value: 'info', label: 'Thông tin' }]} tab={detailTab} onTabChange={setDetailTab}>
                  <DetailHead
                    icon="ph-receipt"
                    title="HD000123"
                    tags={<span className="badge badge-info">Tại salon</span>}
                    meta={<>Khách hàng: <strong>Nguyễn Thị Lan</strong></>}
                    aside={<><div><strong>Chi nhánh Quận 1</strong></div><div>25/09/2026 10:30</div></>}
                  />
                  <ValueStrip items={[
                    { label: 'Tổng tiền hàng', value: '2.000.000đ' },
                    { label: 'Giảm giá', value: '200.000đ', tone: 'danger' },
                    { label: 'Tổng thanh toán', value: '1.800.000đ', tone: 'primary' },
                    { label: 'Đã thanh toán', value: '1.800.000đ', tone: 'success' },
                  ]} />
                  {detailTab === 'items' ? (
                    <div className="table-scroll">
                      <table className="detail-table">
                        <thead><tr><th>Mã hàng</th><th>Tên</th><th className="is-num">SL</th><th className="is-num">Thành tiền</th></tr></thead>
                        <tbody><tr><td className="is-code">DV001</td><td className="text-strong">Gội đầu dưỡng sinh</td><td className="is-num">1</td><td className="is-num text-strong">250.000đ</td></tr></tbody>
                      </table>
                    </div>
                  ) : (
                    <DetailFacts items={[
                      { label: 'Nhân viên', value: 'Hằng' },
                      { label: 'Kênh bán', value: 'Tại salon' },
                      { label: 'Trạng thái', value: <span className="badge badge-success">Đã thanh toán</span> },
                      { label: 'Ghi chú', value: 'Ghi chú...', variant: 'placeholder' },
                    ]} />
                  )}
                  <div className="detail-actions"><button className="btn btn-secondary btn-sm" type="button">In</button><button className="btn btn-primary btn-sm" type="button">Mở hóa đơn</button></div>
                </InlineDetail>
              </td>
            </tr>
          </tbody>
        </table>

        <Section title="Overlay">
          <div className="btn-group">
            <button className="btn btn-secondary" type="button" onClick={() => setModal('sm')}>Modal nhỏ</button>
            <button className="btn btn-secondary" type="button" onClick={() => setModal('lg')}>Modal lớn có form</button>
          </div>
        </Section>
      </div>

      <Modal open={modal === 'sm'} onClose={() => setModal(null)} title="Xóa lịch làm việc" size="sm">
        <div className="modal-body"><p className="modal-description">Bạn có chắc muốn xóa lịch tuần này? Thao tác không thể hoàn tác.</p></div>
        <footer className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={() => setModal(null)}>Hủy</button>
          <button className="btn btn-danger" type="button" onClick={() => setModal(null)}>Xóa lịch</button>
        </footer>
      </Modal>
      <Modal
        open={modal === 'lg'}
        onClose={() => setModal(null)}
        title="Thêm khách hàng"
        subtitle="Thông tin sẽ được đồng bộ cho mọi chi nhánh"
        size="lg"
        headerExtra={<div className="tabs" role="tablist"><button type="button" role="tab" aria-selected className="tab is-active">Thông tin</button><button type="button" role="tab" aria-selected={false} className="tab">Địa chỉ</button></div>}
      >
        <form onSubmit={(event) => { event.preventDefault(); setModal(null); }}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field"><label className="field-label" htmlFor="m-name">Tên khách</label><input className="input" id="m-name" /></div>
              <div className="field"><label className="field-label" htmlFor="m-phone">Số điện thoại</label><input className="input" id="m-phone" /></div>
            </div>
            <div className="field"><label className="field-label" htmlFor="m-note">Ghi chú</label><textarea className="textarea" id="m-note" /></div>
          </div>
          <footer className="modal-footer">
            <button className="btn btn-secondary" type="button" onClick={() => setModal(null)}>Bỏ qua</button>
            <button className="btn btn-primary" type="submit">Lưu khách hàng</button>
          </footer>
        </form>
      </Modal>
    </main>
  );
}

function MobileKit() {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(true);
  const [sheet, setSheet] = useState<'detail' | 'filter' | null>(null);
  return (
    <div className="mobile-app-shell">
      <main className="mobile-main-content is-full-bleed">
        <div className="m-page">
          <MobilePageHeader
            title="Hàng hóa"
            subtitle="UI kit — Mobile"
            backTo="/ui-kit"
            actions={(
              <>
                <MobileHeaderAction icon="ph ph-magnifying-glass" label="Tìm kiếm" active={showSearch} onClick={() => setShowSearch((value) => !value)} />
                <MobileHeaderAction icon="ph ph-plus" label="Thêm hàng" tone="soft" onClick={() => setSheet('detail')} />
              </>
            )}
          >
            {showSearch && <MobileSearchBar value={search} onChange={setSearch} placeholder="Tìm theo tên, mã hàng..." />}
            <div className="m-chip-strip">
              <button className="chip chip-icon" type="button" aria-label="Bộ lọc" onClick={() => setSheet('filter')}><i className="ph ph-faders" /></button>
              <button className="chip is-active" type="button">Dịch vụ <i className="ph ph-caret-down" /></button>
              <button className="chip" type="button">Tồn kho <i className="ph ph-caret-down" /></button>
              <button className="chip" type="button">Tất cả nhóm <i className="ph ph-caret-down" /></button>
            </div>
            <div className="m-summary-bar"><span>Sắp xếp: Mới nhất</span><span className="m-summary-count">128 hàng hóa</span></div>
          </MobilePageHeader>

          <div className="m-body">
            <section className="m-section">
              <h2 className="m-section-title">Dịch vụ tóc</h2>
              <MobileCard title="Gội đầu dưỡng sinh" subtitle="SP0001 · 60 phút" badge={{ text: 'Đang bán', tone: 'green' }} onClick={() => setSheet('detail')} />
              <MobileCard title="Nhuộm phủ bạc" subtitle="SP0002 · 90 phút" badge={{ text: 'Tạm ngưng', tone: 'orange' }} />
            </section>
            <section className="card card-body" style={stack}>
              <div className="field"><label className="field-label" htmlFor="mk-name">Tên khách</label><input className="input" id="mk-name" placeholder="Nguyễn Thị Lan" /></div>
              <div className="tabs" role="tablist"><button type="button" role="tab" aria-selected className="tab is-active">Thông tin</button><button type="button" role="tab" aria-selected={false} className="tab">Bảo mật</button></div>
              <div className="segmented segmented-block"><button type="button" className="is-active">Tuần</button><button type="button">Tháng</button></div>
              <div className="btn-group"><span className="badge badge-success">Đã thu</span><span className="badge badge-warning">Còn nợ</span><span className="badge badge-danger">Đã hủy</span></div>
              <button className="btn btn-primary btn-block" type="button">Nút chính full width</button>
              <button className="btn btn-secondary btn-block" type="button">Nút phụ</button>
            </section>
            <section className="card"><EmptyState compact title="Chưa có lịch hẹn" message="Tạo lịch hẹn đầu tiên cho hôm nay." /></section>
            <section className="card"><ErrorState compact error={sampleError} onRetry={() => undefined} /></section>
          </div>
          <div className="m-footer">
            <button className="btn btn-secondary" type="button">Lưu nháp</button>
            <button className="btn btn-primary" type="button">Thanh toán</button>
          </div>
        </div>
        <button className="m-fab" type="button" aria-label="Thêm mới"><i className="ph ph-plus" /></button>
      </main>

      <BottomSheet
        open={sheet === 'detail'}
        onClose={() => setSheet(null)}
        title="Gội đầu dưỡng sinh"
        subtitle="SP0001 · Dịch vụ"
        tone="muted"
        footer={<><button className="btn btn-secondary" type="button" onClick={() => setSheet(null)}>Đóng</button><button className="btn btn-primary" type="button" onClick={() => setSheet(null)}>Chỉnh sửa</button></>}
      >
        <div className="card card-body">
          <div className="detail-list">
            <div className="detail-row"><span>Giá bán</span><strong>250.000đ</strong></div>
            <div className="detail-row"><span>Thời lượng</span><strong>60 phút</strong></div>
            <div className="detail-row"><span>Hoa hồng</span><strong>10%</strong></div>
          </div>
        </div>
      </BottomSheet>
      <MobileFilterSheet isOpen={sheet === 'filter'} onClose={() => setSheet(null)} onReset={() => undefined} onApply={() => setSheet(null)}>
        <div className="field"><label className="field-label" htmlFor="mf-type">Loại hàng</label><select className="input" id="mf-type"><option>Tất cả</option><option>Dịch vụ</option></select></div>
      </MobileFilterSheet>
    </div>
  );
}

export function Component() {
  const location = useLocation();
  return location.pathname.startsWith('/ui-kit/mobile') ? <MobileKit /> : <DesktopKit />;
}

export default Component;
