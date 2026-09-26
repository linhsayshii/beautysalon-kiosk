import { MoneyInput } from '@/components/forms/MoneyInput';
import { DateTimePickerField } from '@/components/ui/DateTimePicker';
import { Select } from '@/components/ui/Select/Select';
import { formatMoney } from '@/lib/format';
import { fundLabels, type CashFund } from '../cashbook.api';
import type { CashVoucherForm } from '../useCashVoucherForm';
import { DebtCustomerPicker } from './DebtCustomerPicker';

const funds: CashFund[] = ['cash', 'bank'];

/** Voucher fields shared by the desktop modal and the mobile sheet. */
export function CashVoucherFields({ form, idPrefix }: { form: CashVoucherForm; idPrefix: string }) {
  const { type, isDebt, customer } = form;
  return (
    <div className="form-stack cashbook-voucher-fields">
      <div className="segmented segmented-block" role="tablist" aria-label="Loại phiếu">
        <button type="button" role="tab" aria-selected={type === 'income'} onClick={() => form.setType('income')}>
          <i className="ph ph-arrow-down-left" aria-hidden="true" />Phiếu thu
        </button>
        <button type="button" role="tab" aria-selected={type === 'expense'} onClick={() => form.setType('expense')}>
          <i className="ph ph-arrow-up-right" aria-hidden="true" />Phiếu chi
        </button>
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-category`}>
          {type === 'income' ? 'Loại thu' : 'Loại chi'} <span className="field-required">*</span>
        </label>
        <Select<string>
          id={`${idPrefix}-category`}
          value={form.categoryKey}
          onChange={form.selectCategory}
          placeholder={type === 'income' ? 'Chọn loại thu' : 'Chọn loại chi'}
          options={form.categories.map((category) => ({ value: category.key, label: category.label }))}
          fullWidth
        />
      </div>

      {isDebt && (
        <div className="field">
          <span className="field-label">Khách hàng <span className="field-required">*</span></span>
          <DebtCustomerPicker value={customer} onChange={form.setCustomer} />
        </div>
      )}

      <div className="field">
        <span className="field-label">{type === 'income' ? 'Thu vào quỹ' : 'Chi từ quỹ'}</span>
        <div className="segmented segmented-block" role="group" aria-label="Quỹ">
          {funds.map((fund) => (
            <button key={fund} type="button" aria-pressed={form.fund === fund} onClick={() => form.setFund(fund)}>
              <i className={`ph ${fund === 'cash' ? 'ph-money' : 'ph-bank'}`} aria-hidden="true" />{fundLabels[fund]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-amount`}>Số tiền <span className="field-required">*</span></label>
        <MoneyInput id={`${idPrefix}-amount`} className="input" value={form.amount || ''} onChange={form.setAmount} allowEmpty suffix="đ" />
        {isDebt && customer && form.amount > 0 && form.amount <= customer.debtBalance && (
          <p className="field-hint">Dư nợ sau khi thu: {formatMoney(customer.debtBalance - form.amount)}</p>
        )}
      </div>

      {!isDebt && (
        <div className="field">
          <label className="field-label" htmlFor={`${idPrefix}-counterparty`}>{type === 'income' ? 'Người nộp' : 'Người nhận'}</label>
          <input id={`${idPrefix}-counterparty`} className="input" value={form.counterpartyName} maxLength={200} onChange={(event) => form.setCounterpartyName(event.target.value)} />
        </div>
      )}

      {form.canBackdate && !isDebt && (
        <div className="field">
          <label className="field-label" htmlFor={`${idPrefix}-time`}>Thời gian</label>
          <DateTimePickerField id={`${idPrefix}-time`} className="input" value={form.occurredAt} onChange={form.setOccurredAt} placeholder="Bây giờ" title="Thời gian ghi sổ" />
          <p className="field-hint">Để trống để ghi theo thời điểm hiện tại.</p>
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-note`}>Ghi chú</label>
        <textarea id={`${idPrefix}-note`} className="textarea" rows={2} value={form.note} maxLength={isDebt ? 300 : 500} onChange={(event) => form.setNote(event.target.value)} />
      </div>

      {form.mutation.error && <div className="alert alert-danger" role="alert">{form.mutation.error.message}</div>}
    </div>
  );
}
