import { statusLabels } from '@/types/api';

export function StatusBadge({ status, purchase = false }: { status: string; purchase?: boolean }) {
  const label = purchase && status === 'completed' ? 'Đã nhập hàng' : purchase && status === 'draft' ? 'Phiếu tạm' : statusLabels[status] ?? status;
  return <span className={`status-badge ${status}`}>{label}</span>;
}

export function GoodsTypeBadge({ type }: { type: string }) {
  const label = statusLabels[type] ?? type;
  return <span className={`goods-type ${type}`}>{label}</span>;
}
