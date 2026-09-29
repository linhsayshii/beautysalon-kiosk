import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { compressImage } from '@/lib/image-compress';
import { uploadProductImage } from '../inventory.api';

interface ProductImageFieldProps {
  value: string;
  onChange: (url: string) => void;
  /** Lets the form hold Save until the photo has reached the server. */
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
}

/** Take or pick a photo; it is compressed in the browser and uploaded as soon as it is chosen. */
export function ProductImageField({ value, onChange, onUploadingChange, disabled = false }: ProductImageFieldProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Hook-level callbacks still run if the user switches tab mid-upload and this field unmounts.
  const upload = useMutation({
    mutationFn: async (file: File) => uploadProductImage(await compressImage(file)),
    onMutate: () => onUploadingChange?.(true),
    onSuccess: (response) => onChange(response.data.url),
    onSettled: () => onUploadingChange?.(false),
  });

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same photo again still fires a change.
    event.target.value = '';
    if (file) upload.mutate(file);
  };

  const busy = disabled || upload.isPending;
  return <div className="field">
    <span className="field-label" id="goods-image-label">Hình ảnh</span>
    <div className="goods-image-field" aria-labelledby="goods-image-label">
      <div className="goods-image-frame" aria-busy={upload.isPending}>
        {upload.isPending
          ? <span className="goods-image-placeholder"><i className="ph ph-spinner spin" aria-hidden="true" />Đang tải ảnh...</span>
          : value
            ? <img src={value} alt="Ảnh hàng hóa" />
            : <span className="goods-image-placeholder"><i className="ph ph-image" aria-hidden="true" />Chưa có ảnh</span>}
      </div>
      <div className="goods-image-actions">
        <button className="btn btn-secondary" type="button" onClick={() => cameraRef.current?.click()} disabled={busy}><i className="ph ph-camera" aria-hidden="true" />Chụp ảnh</button>
        <button className="btn btn-secondary" type="button" onClick={() => fileRef.current?.click()} disabled={busy}><i className="ph ph-upload-simple" aria-hidden="true" />Chọn ảnh</button>
        {value && <button className="btn btn-ghost" type="button" onClick={() => onChange('')} disabled={busy}><i className="ph ph-trash" aria-hidden="true" />Xóa ảnh</button>}
        <small className="field-help">Ảnh được nén trước khi lưu (tối đa 1200px).</small>
      </div>
    </div>
    {/* capture opens the rear camera on phones; desktops fall back to the file picker. */}
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden data-testid="goods-image-camera" onChange={pick} />
    <input ref={fileRef} type="file" accept="image/*" hidden data-testid="goods-image-file" onChange={pick} />
    {upload.error && <small className="field-error" role="alert">{upload.error.message}</small>}
  </div>;
}
