import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBranches } from '@/features/branches/branches.api';
import { initials } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import './mobile-more.css';

export function MobileMoreView() {
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

  const displayName = account?.displayName || account?.username || 'admin';
  const branchName = account?.branchName || 'Chi nhánh mặc định';

  return (
    <div className="mobile-more-container">
      {/* Profile Section */}
      <div className="mobile-more-profile-card">
        <div className="more-profile-left">
          <div className="more-avatar" data-testid="user-avatar">
            {initials(displayName)}
          </div>
          <div className="more-user-info">
            <span className="more-user-name" data-testid="user-name">{displayName}</span>
            <span className="more-user-branch" data-testid="user-branch">
              <i className="ph ph-storefront" /> {branchName}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="more-branch-switch-btn"
          onClick={() => setIsSwitchingBranch(true)}
          title="Chuyển chi nhánh"
          aria-label="Chuyển chi nhánh"
          data-testid="switch-branch-btn"
        >
          <i className="ph ph-arrows-clockwise" />
        </button>
      </div>

      {/* Store Settings Link */}
      <Link to="/settings" className="mobile-more-store-settings" data-testid="store-settings-link">
        <div className="store-settings-left">
          <div className="store-settings-icon">
            <i className="ph ph-gear-six" />
          </div>
          <span className="store-settings-title">Thông tin cửa hàng</span>
        </div>
        <div className="store-settings-right">
          <i className="ph ph-caret-right" />
        </div>
      </Link>

      {/* Bento Grid Categories */}
      <div className="mobile-more-category-grid">
        {/* Category: Đơn hàng */}
        <div className="mobile-more-bento-card">
          <div className="more-category-title">Đơn hàng</div>
          <div className="more-item-list">
            <Link to="/m/orders" className="more-nav-item">
              <span className="more-item-badge sky"><i className="ph ph-file-text" /></span>
              <span className="more-item-label">Hóa đơn</span>
            </Link>
            <Link to="/m/orders" className="more-nav-item">
              <span className="more-item-badge rose"><i className="ph ph-arrow-u-up-left" /></span>
              <span className="more-item-label">Trả hàng</span>
            </Link>
          </div>
        </div>

        {/* Category: Báo cáo */}
        <div className="mobile-more-bento-card">
          <div className="more-category-title">Báo cáo</div>
          <div className="more-item-list">
            <Link to="/m/dashboard" className="more-nav-item">
              <span className="more-item-badge blue"><i className="ph ph-chart-bar" /></span>
              <span className="more-item-label">Báo cáo</span>
            </Link>
            <Link to="/m/dashboard" className="more-nav-item">
              <span className="more-item-badge violet"><i className="ph ph-chart-line-up" /></span>
              <span className="more-item-label">Phân tích</span>
            </Link>
            <Link to="/m/dashboard" className="more-nav-item">
              <span className="more-item-badge emerald"><i className="ph ph-wallet" /></span>
              <span className="more-item-label">Sổ quỹ</span>
            </Link>
          </div>
        </div>

        {/* Category: Thuế & Kế toán */}
        <div className="mobile-more-bento-card">
          <div className="more-category-title">Thuế & Kế toán</div>
          <div className="more-item-list">
            <Link to="/m/orders" className="more-nav-item">
              <span className="more-item-badge amber"><i className="ph ph-calculator" /></span>
              <span className="more-item-label">Thuế & Kế toán</span>
            </Link>
            <Link to="/m/orders" className="more-nav-item">
              <span className="more-item-badge teal"><i className="ph ph-receipt" /></span>
              <span className="more-item-label">Hóa đơn điện tử</span>
            </Link>
          </div>
        </div>

        {/* Category: Khách hàng */}
        <div className="mobile-more-bento-card">
          <div className="more-category-title">Khách hàng</div>
          <div className="more-item-list">
            <Link to="/m/customers" className="more-nav-item">
              <span className="more-item-badge violet"><i className="ph ph-users" /></span>
              <span className="more-item-label">Khách hàng</span>
            </Link>
            <Link to="/m/customer-cards" className="more-nav-item">
              <span className="more-item-badge indigo"><i className="ph ph-cards" /></span>
              <span className="more-item-label">Gói thẻ đã bán</span>
            </Link>
          </div>
        </div>

        {/* Category: Hàng hóa & Kho */}
        <div className="mobile-more-bento-card">
          <div className="more-category-title">Hàng hóa & Kho</div>
          <div className="more-item-list">
            <Link to="/m/products" className="more-nav-item">
              <span className="more-item-badge emerald"><i className="ph ph-package" /></span>
              <span className="more-item-label">Hàng hóa</span>
            </Link>
            <Link to="/m/pricebooks" className="more-nav-item">
              <span className="more-item-badge amber"><i className="ph ph-tag" /></span>
              <span className="more-item-label">Bảng giá</span>
            </Link>
            <Link to="/m/purchase-orders" className="more-nav-item">
              <span className="more-item-badge blue"><i className="ph ph-truck" /></span>
              <span className="more-item-label">Nhập hàng</span>
            </Link>
          </div>
        </div>

        {/* Category: Nhân sự */}
        <div className="mobile-more-bento-card">
          <div className="more-category-title">Nhân sự</div>
          <div className="more-item-list">
            <Link to="/m/staff" className="more-nav-item">
              <span className="more-item-badge purple"><i className="ph ph-identification-card" /></span>
              <span className="more-item-label">Danh sách NV</span>
            </Link>
            <Link to="/m/staff/schedule" className="more-nav-item">
              <span className="more-item-badge sky"><i className="ph ph-calendar" /></span>
              <span className="more-item-label">Lịch làm việc</span>
            </Link>
            <Link to="/m/staff/attendance" className="more-nav-item">
              <span className="more-item-badge orange"><i className="ph ph-clock" /></span>
              <span className="more-item-label">Chấm công</span>
            </Link>
            <Link to="/m/staff/payroll" className="more-nav-item">
              <span className="more-item-badge green"><i className="ph ph-money" /></span>
              <span className="more-item-label">Lương & HH</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Category: Hệ thống & Tiện ích (Single row bento full-width) */}
      <div className="mobile-more-bento-card">
        <div className="more-category-title">Hệ thống & Tiện ích</div>
        <div className="mobile-more-category-grid" style={{ marginTop: 4 }}>
          <div className="more-item-list">
            <Link to="/m/attendance" className="more-nav-item">
              <span className="more-item-badge emerald"><i className="ph ph-qr-code" /></span>
              <span className="more-item-label">Quét chấm công</span>
            </Link>
            <Link to="/m/attendance/qr" className="more-nav-item">
              <span className="more-item-badge purple"><i className="ph ph-qr-code" /></span>
              <span className="more-item-label">Mã QR chấm công</span>
            </Link>
          </div>
          <div className="more-item-list">
            <button type="button" className="more-nav-item" onClick={handleToggleDesktop} data-testid="desktop-mode-btn">
              <span className="more-item-badge blue"><i className="ph ph-desktop" /></span>
              <span className="more-item-label">Giao diện PC</span>
            </button>
            <button type="button" className="more-nav-item" onClick={handleLogout} data-testid="logout-btn">
              <span className="more-item-badge rose"><i className="ph ph-sign-out" /></span>
              <span className="more-item-label" style={{ color: '#e11d48' }}>Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>

      {/* Branch Selection Sheet Modal */}
      {isSwitchingBranch && (
        <div
          className="mobile-more-sheet-overlay"
          onClick={() => setIsSwitchingBranch(false)}
          data-testid="branch-modal-overlay"
        >
          <div className="mobile-more-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-more-sheet-handle" />
            <div className="mobile-more-sheet-header">
              <h3>Chọn chi nhánh làm việc</h3>
              <button
                type="button"
                className="mobile-more-sheet-close"
                onClick={() => setIsSwitchingBranch(false)}
                aria-label="Đóng"
              >
                <i className="ph ph-x" />
              </button>
            </div>
            <div className="mobile-more-sheet-body">
              {branches.length > 0 ? (
                branches.map((b) => {
                  const isSelected = Number(b.id) === Number(account?.branchId);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`branch-option-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectBranch(Number(b.id))}
                      data-testid={`branch-option-${b.id}`}
                    >
                      <div>
                        <div className="branch-option-title">{b.name}</div>
                        <div className="branch-option-address">{b.address || 'Hồ Chí Minh'}</div>
                      </div>
                      {isSelected && (
                        <i className="ph ph-check-circle" style={{ color: '#0284c7', fontSize: 20 }} />
                      )}
                    </button>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '13px' }}>
                  Không có chi nhánh khả dụng
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
