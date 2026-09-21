import { PartialPaymentFields } from './PartialPaymentFields';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  it('collects a partial amount against a selected invoice and prevents excess collection',async()=>{
    const collect=vi.spyOn(debts,'collectCustomerDebt').mockResolvedValue({data:{paymentId:7,amount:300,balance:600},meta:{}});
    wrap(<CustomerDebtPanel customerId={1} />);
    fireEvent.click(await screen.findByRole('button',{name:'Thu nợ'}));
    fireEvent.change(screen.getByLabelText('Khoản cần thu'),{target:{value:'4'}});
    fireEvent.change(screen.getByLabelText('Số tiền thu (VNĐ)'),{target:{value:'800'}});
    expect(screen.getByRole('button',{name:'Xác nhận thu nợ'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Số tiền thu (VNĐ)'),{target:{value:'300'}});
    fireEvent.click(screen.getByRole('button',{name:'Xác nhận thu nợ'}));
    await waitFor(()=>expect(collect).toHaveBeenCalledWith(1,expect.objectContaining({amount:300,invoiceId:4,paymentMethod:'cash',requestKey:expect.any(String)})));
    expect(await screen.findByRole('status')).toHaveTextContent('Phiếu #7');
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
    fireEvent.click(screen.getByRole('button',{name:'Chuyển khoản (VietQR)'}));
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
