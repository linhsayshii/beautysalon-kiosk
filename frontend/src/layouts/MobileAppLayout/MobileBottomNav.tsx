import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';

export function MobileBottomNav() {
  const { account } = useAuth();
  const role = account?.role;

  if (role === 'staff') {
    return (
      <nav className="mobile-bottom-nav">
        <NavLink to="/m/attendance" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-qr-code" /><span>Chấm công</span>
        </NavLink>
        <NavLink to="/m/schedule" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-calendar-check" /><span>Lịch làm</span>
        </NavLink>
        <NavLink to="/m/salary" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-wallet" /><span>Lương</span>
        </NavLink>
        <NavLink to="/m/account" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-user-circle" /><span>Tài khoản</span>
        </NavLink>
      </nav>
    );
  }

  if (role === 'cashier') {
    return (
      <nav className="mobile-bottom-nav">
        <NavLink to="/m/pos" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-shopping-cart" /><span>Bán hàng</span>
        </NavLink>
        <NavLink to="/m/orders" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-receipt" /><span>Đơn hàng</span>
        </NavLink>
        <NavLink to="/m/customers" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-users" /><span>Khách hàng</span>
        </NavLink>
        <NavLink to="/m/account" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-gear" /><span>Tài khoản</span>
        </NavLink>
      </nav>
    );
  }

  // Manager
  return (
    <nav className="mobile-bottom-nav">
      <NavLink to="/m/dashboard" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
        <i className="ph ph-squares-four" /><span>Tổng quan</span>
      </NavLink>
      <NavLink to="/m/pos" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
        <i className="ph ph-shopping-cart" /><span>Bán hàng</span>
      </NavLink>
      <NavLink to="/m/orders" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
        <i className="ph ph-receipt" /><span>Đơn hàng</span>
      </NavLink>
      <NavLink to="/m/staff" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
        <i className="ph ph-users-three" /><span>Nhân sự</span>
      </NavLink>
      <NavLink to="/m/account" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
        <i className="ph ph-gear" /><span>Cài đặt</span>
      </NavLink>
    </nav>
  );
}
