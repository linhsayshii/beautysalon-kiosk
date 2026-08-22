import { useState, useMemo } from 'react';
import type { FormEvent, RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { clientErrorMessage, errorMessage } from '@/services/api-client';
import { changeMyPassword, updateMyProfile } from '@/features/account-settings/account-settings.api';
import { getBranches, createBranch, updateBranch, deactivateBranch } from '@/features/branches/branches.api';
import { getAccounts, createAccount, updateAccount } from '@/features/accounts/accounts.api';
import { getStaff } from '@/features/staff/staff.api';
import { LocationMapPicker } from '@/components/map/LocationMapPicker';
import { Select } from '@/components/ui/Select/Select';
import { MobileSearchBar, MobileEmptyState } from '@/features/mobile-common';
import { useMobileDialog } from '@/features/mobile-common/useMobileDialog';
import { formatDateTime } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import './mobile-account.css';

type AccountTab = 'profile' | 'branches' | 'accounts';
type ProfileSubTab = 'info' | 'security';

const roleLabels: Record<string, string> = { manager: 'Quản lý', cashier: 'Thu ngân', staff: 'Nhân viên' };
const roleDescriptions: Record<string, string> = { manager: 'Toàn bộ hệ thống', cashier: 'Chỉ trang Thu ngân', staff: 'Chỉ chấm công QR' };

const emptyBranch = {
  code: '',
  name: '',
  address: '',
  phone: '',
  email: '',
  timezone: 'Asia/Ho_Chi_Minh',
  latitude: null as number | null,
  longitude: null as number | null,
  attendanceRadiusMeters: 100,
  active: true,
};

export function MobileAccountView() {
  const { account, updateLocalAccount, switchBranch } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isManager = account?.role === 'manager';

  const [activeTab, setActiveTab] = useState<AccountTab>('profile');
  const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>('info');

  // Search & Dialog states
  const [accountSearch, setAccountSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [editingBranch, setEditingBranch] = useState<ApiRecord | 'new' | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Profile Form state
  const [profile, setProfile] = useState({
    username: account?.username ?? '',
    displayName: account?.displayName ?? '',
    phone: account?.phone ?? '',
    email: account?.email ?? '',
  });
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Queries
  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: getBranches,
    enabled: isManager,
  });

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: isManager,
  });

  const refreshBranches = () => queryClient.invalidateQueries({ queryKey: ['branches'] });
  const refreshAccounts = () => queryClient.invalidateQueries({ queryKey: ['accounts'] });

  // Mutations for Branches
  const deactivateBranchMutation = useMutation({
    mutationFn: deactivateBranch,
    onSuccess: () => {
      refreshBranches();
      notify('Đã ngừng chi nhánh', 'Dữ liệu lịch sử vẫn được giữ nguyên.');
    },
    onError: (cause) => notify('Không thể ngừng chi nhánh', errorMessage(cause, 'Vui lòng thử lại')),
  });

  const activateBranchMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => updateBranch(id, { active: true }),
    onSuccess: () => {
      refreshBranches();
      notify('Đã kích hoạt chi nhánh', 'Chi nhánh đã hoạt động trở lại.');
    },
    onError: (cause) => notify('Không thể kích hoạt chi nhánh', errorMessage(cause, 'Vui lòng thử lại')),
  });

  // Mutations for Accounts
  const toggleAccountMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => updateAccount(id, { active }),
    onSuccess: () => {
      refreshAccounts();
      notify('Đã cập nhật tài khoản', 'Quyền truy cập có hiệu lực ngay.');
    },
    onError: (cause) => notify('Không thể cập nhật tài khoản', errorMessage(cause, 'Vui lòng thử lại')),
  });

  // Mutations for Profile
  const profileMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (payload) => {
      updateLocalAccount(payload.data);
      notify('Đã cập nhật tài khoản', 'Thông tin mới đã có hiệu lực.');
    },
    onError: (cause) => setProfileError(errorMessage(cause, 'Không thể cập nhật')),
  });

  const passwordMutation = useMutation({
    mutationFn: changeMyPassword,
    onSuccess: () => {
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      notify('Đã đổi mật khẩu', 'Các phiên đăng nhập khác đã được đăng xuất.');
    },
    onError: (cause) => setPasswordError(errorMessage(cause, 'Không thể đổi mật khẩu')),
  });

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    setProfileError('');
    profileMutation.mutate(profile);
  };

  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError(clientErrorMessage('Mật khẩu nhập lại chưa khớp', 'PASSWORD_CONFIRMATION_MISMATCH'));
      return;
    }
    passwordMutation.mutate({
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    });
  };

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/m/more');
    }
  };

  const branches = (branchesQuery.data?.data ?? []) as ApiRecord[];
  const accounts = (accountsQuery.data?.data ?? []) as ApiRecord[];

  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return accounts;
    const q = accountSearch.toLowerCase();
    return accounts.filter((row) =>
      `${row.username} ${row.displayName} ${roleLabels[row.role] || ''}`.toLowerCase().includes(q)
    );
  }, [accounts, accountSearch]);

  return (
    <div className="mobile-account-view">
      {/* Sticky Header Cluster */}
      <div className="mobile-account-sticky-header-cluster">
        <div className="mobile-account-top-nav">
          <div className="mobile-account-nav-left">
            <button
              type="button"
              className="mobile-account-back-icon"
              onClick={handleBack}
              aria-label="Quay lại"
            >
              <i className="ph ph-caret-left" />
            </button>
            <div className="mobile-account-nav-title-group">
              <h1 className="mobile-account-nav-title">Cài đặt tài khoản</h1>
              <span className="mobile-account-nav-subtitle">
                {!isManager || activeTab === 'profile'
                  ? 'Thông tin cá nhân & bảo mật'
                  : activeTab === 'branches'
                    ? 'Thông tin chi nhánh & GPS'
                    : 'Phân quyền & quản lý tài khoản'}
              </span>
            </div>
          </div>

          <div className="mobile-account-nav-actions">
            {isManager && activeTab === 'accounts' && (
              <button
                type="button"
                className={`mobile-account-nav-btn ${isSearchVisible ? 'is-active' : ''}`}
                onClick={() => setIsSearchVisible((prev) => !prev)}
                aria-label="Tìm kiếm tài khoản"
              >
                <i className="ph ph-magnifying-glass" />
              </button>
            )}
            {isManager && activeTab === 'branches' && (
              <button
                type="button"
                className="mobile-account-nav-btn is-action"
                onClick={() => setEditingBranch('new')}
                aria-label="Thêm chi nhánh"
                title="Thêm chi nhánh"
              >
                <i className="ph ph-plus" />
              </button>
            )}
            {isManager && activeTab === 'accounts' && (
              <button
                type="button"
                className="mobile-account-nav-btn is-action"
                onClick={() => setCreatingAccount(true)}
                aria-label="Thêm tài khoản"
                title="Thêm tài khoản"
              >
                <i className="ph ph-plus" />
              </button>
            )}
          </div>
        </div>

        {/* Inline Search Bar for Accounts tab */}
        {isManager && activeTab === 'accounts' && isSearchVisible && (
          <div className="mobile-account-search-wrap">
            <MobileSearchBar
              value={accountSearch}
              placeholder="Tìm theo tên, @username hoặc vai trò..."
              onChange={setAccountSearch}
            />
          </div>
        )}

        {/* 3 Tabs Phân quyền (hiển thị khi là manager) */}
        {isManager && (
          <div className="mobile-account-tabs-strip">
            <button
              type="button"
              className={`mobile-account-tab-btn ${activeTab === 'profile' ? 'is-active' : ''}`}
              onClick={() => { setActiveTab('profile'); setProfileSubTab('info'); }}
            >
              <i className="ph ph-user-circle" />
              <span>Thông tin cá nhân</span>
            </button>
            <button
              type="button"
              className={`mobile-account-tab-btn ${activeTab === 'branches' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('branches')}
            >
              <i className="ph ph-storefront" />
              <span>Quản lý chi nhánh</span>
            </button>
            <button
              type="button"
              className={`mobile-account-tab-btn ${activeTab === 'accounts' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('accounts')}
            >
              <i className="ph ph-shield-check" />
              <span>Tài khoản & phân quyền</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Body */}
      <div className="mobile-account-content-body">
        {/* TAB 1: THÔNG TIN CÁ NHÂN */}
        {(!isManager || activeTab === 'profile') && (
          <div className="mobile-profile-container">
            {/* User Overview Pill */}
            <div className="mobile-profile-overview-card">
              <div className="profile-overview-avatar">
                {account?.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="profile-overview-info">
                <strong className="profile-overview-name">
                  {account?.displayName || account?.username}
                </strong>
                <span className="profile-overview-badge">
                  <i className="ph ph-identification-badge" />
                  {account?.role === 'manager' ? 'Quản lý salon' : account?.role === 'cashier' ? 'Thu ngân' : 'Kỹ thuật viên'} • @{account?.username}
                </span>
                <span className="profile-overview-branch">
                  <i className="ph ph-storefront" /> {account?.branchName || 'Chi nhánh mặc định'}
                </span>
              </div>
            </div>

            {/* Sub-tabs: Thông tin / Bảo mật */}
            <div className="mobile-profile-sub-tabs">
              <button
                type="button"
                className={`mobile-profile-sub-tab-btn ${profileSubTab === 'info' ? 'is-active' : ''}`}
                onClick={() => setProfileSubTab('info')}
              >
                <i className="ph ph-user" />
                <span>Thông tin</span>
              </button>
              <button
                type="button"
                className={`mobile-profile-sub-tab-btn ${profileSubTab === 'security' ? 'is-active' : ''}`}
                onClick={() => setProfileSubTab('security')}
              >
                <i className="ph ph-lock-key" />
                <span>Bảo mật</span>
              </button>
            </div>

            {/* Form: Thông tin tài khoản */}
            {profileSubTab === 'info' && (
            <section className="mobile-settings-card">
              <header className="mobile-settings-card-header">
                <span className="mobile-settings-icon blue">
                  <i className="ph ph-user" />
                </span>
                <div>
                  <h2>Thông tin tài khoản</h2>
                  <p>Thông tin hiển thị trong toàn hệ thống</p>
                </div>
              </header>
              <form onSubmit={saveProfile} className="mobile-settings-form">
                <div className="mobile-form-group">
                  <label>
                    <span>Tên hiển thị *</span>
                    <input
                      required
                      value={profile.displayName}
                      onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
                      placeholder="Nhập tên hiển thị"
                    />
                  </label>
                </div>
                <div className="mobile-form-group">
                  <label>
                    <span>Tên đăng nhập *</span>
                    <input
                      required
                      minLength={3}
                      pattern="[a-zA-Z0-9._-]+"
                      value={profile.username}
                      onChange={(event) => setProfile({ ...profile, username: event.target.value })}
                      placeholder="username"
                    />
                  </label>
                </div>
                <div className="mobile-form-group">
                  <label>
                    <span>Số điện thoại</span>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                      placeholder="09xx xxx xxx"
                    />
                  </label>
                </div>
                <div className="mobile-form-group">
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                      placeholder="name@example.com"
                    />
                  </label>
                </div>

                {profileError && (
                  <div className="mobile-form-error">
                    <i className="ph ph-warning-circle" />
                    <span>{profileError}</span>
                  </div>
                )}

                <div className="mobile-account-form-footer">
                  <button
                    className="mobile-primary-btn"
                    disabled={profileMutation.isPending}
                    type="submit"
                  >
                    {profileMutation.isPending ? 'Đang lưu…' : 'Lưu thông tin'}
                  </button>
                </div>
              </form>
            </section>
            )}

            {/* Form: Đổi mật khẩu */}
            {profileSubTab === 'security' && (
            <section className="mobile-settings-card security-card">
              <header className="mobile-settings-card-header">
                <span className="mobile-settings-icon purple">
                  <i className="ph ph-lock-key" />
                </span>
                <div>
                  <h2>Đổi mật khẩu</h2>
                  <p>Tối thiểu 6 ký tự để bảo vệ tài khoản</p>
                </div>
              </header>
              <form onSubmit={savePassword} className="mobile-settings-form">
                <div className="mobile-form-group">
                  <label>
                    <span>Mật khẩu hiện tại *</span>
                    <input
                      required
                      type="password"
                      autoComplete="current-password"
                      value={passwords.currentPassword}
                      onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
                      placeholder="Nhập mật khẩu hiện tại"
                    />
                  </label>
                </div>
                <div className="mobile-form-group">
                  <label>
                    <span>Mật khẩu mới *</span>
                    <input
                      required
                      minLength={6}
                      maxLength={128}
                      type="password"
                      autoComplete="new-password"
                      value={passwords.newPassword}
                      onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
                      placeholder="Tối thiểu 6 ký tự"
                    />
                  </label>
                </div>
                <div className="mobile-form-group">
                  <label>
                    <span>Xác nhận mật khẩu mới *</span>
                    <input
                      required
                      minLength={6}
                      maxLength={128}
                      type="password"
                      autoComplete="new-password"
                      value={passwords.confirmPassword}
                      onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })}
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </label>
                </div>

                <div className="mobile-security-note">
                  <i className="ph ph-shield-check" />
                  <span>Sau khi đổi, các thiết bị khác đang đăng nhập tài khoản này sẽ bị đăng xuất tự động.</span>
                </div>

                {passwordError && (
                  <div className="mobile-form-error">
                    <i className="ph ph-warning-circle" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="mobile-account-form-footer">
                  <button
                    className="mobile-primary-btn"
                    disabled={passwordMutation.isPending}
                    type="submit"
                  >
                    {passwordMutation.isPending ? 'Đang đổi…' : 'Đổi mật khẩu'}
                  </button>
                </div>
              </form>
            </section>
            )}
          </div>
        )}

        {/* TAB 2: QUẢN LÝ CHI NHÁNH */}
        {isManager && activeTab === 'branches' && (
          <div className="mobile-branches-native-list">
            {branchesQuery.isLoading ? (
              <div className="mobile-account-loading">Đang tải danh sách chi nhánh...</div>
            ) : !branches.length ? (
              <MobileEmptyState
                icon="ph ph-storefront"
                title="Chưa có chi nhánh"
                description="Bấm vào nút bên dưới để tạo chi nhánh đầu tiên."
              />
            ) : (
              branches.map((b) => {
                const isCurrent = Number(b.id) === Number(account?.branchId);
                return (
                  <div className={`mobile-branch-card ${!b.active ? 'is-inactive' : ''}`} key={b.id}>
                    <div className="mobile-branch-card-header">
                      <div className="branch-card-icon-pill">
                        <i className="ph ph-storefront" />
                      </div>
                      <div className="branch-card-title-group">
                        <div className="branch-card-code-row">
                          <span className="branch-code-badge">{b.code}</span>
                          <span className={`branch-status-badge ${b.active ? 'active' : 'inactive'}`}>
                            {b.active ? 'Đang hoạt động' : 'Đã ngừng'}
                          </span>
                        </div>
                        <h3 className="branch-name">{b.name}</h3>
                      </div>
                    </div>

                    <div className="mobile-branch-details-box">
                      <div className="branch-detail-row">
                        <i className="ph ph-map-pin" />
                        <span>{b.address || 'Chưa cập nhật địa chỉ'}</span>
                      </div>
                      {b.phone && (
                        <div className="branch-detail-row">
                          <i className="ph ph-phone" />
                          <span>{b.phone}</span>
                        </div>
                      )}
                      <div className="branch-detail-row">
                        <i className="ph ph-navigation-arrow" />
                        <span>
                          {b.latitude !== null && b.longitude !== null
                            ? `GPS: ${Number(b.latitude).toFixed(4)}, ${Number(b.longitude).toFixed(4)} (${b.attendanceRadiusMeters || 100}m)`
                            : 'Chưa cài đặt tọa độ GPS'}
                        </span>
                      </div>
                    </div>

                    <div className="mobile-branch-metrics-row">
                      <div className="metric-col">
                        <strong>{b.staffCount ?? 0}</strong>
                        <span>Nhân viên</span>
                      </div>
                      <div className="metric-col">
                        <strong>{b.accountCount ?? 0}</strong>
                        <span>Tài khoản</span>
                      </div>
                      <div className="metric-col">
                        <strong>{b.attendanceRadiusMeters || 100}m</strong>
                        <span>Bán kính GPS</span>
                      </div>
                    </div>

                    <div className="mobile-branch-actions-row">
                      {b.active && !isCurrent && (
                        <button
                          type="button"
                          className="mobile-branch-action-btn switch-btn"
                          onClick={() => switchBranch(Number(b.id))}
                        >
                          <i className="ph ph-arrows-left-right" />
                          <span>Chuyển sang đây</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="mobile-branch-action-btn edit-btn"
                        onClick={() => setEditingBranch(b)}
                      >
                        <i className="ph ph-pencil-simple" />
                        <span>Chỉnh sửa</span>
                      </button>
                      {b.active ? (
                        <button
                          type="button"
                          className="mobile-branch-action-btn danger-btn"
                          disabled={deactivateBranchMutation.isPending || isCurrent}
                          onClick={() => {
                            if (window.confirm(`Bạn có chắc muốn ngừng hoạt động chi nhánh ${b.name}?`)) {
                              deactivateBranchMutation.mutate(Number(b.id));
                            }
                          }}
                        >
                          <i className="ph ph-minus-circle" />
                          <span>Ngừng</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mobile-branch-action-btn activate-btn"
                          disabled={activateBranchMutation.isPending}
                          onClick={() => activateBranchMutation.mutate({ id: Number(b.id) })}
                        >
                          <i className="ph ph-arrow-counter-clockwise" />
                          <span>Kích hoạt</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: TÀI KHOẢN & PHÂN QUYỀN */}
        {isManager && activeTab === 'accounts' && (
          <div className="mobile-accounts-native-container">
            {/* Roles Summary Strip */}
            <div className="mobile-accounts-role-summary">
              {Object.entries(roleLabels).map(([roleKey, label]) => {
                const count = accounts.filter((item) => item.role === roleKey && item.active).length;
                return (
                  <div className={`role-summary-card is-${roleKey}`} key={roleKey}>
                    <div className="role-summary-icon">
                      <i
                        className={`ph ${
                          roleKey === 'manager'
                            ? 'ph-crown'
                            : roleKey === 'cashier'
                              ? 'ph-cash-register'
                              : 'ph-identification-badge'
                        }`}
                      />
                    </div>
                    <div className="role-summary-text">
                      <strong>{label}</strong>
                      <span className="role-count">{count} tài khoản</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Account Native Cards List */}
            <div className="mobile-accounts-card-list">
              {accountsQuery.isLoading ? (
                <div className="mobile-account-loading">Đang tải danh sách tài khoản...</div>
              ) : !filteredAccounts.length ? (
                <MobileEmptyState
                  icon="ph ph-users-three"
                  title="Không tìm thấy tài khoản"
                  description="Thử tìm kiếm với từ khóa khác hoặc tạo tài khoản mới."
                />
              ) : (
                filteredAccounts.map((acc) => {
                  const roleKey = acc.role as string;
                  return (
                    <div className={`mobile-account-item-card ${!acc.active ? 'is-locked' : ''}`} key={acc.id}>
                      <div className="mobile-acc-card-main">
                        <div className={`mobile-acc-avatar is-${roleKey}`}>
                          {acc.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="mobile-acc-info">
                          <div className="acc-name-line">
                            <strong className="acc-display-name">{acc.displayName}</strong>
                            <span className={`acc-role-pill is-${roleKey}`}>
                              {roleLabels[roleKey] || roleKey}
                            </span>
                          </div>
                          <div className="acc-meta-line">
                            <span className="acc-username">@{acc.username}</span>
                            {acc.staffCode && <span className="acc-staff-code">• {acc.staffCode}</span>}
                          </div>
                          <div className="acc-submeta-line">
                            <span>{roleDescriptions[roleKey] || 'Truy cập cơ bản'}</span>
                            {acc.lastLoginAt && (
                              <span className="acc-last-login">
                                • {formatDateTime(acc.lastLoginAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mobile-acc-card-actions">
                        <button
                          type="button"
                          className={`mobile-acc-toggle-btn ${acc.active ? 'is-active' : ''}`}
                          disabled={toggleAccountMutation.isPending || Number(acc.id) === Number(account?.id)}
                          onClick={() => toggleAccountMutation.mutate({ id: Number(acc.id), active: !acc.active })}
                        >
                          <span className="toggle-indicator" />
                          <span className="toggle-text">{acc.active ? 'Đang hoạt động' : 'Đã khóa'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button for Manager tabs */}
      {isManager && activeTab === 'branches' && (
        <button
          type="button"
          className="mobile-account-fab-btn"
          onClick={() => setEditingBranch('new')}
          aria-label="Thêm chi nhánh"
        >
          <i className="ph ph-plus" />
        </button>
      )}

      {isManager && activeTab === 'accounts' && (
        <button
          type="button"
          className="mobile-account-fab-btn"
          onClick={() => setCreatingAccount(true)}
          aria-label="Thêm tài khoản"
        >
          <i className="ph ph-plus" />
        </button>
      )}

      {/* Dialogs */}
      {editingBranch && (
        <MobileBranchDialog
          branch={editingBranch === 'new' ? null : editingBranch}
          onClose={() => setEditingBranch(null)}
          onSaved={() => {
            setEditingBranch(null);
            refreshBranches();
          }}
        />
      )}

      {creatingAccount && (
        <MobileAccountDialog
          onClose={() => setCreatingAccount(false)}
          onSaved={() => {
            setCreatingAccount(false);
            refreshAccounts();
          }}
        />
      )}
    </div>
  );
}

/* Subcomponent: Branch Dialog for Mobile */
function MobileBranchDialog({
  branch,
  onClose,
  onSaved,
}: {
  branch: ApiRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [form, setForm] = useState(branch ? { ...emptyBranch, ...branch } : emptyBranch);
  const [error, setError] = useState('');
  const { dialogRef, titleId } = useMobileDialog({ isOpen: true, onClose });

  const mutation = useMutation({
    mutationFn: (body: ApiRecord) => (branch ? updateBranch(Number(branch.id), body) : createBranch(body)),
    onSuccess: () => {
      notify(branch ? 'Đã cập nhật chi nhánh' : 'Đã thêm chi nhánh', `${form.name} đã được lưu.`);
      onSaved();
    },
    onError: (cause) => setError(errorMessage(cause, 'Không thể lưu chi nhánh')),
  });

  const locate = () => {
    if (!navigator.geolocation) {
      setError(clientErrorMessage('Trình duyệt không hỗ trợ định vị GPS', 'GEOLOCATION_UNSUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setForm({ ...form, latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (cause) =>
        setError(
          clientErrorMessage(
            cause.code === cause.PERMISSION_DENIED
              ? 'Quyền truy cập vị trí đã bị từ chối. Hãy cấp quyền GPS và thử lại'
              : 'Không lấy được vị trí hiện tại',
            cause.code === cause.PERMISSION_DENIED
              ? 'GEOLOCATION_PERMISSION_DENIED'
              : cause.code === cause.TIMEOUT
                ? 'GEOLOCATION_TIMEOUT'
                : 'GEOLOCATION_UNAVAILABLE'
          )
        )
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    mutation.mutate(form);
  };

  return (
    <div
      className="goods-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section ref={dialogRef as RefObject<HTMLElement>} className="branch-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header>
          <div>
            <span className="eyebrow">THÔNG TIN CHI NHÁNH</span>
            <h2 id={titleId}>{branch ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng">
            <i className="ph ph-x" />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="branch-dialog-body">
            <div className="branch-form-grid">
              <label>
                <span>Mã chi nhánh *</span>
                <input
                  required
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                  placeholder="CN-Q1"
                />
              </label>
              <label>
                <span>Tên chi nhánh *</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="AnnaChill Quận 1"
                />
              </label>
              <label className="wide">
                <span>Địa chỉ</span>
                <input
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                  placeholder="Số nhà, đường, phường, quận"
                />
              </label>
              <label>
                <span>Điện thoại</span>
                <input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </label>
            </div>
            <div className="branch-map-heading">
              <div>
                <span className="eyebrow">GPS CHẤM CÔNG</span>
                <h3>Chọn vị trí trên bản đồ</h3>
              </div>
              <button className="secondary-button" type="button" onClick={locate}>
                <i className="ph ph-crosshair" />
                Vị trí hiện tại
              </button>
            </div>
            <LocationMapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              radiusMeters={form.attendanceRadiusMeters}
              onChange={(latitude, longitude) => setForm((value) => ({ ...value, latitude, longitude }))}
            />
            <div className="coordinate-grid">
              <label>
                <span>Vĩ độ</span>
                <input
                  type="number"
                  step="any"
                  value={form.latitude ?? ''}
                  onChange={(event) =>
                    setForm({ ...form, latitude: event.target.value === '' ? null : Number(event.target.value) })
                  }
                />
              </label>
              <label>
                <span>Kinh độ</span>
                <input
                  type="number"
                  step="any"
                  value={form.longitude ?? ''}
                  onChange={(event) =>
                    setForm({ ...form, longitude: event.target.value === '' ? null : Number(event.target.value) })
                  }
                />
              </label>
              <label>
                <span>Bán kính (mét)</span>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={form.attendanceRadiusMeters}
                  onChange={(event) => setForm({ ...form, attendanceRadiusMeters: Number(event.target.value) })}
                />
              </label>
            </div>
            {error && (
              <div className="auth-error">
                <i className="ph ph-warning-circle" />
                {error}
              </div>
            )}
          </div>
          <footer>
            <button className="secondary-button" type="button" onClick={onClose}>
              Hủy
            </button>
            <button className="primary-button" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang lưu…' : 'Lưu chi nhánh'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

/* Subcomponent: Account Dialog for Mobile */
function MobileAccountDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const staff = useQuery({ queryKey: ['staff-for-account'], queryFn: () => getStaff({ active: 'true' }) });
  const [form, setForm] = useState({ displayName: '', username: '', password: '', role: 'staff', staffId: '' });
  const [error, setError] = useState('');
  const { dialogRef, titleId } = useMobileDialog({ isOpen: true, onClose });

  const mutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      notify('Đã tạo tài khoản', `${form.displayName} có thể đăng nhập ngay.`);
      onSaved();
    },
    onError: (cause) => setError(errorMessage(cause, 'Không thể tạo tài khoản')),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    mutation.mutate({ ...form, staffId: form.staffId ? Number(form.staffId) : null });
  };

  return (
    <div
      className="goods-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section ref={dialogRef as RefObject<HTMLElement>} className="account-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header>
          <div>
            <span className="eyebrow">PHÂN QUYỀN</span>
            <h2 id={titleId}>Thêm tài khoản</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng">
            <i className="ph ph-x" />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="account-form-grid">
            <label>
              <span>Tên hiển thị *</span>
              <input
                required
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                placeholder="Nguyễn Minh Anh"
              />
            </label>
            <label>
              <span>Tên đăng nhập *</span>
              <input
                required
                minLength={3}
                pattern="[a-zA-Z0-9._-]+"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                placeholder="minhanh"
              />
            </label>
            <label>
              <span>Mật khẩu ban đầu *</span>
              <input
                required
                minLength={6}
                maxLength={128}
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Tối thiểu 6 ký tự"
              />
            </label>
            <div className="form-field">
              <span className="field-label">Loại tài khoản</span>
              <Select
                aria-label="Loại tài khoản"
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
                  ...(staff.data?.data.map((row) => ({
                    value: String(row.id),
                    label: `${row.code} · ${row.name}`,
                  })) ?? []),
                ]}
              />
            </div>
          </div>
          {error && (
            <div className="auth-error">
              <i className="ph ph-warning-circle" />
              {error}
            </div>
          )}
          <footer>
            <button className="secondary-button" type="button" onClick={onClose}>
              Hủy
            </button>
            <button className="primary-button" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
