import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMetadata } from '@/services/metadata';
import { usePosSocket } from '@/services/usePosSocket';
import { getBranches } from '@/features/branches/branches.api';
import type { ApiRecord } from '@/types/api';

export function MobileTopBar() {
  const { account, switchBranch } = useAuth();
  const { data: meta } = useMetadata();
  const { isOnline } = usePosSocket();
  const [isBranchSheetOpen, setIsBranchSheetOpen] = useState(false);
  const storeName = meta?.data?.system?.storeName || 'AnnaChill';

  const { data: branchesData } = useQuery({
    queryKey: ['branches-list'],
    queryFn: getBranches,
    enabled: isBranchSheetOpen,
  });

  const branches = (branchesData?.data ?? []) as ApiRecord[];

  const handleSelectBranch = async (branchId: number) => {
    await switchBranch(branchId);
    setIsBranchSheetOpen(false);
  };

  return (
    <>
      <header className="mobile-topbar">
        <Link to="/m" className="mobile-brand">
          <span className="brand-mark"><span /><span /></span>
          <span className="mobile-store-title">{storeName}</span>
        </Link>
        <div className="mobile-top-right">
          <span className={`mobile-status-dot ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Realtime Online' : 'Offline'} />

          {/* Shop Icon Button to switch branches */}
          <button
            type="button"
            className="mobile-shop-button"
            onClick={() => setIsBranchSheetOpen(true)}
            aria-label={`Chi nhánh: ${account?.branchName || 'Chọn chi nhánh'}`}
            title={account?.branchName || 'Chọn chi nhánh'}
          >
            <i className="ph ph-storefront" />
          </button>

          <Link to="/m/account" className="mobile-avatar-pill">
            {account?.displayName?.charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>

      {/* Branch Selection Bottom Sheet */}
      {isBranchSheetOpen && (
        <div className="order-sheet-overlay" onClick={() => setIsBranchSheetOpen(false)}>
          <div className="order-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="order-sheet-handle" />
            <div className="order-sheet-header">
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Chọn chi nhánh làm việc</h2>
                <small style={{ color: '#64748b', fontSize: 12 }}>Đang chọn: <strong>{account?.branchName}</strong></small>
              </div>
              <button
                type="button"
                onClick={() => setIsBranchSheetOpen(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', padding: 4 }}
                aria-label="Đóng"
              >
                <i className="ph ph-x" />
              </button>
            </div>
            <div className="order-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px' }}>
              {branches.length > 0 ? (
                branches.map((b) => {
                  const isCurrent = Number(b.id) === Number(account?.branchId);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectBranch(Number(b.id))}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: isCurrent ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        background: isCurrent ? '#f0f9ff' : '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: isCurrent ? '#0284c7' : '#0f172a', fontSize: 14 }}>
                          {b.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {b.address || 'Chi nhánh hệ thống'}
                        </div>
                      </div>
                      {isCurrent ? (
                        <i className="ph-fill ph-check-circle" style={{ color: '#0284c7', fontSize: 22 }} />
                      ) : (
                        <i className="ph ph-caret-right" style={{ color: '#94a3b8', fontSize: 18 }} />
                      )}
                    </button>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                  Đang tải danh sách chi nhánh...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

