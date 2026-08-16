import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMetadata } from '@/services/metadata';
import { usePosSocket } from '@/services/usePosSocket';

export function MobileTopBar() {
  const { account } = useAuth();
  const { data: meta } = useMetadata();
  const { isOnline } = usePosSocket();
  const storeName = meta?.data?.system?.storeName || 'AnnaChill';

  return (
    <header className="mobile-topbar">
      <Link to="/m" className="mobile-brand">
        <span className="brand-mark"><span /><span /></span>
        <span className="mobile-store-title">{storeName}</span>
      </Link>
      <div className="mobile-top-right">
        <span className={`mobile-status-dot ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Realtime Online' : 'Offline'} />
        <span className="mobile-branch-tag">{account?.branchName || 'Chi nhánh'}</span>
        <Link to="/m/account" className="mobile-avatar-pill">
          {account?.displayName?.charAt(0).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
