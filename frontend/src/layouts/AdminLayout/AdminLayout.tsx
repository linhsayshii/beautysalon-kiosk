import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { AuthLoading } from '@/features/auth/LoginView';
import { homeForRole, useAuth } from '@/features/auth/AuthProvider';
import { canAccessPath } from '@/features/auth/authorization';
import { shouldRedirectToMobile } from '@/pwa/device-detect';

export function AdminLayout() {
  const { account, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthLoading />;
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (shouldRedirectToMobile(location.pathname)) {
    const mobileHome = homeForRole(account.role, true);
    return <Navigate to={mobileHome} replace />;
  }

  if (!canAccessPath(account.role, location.pathname)) return <Navigate to={homeForRole(account.role)} replace />;
  return (
    <div className="app-shell">
      <Header />
      <Outlet />
    </div>
  );
}
