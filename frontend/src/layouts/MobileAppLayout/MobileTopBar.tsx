import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMetadata } from '@/services/metadata';
import { usePosSocket } from '@/services/usePosSocket';
import { getBranches } from '@/features/branches/branches.api';
import type { ApiRecord } from '@/types/api';

// Sub-page titles and configuration
const SUBPAGE_CONFIG: Record<string, { title: string; backTo?: string; hideTopBar?: boolean }> = {
  '/m/products': { title: 'Hàng hóa', backTo: '/m/more', hideTopBar: true },
  '/m/appointments': { title: 'Lịch dịch vụ', hideTopBar: true },
  '/m/pricebooks': { title: 'Bảng giá', backTo: '/m/more' },
  '/m/purchase-orders': { title: 'Nhập hàng', backTo: '/m/more' },
  '/m/purchase-orders/new': { title: 'Tạo phiếu nhập', backTo: '/m/purchase-orders' },
  '/m/customer-cards': { title: 'Gói & Thẻ khách hàng', backTo: '/m/more' },
  '/m/staff/schedule': { title: 'Lịch làm việc', backTo: '/m/more' },
  '/m/staff/attendance': { title: 'Bảng chấm công', backTo: '/m/more' },
  '/m/staff/payroll': { title: 'Bảng lương & Hoa hồng', backTo: '/m/more' },
  '/m/staff/commissions': { title: 'Hoa hồng nhân viên', backTo: '/m/more' },
  '/m/attendance/qr': { title: 'Mã QR Chấm công', backTo: '/m/more' },
  '/m/invoices/new': { title: 'Tạo hóa đơn', backTo: '/m/pos' },
  '/m/appointments/new': { title: 'Đặt lịch hẹn', backTo: '/m/appointments' },
};

// Map of top-level tab routes
const ROOT_TAB_ROUTES = new Set([
  '/m',
  '/m/dashboard',
  '/m/appointments',
  '/m/notifications',
  '/m/more',
  '/m/pos',
  '/m/orders',
  '/m/customers',
  '/m/staff',
  '/m/schedule',
  '/m/salary',
  '/m/attendance',
  '/m/account',
]);

export function MobileTopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { account, switchBranch } = useAuth();
  const { data: meta } = useMetadata();
  const { isOnline } = usePosSocket();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const storeName = meta?.data?.system?.storeName || 'AnnaChill';

  const pathname = location.pathname.replace(/\/$/, '') || '/m';
  const isSubPage = !ROOT_TAB_ROUTES.has(pathname);
  const subPageInfo = SUBPAGE_CONFIG[pathname];
  const subPageTitle = subPageInfo?.title || 'Chi tiết';

  const { data: branchesData } = useQuery({
    queryKey: ['branches-list'],
    queryFn: getBranches,
    enabled: isDropdownOpen && !subPageInfo?.hideTopBar && pathname !== '/m/appointments',
  });

  const branches = (branchesData?.data ?? []) as ApiRecord[];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDropdownOpen]);

  if (subPageInfo?.hideTopBar || pathname === '/m/appointments') {
    return null;
  }

  const handleSelectBranch = async (branchId: number) => {
    await switchBranch(branchId);
    setIsDropdownOpen(false);
  };

  const handleBack = () => {
    if (subPageInfo?.backTo) {
      navigate(subPageInfo.backTo);
    } else if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/m/more');
    }
  };

  return (
    <header className="mobile-topbar">
      {isSubPage ? (
        <div className="mobile-topbar-subpage-left">
          <button
            type="button"
            className="mobile-topbar-back-btn"
            onClick={handleBack}
            aria-label="Quay lại"
            data-testid="mobile-topbar-back-btn"
          >
            <i className="ph ph-arrow-left" />
          </button>
          <h1 className="mobile-topbar-subpage-title" data-testid="mobile-topbar-title">
            {subPageTitle}
          </h1>
        </div>
      ) : (
        <Link to="/m" className="mobile-brand">
          <span className="brand-mark"><span /><span /></span>
          <span className="mobile-store-title">{storeName}</span>
        </Link>
      )}

      <div className="mobile-top-right">
        <span className={`mobile-status-dot ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Realtime Online' : 'Offline'} />

        {/* Shop Icon Button & Dropdown Menu Container */}
        <div className="mobile-shop-dropdown-container" ref={dropdownRef}>
          <button
            type="button"
            className={`mobile-shop-button ${isDropdownOpen ? 'is-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsDropdownOpen((prev) => !prev);
            }}
            aria-label={`Chi nhánh: ${account?.branchName || 'Chọn chi nhánh'}`}
            title={account?.branchName || 'Chọn chi nhánh'}
          >
            <i className="ph ph-storefront" />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="mobile-shop-dropdown-menu" role="menu">
              <div className="mobile-dropdown-header">
                <span>Chi nhánh làm việc</span>
                <small>Đang chọn: <strong>{account?.branchName}</strong></small>
              </div>

              <div className="mobile-dropdown-list">
                {branches.length > 0 ? (
                  branches.map((b) => {
                    const isCurrent = Number(b.id) === Number(account?.branchId);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        className={`mobile-dropdown-item ${isCurrent ? 'is-current' : ''}`}
                        onClick={() => handleSelectBranch(Number(b.id))}
                        role="menuitem"
                      >
                        <div className="dropdown-item-info">
                          <strong className="branch-name">{b.name}</strong>
                          <span className="branch-addr">{b.address || 'Chi nhánh hệ thống'}</span>
                        </div>
                        {isCurrent && (
                          <i className="ph-fill ph-check-circle current-check-icon" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="dropdown-loading">Đang tải danh sách...</div>
                )}
              </div>
            </div>
          )}
        </div>

        <Link to="/m/account" className="mobile-avatar-pill">
          {account?.displayName?.charAt(0).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}



