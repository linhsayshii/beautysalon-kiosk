import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { DateTimePickerField } from '@/components/ui/DateTimePicker';
import { Modal } from '@/components/ui/Modal/Modal';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { usePaymentRequestKey } from '@/features/debts/debts.api';
import { zonedLocalDateTimeToIso } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { createCashTransfer, createOpeningBalance, fundLabels, type CashFund, type CashFundBalance } from '../cashbook.api';
import { cashbookQueryPrefixes } from '../useCashVoucherForm';

export type CashFundAction = 'transfer' | 'opening';
const funds: CashFund[] = ['cash', 'bank'];

/** Manager-only fund operations: move money between funds or record an opening balance. */
export function CashFundModal({ action, balances, onClose }: { action: CashFundAction; balances?: CashFundBalance[]; onClose: () => void }) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const requestKey = usePaymentRequestKey();
  const [fromFund, setFromFund] = useState<CashFund>('cash');
  const [fund, setFund] = useState<CashFund>('cash');
  const [amount, setAmount] = useState(0);
  const [occurredAt, setOccurredAt] = useState('');
  const [note, setNote] = useState('');
  const toFund: CashFund = fromFund === 'cash' ? 'bank' : 'cash';
  const isTransfer = action === 'transfer';
  const available = balances?.find((balance) => balance.fund === fromFund)?.currentBalance;

  const mutation = useMutation({
    mutationFn: () => {
      const occurred = occurredAt ? zonedLocalDateTimeToIso(occurredAt) ?? undefined : undefined;
      if (isTransfer) {
        const body = { fromFund, toFund, amount, occurredAt: occurred, note: note.trim() };
        return createCashTransfer({ ...body, requestKey: requestKey(body) }).then(() => `Đã chuyển ${formatMoney(amount)} từ ${fundLabels[fromFund]} sang ${fundLabels[toFund]}.`);
      }
      const body = { fund, amount, occurredAt: occurred, note: note.trim() };
      return createOpeningBalance({ ...body, requestKey: requestKey(body) }).then((result) => `Đã ghi ${result.data.code} · số dư đầu kỳ ${fundLabels[fund]} ${formatMoney(amount)}.`);
    },
    onSuccess: (message) => {
      cashbookQueryPrefixes.forEach((queryKey) => { void queryClient.invalidateQueries({ queryKey }); });
      notify('Đã ghi sổ quỹ', message);
      onClose();
    },
  });
  const pending = mutation.isPending;

  return (
    <Modal open onClose={onClose} size="sm" closeOnBackdrop={!pending}
      title={isTransfer ? 'Chuyển quỹ' : 'Số dư đầu kỳ'}
      subtitle={isTransfer ? 'Ví dụ: nộp tiền mặt vào tài khoản ngân hàng' : 'Ghi số tiền đang có trong quỹ khi bắt đầu dùng sổ quỹ'}>
      <form onSubmit={(event) => { event.preventDefault(); if (amount > 0 && !pending) mutation.mutate(); }}>
        <div className="modal-body form-stack">
          <div className="field">
            <span className="field-label">{isTransfer ? 'Chuyển từ quỹ' : 'Quỹ'}</span>
            <div className="segmented segmented-block" role="group" aria-label={isTransfer ? 'Quỹ chuyển' : 'Quỹ'}>
              {funds.map((item) => (
                <button key={item} type="button" aria-pressed={(isTransfer ? fromFund : fund) === item} onClick={() => (isTransfer ? setFromFund(item) : setFund(item))}>
                  <i className={`ph ${item === 'cash' ? 'ph-money' : 'ph-bank'}`} aria-hidden="true" />{fundLabels[item]}
                </button>
              ))}
            </div>
            {isTransfer && <p className="field-hint">Nhận vào quỹ {fundLabels[toFund]}{available !== undefined ? ` · Tồn quỹ ${fundLabels[fromFund]} hiện tại ${formatMoney(available)}` : ''}</p>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="cash-fund-amount">Số tiền <span className="field-required">*</span></label>
            <MoneyInput id="cash-fund-amount" className="input" value={amount || ''} onChange={setAmount} allowEmpty suffix="đ" />
            {isTransfer && available !== undefined && amount > available && <p className="field-error">Số tiền lớn hơn tồn quỹ hiện tại.</p>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="cash-fund-time">Thời gian</label>
            <DateTimePickerField id="cash-fund-time" className="input" value={occurredAt} onChange={setOccurredAt} placeholder="Bây giờ" title="Thời gian ghi sổ" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="cash-fund-note">Ghi chú</label>
            <input id="cash-fund-note" className="input" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
          </div>
          {mutation.error && <div className="alert alert-danger" role="alert">{mutation.error.message}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Bỏ qua</button>
          <button type="submit" className="btn btn-primary" disabled={amount <= 0 || pending}>{pending ? 'Đang lưu…' : 'Lưu'}</button>
        </div>
      </form>
    </Modal>
  );
}
