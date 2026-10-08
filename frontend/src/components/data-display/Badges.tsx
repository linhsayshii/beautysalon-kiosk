import { statusLabels } from '@/types/api';
import { appointmentStatusLabel } from '@/lib/appointment-status';

export function StatusBadge({
  status,
  purchase = false,
  payroll = false,
  appointment = false,
}: {
  status: string;
  purchase?: boolean;
  payroll?: boolean;
  appointment?: boolean;
}) {
  let label = statusLabels[status] ?? status;
  if (appointment) {
    label = appointmentStatusLabel(status);
  } else if (purchase) {
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
  return <span className="status-badge unpaid">{paymentStatus === 'partial' ? 'Thanh toán một phần' : 'Chưa thanh toán'}</span>;
}
