import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { homeForRole, type AccountRole } from '@/features/auth/authorization';

export function NotFoundPage() {
  let role: AccountRole = 'manager';
  try {
    const auth = useAuth();
    if (auth?.account?.role) {
      role = auth.account.role;
    }
  } catch {
    // Fallback when rendered outside AuthProvider
  }

  const location = useLocation();
  const isMobilePath = location.pathname.startsWith('/m');
  const targetHome = homeForRole(role, isMobilePath);

  return (
    <main className="workspace">
      <div className="workspace-shell">
        <div className="table-empty">
          <div className="state-box">
            <i className="ph ph-warning-circle" />
            <strong>Trang không tồn tại</strong>
            <p>Đường dẫn bạn mở chưa có trong hệ thống hoặc đã được cập nhật.</p>
            <Link className="primary-button" to={targetHome}>
              {isMobilePath ? 'Về trang chủ di động' : 'Về trang tổng quan'}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
