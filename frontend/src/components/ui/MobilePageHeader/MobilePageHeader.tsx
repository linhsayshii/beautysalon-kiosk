import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export interface MobilePageHeaderProps {
  title: ReactNode;
  /** One muted line under the title, e.g. the active section. */
  subtitle?: ReactNode;
  /** Route the back button opens. Omit both backTo and onBack for a page without a back button. */
  backTo?: string;
  /** Custom back behaviour; wins over backTo. */
  onBack?: () => void;
  /** Icon buttons on the right, usually MobileHeaderAction. */
  actions?: ReactNode;
  /** Extra rows under the title bar: search box, chip strip, tabs. */
  children?: ReactNode;
  className?: string;
}

/**
 * Sticky header for mobile sub-pages (list pages and full-screen forms).
 * Replaces the per-module `mobile-[module]-sticky-header-cluster` copies.
 */
export function MobilePageHeader({ title, subtitle, backTo, onBack, actions, children, className }: MobilePageHeaderProps) {
  const navigate = useNavigate();
  const hasBack = Boolean(onBack || backTo);
  const handleBack = () => {
    if (onBack) onBack();
    else if (backTo) navigate(backTo);
  };

  return (
    <header className={['m-header', className].filter(Boolean).join(' ')}>
      <div className="m-header-bar">
        {hasBack && (
          <button type="button" className="m-header-back" onClick={handleBack} aria-label="Quay lại">
            <i className="ph ph-caret-left" aria-hidden="true" />
          </button>
        )}
        <div className="m-header-heading">
          <h1 className="m-header-title">{title}</h1>
          {subtitle && <p className="m-header-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="m-header-actions">{actions}</div>}
      </div>
      {children && <div className="m-header-extra">{children}</div>}
    </header>
  );
}

export interface MobileHeaderActionProps {
  icon: string;
  label: string;
  onClick: () => void;
  /** Toggle state, e.g. the search box is open. */
  active?: boolean;
  /** ghost (default) for tools, soft for the page's primary "add" action. */
  tone?: 'ghost' | 'soft';
  badge?: boolean;
  disabled?: boolean;
}

/** Icon button for the MobilePageHeader actions slot. */
export function MobileHeaderAction({ icon, label, onClick, active, badge, disabled, tone = 'ghost' }: MobileHeaderActionProps) {
  return (
    <button
      type="button"
      className={`btn btn-${tone} btn-icon m-header-action${active ? ' is-active' : ''}${badge ? ' has-badge' : ''}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
    >
      <i className={icon} aria-hidden="true" />
    </button>
  );
}
