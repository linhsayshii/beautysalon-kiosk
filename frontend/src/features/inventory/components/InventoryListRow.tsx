import { formatMoney, formatNumber } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import { inventoryTypes } from '../inventory-ui';
import type { InventoryItemType } from '../inventory.api';

export function InventoryListRow({ item, price, onClick }: { item: ApiRecord; price?: number; onClick: () => void }) {
  const type = item.itemType as InventoryItemType;
  return <button type="button" className="m-list-row" onClick={onClick}>
    <span className={`m-list-avatar is-${type}`} aria-hidden="true">
      {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <i className={`ph ${inventoryTypes[type].icon}`} />}
    </span>
    <span className="m-list-copy">
      <strong>{item.name}</strong>
      <small>{item.code} · {item.category || inventoryTypes[type].label}</small>
      {item.active === false && <small className="text-warning">Ngừng kinh doanh</small>}
      {type === 'product' && <small className={item.stockQuantity < item.minStock ? 'text-warning' : undefined}>Tồn {formatNumber(item.stockQuantity)} {item.unit || ''}</small>}
    </span>
    <span className="m-list-value">{formatMoney(price ?? item.salePrice)}<i className="ph ph-caret-right" aria-hidden="true" /></span>
  </button>;
}
