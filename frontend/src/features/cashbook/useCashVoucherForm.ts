import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { hasPermission } from '@/features/auth/authorization';
import { collectCustomerDebt, usePaymentRequestKey } from '@/features/debts/debts.api';
import { zonedLocalDateTimeToIso } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { useMetadata } from '@/services/metadata';
import { createCashVoucher, type CashFund, type CashVoucherType } from './cashbook.api';

export const DEBT_COLLECTION_KEY = 'debt_collection';

export interface DebtCustomer {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  debtBalance: number;
}

export interface CashVoucherResult {
  message: string;
}

/** Query caches that show fund balances or customer debt. */
export const cashbookQueryPrefixes = [['cashbook'], ['cashbook-summary'], ['mobile-cashbook'], ['profit-report'], ['dashboard']];

/**
 * Form state shared by the desktop voucher modal and the mobile voucher sheet.
 * "Thu nợ khách hàng" posts to the debt API, which writes the receipt itself;
 * every other category posts a manual cashbook voucher.
 */
export function useCashVoucherForm(initialType: CashVoucherType, onDone: (result: CashVoucherResult) => void) {
  const { account } = useAuth();
  const canBackdate = account ? hasPermission(account.role, 'finance:read') : false;
  const metadata = useMetadata();
  const queryClient = useQueryClient();
  const requestKey = usePaymentRequestKey();

  const [type, setTypeState] = useState<CashVoucherType>(initialType);
  const [categoryKey, setCategoryKey] = useState('');
  const [fund, setFund] = useState<CashFund>('cash');
  const [amount, setAmount] = useState(0);
  const [occurredAt, setOccurredAt] = useState('');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [note, setNote] = useState('');
  const [customer, setCustomer] = useState<DebtCustomer | null>(null);
  const [sequence, setSequence] = useState(0);

  const categories = useMemo(() => (metadata.data?.data.cashbook?.categories ?? [])
    .filter((category) => category.type === type && (category.manual || category.key === DEBT_COLLECTION_KEY)), [metadata.data, type]);
  const isDebt = categoryKey === DEBT_COLLECTION_KEY;

  const setType = (next: CashVoucherType) => {
    setTypeState(next);
    setCategoryKey('');
    setCustomer(null);
  };

  const selectCategory = (key: string) => {
    setCategoryKey(key);
    if (key !== DEBT_COLLECTION_KEY) setCustomer(null);
  };

  const problem = !categoryKey ? 'Chọn loại thu chi'
    : amount <= 0 ? 'Nhập số tiền lớn hơn 0'
      : isDebt && !customer ? 'Chọn khách hàng cần thu nợ'
        : isDebt && customer && amount > customer.debtBalance ? `Số tiền vượt dư nợ ${formatMoney(customer.debtBalance)}`
          : null;

  const mutation = useMutation({
    mutationFn: async (): Promise<CashVoucherResult> => {
      if (isDebt && customer) {
        const body = { amount, paymentMethod: fund === 'cash' ? 'cash' : 'bank_transfer', invoiceId: null, note };
        const result = await collectCustomerDebt(customer.id, { ...body, requestKey: requestKey({ customerId: customer.id, sequence, ...body }) });
        return { message: `Đã thu ${formatMoney(result.data.amount)} của ${customer.name}. Còn nợ ${formatMoney(result.data.balance)}.` };
      }
      const occurredIso = canBackdate && occurredAt ? zonedLocalDateTimeToIso(occurredAt) ?? undefined : undefined;
      const body = { type, fund, categoryKey, amount, occurredAt: occurredIso, counterpartyName: counterpartyName.trim(), note: note.trim() };
      const result = await createCashVoucher({ ...body, requestKey: requestKey({ sequence, ...body }) });
      return { message: `Đã lập ${result.data.code} · ${formatMoney(result.data.amount)}.` };
    },
    onSuccess: (result) => {
      setSequence((value) => value + 1);
      cashbookQueryPrefixes.forEach((queryKey) => { void queryClient.invalidateQueries({ queryKey }); });
      if (isDebt) {
        void queryClient.invalidateQueries({ queryKey: ['customer-debt'] });
        void queryClient.invalidateQueries({ queryKey: ['customers'] });
        void queryClient.invalidateQueries({ queryKey: ['cashbook-debt-customers'] });
      }
      onDone(result);
    },
  });

  return {
    type, setType,
    categoryKey, selectCategory, categories, isDebt,
    fund, setFund,
    amount, setAmount,
    occurredAt, setOccurredAt, canBackdate,
    counterpartyName, setCounterpartyName,
    note, setNote,
    customer, setCustomer,
    problem,
    submit: () => { if (!problem && !mutation.isPending) mutation.mutate(); },
    mutation,
  };
}

export type CashVoucherForm = ReturnType<typeof useCashVoucherForm>;
