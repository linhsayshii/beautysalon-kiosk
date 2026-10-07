import { inventoryTypes } from '../inventory-ui';
import { useEffect, useRef, useState } from 'react';
import type { InventoryItemType } from '../inventory.api';
import { FloatingLayer } from '@/components/ui/FloatingLayer/FloatingLayer';
import { GoodsCreateDialog } from './GoodsCreateDialog';

export function GoodsCreateMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogType, setDialogType] = useState<InventoryItemType | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setMenuOpen(false);
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
      <button className="btn btn-primary goods-create-trigger" type="button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
        <i className="ph ph-plus" aria-hidden="true" />Hàng hóa<i className={`ph ph-caret-${menuOpen ? 'up' : 'down'}`} aria-hidden="true" />
      </button>
      {menuOpen && <FloatingLayer anchorRef={rootRef} layerRef={menuRef} align="right" className="goods-create-popover" role="menu" aria-label="Chọn loại hàng hóa">
        {Object.entries(inventoryTypes).map(([type, item]) => <button key={type} type="button" role="menuitem" onClick={() => { setDialogType(type as InventoryItemType); setMenuOpen(false); }}>
          <i className={`ph ${item.icon}`} aria-hidden="true" />
          <span><strong>{item.label}</strong><small>{item.description}</small></span>
          <i className="ph ph-caret-right" aria-hidden="true" />
        </button>)}
      </FloatingLayer>}
    </div>
    {dialogType && <GoodsCreateDialog type={dialogType} onClose={() => setDialogType(null)} />}
  </>;
}
