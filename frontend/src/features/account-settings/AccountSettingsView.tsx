import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { clientErrorMessage, errorMessage } from '@/services/api-client';
import { changeMyPassword, updateMyProfile } from './account-settings.api';
import { BranchesView, useBranchDialog } from '@/features/branches/BranchesView';
import { StaffAccountsView, useAccountDialog } from '@/features/accounts/StaffAccountsView';

export function AccountSettingsView() {
  const { account, updateLocalAccount } = useAuth();
  const { notify } = useToast();
  const isManager = account?.role === 'manager';
  const [activeTab, setActiveTab] = useState<'profile' | 'branches' | 'accounts'>('profile');

  const { openAddBranch, renderBranchDialog } = useBranchDialog();
  const { openAddAccount, renderAccountDialog } = useAccountDialog();

  const [profile, setProfile] = useState({ username: account?.username ?? '', displayName: account?.displayName ?? '', phone: account?.phone ?? '', email: account?.email ?? '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const profileMutation = useMutation({ mutationFn: updateMyProfile, onSuccess: (payload) => { updateLocalAccount(payload.data); notify('Đã cập nhật tài khoản', 'Thông tin mới đã có hiệu lực.'); }, onError: (cause) => setProfileError(errorMessage(cause, 'Không thể cập nhật')) });
  const passwordMutation = useMutation({ mutationFn: changeMyPassword, onSuccess: () => { setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' }); notify('Đã đổi mật khẩu', 'Các phiên đăng nhập khác đã được đăng xuất.'); }, onError: (cause) => setPasswordError(errorMessage(cause, 'Không thể đổi mật khẩu')) });
  const saveProfile = (event: FormEvent) => { event.preventDefault(); setProfileError(''); profileMutation.mutate(profile); };
  const savePassword = (event: FormEvent) => { event.preventDefault(); setPasswordError(''); if (passwords.newPassword !== passwords.confirmPassword) { setPasswordError(clientErrorMessage('Mật khẩu nhập lại chưa khớp', 'PASSWORD_CONFIRMATION_MISMATCH')); return; } passwordMutation.mutate({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }); };

  const headerAction = isManager && activeTab === 'branches' ? {
    label: 'Thêm chi nhánh',
    onAction: openAddBranch,
  } : undefined;

  return (
    <main className="workspace">
      <div className="workspace-shell account-settings-shell">
        <PageHeader
          title="Cài đặt tài khoản"
          subtitle={
            !isManager || activeTab === 'profile'
              ? 'Cập nhật thông tin cá nhân và bảo mật đăng nhập.'
              : activeTab === 'branches'
                ? 'Thông tin liên hệ, trạng thái vận hành và vị trí GPS chấm công.'
                : 'Quản lý quyền truy cập của quản lý, thu ngân và nhân viên.'
          }
          actionLabel={headerAction?.label}
          onAction={headerAction?.onAction}
        />

        {isManager && (
          <div className="account-tabs-wrapper">
            <div className="account-segmented-tabs" role="tablist" aria-label="Cài đặt tài khoản và hệ thống">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'profile'}
                className={activeTab === 'profile' ? 'is-active' : ''}
                onClick={() => setActiveTab('profile')}
              >
                <i className="ph ph-user-circle" />
                <span>Thông tin cá nhân</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'branches'}
                className={activeTab === 'branches' ? 'is-active' : ''}
                onClick={() => setActiveTab('branches')}
              >
                <i className="ph ph-storefront" />
                <span>Quản lý chi nhánh</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'accounts'}
                className={activeTab === 'accounts' ? 'is-active' : ''}
                onClick={() => setActiveTab('accounts')}
              >
                <i className="ph ph-shield-check" />
                <span>Tài khoản & phân quyền</span>
              </button>
            </div>
          </div>
        )}

        {(!isManager || activeTab === 'profile') && (
          <div className="account-settings-grid">
            <section className="settings-panel">
              <header>
                <span className="settings-panel-icon"><i className="ph ph-user-circle" /></span>
                <div><h2>Thông tin tài khoản</h2><p>Thông tin hiển thị trong hệ thống.</p></div>
              </header>
              <form onSubmit={saveProfile}>
                <div className="settings-form-grid">
                  <label><span>Tên hiển thị</span><input required value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} /></label>
                  <label><span>Tên đăng nhập</span><input required minLength={3} pattern="[a-zA-Z0-9._-]+" value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} /></label>
                  <label><span>Điện thoại</span><input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
                  <label><span>Email</span><input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
                </div>
                <div className="account-context">
                  <span><i className="ph ph-identification-card" />{account?.role === 'manager' ? 'Quản lý' : account?.role === 'cashier' ? 'Thu ngân' : 'Nhân viên'}</span>
                  <span><i className="ph ph-storefront" />{account?.branchName}</span>
                </div>
                {profileError && <div className="auth-error"><i className="ph ph-warning-circle" />{profileError}</div>}
                <footer>
                  <button className="primary-button" disabled={profileMutation.isPending} type="submit">{profileMutation.isPending ? 'Đang lưu…' : 'Lưu thông tin'}</button>
                </footer>
              </form>
            </section>
            <section className="settings-panel security-panel">
              <header>
                <span className="settings-panel-icon is-security"><i className="ph ph-lock-key" /></span>
                <div><h2>Đổi mật khẩu</h2><p>Dùng tối thiểu 12 ký tự và không dùng lại mật khẩu cũ.</p></div>
              </header>
              <form onSubmit={savePassword}>
                <div className="settings-form-grid single">
                  <label><span>Mật khẩu hiện tại</span><input required type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></label>
                  <label><span>Mật khẩu mới</span><input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} /></label>
                  <label><span>Nhập lại mật khẩu mới</span><input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={passwords.confirmPassword} onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} /></label>
                </div>
                <div className="security-note">
                  <i className="ph ph-shield-check" /><span>Sau khi đổi, các thiết bị khác đang đăng nhập tài khoản này sẽ bị đăng xuất.</span>
                </div>
                {passwordError && <div className="auth-error"><i className="ph ph-warning-circle" />{passwordError}</div>}
                <footer>
                  <button className="primary-button" disabled={passwordMutation.isPending} type="submit">{passwordMutation.isPending ? 'Đang đổi…' : 'Đổi mật khẩu'}</button>
                </footer>
              </form>
            </section>
          </div>
        )}

        {isManager && activeTab === 'branches' && (
          <div className="account-tab-content">
            <BranchesView embedded onAddBranch={openAddBranch} />
          </div>
        )}

        {isManager && activeTab === 'accounts' && (
          <div className="account-tab-content">
            <StaffAccountsView embedded onAddAccount={openAddAccount} />
          </div>
        )}
      </div>

      {renderBranchDialog()}
      {renderAccountDialog()}
    </main>
  );
}
