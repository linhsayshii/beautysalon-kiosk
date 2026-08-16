import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { AuthLoading } from '@/features/auth/LoginView';
import { homeForRole, useAuth } from '@/features/auth/AuthProvider';
import { canAccessPath } from '@/features/auth/authorization';
import { shouldRedirectToMobile, isMobileDevice, setPreferredUiMode } from '@/pwa/device-detect';

export function AdminLayout() {
  const { account, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showMobileBanner, setShowMobileBanner] = useState(false);

  useEffect(() => {
    // If on a mobile device and user explicitly chose desktop, show a floating helper banner
    if (isMobileDevice()) {
      setShowMobileBanner(true);
    }
  }, []);

  if (loading) return <AuthLoading />;
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (shouldRedirectToMobile(location.pathname)) {
    const mobileHome = homeForRole(account.role, true);
    return <Navigate to={mobileHome} replace />;
  }

  if (!canAccessPath(account.role, location.pathname)) return <Navigate to={homeForRole(account.role)} replace />;

  const handleSwitchToMobile = () => {
    setPreferredUiMode('mobile');
    navigate(homeForRole(account.role, true));
  };

  return (
    <div className="app-shell">
      <Header />
      <Outlet />

      {/* Floating helper banner for mobile screens viewing desktop */}
      {showMobileBanner && (
        <aside className="mobile-switch-floating-banner" aria-label="Gợi ý chuyển sang giao diện di động">
          <div className="banner-text">
            <i className="ph ph-device-mobile" />
            <span>Bạn đang xem bản máy tính</span>
          </div>
          <div className="banner-actions">
            <button
              type="button"
              className="switch-btn"
              onClick={handleSwitchToMobile}
            >
              Về bản di động
            </button>
            <button
              type="button"
              className="close-btn"
              onClick={() => setShowMobileBanner(false)}
              aria-label="Đóng thông báo"
            >
              <i className="ph ph-x" />
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
