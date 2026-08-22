import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AvatarName } from '@/components/data-display/AvatarName';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Select } from '@/components/ui/Select/Select';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { getStaff } from '@/features/staff/staff.api';
import { errorMessage } from '@/services/api-client';
import { formatDateTime } from '@/lib/format';
import { createAccount, getAccounts, updateAccount } from './accounts.api';

const roleLabels: Record<string, string> = { manager: 'Quản lý', cashier: 'Thu ngân', staff: 'Nhân viên' };
const roleDescriptions: Record<string, string> = { manager: 'Toàn bộ hệ thống', cashier: 'Chỉ trang Thu ngân', staff: 'Chỉ chấm công QR' };

export function StaffAccountsView({ embedded = false, onAddAccount }: { embedded?: boolean; onAddAccount?: () => void }) {
  const client = useQueryClient();
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const rows = useMemo(() => (query.data?.data ?? []).filter((row) => `${row.username} ${row.displayName} ${roleLabels[row.role]}`.toLowerCase().includes(search.toLowerCase())), [query.data, search]);
  const toggle = useMutation({ mutationFn: ({ id, active }: { id: number; active: boolean }) => updateAccount(id, { active }), onSuccess: () => { client.invalidateQueries({ queryKey: ['accounts'] }); notify('Đã cập nhật tài khoản', 'Quyền truy cập có hiệu lực ngay.'); }, onError: (cause) => notify('Không thể cập nhật tài khoản', errorMessage(cause, 'Vui lòng thử lại')) });

  const handleCreate = onAddAccount ?? (() => setCreating(true));

  const content = (
    <div className={embedded ? 'embedded-accounts-content' : 'workspace-shell'}>
      {!embedded && <PageHeader title="Tài khoản & phân quyền" subtitle="Quản lý quyền truy cập của quản lý, thu ngân và nhân viên." actionLabel="Thêm tài khoản" onAction={handleCreate} />}
      <section className="role-summary">{Object.entries(roleLabels).map(([role, label]) => <article key={role}><span className={`role-icon is-${role}`}><i className={`ph ${role === 'manager' ? 'ph-crown' : role === 'cashier' ? 'ph-cash-register' : 'ph-identification-badge'}`} /></span><div><strong>{label}</strong><span>{roleDescriptions[role]}</span></div><b>{(query.data?.data ?? []).filter((item) => item.role === role && item.active).length}</b></article>)}</section>
      <section className="data-panel"><SearchToolbar value={search} placeholder="Tìm tên hoặc tài khoản" onChange={setSearch} onSearch={() => undefined} onRefresh={() => query.refetch()} actions={embedded ? <button className="primary-button" type="button" onClick={handleCreate}><i className="ph ph-plus" />Thêm tài khoản</button> : undefined} />
        {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState message="Chưa có tài khoản phù hợp." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Người dùng</th><th>Tên đăng nhập</th><th>Loại tài khoản</th><th>Phạm vi truy cập</th><th>Đăng nhập gần nhất</th><th>Trạng thái</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><AvatarName name={row.displayName} subtitle={row.staffCode ?? 'Không liên kết nhân viên'} tone={row.role === 'manager' ? 'violet' : row.role === 'cashier' ? 'green' : 'blue'} /></td><td><span className="account-username">@{row.username}</span></td><td><span className={`account-role is-${row.role}`}>{roleLabels[row.role]}</span></td><td>{roleDescriptions[row.role]}</td><td>{row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Chưa đăng nhập'}</td><td><button className={`account-toggle ${row.active ? 'is-active' : ''}`} type="button" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: row.id, active: !row.active })}><span />{row.active ? 'Đang hoạt động' : 'Đã khóa'}</button></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );

  return (
    <>
      {embedded ? content : <main className="workspace">{content}</main>}
      {creating && <AccountDialog onClose={() => setCreating(false)} />}
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

function AccountDialog({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const { notify } = useToast();
  const staff = useQuery({ queryKey: ['staff-for-account'], queryFn: () => getStaff({ active: 'true' }) });
  const [form, setForm] = useState({ displayName: '', username: '', password: '', role: 'staff', staffId: '' });
  const [error, setError] = useState('');
  const mutation = useMutation({ mutationFn: createAccount, onSuccess: () => { client.invalidateQueries({ queryKey: ['accounts'] }); notify('Đã tạo tài khoản', `${form.displayName} có thể đăng nhập ngay.`); onClose(); }, onError: (cause) => setError(errorMessage(cause, 'Không thể tạo tài khoản')) });
  const submit = (event: FormEvent) => { event.preventDefault(); setError(''); mutation.mutate({ ...form, staffId: form.staffId ? Number(form.staffId) : null }); };
  return (
    <div className="goods-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
        <header>
          <div><span className="eyebrow">PHÂN QUYỀN</span><h2 id="account-dialog-title">Thêm tài khoản</h2></div>
          <button type="button" onClick={onClose} aria-label="Đóng"><i className="ph ph-x" /></button>
        </header>
        <form onSubmit={submit}>
          <div className="account-form-grid">
            <label><span>Tên hiển thị</span><input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Nguyễn Minh Anh" /></label>
            <label><span>Tên đăng nhập</span><input required minLength={3} pattern="[a-zA-Z0-9._-]+" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="minhanh" /></label>
            <label><span>Mật khẩu ban đầu</span><input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Ít nhất 12 ký tự, gồm hoa, thường và số" /></label>
            <div className="form-field">
              <span className="field-label">Loại tài khoản</span>
              <Select
                value={form.role}
                onChange={(role) => setForm({ ...form, role })}
                fullWidth
                options={Object.entries(roleLabels).map(([value, label]) => ({
                  value,
                  label: `${label} · ${roleDescriptions[value]}`,
                }))}
              />
            </div>
            <div className="form-field account-staff-field">
              <span className="field-label">Liên kết nhân viên {form.role === 'staff' && '*'}</span>
              <Select
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
                  ...(staff.data?.data.map((row) => ({
                    value: String(row.id),
                    label: `${row.code} · ${row.name}`,
                  })) ?? []),
                ]}
              />
            </div>
          </div>
          {error && <div className="auth-error"><i className="ph ph-warning-circle" />{error}</div>}
          <footer>
            <button className="secondary-button" type="button" onClick={onClose}>Hủy</button>
            <button className="primary-button" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
