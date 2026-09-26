import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPricebookCustomerOptions } from '../inventory.api';

interface PricebookCustomerPickerProps {
  value: number[];
  onChange: (value: number[]) => void;
}

export function PricebookCustomerPicker({ value, onChange }: PricebookCustomerPickerProps) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const query = useQuery({
    queryKey: ['pricebook-customer-options', deferredSearch, value.join(',')],
    queryFn: () => getPricebookCustomerOptions(deferredSearch, value),
  });
  const options = query.data?.data ?? [];

  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  };

  return (
    <div className="pricebook-customer-picker">
      <input
        type="search"
        className="input"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Tìm tên, mã hoặc số điện thoại"
      />
      <div className="pricebook-customer-options" role="group" aria-label="Khách hàng áp dụng">
        {query.isPending ? <small>Đang tải khách hàng...</small> : options.length === 0 ? <small>Không tìm thấy khách hàng.</small> : options.map((customer) => (
          <label key={customer.id} className="pricebook-customer-option">
            <input type="checkbox" checked={value.includes(customer.id)} onChange={() => toggle(customer.id)} />
            <span><strong>{customer.name}</strong><small>{customer.code}{customer.phone ? ` · ${customer.phone}` : ''}</small></span>
          </label>
        ))}
      </div>
      <small>Đã chọn {value.length} khách hàng. Bảng giá riêng được ưu tiên hơn bảng giá theo thời gian.</small>
    </div>
  );
}
