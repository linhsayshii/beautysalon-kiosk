import { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { canAccessPath, type AccountRole } from '@/features/auth/authorization';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';

interface QuickActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileQuickActionSheet({ isOpen, onClose }: QuickActionSheetProps) {
  const { account } = useAuth();

  return (
    <BottomSheet open={isOpen} onClose={onClose} title="Tạo mới nhanh" className="mobile-quick-action-sheet">
      <div className="mobile-quick-action-list">
        {account && canAccessPath(account.role, '/m/appointments/new') && <Link to="/m/appointments/new" className="mobile-quick-action-item" onClick={onClose}>
          <div className="mobile-quick-action-icon action-appointment">
            <i className="ph ph-calendar-plus" />
          </div>
          <div className="mobile-quick-action-info">
            <div className="mobile-quick-action-name">Tạo lịch hẹn</div>
            <div className="mobile-quick-action-desc">Đặt lịch dịch vụ, chọn nhân viên & khung giờ</div>
          </div>
          <i className="ph ph-caret-right mobile-quick-action-arrow" />
        </Link>}

        {account && canAccessPath(account.role, '/m/invoices/new') && <Link to="/m/invoices/new" className="mobile-quick-action-item" onClick={onClose}>
          <div className="mobile-quick-action-icon action-invoice">
            <i className="ph ph-receipt" />
          </div>
          <div className="mobile-quick-action-info">
            <div className="mobile-quick-action-name">Tạo hóa đơn bán hàng</div>
            <div className="mobile-quick-action-desc">Thanh toán nhanh, xuất bill & tính hoa hồng thợ</div>
          </div>
          <i className="ph ph-caret-right mobile-quick-action-arrow" />
        </Link>}

        {account && canAccessPath(account.role, '/m/cashbook') && <Link to="/m/cashbook?create=1" className="mobile-quick-action-item" onClick={onClose}>
          <div className="mobile-quick-action-icon action-cashbook">
            <i className="ph ph-wallet" />
          </div>
          <div className="mobile-quick-action-info">
            <div className="mobile-quick-action-name">Lập phiếu thu chi</div>
            <div className="mobile-quick-action-desc">Ghi thu, chi tiền mặt hoặc chuyển khoản vào sổ quỹ</div>
          </div>
          <i className="ph ph-caret-right mobile-quick-action-arrow" />
        </Link>}

        {account && canAccessPath(account.role, '/m/customers') && !canAccessPath(account.role, '/m/cashbook') && (
          <Link to="/m/customers?debt=1" className="mobile-quick-action-item" onClick={onClose}>
            <div className="mobile-quick-action-icon action-cashbook">
              <i className="ph ph-hand-coins" />
            </div>
            <div className="mobile-quick-action-info">
              <div className="mobile-quick-action-name">Thu nợ khách hàng</div>
              <div className="mobile-quick-action-desc">Chọn khách đang nợ & ghi nhận khoản thu</div>
            </div>
            <i className="ph ph-caret-right mobile-quick-action-arrow" />
          </Link>
        )}

        {account && canAccessPath(account.role, '/m/customers') && (
          <Link to="/m/customers?create=1" className="mobile-quick-action-item" onClick={onClose}>
            <div className="mobile-quick-action-icon action-customer">
              <i className="ph ph-user-plus" />
            </div>
            <div className="mobile-quick-action-info">
              <div className="mobile-quick-action-name">Thêm khách hàng</div>
              <div className="mobile-quick-action-desc">Đăng ký hồ sơ khách mới & gói thẻ dịch vụ</div>
            </div>
            <i className="ph ph-caret-right mobile-quick-action-arrow" />
          </Link>
        )}
      </div>
    </BottomSheet>
  );
}

type NavTab = { to: string; icon: string; label: string };

/** Bottom-nav tabs per role; the centre "Tạo mới nhanh" button sits between the two pairs. */
const NAV_TABS: Record<AccountRole, [NavTab, NavTab, NavTab, NavTab]> = {
  manager: [
    { to: '/m/dashboard', icon: 'ph-squares-four', label: 'Tổng quan' },
    { to: '/m/appointments', icon: 'ph-calendar-blank', label: 'Lịch dịch vụ' },
    { to: '/m/notifications', icon: 'ph-bell', label: 'Thông báo' },
    { to: '/m/more', icon: 'ph-list', label: 'Nhiều hơn' },
  ],
  cashier: [
    { to: '/m/pos', icon: 'ph-shopping-cart', label: 'Bán hàng' },
    { to: '/m/appointments', icon: 'ph-calendar-check', label: 'Lịch hẹn' },
    { to: '/m/notifications', icon: 'ph-bell', label: 'Thông báo' },
    { to: '/m/account', icon: 'ph-gear', label: 'Tài khoản' },
  ],
  // The staff account opens from the top-bar avatar.
  staff: [
    { to: '/m/attendance', icon: 'ph-qr-code', label: 'Chấm công' },
    { to: '/m/my-schedule', icon: 'ph-calendar-check', label: 'Lịch của tôi' },
    { to: '/m/salary', icon: 'ph-wallet', label: 'Lương' },
    { to: '/m/notifications', icon: 'ph-bell', label: 'Thông báo' },
  ],
};

/** A tab page has no back button: it is a root the bottom nav switches to. */
export function useIsTabRoot() {
  const { account } = useAuth();
  const { pathname } = useLocation();
  return Boolean(account && NAV_TABS[account.role].some((tab) => tab.to === pathname));
}

export function MobileBottomNav() {
  const { account } = useAuth();
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  if (!account) return null;
  const [first, second, third, fourth] = NAV_TABS[account.role];
  const tab = ({ to, icon, label }: NavTab) => (
    <NavLink key={to} to={to} className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
      <i className={`ph ${icon}`} /><span>{label}</span>
    </NavLink>
  );

  return (
    <>
      <nav className="mobile-bottom-nav">
        {tab(first)}
        {tab(second)}
        <button
          type="button"
          className="mobile-nav-center-action"
          onClick={() => setIsActionSheetOpen(true)}
          aria-label="Tạo mới nhanh"
        >
          <i className="ph ph-plus" />
        </button>
        {tab(third)}
        {tab(fourth)}
      </nav>

      <MobileQuickActionSheet
        isOpen={isActionSheetOpen}
        onClose={() => setIsActionSheetOpen(false)}
      />
    </>
  );
}
