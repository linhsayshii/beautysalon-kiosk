import { useState } from 'react';
import type { RefObject } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMobileDialog } from '@/features/mobile-common/useMobileDialog';

interface QuickActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileQuickActionSheet({ isOpen, onClose }: QuickActionSheetProps) {
  const { account } = useAuth();
  const { dialogRef, titleId } = useMobileDialog({ isOpen, onClose });
  if (!isOpen) return null;

  return (
    <div className="mobile-bottom-sheet-backdrop" onClick={onClose}>
      <div ref={dialogRef as RefObject<HTMLDivElement>} className="mobile-bottom-sheet mobile-quick-action-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="mobile-sheet-drag-handle" />
        <div className="mobile-quick-action-header">
          <h3 id={titleId} className="mobile-quick-action-title">Tạo mới nhanh</h3>
          <button type="button" className="mobile-quick-action-close" onClick={onClose} aria-label="Đóng">
            <i className="ph ph-x" />
          </button>
        </div>
        <div className="mobile-quick-action-list">
          <Link to="/m/appointments/new" className="mobile-quick-action-item" onClick={onClose}>
            <div className="mobile-quick-action-icon action-appointment">
              <i className="ph ph-calendar-plus" />
            </div>
            <div className="mobile-quick-action-info">
              <div className="mobile-quick-action-name">Tạo lịch hẹn</div>
              <div className="mobile-quick-action-desc">Đặt lịch dịch vụ, chọn nhân viên & khung giờ</div>
            </div>
            <i className="ph ph-caret-right mobile-quick-action-arrow" />
          </Link>

          <Link to="/m/invoices/new" className="mobile-quick-action-item" onClick={onClose}>
            <div className="mobile-quick-action-icon action-invoice">
              <i className="ph ph-receipt" />
            </div>
            <div className="mobile-quick-action-info">
              <div className="mobile-quick-action-name">Tạo hóa đơn bán hàng</div>
              <div className="mobile-quick-action-desc">Thanh toán nhanh, xuất bill & tính hoa hồng thợ</div>
            </div>
            <i className="ph ph-caret-right mobile-quick-action-arrow" />
          </Link>

          {account?.role !== 'staff' && (
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
      </div>
    </div>
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
            <NavLink to="/m/account" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-user-circle" /><span>Tài khoản</span>
            </NavLink>
          </>
        ) : role === 'cashier' ? (
          <>
            <NavLink to="/m/pos" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-shopping-cart" /><span>Bán hàng</span>
            </NavLink>
            <NavLink to="/m/orders" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-receipt" /><span>Đơn hàng</span>
            </NavLink>
            {renderCenterButton()}
            <NavLink to="/m/customers" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
              <i className="ph ph-users" /><span>Khách hàng</span>
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
