import { useState } from 'react';
import { Modal } from '@/components/ui/Modal/Modal';

interface ProductImageViewButtonProps {
  imageUrl?: string | null;
  name: string;
  className?: string;
}

/** Small icon button that opens a goods photo; renders nothing when the item has no photo. */
export function ProductImageViewButton({ imageUrl, name, className = '' }: ProductImageViewButtonProps) {
  const [open, setOpen] = useState(false);
  if (!imageUrl) return null;
  return <>
    <button className={`btn btn-ghost btn-icon btn-sm ${className}`.trim()} type="button" onClick={() => setOpen(true)} aria-label={`Xem ảnh ${name}`} title="Xem ảnh">
      <i className="ph ph-image" aria-hidden="true" />
    </button>
    <Modal open={open} onClose={() => setOpen(false)} title={name} size="md" nested>
      <div className="modal-body goods-image-preview">
        <img src={imageUrl} alt={`Ảnh ${name}`} />
      </div>
    </Modal>
  </>;
}
