import type { ReactNode } from 'react';
import './mobile-common.css';

export interface MobileDetailSheetProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footerActions?: ReactNode;
}

export function MobileDetailSheet({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  footerActions,
}: MobileDetailSheetProps) {
  if (!isOpen) return null;

  return (
    <div
      className="mobile-detail-sheet-backdrop"
      data-testid="mobile-detail-sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="mobile-detail-sheet-container">
        <div className="mobile-sheet-drag-handle" />

        <div className="mobile-detail-sheet-header">
          <div className="mobile-detail-sheet-title-box">
            <h3 className="mobile-detail-sheet-title">{title}</h3>
            {subtitle && (
              <span className="mobile-detail-sheet-subtitle">{subtitle}</span>
            )}
          </div>
          <button
            type="button"
            className="mobile-detail-sheet-close-btn"
            aria-label="Đóng"
            onClick={onClose}
          >
            <i className="ph ph-x" />
          </button>
        </div>

        <div className="mobile-detail-sheet-body">{children}</div>

        {footerActions && (
          <div className="mobile-detail-sheet-footer">{footerActions}</div>
        )}
      </div>
    </div>
  );
}
