import { PartialPaymentFields } from './PartialPaymentFields';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerDebtPanel } from './CustomerDebtPanel';
import { PosCheckoutModal } from '@/features/pos/components/PosCheckoutModal';
import { MobileCartBottomSheet } from '@/features/mobile-pos/MobileCartBottomSheet';
import * as debts from './debts.api';
import * as pos from '@/features/pos/pos.api';

vi.mock('@/services/metadata',()=>({useMetadata:()=>({data:{data:{system:{vietqr:{bankBin:'ICB',accountNumber:'123',accountName:'TEST'}}}}})}));

function wrap(child: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>{child}</QueryClientProvider>);
}
const customerDebt: debts.CustomerDebt = {balance:900,openingDebt:200,invoices:[{id:4,code:'HD4',total:1000,amountPaid:300,debtAmount:700,issuedAt:'2026-09-14T00:00:00Z'}],entries:[]};

describe('customer debt interactions',()=>{
  beforeEach(()=>{
    vi.restoreAllMocks();
    vi.spyOn(debts,'getCustomerDebt').mockResolvedValue({data:structuredClone(customerDebt),meta:{}});
  });
  it('does not show endless debt loading when no customer is selected', () => {
    wrap(<PartialPaymentFields total={100} amount={100} onAmountChange={() => {}} allowDebt={false} onAllowDebtChange={() => {}} method="cash" />);
    expect(screen.getByText('Chưa chọn khách hàng')).toBeInTheDocument();
    expect(screen.queryByText('Đang tải…')).not.toBeInTheDocument();
    expect(debts.getCustomerDebt).not.toHaveBeenCalled();
  });
  it('styles every checkout and debt button with a standard button class', async () => {
    const lines=[{itemId:1,itemType:'service' as const,code:'DV1',name:'Dịch vụ',category:'',unit:'lần',salePrice:1000,quantity:1,staffId:null}];
    wrap(<PosCheckoutModal customer={{id:1,name:'Khách'}} lines={lines} onClose={()=>{}} onSuccess={()=>{}} />);
    fireEvent.click(screen.getByRole('button',{name:'Xem công nợ / Thu nợ cũ'}));
    fireEvent.click(await screen.findByRole('button',{name:'Thu nợ'}));
    const panelButtons = [...document.querySelectorAll<HTMLButtonElement>('.debt-panel button:not(.app-select-trigger)')];
    expect(panelButtons.map((button) => button.textContent)).toEqual(expect.arrayContaining(['Thanh toán đủ', 'Hủy', 'Xác nhận thu nợ']));
    const toggle = screen.getByRole('button',{name:'Ẩn công nợ'});
    for (const button of [...panelButtons, toggle]) expect(button.className, button.textContent ?? '').toMatch(/(^| )btn( |$)/);
  });
  it('styles the retry button when the debt cannot be loaded', async () => {
    vi.mocked(debts.getCustomerDebt).mockRejectedValue(new Error('Không tải được công nợ'));
    wrap(<CustomerDebtPanel customerId={1} />);
    expect(await screen.findByRole('button',{name:'Thử lại'})).toHaveClass('btn');
  });
  it('names payment methods the same way on desktop and mobile checkout', async () => {
    vi.spyOn(pos,'getPosStaff').mockResolvedValue({data:[],meta:{}});
    const lines=[{itemId:1,itemType:'service' as const,code:'DV1',name:'Dịch vụ',category:'',unit:'lần',salePrice:1000,quantity:1,staffId:null}];
    const names = ['Tiền mặt', 'Chuyển khoản', 'Quẹt thẻ', 'Thẻ tài khoản'];
    const desktop = wrap(<PosCheckoutModal customer={{id:1,name:'Khách'}} lines={lines} onClose={()=>{}} onSuccess={()=>{}} />);
    for (const name of names) expect(screen.getByRole('button',{name})).toBeInTheDocument();
    desktop.unmount();
    wrap(<MobileCartBottomSheet customer={{id:1,name:'Khách'}} lines={lines} invoiceId={4} onSelectCustomer={()=>{}} onUpdateQuantity={()=>{}} onUpdateLineStaff={()=>{}} onClose={()=>{}} onSuccess={()=>{}} />);
    for (const name of names) expect(screen.getByRole('button',{name})).toBeInTheDocument();
  });
  it('collects a partial amount against a selected invoice and prevents excess collection',async()=>{
    const collect=vi.spyOn(debts,'collectCustomerDebt').mockResolvedValue({data:{paymentId:7,amount:300,balance:600},meta:{}});
    wrap(<CustomerDebtPanel customerId={1} />);
    fireEvent.click(await screen.findByRole('button',{name:'Thu nợ'}));
    fireEvent.click(screen.getByRole('button',{name:'Khoản cần thu'}));
    fireEvent.click(screen.getByRole('option',{name:'HD4 · 700đ'}));
    fireEvent.change(screen.getByLabelText('Số tiền thu (VNĐ)'),{target:{value:'800'}});
    expect(screen.getByRole('button',{name:'Xác nhận thu nợ'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Số tiền thu (VNĐ)'),{target:{value:'300'}});
    fireEvent.click(screen.getByRole('button',{name:'Xác nhận thu nợ'}));
    await waitFor(()=>expect(collect).toHaveBeenCalledWith(1,expect.objectContaining({amount:300,invoiceId:4,paymentMethod:'cash',requestKey:expect.any(String)})));
    expect(await screen.findByRole('status')).toHaveTextContent('Phiếu #7');
  });
  it('updates the amount and limit for each invoice and restores automatic allocation', async () => {
    vi.mocked(debts.getCustomerDebt).mockResolvedValue({ data: {
      ...customerDebt, balance: 1200,
      invoices: [...customerDebt.invoices, { id: 5, code: 'HD5', total: 300, amountPaid: 0, debtAmount: 300, issuedAt: '2026-09-15T00:00:00Z' }],
    }, meta: {} });
    const collect = vi.spyOn(debts, 'collectCustomerDebt').mockResolvedValue({ data: { paymentId: 10, amount: 1200, balance: 0 }, meta: {} });
    wrap(<CustomerDebtPanel customerId={1} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thu nợ' }));
    const amount = screen.getByLabelText('Số tiền thu (VNĐ)');
    const confirm = screen.getByRole('button', { name: 'Xác nhận thu nợ' });
    expect(amount).toHaveValue('1.200');
    for (const [option, maximum] of [['HD4 · 700đ', 700], ['HD5 · 300đ', 300], ['Tự động trả khoản cũ nhất', 1200]] as const) {
      fireEvent.click(screen.getByRole('button', { name: 'Khoản cần thu' }));
      fireEvent.click(screen.getByRole('option', { name: option }));
      expect(amount).toHaveValue(maximum.toLocaleString('vi-VN'));
      expect(confirm).toBeEnabled();
      fireEvent.change(amount, { target: { value: String(maximum + 1) } });
      expect(screen.getByRole('alert')).toHaveTextContent('Số tiền vượt khoản nợ được chọn.');
      expect(confirm).toBeDisabled();
      fireEvent.click(confirm);
      expect(collect).not.toHaveBeenCalled();
      fireEvent.change(amount, { target: { value: '0' } });
      expect(confirm).toBeDisabled();
    }
    fireEvent.change(amount, { target: { value: '1200' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(collect).toHaveBeenCalledWith(1, expect.objectContaining({ amount: 1200, invoiceId: null })));
  });

  it.each([['Tiền mặt', 'cash'], ['Chuyển khoản', 'bank_transfer'], ['Quẹt thẻ', 'card']])(
    'sends the correct payment method for %s', async (label, paymentMethod) => {
      const collect = vi.spyOn(debts, 'collectCustomerDebt').mockResolvedValue({ data: { paymentId: 11, amount: 900, balance: 0 }, meta: {} });
      wrap(<CustomerDebtPanel customerId={1} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Thu nợ' }));
      fireEvent.click(screen.getByRole('button', { name: 'Phương thức' }));
      fireEvent.click(screen.getByRole('option', { name: label }));
      expect(screen.getByRole('button', { name: 'Phương thức' })).toHaveTextContent(label);
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thu nợ' }));
      await waitFor(() => expect(collect).toHaveBeenCalledWith(1, expect.objectContaining({ paymentMethod, invoiceId: null, amount: 900 })));
    },
  );

  it('supports keyboard selection and dismissal without submitting or closing the parent', async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const parentKeyDown = vi.fn();
    const collect = vi.spyOn(debts, 'collectCustomerDebt');
    wrap(<form onSubmit={submit} onKeyDown={parentKeyDown}><CustomerDebtPanel customerId={1} /></form>);
    fireEvent.click(await screen.findByRole('button', { name: 'Thu nợ' }));
    const invoice = screen.getByRole('button', { name: 'Khoản cần thu' });
    invoice.focus();
    fireEvent.keyDown(invoice, { key: 'Enter' });
    expect(invoice).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(invoice, { key: 'ArrowDown' });
    fireEvent.keyDown(invoice, { key: 'Enter' });
    expect(invoice).toHaveTextContent('HD4 · 700đ');
    expect(invoice).toHaveFocus();
    expect(screen.getByLabelText('Số tiền thu (VNĐ)')).toHaveValue('700');
    const method = screen.getByRole('button', { name: 'Phương thức' });
    method.focus();
    fireEvent.keyDown(method, { key: ' ' });
    fireEvent.keyDown(method, { key: 'ArrowDown' });
    fireEvent.keyDown(method, { key: ' ' });
    expect(method).toHaveTextContent('Chuyển khoản');
    expect(method).toHaveFocus();
    fireEvent.keyDown(method, { key: 'ArrowUp' });
    fireEvent.keyDown(method, { key: 'ArrowUp' });
    fireEvent.keyDown(method, { key: 'Enter' });
    expect(method).toHaveTextContent('Tiền mặt');
    fireEvent.keyDown(method, { key: 'Enter' });
    fireEvent.keyDown(method, { key: 'ArrowDown' });
    fireEvent.keyDown(method, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(method).toHaveTextContent('Tiền mặt');
    expect(method).toHaveFocus();
    fireEvent.keyDown(method, { key: 'Enter' });
    fireEvent.keyDown(method, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    expect(collect).not.toHaveBeenCalled();
    expect(parentKeyDown.mock.calls.some(([event]) => ['Enter', 'Escape'].includes(event.key))).toBe(false);
  });

  it.each([
    ['Khoản cần thu', 'HD4 · 700đ', 'Tự động trả khoản cũ nhất'],
    ['Phương thức', 'Chuyển khoản', 'Tiền mặt'],
  ])('locks %s including an already-open portal while collecting', async (label, option, current) => {
    let reject!: (reason: Error) => void;
    const collect = vi.spyOn(debts, 'collectCustomerDebt').mockImplementation(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    wrap(<CustomerDebtPanel customerId={1} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thu nợ' }));
    const trigger = screen.getByRole('button', { name: label });
    fireEvent.click(trigger);
    const portalOption = screen.getByRole('option', { name: option });
    expect(screen.getByRole('listbox').closest('.app-select-popover')?.parentElement).toBe(document.body);
    const confirm = screen.getByRole('button', { name: 'Xác nhận thu nợ' });
    fireEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Khoản cần thu' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Phương thức' })).toBeDisabled();
    fireEvent.click(portalOption);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(trigger).toHaveTextContent(current);
    fireEvent.click(confirm);
    expect(collect).toHaveBeenCalledTimes(1);
    await act(async () => { reject(new Error('Thử lại')); });
    await screen.findByText('Thử lại');
    expect(trigger).toBeEnabled();
  });

  it('reuses a request key after a failed response, but gives the next collection a new key',async()=>{
    const collect=vi.spyOn(debts,'collectCustomerDebt').mockRejectedValueOnce(new Error('Mất kết nối')).mockResolvedValue({data:{paymentId:8,amount:100,balance:800},meta:{}});
    wrap(<CustomerDebtPanel customerId={1} />);
    fireEvent.click(await screen.findByRole('button',{name:'Thu nợ'}));
    fireEvent.change(screen.getByLabelText('Số tiền thu (VNĐ)'),{target:{value:'100'}});
    fireEvent.click(screen.getByRole('button',{name:'Xác nhận thu nợ'}));
    await screen.findByText('Mất kết nối');
    fireEvent.click(screen.getByRole('button',{name:'Xác nhận thu nợ'}));
    await screen.findByRole('status');
    expect(collect.mock.calls[0][1].requestKey).toBe(collect.mock.calls[1][1].requestKey);
    fireEvent.click(screen.getByRole('button',{name:'Thu nợ'}));
    fireEvent.change(screen.getByLabelText('Số tiền thu (VNĐ)'),{target:{value:'100'}});
    fireEvent.click(screen.getByRole('button',{name:'Xác nhận thu nợ'}));
    await waitFor(()=>expect(collect).toHaveBeenCalledTimes(3));
    expect(collect.mock.calls[2][1].requestKey).not.toBe(collect.mock.calls[1][1].requestKey);
  });
  it('desktop checkout requires consent for zero payment and sends zero unchanged',async()=>{
    const checkout=vi.spyOn(pos,'checkoutPosInvoice').mockResolvedValue({data:{id:1} as pos.PosReceiptData,meta:{}});
    wrap(<PosCheckoutModal customer={{id:1,name:'Khách'}} lines={[{itemId:1,itemType:'service',code:'DV1',name:'Dịch vụ',category:'',unit:'lần',salePrice:1000,quantity:1,staffId:null}]} onClose={()=>{}} onSuccess={()=>{}} />);
    fireEvent.change(screen.getByLabelText('Khách thanh toán lần này (VNĐ)'),{target:{value:'0'}});
    expect(screen.getByRole('button',{name:/Chốt hóa đơn/})).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Cho phép ghi nợ phần còn lại'));
    fireEvent.click(screen.getByRole('button',{name:/Chốt hóa đơn/}));
    await waitFor(()=>expect(checkout).toHaveBeenCalledWith(expect.objectContaining({amountPaid:0,allowDebt:true,requestKey:expect.any(String)})));
  });
  it('transfer QR uses this payment amount, and debt collection does not submit the surrounding checkout form',async()=>{
    const checkout=vi.spyOn(pos,'checkoutPosInvoice');
    const collect=vi.spyOn(debts,'collectCustomerDebt').mockResolvedValue({data:{paymentId:9,amount:100,balance:800},meta:{}});
    wrap(<PosCheckoutModal customer={{id:1,name:'Khách'}} lines={[{itemId:1,itemType:'service',code:'DV1',name:'Dịch vụ',category:'',unit:'lần',salePrice:1000,quantity:1,staffId:null}]} onClose={()=>{}} onSuccess={()=>{}} />);
    fireEvent.click(screen.getByRole('button',{name:'Chuyển khoản'}));
    fireEvent.change(screen.getByLabelText('Khách thanh toán lần này (VNĐ)'),{target:{value:'300'}});
    expect(screen.getByAltText('VietQR Thanh toán').getAttribute('src')).toContain('amount=300&');
    fireEvent.click(screen.getByRole('button',{name:'Xem công nợ / Thu nợ cũ'}));
    fireEvent.click(await screen.findByRole('button',{name:'Thu nợ'}));
    fireEvent.change(screen.getByLabelText('Số tiền thu (VNĐ)'),{target:{value:'100'}});
    fireEvent.click(screen.getByRole('button',{name:'Xác nhận thu nợ'}));
    await waitFor(()=>expect(collect).toHaveBeenCalledTimes(1));
    expect(checkout).not.toHaveBeenCalled();
  });
  it('mobile checkout preserves partial payment and explicit credit consent',async()=>{
    vi.spyOn(pos,'getPosStaff').mockResolvedValue({data:[],meta:{}});
    const checkout=vi.spyOn(pos,'checkoutPosInvoice').mockResolvedValue({data:{id:1} as pos.PosReceiptData,meta:{}});
    wrap(<MobileCartBottomSheet customer={{id:1,name:'Khách'}} lines={[{itemId:1,itemType:'service',code:'DV1',name:'Dịch vụ',category:'',unit:'lần',salePrice:1000,quantity:1,staffId:null}]} invoiceId={4} onSelectCustomer={()=>{}} onUpdateQuantity={()=>{}} onUpdateLineStaff={()=>{}} onClose={()=>{}} onSuccess={()=>{}} />);
    fireEvent.change(screen.getByLabelText('Khách thanh toán lần này (VNĐ)'),{target:{value:'300'}});
    const button=screen.getByRole('button',{name:'Xác nhận thanh toán'});
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Cho phép ghi nợ phần còn lại'));
    fireEvent.click(button);
    await waitFor(()=>expect(checkout).toHaveBeenCalledWith(expect.objectContaining({amountPaid:300,allowDebt:true,invoiceId:4,requestKey:expect.any(String)})));
  });
});
