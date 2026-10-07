import { useEffect, useState, useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createPosCustomer, searchPosCustomers } from '@/features/pos/pos.api';
import { CustomerCreateDialog } from '@/features/operations/components/CustomerCreateDialog';
import { formatMoney, formatNumber, initials } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { MobileSearchBar } from './MobileSearchBar';

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

  const { data: customerResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['mobile-customer-select', debouncedSearch],
    // POS endpoints: every role that sells or books (pos:use) may search and add customers.
    queryFn: () => searchPosCustomers(debouncedSearch, 50),
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
          <MobileSearchBar placeholder="Tìm khách hàng" value={search} onChange={setSearch} autoFocus />
        </div>
      )}
    >
      {/* Customer List */}
      <div className="m-list">
        {isLoading ? (
          <LoadingState compact label="Đang tải danh sách khách hàng..." />
        ) : error ? (
          <ErrorState compact error={error} onRetry={() => refetch()} />
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
                className="m-list-row"
                aria-pressed={isSelected}
                onClick={() => {
                  onSelectCustomer(c);
                  onClose();
                }}
              >
                <div className="m-list-avatar is-round" aria-hidden="true">
                  {initials(c.name) || 'KH'}
                </div>
                <div className="m-list-copy">
                  <strong>{c.name}</strong>
                  {c.code && <small>{c.code}</small>}
                  {c.phone && (
                    <small>{c.phone}</small>
                  )}
                  {(remainingUnits > 0 || debt > 0) && (
                    <div className="m-list-meta">
                      {remainingUnits > 0 && (
                        <span className="badge badge-violet">
                          <i className="ph ph-ticket" />
                          Còn: {formatNumber(remainingUnits)} Buổi DV
                        </span>
                      )}
                      {debt > 0 && (
                        <span className="badge badge-danger">
                          <i className="ph ph-warning-circle" />
                          Nợ: {formatMoney(debt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="m-list-value" aria-hidden="true">
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
          customMutationFn={createPosCustomer}
          onClose={() => setIsAddCustomerOpen(false)}
          onSuccess={handleCustomerCreated}
        />
      )}
    </>
  );
}
