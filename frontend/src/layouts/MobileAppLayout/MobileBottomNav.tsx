import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { canAccessPath } from '@/features/auth/authorization';
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

export function MobileBottomNav() {
  const { account } = useAuth();
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const role = account?.role;

  const renderCenterButton = () => (
    <button
      type="button"
      className="mobile-nav-center-action"
      onClick={() => setIsActionSheetOpen(true)}
      aria-label="Tạo mới nhanh"
    >
      <i className="ph ph-plus" />
    </button>
  );

  return (
    <>
      <nav className="mobile-bottom-nav">
        {role === 'staff' ? (
          <>
            <NavLink to="/m/attendance" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-qr-code" /><span>Chấm công</span>
            </NavLink>
            <NavLink to="/m/my-schedule" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-calendar-check" /><span>Lịch của tôi</span>
            </NavLink>
            {renderCenterButton()}
            <NavLink to="/m/salary" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-wallet" /><span>Lương</span>
            </NavLink>
            <NavLink to="/m/notifications" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-bell" /><span>Thông báo</span>
            </NavLink>
            <NavLink to="/m/account" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-user-circle" /><span>Tài khoản</span>
            </NavLink>
          </>
        ) : role === 'cashier' ? (
          <>
            <NavLink to="/m/pos" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-shopping-cart" /><span>Bán hàng</span>
            </NavLink>
            <NavLink to="/m/appointments" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-calendar-check" /><span>Lịch hẹn</span>
            </NavLink>
            {renderCenterButton()}
            <NavLink to="/m/notifications" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-bell" /><span>Thông báo</span>
            </NavLink>
            <NavLink to="/m/account" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-gear" /><span>Tài khoản</span>
            </NavLink>
          </>
        ) : (
          /* Manager */
          <>
            <NavLink to="/m/dashboard" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-squares-four" /><span>Tổng quan</span>
            </NavLink>
            <NavLink to="/m/appointments" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-calendar-blank" /><span>Lịch dịch vụ</span>
            </NavLink>
            {renderCenterButton()}
            <NavLink to="/m/notifications" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-bell" /><span>Thông báo</span>
            </NavLink>
            <NavLink to="/m/more" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-list" /><span>Nhiều hơn</span>
            </NavLink>
          </>
        )}
      </nav>

      <MobileQuickActionSheet
        isOpen={isActionSheetOpen}
        onClose={() => setIsActionSheetOpen(false)}
      />
    </>
  );
}
