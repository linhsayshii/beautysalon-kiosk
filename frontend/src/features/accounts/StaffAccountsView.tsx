import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AvatarName } from '@/components/data-display/AvatarName';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Select } from '@/components/ui/Select/Select';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getStaff } from '@/features/staff/staff.api';
import { errorMessage } from '@/services/api-client';
import { formatDateTime } from '@/lib/format';
import { createAccount, getAccounts, updateAccount } from './accounts.api';
import { Modal } from '@/components/ui/Modal/Modal';
import { useAuth } from '@/features/auth/AuthProvider';
import type { ApiRecord } from '@/types/api';

export const roleLabels: Record<string, string> = { manager: 'Quản lý', cashier: 'Thu ngân', staff: 'Nhân viên' };
export const roleDescriptions: Record<string, string> = { manager: 'Toàn bộ hệ thống', cashier: 'Chỉ trang Thu ngân', staff: 'Bán hàng, khách hàng, chấm công' };

export function StaffAccountsView({ embedded = false, onAddAccount }: { embedded?: boolean; onAddAccount?: () => void }) {
  const client = useQueryClient();
  const { notify } = useToast();
  const { account: me } = useAuth();
  const { subscribe } = useWebSocket();
  const [search, setSearch] = useState('');
  useEffect(() => {
    const unsub = subscribe(['staff:created', 'staff:updated'], () => {
      client.invalidateQueries({ queryKey: ['accounts'] });
    });
    return unsub;
  }, [subscribe, client]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ApiRecord | null>(null);
  const query = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const rows = useMemo(() => (query.data?.data ?? []).filter((row) => `${row.username} ${row.displayName} ${roleLabels[row.role]}`.toLowerCase().includes(search.toLowerCase())), [query.data, search]);
  const toggle = useMutation({ mutationFn: ({ id, active }: { id: number; active: boolean }) => updateAccount(id, { active }), onSuccess: () => { client.invalidateQueries({ queryKey: ['accounts'] }); notify('Đã cập nhật tài khoản', 'Quyền truy cập có hiệu lực ngay.'); }, onError: (cause) => notify('Không thể cập nhật tài khoản', errorMessage(cause, 'Vui lòng thử lại')) });

  const handleCreate = onAddAccount ?? (() => setCreating(true));

  const content = (
    <div className={embedded ? 'embedded-accounts-content' : 'page-stack'}>
      {!embedded && <PageHeader title="Tài khoản & phân quyền" subtitle="Quản lý quyền truy cập của quản lý, thu ngân và nhân viên." actionLabel="Thêm tài khoản" onAction={handleCreate} />}
      <section className="role-summary">{Object.entries(roleLabels).map(([role, label]) => <article key={role}><span className={`role-icon is-${role}`}><i className={`ph ${role === 'manager' ? 'ph-crown' : role === 'cashier' ? 'ph-cash-register' : 'ph-identification-badge'}`} /></span><div><strong>{label}</strong><span>{roleDescriptions[role]}</span></div><b>{(query.data?.data ?? []).filter((item) => item.role === role && item.active).length}</b></article>)}</section>
      <section className="data-panel"><SearchToolbar value={search} placeholder="Tìm tên hoặc tài khoản" onChange={setSearch} onSearch={() => undefined} onRefresh={() => query.refetch()} actions={embedded ? <button className="btn btn-primary" type="button" onClick={handleCreate}><i className="ph ph-plus" />Thêm tài khoản</button> : undefined} />
        {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState message="Chưa có tài khoản phù hợp." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Người dùng</th><th>Tên đăng nhập</th><th>Loại tài khoản</th><th>Phạm vi truy cập</th><th>Đăng nhập gần nhất</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><AvatarName name={row.displayName} subtitle={row.staffCode ?? 'Không liên kết nhân viên'} tone={row.role === 'manager' ? 'violet' : row.role === 'cashier' ? 'green' : 'blue'} /></td><td><span className="account-username">@{row.username}</span></td><td><span className={`account-role is-${row.role}`}>{roleLabels[row.role]}</span></td><td>{roleDescriptions[row.role]}</td><td>{row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Chưa đăng nhập'}</td><td><button className={`account-toggle ${row.active ? 'is-active' : ''}`} type="button" disabled={toggle.isPending || row.id === me?.id} onClick={() => toggle.mutate({ id: row.id, active: !row.active })}><span />{row.active ? 'Đang hoạt động' : 'Đã khóa'}</button></td><td className="text-right"><button className="btn btn-ghost btn-sm btn-icon" type="button" aria-label={`Sửa tài khoản ${row.displayName}`} title="Sửa tài khoản" onClick={() => setEditing(row)}><i className="ph ph-pencil-simple" /></button></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );

  return (
    <>
      {embedded ? content : <main className="page">{content}</main>}
      {creating && <AccountDialog onClose={() => setCreating(false)} />}
      {editing && <AccountDialog account={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

export function useAccountDialog() {
  const [creating, setCreating] = useState(false);
  return {
    openAddAccount: () => setCreating(true),
    renderAccountDialog: () => creating ? <AccountDialog onClose={() => setCreating(false)} /> : null,
  };
}

export function AccountDialog({ account, nested = false, onClose }: { account?: ApiRecord; nested?: boolean; onClose: () => void }) {
  const client = useQueryClient();
  const { notify } = useToast();
  const { account: me, updateLocalAccount } = useAuth();
  const editing = Boolean(account);
  const isSelf = editing && Number(account?.id) === Number(me?.id);
  const staff = useQuery({ queryKey: ['staff-for-account'], queryFn: () => getStaff({ active: 'true' }) });
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const [form, setForm] = useState({
    displayName: account?.displayName ?? '',
    username: account?.username ?? '',
    password: '',
    role: account?.role ?? 'staff',
    staffId: account?.staffId ? String(account.staffId) : '',
  });
  const [error, setError] = useState('');
  const linkedStaffIds = new Set((accounts.data?.data ?? []).filter((row) => row.staffId && row.id !== account?.id).map((row) => Number(row.staffId)));
  const staffOptions = (staff.data?.data ?? []).filter((row) => !linkedStaffIds.has(Number(row.id)));
  const currentStaffMissing = Boolean(account?.staffId) && !staffOptions.some((row) => Number(row.id) === Number(account?.staffId));
  const mutation = useMutation({
    mutationFn: () => {
      const body: ApiRecord = { displayName: form.displayName, username: form.username, role: form.role, staffId: form.staffId ? Number(form.staffId) : null };
      if (!editing) return createAccount({ ...body, password: form.password });
      if (form.password) body.password = form.password;
      return updateAccount(Number(account?.id), body);
    },
    onSuccess: (payload) => {
      client.invalidateQueries({ queryKey: ['accounts'] });
      if (!editing) notify('Đã tạo tài khoản', `${form.displayName} có thể đăng nhập ngay.`);
      else if (payload.data.sessionsRevoked) notify('Đã cập nhật tài khoản', `${form.displayName} cần đăng nhập lại để áp dụng thay đổi.`);
      else notify('Đã cập nhật tài khoản', `Đã lưu thông tin của ${form.displayName}.`);
      if (isSelf && me) updateLocalAccount({ ...me, displayName: payload.data.displayName, username: payload.data.username });
      onClose();
    },
    onError: (cause) => setError(errorMessage(cause, editing ? 'Không thể cập nhật tài khoản' : 'Không thể tạo tài khoản')),
  });
  const submit = (event: FormEvent) => { event.preventDefault(); setError(''); mutation.mutate(); };
  const roleChanged = editing && form.role !== account?.role;
  return (
    <Modal open onClose={onClose} nested={nested} title={editing ? 'Sửa tài khoản' : 'Thêm tài khoản'} subtitle={editing ? `@${account?.username}` : 'Tạo đăng nhập và phân quyền cho nhân viên'} size="md" className="modal-fill account-dialog">
      <form onSubmit={submit}>
        <div className="modal-body">
        <div className="account-form-grid">
          <label><span>Tên hiển thị *</span><input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Nguyễn Minh Anh" /></label>
          <label><span>Tên đăng nhập *</span><input required minLength={3} maxLength={80} pattern="[a-zA-Z0-9._\-]+" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="minhanh" /></label>
          {isSelf ? (
            <div className="field"><span className="field-label">Mật khẩu</span><span className="field-hint">Đổi mật khẩu của bạn ở mục Bảo mật.</span></div>
          ) : (
            <label><span>{editing ? 'Đặt lại mật khẩu' : 'Mật khẩu ban đầu *'}</span><input required={!editing} minLength={8} maxLength={128} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editing ? 'Để trống nếu giữ nguyên' : 'Ít nhất 8 ký tự'} /></label>
          )}
          <div className="field">
            <span className="field-label">Loại tài khoản</span>
            <Select
              aria-label="Loại tài khoản"
              value={form.role}
              onChange={(role) => setForm({ ...form, role })}
              disabled={isSelf}
              fullWidth
              options={Object.entries(roleLabels).map(([value, label]) => ({
                value,
                label: `${label} · ${roleDescriptions[value]}`,
              }))}
            />
            {isSelf && <span className="field-hint">Không thể tự đổi loại tài khoản đang đăng nhập.</span>}
          </div>
          <div className="field account-staff-field">
            <span className="field-label">Liên kết nhân viên {form.role === 'staff' && '*'}</span>
            <Select
              aria-label="Liên kết nhân viên"
              value={form.staffId}
              onChange={(val) => {
                const selected = staff.data?.data.find((row) => String(row.id) === val);
                setForm({
                  ...form,
                  staffId: val,
                  displayName: form.displayName || selected?.name || '',
                });
              }}
              fullWidth
              placeholder="Không liên kết"
              options={[
                { value: '', label: 'Không liên kết' },
                ...(currentStaffMissing ? [{ value: String(account?.staffId), label: `${account?.staffCode ?? ''} · ${account?.staffName ?? ''}` }] : []),
                ...staffOptions.map((row) => ({
                  value: String(row.id),
                  label: `${row.code} · ${row.name}`,
                })),
              ]}
            />
          </div>
        </div>
        {roleChanged && <div className="alert alert-warning account-role-alert"><i className="ph ph-warning" />Đổi loại tài khoản sẽ đăng xuất {account?.displayName} khỏi mọi thiết bị.</div>}
        {error && <div className="auth-error"><i className="ph ph-warning-circle" />{error}</div>}
        </div>
        <footer className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button>
        </footer>
      </form>
    </Modal>
  );
}
