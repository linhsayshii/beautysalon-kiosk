import type { ReactNode } from 'react';

interface PageHeaderProps { title: string; subtitle: string; actionLabel?: string; onAction?: () => void; extraActions?: ReactNode }

export function PageHeader({ title, subtitle, actionLabel, onAction, extraActions }: PageHeaderProps) {
  return (
    <div className="workspace-heading">
      <div className="workspace-heading-copy"><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="workspace-actions">
        {extraActions}
        {actionLabel && <button className="primary-button" type="button" onClick={onAction}><i className="ph ph-plus" />{actionLabel}</button>}
      </div>
    </div>
  );
}
