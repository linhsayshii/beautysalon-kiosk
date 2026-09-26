import { useEffect, useState, useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getCustomers } from '@/features/operations/operations.api';
import { CustomerCreateDialog } from '@/features/operations/components/CustomerCreateDialog';
import { formatNumber, initials } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';
import { EmptyState, LoadingState } from '@/components/data-display/DataState';

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data: customerResponse, isLoading, refetch } = useQuery({
    queryKey: ['mobile-customer-select', debouncedSearch],
    queryFn: ({ signal }) => getCustomers({ search: debouncedSearch, page: 1, pageSize: 50 }, { signal }),
    enabled: isOpen,
    placeholderData: keepPreviousData,
  });

  const customers = useMemo(() => {
    return ((customerResponse?.data || []) as unknown as MobileCustomer[]);
  }, [customerResponse]);

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
    <>
    <BottomSheet
      open={isOpen}
      onClose={onClose}
      title="Chọn khách hàng"
      height="full"
      tone="muted"
      headerActions={(
        <button type="button" className="btn btn-soft btn-icon" aria-label="Thêm khách hàng mới" onClick={() => setIsAddCustomerOpen(true)}>
          <i className="ph ph-plus" />
        </button>
      )}
      headerExtra={(
        <div className="sheet-toolbar">
          <label className="input-group">
            <i className="ph ph-magnifying-glass" aria-hidden="true" />
            <input
              type="search"
              placeholder="Tìm khách hàng"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Tìm khách hàng"
              autoFocus
            />
          </label>
        </div>
      )}
    >
      {/* Customer List */}
      <div className="mobile-customer-list">
        {isLoading ? (
          <LoadingState compact label="Đang tải danh sách khách hàng..." />
        ) : customers.length === 0 ? (
          <EmptyState compact icon="ph ph-users" title="Không tìm thấy khách hàng nào" message={null} />
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

    </BottomSheet>

      {/* Customer Create Modal */}
      {isAddCustomerOpen && (
        <CustomerCreateDialog
          onClose={() => setIsAddCustomerOpen(false)}
          onSuccess={handleCustomerCreated}
        />
      )}
    </>
  );
}
