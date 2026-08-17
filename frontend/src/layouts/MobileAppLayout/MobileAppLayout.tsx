import { useEffect, useRef } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeForRole } from '@/features/auth/AuthProvider';
import { canAccessPath } from '@/features/auth/authorization';
import { AuthLoading } from '@/features/auth/LoginView';
import { MobileTopBar } from './MobileTopBar';
import { MobileBottomNav } from './MobileBottomNav';
import '@/styles/mobile.css';

const FULL_BLEED_PREFIXES = [
  '/m/orders',
  '/m/products',
  '/m/appointments',
  '/m/invoices/new',
  '/m/customers',
  '/m/customer-cards',
  '/m/purchase-orders',
  '/m/pricebooks',
  '/m/staff',
  '/m/attendance/qr',
  '/m/account',
];

export function MobileAppLayout() {
  const { account, loading } = useAuth();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mainRef.current) {
      if (typeof mainRef.current.scrollTo === 'function') {
        mainRef.current.scrollTo(0, 0);
      } else {
        mainRef.current.scrollTop = 0;
      }
    }
    if (typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.key]);

  if (loading) return <AuthLoading />;
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!canAccessPath(account.role, location.pathname)) return <Navigate to={homeForRole(account.role, true)} replace />;

  const isFullBleed = FULL_BLEED_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));

  return (
    <div className="mobile-app-shell">
      <MobileTopBar />
      <main
        ref={mainRef}
        className={`mobile-main-content ${isFullBleed ? 'is-full-bleed' : ''}`}
      >
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}
