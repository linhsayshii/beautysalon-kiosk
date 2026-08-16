import { useState, useRef, useEffect } from 'react';
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const storeName = meta?.data?.system?.storeName || 'AnnaChill';

  const { data: branchesData } = useQuery({
    queryKey: ['branches-list'],
    queryFn: getBranches,
    enabled: isDropdownOpen,
  });

  const branches = (branchesData?.data ?? []) as ApiRecord[];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleSelectBranch = async (branchId: number) => {
    await switchBranch(branchId);
    setIsDropdownOpen(false);
  };

  return (
    <header className="mobile-topbar">
      <Link to="/m" className="mobile-brand">
        <span className="brand-mark"><span /><span /></span>
        <span className="mobile-store-title">{storeName}</span>
      </Link>

      <div className="mobile-top-right">
        <span className={`mobile-status-dot ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Realtime Online' : 'Offline'} />

        {/* Shop Icon Button & Dropdown Menu Container */}
        <div className="mobile-shop-dropdown-container" ref={dropdownRef}>
          <button
            type="button"
            className={`mobile-shop-button ${isDropdownOpen ? 'is-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsDropdownOpen((prev) => !prev);
            }}
            aria-label={`Chi nhánh: ${account?.branchName || 'Chọn chi nhánh'}`}
            title={account?.branchName || 'Chọn chi nhánh'}
          >
            <i className="ph ph-storefront" />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="mobile-shop-dropdown-menu" role="menu">
              <div className="mobile-dropdown-header">
                <span>Chi nhánh làm việc</span>
                <small>Đang chọn: <strong>{account?.branchName}</strong></small>
              </div>

              <div className="mobile-dropdown-list">
                {branches.length > 0 ? (
                  branches.map((b) => {
                    const isCurrent = Number(b.id) === Number(account?.branchId);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        className={`mobile-dropdown-item ${isCurrent ? 'is-current' : ''}`}
                        onClick={() => handleSelectBranch(Number(b.id))}
                        role="menuitem"
                      >
                        <div className="dropdown-item-info">
                          <strong className="branch-name">{b.name}</strong>
                          <span className="branch-addr">{b.address || 'Chi nhánh hệ thống'}</span>
                        </div>
                        {isCurrent && (
                          <i className="ph-fill ph-check-circle current-check-icon" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="dropdown-loading">Đang tải danh sách...</div>
                )}
              </div>
            </div>
          )}
        </div>

        <Link to="/m/account" className="mobile-avatar-pill">
          {account?.displayName?.charAt(0).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}


