import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { formatMoney, formatDateTime } from '@/lib/format';
import { getCustomerDebt, collectCustomerDebt, usePaymentRequestKey } from './debts.api';
import { statusLabels } from '@/types/api';

export function CustomerDebtPanel({customerId}: {customerId:number}) {
  const client = useQueryClient();
  const query = useQuery({queryKey:['customer-debt',customerId],queryFn:()=>getCustomerDebt(customerId)});
  const [collecting,setCollecting] = useState(false);
  const [amount,setAmount] = useState(0);
  const [method,setMethod] = useState('cash');
  const [invoiceId,setInvoiceId] = useState<number | null>(null);
  const [note,setNote] = useState('');
  const [sequence,setSequence] = useState(0);
  const [notice,setNotice] = useState('');
  const requestKey = usePaymentRequestKey();
  const mutation = useMutation({
    mutationFn: () => {
      const body = {amount,paymentMethod:method,invoiceId,note};
      return collectCustomerDebt(customerId,{...body,requestKey:requestKey({customerId,sequence,...body})});
    },
    onSuccess: res => {
      setSequence(n=>n+1);setCollecting(false);setAmount(0);setNote('');setInvoiceId(null);
      setNotice(`Đã thu ${formatMoney(res.data.amount)} · Phiếu #${res.data.paymentId} · Còn nợ ${formatMoney(res.data.balance)}`);
      void client.invalidateQueries();
    },
  });
  if (query.isPending) return <p>Đang tải công nợ…</p>;
  if (query.error) return <div role="alert">{query.error.message} <button type="button" onClick={()=>query.refetch()}>Thử lại</button></div>;
  const debt = query.data.data;
  const maximum = invoiceId ? debt.invoices.find(i=>i.id===invoiceId)?.debtAmount ?? 0 : debt.balance;
  return <section className="debt-panel" aria-label="Công nợ khách hàng">
    <div className="debt-heading"><div><span>Dư nợ hiện tại</span><strong>{formatMoney(debt.balance)}</strong></div>
      {debt.balance > 0 && !collecting && <button type="button" className="btn btn-primary" onClick={()=>{setCollecting(true);setAmount(debt.balance);setNotice('');mutation.reset();}}>Thu nợ</button>}
    </div>
    {notice && <p role="status">{notice}</p>}
    {collecting && <div role="group" aria-label="Thu nợ" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();}}}>
      <fieldset disabled={mutation.isPending} className="debt-form">
        <label>Khoản cần thu<select value={invoiceId ?? ''} onChange={e=>{const id=e.target.value ? Number(e.target.value):null;setInvoiceId(id);setAmount(id ? debt.invoices.find(i=>i.id===id)!.debtAmount : debt.balance);}}>
          <option value="">Tự động trả khoản cũ nhất</option>{debt.invoices.map(i=><option key={i.id} value={i.id}>{i.code} · {formatMoney(i.debtAmount)}</option>)}
        </select></label>
        <label>Số tiền thu (VNĐ)<MoneyInput value={amount} onChange={setAmount} allowEmpty={false} /></label>
        <label>Phương thức<select value={method} onChange={e=>setMethod(e.target.value)}><option value="cash">Tiền mặt</option><option value="bank_transfer">Chuyển khoản</option><option value="card">Thẻ ngân hàng</option></select></label>
        <label>Ghi chú<input value={note} maxLength={300} onChange={e=>setNote(e.target.value)} /></label>
        <p>Dư nợ sau thu: <strong>{formatMoney(Math.max(0,debt.balance-amount))}</strong></p>
        {amount>maximum && <p role="alert">Số tiền vượt khoản nợ được chọn.</p>}
        {mutation.error && <p role="alert">{mutation.error.message}</p>}
        <div className="debt-actions"><button type="button" onClick={()=>setCollecting(false)}>Hủy</button><button type="button" className="btn btn-primary" disabled={amount<=0 || amount>maximum} onClick={()=>{if(!mutation.isPending && amount>0 && amount<=maximum) mutation.mutate();}}>{mutation.isPending?'Đang thu…':'Xác nhận thu nợ'}</button></div>
      </fieldset>
    </div>}
    {debt.openingDebt>0 && <p>Nợ đầu kỳ còn lại: <strong>{formatMoney(debt.openingDebt)}</strong></p>}
    <h4>Hóa đơn còn nợ</h4>
    {!debt.invoices.length && <p>Không có hóa đơn còn nợ.</p>}
    {debt.invoices.map(i=><article className="debt-row" key={i.id}><div><strong>{i.code}</strong><small>{formatDateTime(i.issuedAt)}</small></div><div><span>Tổng: {formatMoney(i.total)} · Đã trả: {formatMoney(i.amountPaid)}</span><strong>Còn nợ: {formatMoney(i.debtAmount)}</strong></div></article>)}
    <h4>Lịch sử công nợ</h4>
    <small>Hiển thị tối đa 200 giao dịch gần nhất.</small>
    {!debt.entries.length && <p>Chưa có phát sinh công nợ.</p>}
    {debt.entries.map(e=><article className="debt-row" key={e.id}><div><strong>{e.kind==='opening'?'Nợ đầu kỳ':e.kind==='charge'?`Ghi nợ ${e.invoiceCode}`:'Thu nợ'}</strong><small>{formatDateTime(e.createdAt)} · {e.actorName ?? 'Hệ thống'}</small>{e.paymentMethod && <small>{statusLabels[e.paymentMethod] ?? e.paymentMethod}</small>}{e.note && <small>{e.note}</small>}{e.allocations?.map((a,index)=><small key={index}>{a.invoiceCode ?? 'Nợ đầu kỳ'}: {formatMoney(a.amount)}</small>)}</div><div><strong>{e.amount>0?'+':''}{formatMoney(e.amount)}</strong><small>Dư nợ: {formatMoney(e.balanceAfter)}</small></div></article>)}
  </section>;
}
