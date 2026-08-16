import { useEffect, useRef, useState } from 'react';
import type { InventoryItemType } from '../inventory.api';
import { GoodsCreateDialog } from './GoodsCreateDialog';

const itemTypes: Array<{ type: InventoryItemType; label: string; description: string; icon: string }> = [
  { type: 'product', label: 'Sản phẩm', description: 'Có giá vốn và tồn kho', icon: 'ph-package' },
  { type: 'service', label: 'Dịch vụ', description: 'Có thời lượng thực hiện', icon: 'ph-sparkle' },
  { type: 'package', label: 'Gói dịch vụ, liệu trình', description: 'Gồm nhiều dịch vụ và số buổi', icon: 'ph-stack' },
  { type: 'account_card', label: 'Thẻ tài khoản', description: 'Có mệnh giá và phạm vi sử dụng', icon: 'ph-credit-card' },
];

export function GoodsCreateMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogType, setDialogType] = useState<InventoryItemType | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);

  return <>
    <div className="goods-create-menu" ref={rootRef}>
      <button className="primary-button goods-create-trigger" type="button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
        <i className="ph ph-plus" aria-hidden="true" />Hàng hóa<i className={`ph ph-caret-${menuOpen ? 'up' : 'down'}`} aria-hidden="true" />
      </button>
      {menuOpen && <div className="goods-create-popover" role="menu" aria-label="Chọn loại hàng hóa">
        {itemTypes.map((item) => <button key={item.type} type="button" role="menuitem" onClick={() => { setDialogType(item.type); setMenuOpen(false); }}>
          <i className={`ph ${item.icon}`} aria-hidden="true" />
          <span><strong>{item.label}</strong><small>{item.description}</small></span>
          <i className="ph ph-caret-right" aria-hidden="true" />
        </button>)}
      </div>}
    </div>
    {dialogType && <GoodsCreateDialog type={dialogType} onClose={() => setDialogType(null)} />}
  </>;
}
