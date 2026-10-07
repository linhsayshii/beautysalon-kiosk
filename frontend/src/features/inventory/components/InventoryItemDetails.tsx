import { useQuery } from '@tanstack/react-query';
import { DetailFacts, DetailHead, ValueStrip } from '@/components/data-display/InlineDetail';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { GoodsTypeBadge } from '@/components/data-display/Badges';
import { formatMoney, formatNumber } from '@/lib/format';
import { getInventoryItem, type InventoryItemType } from '../inventory.api';
import { inventoryTypes } from '../inventory-ui';

/** Desktop and phone details use the same saved record and field rules. */
export function InventoryItemDetails({ type, itemId }: { type: InventoryItemType; itemId: number }) {
  const query = useQuery({ queryKey: ['inventory-item', type, itemId], queryFn: () => getInventoryItem(type, itemId) });
  if (query.isPending) return <LoadingState compact label="Đang tải thông tin hàng hóa…" />;
  if (query.error) return <ErrorState compact error={query.error} onRetry={() => query.refetch()} />;
  const item = query.data.data;
  const isProduct = type === 'product';
  const isCard = type === 'account_card';
  const hasValidity = type === 'package' || isCard;
  const commission = (commissionType: string | null, rate: number) => !commissionType
    ? 'Không áp dụng'
    : commissionType === 'percent' ? `${formatNumber(rate * 100)}%` : `${formatMoney(rate)} / lượt`;

  return <div className="form-stack">
    <DetailHead icon={inventoryTypes[type].icon} title={item.name} meta={item.code} tags={<GoodsTypeBadge type={type} />} />
    <span className={`badge ${item.active ? 'badge-success' : 'badge-neutral'}`}>{item.active ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}</span>
    {item.imageUrl && <img className="inventory-detail-image" src={item.imageUrl} alt={item.name} />}
    <ValueStrip items={[
      { label: 'Giá bán', value: formatMoney(item.salePrice), tone: 'primary' },
      { label: isCard ? 'Mệnh giá sử dụng' : 'Giá vốn', value: formatMoney(isCard ? item.faceValue : item.costPrice) },
      ...(isProduct ? [{ label: 'Tồn hiện tại', value: `${formatNumber(item.stockQuantity)} ${item.unit || ''}` }] : []),
    ]} />
    <DetailFacts items={[
      { label: 'Nhóm hàng', value: item.category || 'Chưa phân nhóm' },
      { label: 'Thương hiệu', value: item.brand || 'Chưa có' },
      isProduct && { label: 'Mã vạch', value: item.barcode || 'Chưa có' },
      isProduct && { label: 'Đơn vị tính', value: item.unit },
      isProduct && { label: 'Tồn tối thiểu', value: formatNumber(item.minStock) },
      isProduct && { label: 'Tồn tối đa', value: item.maxStock == null ? 'Không giới hạn' : formatNumber(item.maxStock) },
      type === 'service' && { label: 'Thời lượng', value: `${formatNumber(item.durationMinutes)} phút` },
      (type === 'service' || isProduct) && { label: type === 'service' ? 'Hoa hồng tư vấn bán' : 'Hoa hồng bán', value: commission(item.commissionType, item.commissionRate) },
      type === 'service' && { label: 'Hoa hồng tua', value: commission(item.tourCommissionType, item.tourCommissionRate) },
      hasValidity && { label: 'Thời hạn sử dụng', value: item.validityDays == null ? 'Không giới hạn' : `${formatNumber(item.validityDays)} ngày từ khi mua` },
      type === 'package' && { label: 'Lịch sử dụng', value: item.usageSchedule === 'scheduled' ? 'Theo lịch' : 'Tự do' },
      type === 'package' && { label: 'Dịch vụ trong gói', value: (item.packageItems ?? []).map((entry: { serviceId: number; serviceName?: string; units: number }) => `${entry.serviceName || `Dịch vụ #${entry.serviceId}`}: ${formatNumber(entry.units)} buổi`).join(' · ') || 'Chưa có dịch vụ', span: 'full' },
      isCard && { label: 'Phạm vi thanh toán', value: (item.allowedTypes ?? []).map((value: InventoryItemType) => inventoryTypes[value]?.label).filter(Boolean).join(', ') || 'Chưa có loại hàng', span: 'full' },
      isCard && { label: 'Giới hạn hàng hóa', value: item.scopeItems?.length ? `${item.scopeItems.length} hàng hóa được chọn; loại còn lại áp dụng toàn bộ` : 'Toàn bộ hàng hóa thuộc các loại đã chọn', span: 'full' },
      item.description && { label: 'Mô tả', value: item.description, span: 'full', variant: 'note' },
      item.note && { label: 'Ghi chú nội bộ', value: item.note, span: 'full', variant: 'note' },
    ]} />
  </div>;
}
