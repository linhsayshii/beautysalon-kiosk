import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCustomers } from '@/features/operations/operations.api';
import { CustomerCreateDialog } from '@/features/operations/components/CustomerCreateDialog';
import { formatNumber, initials } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import type { RefObject } from 'react';
import { useMobileDialog } from './useMobileDialog';
import './mobile-common.css';

export interface MobileCustomer {
  id: number;
  code?: string;
  name: string;
  phone?: string;
  customerGroup?: string;
  debtBalance?: number;
  remainingPackageUnits?: number;
  totalSpent?: number;
}

interface MobileCustomerSelectSheetProps {
  isOpen: boolean;
  selectedCustomerId?: number | null;
  onClose: () => void;
  onSelectCustomer: (customer: MobileCustomer) => void;
}

export function MobileCustomerSelectSheet({
  isOpen,
  selectedCustomerId,
  onClose,
  onSelectCustomer,
}: MobileCustomerSelectSheetProps) {
  const [search, setSearch] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const { dialogRef, titleId } = useMobileDialog({ isOpen, onClose });

  const { data: customerResponse, isLoading, refetch } = useQuery({
    queryKey: ['mobile-customer-select', search],
    queryFn: () => getCustomers({ search, page: 1, pageSize: 50 }),
    enabled: isOpen,
  });

  const customers = useMemo(() => {
    return ((customerResponse?.data || []) as unknown as MobileCustomer[]);
  }, [customerResponse]);

  if (!isOpen) return null;

  const handleCustomerCreated = (newCust: ApiRecord) => {
    refetch();
    onSelectCustomer({
      id: Number(newCust.id),
      code: newCust.code ? String(newCust.code) : undefined,
      name: String(newCust.name),
      phone: newCust.phone ? String(newCust.phone) : undefined,
      debtBalance: Number(newCust.debtBalance || 0),
      remainingPackageUnits: Number(newCust.remainingPackageUnits || 0),
    });
    onClose();
  };

  return (
    <div
      className="mobile-bottom-sheet-backdrop"
      style={{ zIndex: 90 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef as RefObject<HTMLDivElement>} className="mobile-customer-sheet" style={{ width: '100%' }} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId} className="sr-only">Chọn khách hàng</h2>
        {/* Header Search & Cancel */}
        <header className="mobile-customer-sheet-header">
          <div className="mobile-customer-search-box">
            <i className="ph ph-magnifying-glass search-icon" />
            <input
              type="text"
              className="mobile-customer-search-input"
              placeholder="Tìm khách hàng"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Tìm khách hàng"
              autoFocus
            />
          </div>
          <button
            type="button"
            className="mobile-customer-cancel-btn"
            onClick={onClose}
          >
            Hủy
          </button>
        </header>

        {/* Customer List */}
        <div className="mobile-customer-list">
          {isLoading ? (
            <div className="mobile-customer-state">
              <i className="ph ph-spinner spin" />
              <span>Đang tải danh sách khách hàng...</span>
            </div>
          ) : customers.length === 0 ? (
            <div className="mobile-customer-state">
              <i className="ph ph-users" />
              <span>Không tìm thấy khách hàng nào</span>
            </div>
          ) : (
            customers.map((c) => {
              const isSelected = selectedCustomerId === c.id;
              const remainingUnits = c.remainingPackageUnits ?? 0;
              const debt = c.debtBalance ?? 0;

              return (
                <button
                  type="button"
                  key={c.id}
                  className={`mobile-customer-card ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    onSelectCustomer(c);
                    onClose();
                  }}
                >
                  <div className="mobile-customer-avatar">
                    {initials(c.name) || 'KH'}
                  </div>
                  <div className="mobile-customer-info">
                    <div className="mobile-customer-name-row">
                      <span className="mobile-customer-name">{c.name}</span>
                      {c.code && (
                        <span className="mobile-customer-code">{c.code}</span>
                      )}
                    </div>
                    {c.phone && (
                      <div className="mobile-customer-phone">
                        <i className="ph ph-phone" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                    {(remainingUnits > 0 || debt > 0) && (
                      <div className="mobile-customer-badges">
                        {remainingUnits > 0 && (
                          <span className="mobile-customer-pkg-badge">
                            <i className="ph ph-ticket" />
                            Còn: {formatNumber(remainingUnits)} Buổi DV
                          </span>
                        )}
                        {debt > 0 && (
                          <span className="mobile-customer-debt-badge">
                            <i className="ph ph-warning-circle" />
                            Nợ: {formatNumber(debt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mobile-customer-card-action">
                    <i className={`ph ${isSelected ? 'ph-check-circle' : 'ph-caret-right'}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Floating Action Button (Create Customer) */}
        <button
          type="button"
          className="mobile-customer-fab"
          aria-label="Thêm khách hàng mới"
          onClick={() => setIsAddCustomerOpen(true)}
        >
          <i className="ph ph-plus" />
        </button>
      </div>

      {/* Customer Create Modal */}
      {isAddCustomerOpen && (
        <CustomerCreateDialog
          onClose={() => setIsAddCustomerOpen(false)}
          onSuccess={handleCustomerCreated}
        />
      )}
    </div>
  );
}
