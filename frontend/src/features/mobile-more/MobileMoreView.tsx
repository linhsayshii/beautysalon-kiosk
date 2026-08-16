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

      {/* 1-Column Bento Categories (Aligned with Desktop navigation) */}
      <div className="mobile-more-category-list">
        {/* Category: Đơn hàng & Bán hàng */}
        <div className="mobile-more-bento-card">
          <div className="more-category-title">Đơn hàng & Bán hàng</div>
          <div className="more-item-list">
            <Link to="/m/orders" className="more-nav-item">
              <span className="more-item-badge sky"><i className="ph ph-receipt" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Danh sách đơn hàng</span>
                <span className="more-item-desc">Tra cứu hóa đơn & trạng thái thanh toán</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
            <Link to="/m/pos" className="more-nav-item">
              <span className="more-item-badge emerald"><i className="ph ph-shopping-cart" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Bán hàng POS</span>
                <span className="more-item-desc">Tạo hóa đơn, thanh toán & in bill</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
          </div>
        </div>

        {/* Category: Hàng hóa */}
        <div className="mobile-more-bento-card">
          <div className="more-category-title">Hàng hóa & Bảng giá</div>
          <div className="more-item-list">
            <Link to="/m/products" className="more-nav-item">
              <span className="more-item-badge blue"><i className="ph ph-package" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Danh sách hàng hóa</span>
                <span className="more-item-desc">Quản lý sản phẩm, dịch vụ & tồn kho</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
            <Link to="/m/pricebooks" className="more-nav-item">
              <span className="more-item-badge violet"><i className="ph ph-tag" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Thiết lập giá</span>
                <span className="more-item-desc">Bảng giá theo từng chi nhánh & nhóm khách</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
            <Link to="/m/purchase-orders" className="more-nav-item">
              <span className="more-item-badge green"><i className="ph ph-truck" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Nhập hàng</span>
                <span className="more-item-desc">Đơn đặt hàng nhà cung cấp & nhập kho</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
          </div>
        </div>

        {/* Category: Khách hàng */}
        <div className="mobile-more-bento-card">
          <div className="more-category-title">Khách hàng</div>
          <div className="more-item-list">
            <Link to="/m/customers" className="more-nav-item">
              <span className="more-item-badge blue"><i className="ph ph-users" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Danh sách khách hàng</span>
                <span className="more-item-desc">Hồ sơ khách hàng, số điện thoại & công nợ</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
            <Link to="/m/customer-cards" className="more-nav-item">
              <span className="more-item-badge violet"><i className="ph ph-cards-three" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Gói, thẻ đã bán</span>
                <span className="more-item-desc">Thẻ liệu trình spa, buổi điều trị & số dư thẻ</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
          </div>
        </div>

        {/* Category: Nhân viên */}
        <div className="mobile-more-bento-card">
          <div className="more-category-title">Nhân viên & Lương thưởng</div>
          <div className="more-item-list">
            <Link to="/m/staff" className="more-nav-item">
              <span className="more-item-badge blue"><i className="ph ph-identification-card" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Danh sách nhân viên</span>
                <span className="more-item-desc">Hồ sơ, vai trò thợ & tài khoản đăng nhập</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
            <Link to="/m/staff/schedule" className="more-nav-item">
              <span className="more-item-badge sky"><i className="ph ph-calendar-dots" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Lịch làm việc</span>
                <span className="more-item-desc">Phân ca làm việc tuần/tháng</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
            <Link to="/m/staff/attendance" className="more-nav-item">
              <span className="more-item-badge emerald"><i className="ph ph-clock-user" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Bảng chấm công</span>
                <span className="more-item-desc">Thời gian vào ca, ra ca & duyệt công</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
            <Link to="/m/staff/payroll" className="more-nav-item">
              <span className="more-item-badge orange"><i className="ph ph-money" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Bảng lương</span>
                <span className="more-item-desc">Lương cứng, phụ cấp, giảm trừ & thực lĩnh</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
            <Link to="/m/staff/commissions" className="more-nav-item">
              <span className="more-item-badge rose"><i className="ph ph-chart-line-up" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Bảng hoa hồng</span>
                <span className="more-item-desc">Chiết khấu dịch vụ, bán mỹ phẩm & làm móng/gội</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
          </div>
        </div>

        {/* Category: Hệ thống & Tiện ích */}
        <div className="mobile-more-bento-card">
          <div className="more-category-title">Hệ thống & Tiện ích</div>
          <div className="more-item-list">
            <Link to="/m/attendance" className="more-nav-item">
              <span className="more-item-badge emerald"><i className="ph ph-qr-code" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Quét mã chấm công</span>
                <span className="more-item-desc">Chấm công GPS vào ca / ra ca</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
            <Link to="/m/attendance/qr" className="more-nav-item">
              <span className="more-item-badge purple"><i className="ph ph-qr-code" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Mã QR chấm công cửa hàng</span>
                <span className="more-item-desc">Tạo mã QR cho nhân viên quét</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </Link>
            <button type="button" className="more-nav-item" onClick={handleToggleDesktop} data-testid="desktop-mode-btn">
              <span className="more-item-badge blue"><i className="ph ph-desktop" /></span>
              <div className="more-item-info">
                <span className="more-item-label">Giao diện máy tính</span>
                <span className="more-item-desc">Chuyển sang bản quản trị desktop đầy đủ</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
            </button>
            <button type="button" className="more-nav-item logout" onClick={handleLogout} data-testid="logout-btn">
              <span className="more-item-badge rose"><i className="ph ph-sign-out" /></span>
              <div className="more-item-info">
                <span className="more-item-label" style={{ color: '#e11d48', fontWeight: 600 }}>Đăng xuất tài khoản</span>
                <span className="more-item-desc">Thoát phiên làm việc trên thiết bị này</span>
              </div>
              <i className="ph ph-caret-right more-item-arrow" />
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
