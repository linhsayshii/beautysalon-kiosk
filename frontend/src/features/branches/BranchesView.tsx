import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { LocationMapPicker } from '@/components/map/LocationMapPicker';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { clientErrorMessage, errorMessage } from '@/services/api-client';
import { useAuth } from '@/features/auth/AuthProvider';
import type { ApiRecord } from '@/types/api';
import { createBranch, deactivateBranch, getBranches, updateBranch } from './branches.api';

const emptyBranch = { code: '', name: '', address: '', phone: '', email: '', timezone: 'Asia/Ho_Chi_Minh', latitude: null as number | null, longitude: null as number | null, attendanceRadiusMeters: 100, active: true };

export function BranchesView({ embedded = false, onAddBranch }: { embedded?: boolean; onAddBranch?: () => void }) {
  const { account, switchBranch } = useAuth();
  const client = useQueryClient();
  const { notify } = useToast();
  const [editing, setEditing] = useState<ApiRecord | 'new' | null>(null);
  const query = useQuery({ queryKey: ['branches'], queryFn: getBranches });
  const refresh = () => client.invalidateQueries({ queryKey: ['branches'] });
  const deactivate = useMutation({ mutationFn: deactivateBranch, onSuccess: () => { refresh(); notify('Đã ngừng chi nhánh', 'Dữ liệu lịch sử vẫn được giữ nguyên.'); }, onError: (cause) => notify('Không thể ngừng chi nhánh', errorMessage(cause, 'Vui lòng thử lại')) });
  const activate = useMutation({ mutationFn: ({ id }: { id: number }) => updateBranch(id, { active: true }), onSuccess: refresh, onError: (cause) => notify('Không thể kích hoạt chi nhánh', errorMessage(cause, 'Vui lòng thử lại')) });

  const handleCreate = onAddBranch ?? (() => setEditing('new'));

  const content = (
    <div className={embedded ? 'embedded-branch-content' : 'workspace-shell branch-shell'}>
      {!embedded && <PageHeader title="Quản lý chi nhánh" subtitle="Thông tin liên hệ, trạng thái vận hành và vị trí GPS chấm công." actionLabel="Thêm chi nhánh" onAction={handleCreate} />}
      {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !query.data?.data.length ? <EmptyState message="Chưa có chi nhánh." /> : <div className="branch-grid">{query.data.data.map((branch) => <article className={`branch-card ${!branch.active ? 'is-inactive' : ''}`} key={branch.id}>
        <header><span className="branch-card-icon"><i className="ph ph-storefront" /></span><div><span>{branch.code}</span><h2>{branch.name}</h2></div><span className={`branch-state ${branch.active ? 'is-active' : ''}`}>{branch.active ? 'Hoạt động' : 'Đã ngừng'}</span></header>
        <div className="branch-details"><p><i className="ph ph-map-pin" />{branch.address || 'Chưa cập nhật địa chỉ'}</p><p><i className="ph ph-phone" />{branch.phone || 'Chưa cập nhật điện thoại'}</p><p><i className="ph ph-navigation-arrow" />{branch.latitude !== null ? `${branch.latitude.toFixed(6)}, ${branch.longitude.toFixed(6)}` : 'Chưa đặt GPS'}</p></div>
        <div className="branch-metrics"><div><strong>{branch.staffCount}</strong><span>Nhân viên</span></div><div><strong>{branch.accountCount}</strong><span>Tài khoản</span></div><div><strong>{branch.attendanceRadiusMeters}m</strong><span>Bán kính GPS</span></div></div>
        <footer>{branch.active && branch.id !== account?.branchId && <button type="button" onClick={() => switchBranch(branch.id)}><i className="ph ph-arrows-left-right" />Chuyển sang đây</button>}<button type="button" onClick={() => setEditing(branch)}><i className="ph ph-pencil-simple" />Chỉnh sửa</button>{branch.active ? <button className="danger-text" type="button" disabled={deactivate.isPending || branch.id === account?.branchId} onClick={() => deactivate.mutate(branch.id)}><i className="ph ph-minus-circle" />Ngừng</button> : <button type="button" onClick={() => activate.mutate({ id: branch.id })}><i className="ph ph-arrow-counter-clockwise" />Kích hoạt</button>}</footer>
      </article>)}</div>}
    </div>
  );

  return (
    <>
      {embedded ? content : <main className="workspace">{content}</main>}
      {editing && <BranchDialog branch={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </>
  );
}

export function useBranchDialog() {
  const [editing, setEditing] = useState<ApiRecord | 'new' | null>(null);
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ['branches'] });

  const renderDialog = () => editing ? (
    <BranchDialog
      branch={editing === 'new' ? null : editing}
      onClose={() => setEditing(null)}
      onSaved={() => { setEditing(null); refresh(); }}
    />
  ) : null;

  return {
    openAddBranch: () => setEditing('new'),
    openEditBranch: (branch: ApiRecord) => setEditing(branch),
    renderBranchDialog: renderDialog,
  };
}

function BranchDialog({ branch, onClose, onSaved }: { branch: ApiRecord | null; onClose: () => void; onSaved: () => void }) {
  const { notify } = useToast();
  const [form, setForm] = useState(branch ? { ...emptyBranch, ...branch } : emptyBranch);
  const [error, setError] = useState('');
  const mutation = useMutation({ mutationFn: (body: ApiRecord) => branch ? updateBranch(branch.id, body) : createBranch(body), onSuccess: () => { notify(branch ? 'Đã cập nhật chi nhánh' : 'Đã thêm chi nhánh', `${form.name} đã được lưu.`); onSaved(); }, onError: (cause) => setError(errorMessage(cause, 'Không thể lưu chi nhánh')) });
  const locate = () => {
    if (!navigator.geolocation) {
      setError(clientErrorMessage('Trình duyệt không hỗ trợ định vị GPS', 'GEOLOCATION_UNSUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setForm({ ...form, latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (cause) => setError(clientErrorMessage(
        cause.code === cause.PERMISSION_DENIED ? 'Quyền truy cập vị trí đã bị từ chối. Hãy cấp quyền GPS và thử lại' : 'Không lấy được vị trí hiện tại',
        cause.code === cause.PERMISSION_DENIED ? 'GEOLOCATION_PERMISSION_DENIED' : cause.code === cause.TIMEOUT ? 'GEOLOCATION_TIMEOUT' : 'GEOLOCATION_UNAVAILABLE',
      )),
    );
  };
  const submit = (event: FormEvent) => { event.preventDefault(); setError(''); mutation.mutate(form); };
  return <div className="goods-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="branch-dialog" role="dialog" aria-modal="true"><header><div><span className="eyebrow">THÔNG TIN CHI NHÁNH</span><h2>{branch ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh'}</h2></div><button type="button" onClick={onClose}><i className="ph ph-x" /></button></header><form onSubmit={submit}><div className="branch-dialog-body"><div className="branch-form-grid"><label><span>Mã chi nhánh *</span><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="CN-Q1" /></label><label><span>Tên chi nhánh *</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="AnnaChill Quận 1" /></label><label className="wide"><span>Địa chỉ</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Số nhà, đường, phường, quận" /></label><label><span>Điện thoại</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div><div className="branch-map-heading"><div><span className="eyebrow">GPS CHẤM CÔNG</span><h3>Chọn vị trí trên bản đồ</h3></div><button className="secondary-button" type="button" onClick={locate}><i className="ph ph-crosshair" />Vị trí hiện tại</button></div><LocationMapPicker latitude={form.latitude} longitude={form.longitude} radiusMeters={form.attendanceRadiusMeters} onChange={(latitude, longitude) => setForm((value) => ({ ...value, latitude, longitude }))} /><div className="coordinate-grid"><label><span>Vĩ độ</span><input type="number" step="any" value={form.latitude ?? ''} onChange={(event) => setForm({ ...form, latitude: event.target.value === '' ? null : Number(event.target.value) })} /></label><label><span>Kinh độ</span><input type="number" step="any" value={form.longitude ?? ''} onChange={(event) => setForm({ ...form, longitude: event.target.value === '' ? null : Number(event.target.value) })} /></label><label><span>Bán kính (mét)</span><input type="number" min="10" max="1000" value={form.attendanceRadiusMeters} onChange={(event) => setForm({ ...form, attendanceRadiusMeters: Number(event.target.value) })} /></label></div>{error && <div className="auth-error"><i className="ph ph-warning-circle" />{error}</div>}</div><footer><button className="secondary-button" type="button" onClick={onClose}>Hủy</button><button className="primary-button" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Đang lưu…' : 'Lưu chi nhánh'}</button></footer></form></section></div>;
}
