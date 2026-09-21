import { statusLabels } from '@/types/api';

export function StatusBadge({
  status,
  purchase = false,
  payroll = false,
}: {
  status: string;
  purchase?: boolean;
  payroll?: boolean;
}) {
  let label = statusLabels[status] ?? status;
  if (purchase) {
    if (status === 'completed') label = 'Đã nhập hàng';
    else if (status === 'draft') label = 'Phiếu tạm';
  } else if (payroll) {
    if (status === 'draft') label = 'Tạm tính';
    else if (status === 'approved') label = 'Đã chốt lương';
    else if (status === 'creating') label = 'Đang tạo';
    else if (status === 'cancelled') label = 'Đã hủy';
    else if (status === 'paid') label = 'Đã thanh toán';
  }
  return <span className={`status-badge ${status}`}>{label}</span>;
}

export function GoodsTypeBadge({ type }: { type: string }) {
  const label = statusLabels[type] ?? type;
  return <span className={`goods-type ${type}`}>{label}</span>;
}

// The legacy invoice status 'paid' means posted; paymentStatus tracks settlement.
export function InvoiceStatusBadge({status,paymentStatus}: {status:string;paymentStatus?:string}) {
  if (status !== 'paid' || !paymentStatus || paymentStatus === 'paid') return <StatusBadge status={status} />;
  return <span className="status-badge draft">{paymentStatus === 'partial' ? 'Thanh toán một phần' : 'Chưa thanh toán'}</span>;
}
