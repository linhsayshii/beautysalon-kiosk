import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Shows a back button linking to this route (detail/create pages). */
  backTo?: string;
  /** Shows a back button that runs this callback (in-page views without their own route). */
  onBack?: () => void;
  backLabel?: string;
  /** Primary "add" action shortcut; rendered after extraActions. */
  actionLabel?: string;
  onAction?: () => void;
  extraActions?: ReactNode;
}

/** Desktop page title row: title + subtitle on the left, page actions on the right. */
export function PageHeader({ title, subtitle, backTo, onBack, backLabel = 'Quay lại', actionLabel, onAction, extraActions }: PageHeaderProps) {
  const hasActions = Boolean(extraActions || actionLabel);
  return (
    <div className="page-header">
      <div className="page-header-main">
        {backTo ? (
          <Link className="btn btn-ghost btn-icon" to={backTo} aria-label={backLabel}>
            <i className="ph ph-arrow-left" aria-hidden="true" />
          </Link>
        ) : onBack && (
          <button className="btn btn-ghost btn-icon" type="button" onClick={onBack} aria-label={backLabel}>
            <i className="ph ph-arrow-left" aria-hidden="true" />
          </button>
        )}
        <div className="page-header-copy">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {hasActions && (
        <div className="page-actions">
          {extraActions}
          {actionLabel && (
            <button className="btn btn-primary" type="button" onClick={onAction}>
              <i className="ph ph-plus" aria-hidden="true" />
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
