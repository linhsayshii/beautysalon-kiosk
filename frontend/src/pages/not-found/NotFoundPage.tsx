import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return <main className="workspace"><div className="workspace-shell"><div className="table-empty"><div className="state-box"><i className="ph ph-warning-circle" /><strong>Trang không tồn tại</strong><p>Đường dẫn bạn mở chưa có trong hệ thống.</p><Link className="primary-button" to="/dashboard">Về tổng quan</Link></div></div></div></main>;
}
