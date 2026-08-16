import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeForRole } from '@/features/auth/AuthProvider';
import { canAccessPath } from '@/features/auth/authorization';
import { AuthLoading } from '@/features/auth/LoginView';
import { MobileTopBar } from './MobileTopBar';
import { MobileBottomNav } from './MobileBottomNav';
import '@/styles/mobile.css';

export function MobileAppLayout() {
  const { account, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!canAccessPath(account.role, location.pathname)) return <Navigate to={homeForRole(account.role, true)} replace />;

  return (
    <div className="mobile-app-shell">
      <MobileTopBar />
      <main
        className={`mobile-main-content ${
          location.pathname.startsWith('/m/orders') ||
          location.pathname.startsWith('/m/products') ||
          location.pathname.startsWith('/m/appointments') ||
          location.pathname.startsWith('/m/customers') ||
          location.pathname.startsWith('/m/customer-cards') ||
          location.pathname.startsWith('/m/purchase-orders') ||
          location.pathname.startsWith('/m/pricebooks')
            ? 'is-full-bleed'
            : ''
        }`}
      >
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}
