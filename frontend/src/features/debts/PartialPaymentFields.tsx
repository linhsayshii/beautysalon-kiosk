import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { formatMoney } from '@/lib/format';
import { getCustomerDebt } from './debts.api';
import { useMetadata } from '@/services/metadata';

export function PartialPaymentFields({customerId,total,amount,onAmountChange,allowDebt,onAllowDebtChange,method,disabled=false,showTransferQr=true,compact=false}: {
  customerId?: number | null; total:number; amount:number; onAmountChange:(n:number)=>void;
  allowDebt:boolean; onAllowDebtChange:(v:boolean)=>void; method:string; disabled?:boolean; showTransferQr?:boolean; compact?:boolean;
}) {
  const id = useId();
  const metadata = useMetadata();
  const bank = metadata.data?.data.system?.vietqr;
  const query = useQuery({queryKey:['customer-debt',customerId],queryFn:()=>getCustomerDebt(customerId!),enabled:!!customerId});
  const debt = Math.max(0,total-amount);
  return <section className="debt-panel" aria-label="Thanh toán và công nợ">
    {method !== 'wallet' && <label htmlFor={id}>Khách thanh toán lần này (VNĐ)
      <MoneyInput id={id} value={amount} onChange={onAmountChange} disabled={disabled} allowEmpty={false} />
    </label>}
    {method !== 'wallet' && <button type="button" className="btn btn-soft" disabled={disabled} onClick={()=>onAmountChange(total)}>{compact ? 'Điền đủ số tiền' : 'Thanh toán đủ'}</button>}
    <div className="debt-facts" aria-live="polite">
      <span>Nợ cũ <strong>{!customerId ? 'Chưa chọn khách hàng' : query.data ? formatMoney(query.data.data.balance) : query.isError ? 'Không tải được' : 'Đang tải…'}</strong></span>
      {(!compact || debt > 0) && <span>Nợ hóa đơn này <strong>{formatMoney(debt)}</strong></span>}
      {(!compact || debt > 0) && <span>Dư nợ sau giao dịch <strong>{query.data ? formatMoney(query.data.data.balance+debt) : '—'}</strong></span>}
      {method === 'cash' && amount > total && <span>Tiền thừa trả khách <strong>{formatMoney(amount-total)}</strong></span>}
    </div>
    {compact && <small>Nợ cũ không cộng vào số tiền thu hóa đơn này.</small>}
    {debt > 0 && <label className="debt-consent"><input type="checkbox" checked={allowDebt} onChange={e=>onAllowDebtChange(e.target.checked)} disabled={disabled} /> Cho phép ghi nợ phần còn lại</label>}
    {method !== 'cash' && amount > total && <p role="alert">Số tiền thanh toán vượt tổng hóa đơn.</p>}
    {showTransferQr && method === 'bank_transfer' && amount > 0 && amount <= total && bank?.bankBin && bank.accountNumber && <div className="debt-qr">
      <img alt="VietQR thanh toán lần này" src={`https://img.vietqr.io/image/${encodeURIComponent(bank.bankBin)}-${encodeURIComponent(bank.accountNumber)}-qr_only.png?amount=${amount}&accountName=${encodeURIComponent(bank.accountName)}&addInfo=${encodeURIComponent(`THANH TOAN KH ${customerId ?? ''}`)}`} />
      <span>Chuyển khoản {formatMoney(amount)}</span><small>{bank.accountNumber} · {bank.accountName}</small>
    </div>}
  </section>;
}
