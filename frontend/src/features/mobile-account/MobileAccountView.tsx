import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBranches } from '@/features/branches/branches.api';
import { initials } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import './mobile-account.css';

export function MobileAccountView() {
  const { account, logout, switchBranch } = useAuth();
  const navigate = useNavigate();
  const [isSwitchingBranch, setIsSwitchingBranch] = useState(false);

  const { data: branchesData } = useQuery({
    queryKey: ['branches-list'],
    queryFn: getBranches,
  });

  const branches = (branchesData?.data ?? []) as ApiRecord[];

  const handleLogout = async () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      await logout();
      navigate('/login');
    }
  };

  const handleToggleDesktop = () => {
    window.localStorage.setItem('annachill-ui-mode', 'desktop');
    navigate('/dashboard');
  };

  const handleSelectBranch = async (branchId: number) => {
    await switchBranch(branchId);
    setIsSwitchingBranch(false);
  };

  return (
    <div className="mobile-account-container">
      {/* Profile Card */}
      <div className="mobile-account-profile-card">
        <div className="account-avatar">
          {initials(account?.displayName || account?.username)}
        </div>
        <div className="account-info">
          <span className="account-name">{account?.displayName || account?.username || 'Người dùng'}</span>
          <span className="account-role-tag">
            {account?.role === 'manager' ? 'Quản lý salon' : account?.role === 'cashier' ? 'Thu ngân' : 'Kỹ thuật viên'} • @{account?.username}
          </span>
          <span style={{ fontSize: 11, color: '#0284c7', fontWeight: 600 }}>
            Chi nhánh: {account?.branchName || 'Chi nhánh chính'}
          </span>
        </div>
      </div>

      {/* Menu Options */}
      <div className="mobile-account-menu-group">
        <button
          type="button"
          className="mobile-account-menu-item"
          onClick={() => setIsSwitchingBranch(true)}
        >
          <div className="menu-item-left">
            <span className="menu-item-icon blue"><i className="ph ph-storefront" /></span>
            <div className="menu-item-text">
              <span className="menu-item-title">Chuyển chi nhánh</span>
              <span className="menu-item-desc">{account?.branchName || 'Chọn chi nhánh làm việc'}</span>
            </div>
          </div>
          <div className="menu-item-right">
            <i className="ph ph-caret-right" />
          </div>
        </button>

        <button
          type="button"
          className="mobile-account-menu-item"
          onClick={handleToggleDesktop}
        >
          <div className="menu-item-left">
            <span className="menu-item-icon purple"><i className="ph ph-desktop" /></span>
            <div className="menu-item-text">
              <span className="menu-item-title">Giao diện máy tính</span>
              <span className="menu-item-desc">Chuyển sang bản đầy đủ</span>
            </div>
          </div>
          <div className="menu-item-right">
            <i className="ph ph-caret-right" />
          </div>
        </button>

        <button
          type="button"
          className="mobile-account-menu-item"
          onClick={() => navigate('/m/attendance')}
        >
          <div className="menu-item-left">
            <span className="menu-item-icon green"><i className="ph ph-qr-code" /></span>
            <div className="menu-item-text">
              <span className="menu-item-title">Quét mã chấm công</span>
              <span className="menu-item-desc">Vào ca / Ra ca bằng GPS</span>
            </div>
          </div>
          <div className="menu-item-right">
            <i className="ph ph-caret-right" />
          </div>
        </button>
      </div>

      {/* Logout button */}
      <button
        type="button"
        className="logout-button"
        onClick={handleLogout}
      >
        <i className="ph ph-sign-out" /> Đăng xuất tài khoản
      </button>

      {/* Branch Selection Sheet/Modal */}
      {isSwitchingBranch && (
        <div className="order-sheet-overlay" onClick={() => setIsSwitchingBranch(false)}>
          <div className="order-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="order-sheet-handle" />
            <div className="order-sheet-header">
              <h2>Chọn chi nhánh làm việc</h2>
              <button
                type="button"
                onClick={() => setIsSwitchingBranch(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer' }}
              >
                <i className="ph ph-x" />
              </button>
            </div>
            <div className="order-sheet-body">
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleSelectBranch(Number(b.id))}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    background: Number(b.id) === Number(account?.branchId) ? '#f0f9ff' : '#ffffff',
                    borderColor: Number(b.id) === Number(account?.branchId) ? '#0284c7' : '#e2e8f0',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{b.address || 'Hồ Chí Minh'}</div>
                  </div>
                  {Number(b.id) === Number(account?.branchId) && (
                    <i className="ph ph-check-circle" style={{ color: '#0284c7', fontSize: 20 }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
