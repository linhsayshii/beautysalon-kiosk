import type { ReactNode } from 'react';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';

export interface MobileFilterSheetProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  onReset?: () => void;
  onApply: () => void;
  children: ReactNode;
}

/** Filter sheet with the standard Đặt lại / Áp dụng footer. */
export function MobileFilterSheet({
  isOpen,
  title = 'Bộ lọc tìm kiếm',
  onClose,
  onReset,
  onApply,
  children,
}: MobileFilterSheetProps) {
  return (
    <BottomSheet
      open={isOpen}
      onClose={onClose}
      title={title}
      testId="mobile-filter-sheet"
      footer={(
        <>
          {onReset && (
            <button type="button" className="btn btn-secondary" onClick={onReset}>
              Đặt lại
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onApply}>
            Áp dụng
          </button>
        </>
      )}
    >
      {children}
    </BottomSheet>
  );
}
