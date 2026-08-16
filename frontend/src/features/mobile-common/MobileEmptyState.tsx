import type { ReactNode } from 'react';
import './mobile-common.css';

export interface MobileEmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function MobileEmptyState({
  icon = 'ph ph-folder-open',
  title,
  description,
  action,
}: MobileEmptyStateProps) {
  return (
    <div className="mobile-empty-state">
      <div className="mobile-empty-state-icon">
        <i className={icon} />
      </div>
      <h4 className="mobile-empty-state-title">{title}</h4>
      {description && <p className="mobile-empty-state-desc">{description}</p>}
      {action && <div className="mobile-empty-state-action">{action}</div>}
    </div>
  );
}
