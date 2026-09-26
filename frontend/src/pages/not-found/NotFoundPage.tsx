import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { homeForRole, type AccountRole } from '@/features/auth/authorization';
import { EmptyState } from '@/components/data-display/DataState';

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
    <main className="page">
      <EmptyState
        icon="ph ph-warning-circle"
        title="Trang không tồn tại"
        message="Đường dẫn bạn mở chưa có trong hệ thống hoặc đã được cập nhật."
        action={(
          <Link className="btn btn-primary" to={targetHome}>
            {isMobilePath ? 'Về trang chủ di động' : 'Về trang tổng quan'}
          </Link>
        )}
      />
    </main>
  );
}
