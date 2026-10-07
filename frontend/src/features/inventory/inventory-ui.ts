import type { InventoryItemType } from './inventory.api';

/** One vocabulary for goods menus, lists, detail views and card scopes. */
export const inventoryTypes: Record<InventoryItemType, { label: string; icon: string; description: string }> = {
  product: { label: 'Sản phẩm', icon: 'ph-package', description: 'Có tồn kho, giá vốn và đơn vị tính' },
  service: { label: 'Dịch vụ', icon: 'ph-sparkle', description: 'Có thời lượng, hoa hồng tua và tư vấn bán' },
  package: { label: 'Gói dịch vụ', icon: 'ph-stack', description: 'Gồm nhiều dịch vụ và số buổi sử dụng' },
  account_card: { label: 'Thẻ tài khoản', icon: 'ph-credit-card', description: 'Có mệnh giá và phạm vi thanh toán' },
};

export const inventoryTypeOptions = Object.entries(inventoryTypes).map(([value, item]) => ({ value, label: item.label }));
