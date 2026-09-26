import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCustomers } from '@/features/operations/operations.api';
import { formatMoney } from '@/lib/format';
import type { DebtCustomer } from '../useCashVoucherForm';

/** Lists customers who still owe money, largest debt first, with a search box. */
export function DebtCustomerPicker({ value, onChange }: { value: DebtCustomer | null; onChange: (customer: DebtCustomer | null) => void }) {
  const [search, setSearch] = useState('');
  const term = search.trim();
  const query = useQuery({
    queryKey: ['cashbook-debt-customers', term],
    queryFn: ({ signal }) => getCustomers({ search: term, debtStatus: 'with_debt', sort: 'debt_desc', page: 1, pageSize: 6 }, { signal }),
    enabled: !value,
  });

  if (value) {
    return (
      <div className="cashbook-customer-selected">
        <div>
          <strong>{value.name}</strong>
          <small>{[value.code, value.phone].filter(Boolean).join(' · ')}</small>
        </div>
        <div className="cashbook-customer-debt">
          <small>Dư nợ</small>
          <strong className="text-danger">{formatMoney(value.debtBalance)}</strong>
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => onChange(null)}>Đổi</button>
      </div>
    );
  }

  const customers = query.data?.data ?? [];
  return (
    <div className="cashbook-customer-picker">
      <label className="input-group">
        <i className="ph ph-magnifying-glass" aria-hidden="true" />
        <input className="input" type="search" value={search} placeholder="Tìm khách còn nợ theo tên, mã, SĐT" aria-label="Tìm khách hàng còn nợ" onChange={(event) => setSearch(event.target.value)} />
      </label>
      <div className="cashbook-customer-results" role="listbox" aria-label="Khách hàng còn nợ">
        {query.isPending ? <p className="field-hint">Đang tải khách hàng…</p>
          : query.error ? <p className="field-error">{query.error.message}</p>
            : !customers.length ? <p className="field-hint">Không có khách hàng nào còn nợ{term ? ' khớp tìm kiếm' : ''}.</p>
              : customers.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="cashbook-customer-option"
                  onClick={() => onChange({ id: row.id, code: row.code, name: row.name, phone: row.phone ?? null, debtBalance: Number(row.debtBalance ?? 0) })}
                >
                  <span><strong>{row.name}</strong><small>{[row.code, row.phone].filter(Boolean).join(' · ')}</small></span>
                  <strong className="text-danger">{formatMoney(row.debtBalance)}</strong>
                </button>
              ))}
      </div>
    </div>
  );
}
