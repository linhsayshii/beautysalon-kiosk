import type { ReactNode, RefObject } from 'react';
import { DialogPortal } from '@/components/ui/Dialog/DialogPortal';
import { useDialog } from '@/components/ui/Dialog/useDialog';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Sticky actions under the scrolling body. Buttons share the width equally. */
  footer?: ReactNode;
  /** auto uses up to 90% of the visible viewport; full uses 94%, including with a keyboard. */
  height?: 'auto' | 'full';
  /** muted puts the body on the canvas colour so white cards stand out. */
  tone?: 'default' | 'muted';
  /** Extra controls placed before the close button. */
  headerActions?: ReactNode;
  /** Rendered between the header and the body, e.g. a search box that must not scroll. */
  headerExtra?: ReactNode;
  closeOnBackdrop?: boolean;
  nested?: boolean;
  className?: string;
  bodyClassName?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  testId?: string;
  children: ReactNode;
}

/** Mobile bottom sheet: drag handle, header with close button, scrolling body and optional footer. */
export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  footer,
  height = 'auto',
  tone = 'default',
  headerActions,
  headerExtra,
  closeOnBackdrop = true,
  nested = false,
  className,
  bodyClassName,
  initialFocusRef,
  testId,
  children,
}: BottomSheetProps) {
  const { dialogRef, titleId } = useDialog({ isOpen: open, onClose, initialFocusRef });
  if (!open) return null;

  const sheetClass = [
    'sheet',
    height === 'full' && 'sheet-full',
    tone === 'muted' && 'sheet-muted',
    className,
  ].filter(Boolean).join(' ');

  return (
    <DialogPortal>
      <div
        className={`sheet-backdrop${nested ? ' is-nested' : ''}`}
        data-testid={testId ? `${testId}-backdrop` : undefined}
        onClick={(event) => {
          if (closeOnBackdrop && event.target === event.currentTarget) onClose();
        }}
      >
        <div
          ref={dialogRef as RefObject<HTMLDivElement>}
          className={sheetClass}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          data-testid={testId}
        >
          <div className="sheet-handle" aria-hidden="true" />
          <header className="sheet-header">
            <div className="sheet-heading">
              <h2 id={titleId} className="sheet-title">{title}</h2>
              {subtitle && <span className="sheet-subtitle">{subtitle}</span>}
            </div>
            {headerActions}
            <button type="button" className="sheet-close" aria-label="Đóng" onClick={onClose}>
              <i className="ph ph-x" aria-hidden="true" />
            </button>
          </header>
          {headerExtra}
          <div className={['sheet-body', bodyClassName].filter(Boolean).join(' ')}>{children}</div>
          {footer && <div className="sheet-footer">{footer}</div>}
        </div>
      </div>
    </DialogPortal>
  );
}
