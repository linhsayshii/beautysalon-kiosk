import type { ReactNode, RefObject } from 'react';
import { useMobileDialog } from './useMobileDialog';
import './mobile-common.css';

export interface MobileFilterSheetProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  onReset?: () => void;
  onApply: () => void;
  children: ReactNode;
}

export function MobileFilterSheet({
  isOpen,
  title = 'Bộ lọc tìm kiếm',
  onClose,
  onReset,
  onApply,
  children,
}: MobileFilterSheetProps) {
  const { dialogRef, titleId } = useMobileDialog({ isOpen, onClose });
  if (!isOpen) return null;

  return (
    <div
      className="mobile-filter-sheet-backdrop"
      data-testid="mobile-filter-sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef as RefObject<HTMLDivElement>}
        className="mobile-filter-sheet-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="mobile-sheet-drag-handle" />

        <div className="mobile-filter-sheet-header">
          <h3 id={titleId} className="mobile-filter-sheet-title">{title}</h3>
          <button
            type="button"
            className="mobile-filter-sheet-close-btn"
            aria-label="Đóng"
            onClick={onClose}
          >
            <i className="ph ph-x" />
          </button>
        </div>

        <div className="mobile-filter-sheet-body">{children}</div>

        <div className="mobile-filter-sheet-footer">
          {onReset && (
            <button
              type="button"
              className="mobile-filter-sheet-reset-btn"
              onClick={onReset}
            >
              Đặt lại
            </button>
          )}
          <button
            type="button"
            className="mobile-filter-sheet-apply-btn"
            onClick={onApply}
          >
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
}
