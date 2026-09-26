import type { ReactNode, RefObject } from 'react';
import { DialogPortal } from '@/components/ui/Dialog/DialogPortal';
import { useDialog } from '@/components/ui/Dialog/useDialog';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** sm 420px · md 560px · lg 760px · xl 960px. Below 640px every size docks to the bottom. */
  size?: ModalSize;
  className?: string;
  /** Rendered under the header, e.g. a `.tabs` row. */
  headerExtra?: ReactNode;
  /** Extra controls placed before the close button. */
  headerActions?: ReactNode;
  /** Set false while a mutation is pending or for flows that must be closed explicitly. */
  closeOnBackdrop?: boolean;
  closeLabel?: string;
  /** Opened on top of another dialog. */
  nested?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  testId?: string;
  /** Put the content in `.modal-body` and actions in `.modal-footer` (optionally inside a `<form>`). */
  children: ReactNode;
}

/** Desktop dialog: header with title and close button; body and footer supplied by the caller. */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  className,
  headerExtra,
  headerActions,
  closeOnBackdrop = true,
  closeLabel = 'Đóng',
  nested = false,
  initialFocusRef,
  testId,
  children,
}: ModalProps) {
  const { dialogRef, titleId } = useDialog({ isOpen: open, onClose, initialFocusRef });
  if (!open) return null;

  return (
    <DialogPortal>
      <div
        className={`modal-backdrop${nested ? ' is-nested' : ''}`}
        data-testid={testId ? `${testId}-backdrop` : undefined}
        onClick={(event) => {
          if (closeOnBackdrop && event.target === event.currentTarget) onClose();
        }}
      >
        <section
          ref={dialogRef as RefObject<HTMLElement>}
          className={['modal', `modal-${size}`, className].filter(Boolean).join(' ')}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          data-testid={testId}
        >
          <header className="modal-header">
            <div className="modal-heading">
              <h2 id={titleId} className="modal-title">{title}</h2>
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
            {headerActions}
            <button type="button" className="modal-close" aria-label={closeLabel} onClick={onClose}>
              <i className="ph ph-x" aria-hidden="true" />
            </button>
          </header>
          {headerExtra}
          {children}
        </section>
      </div>
    </DialogPortal>
  );
}
