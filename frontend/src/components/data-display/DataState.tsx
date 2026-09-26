import type { ReactNode } from 'react';

/*
 * Loading / empty / error states shared by desktop tables and mobile lists
 * (styles/ui/state.css). `compact` drops the tall table minimum for lists,
 * cards and sheets. The table-* wrapper classes stay because detail panels
 * position the states by those names.
 */

interface StateFrameProps {
  kind: 'loading' | 'empty' | 'error';
  compact?: boolean;
  icon: string;
  title: ReactNode;
  children?: ReactNode;
  role?: 'status' | 'alert';
}

function StateFrame({ kind, compact, icon, title, children, role }: StateFrameProps) {
  const className = [`table-${kind}`, 'state', kind === 'error' && 'state-error', compact && 'state-compact']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={className} role={role}>
      <div className="state-inner">
        <span className="state-icon"><i className={icon} aria-hidden="true" /></span>
        <strong className="state-title">{title}</strong>
        {children}
      </div>
    </div>
  );
}

export function LoadingState({ compact, label = 'Đang tải dữ liệu' }: { compact?: boolean; label?: string }) {
  return (
    <StateFrame kind="loading" compact={compact} icon="ph ph-database" title={label} role="status">
      <div className="skeleton-lines" aria-hidden="true"><span /><span /><span /></div>
    </StateFrame>
  );
}

export interface EmptyStateProps {
  title?: string;
  message?: ReactNode;
  icon?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  title = 'Chưa có dữ liệu',
  message = 'Không tìm thấy dữ liệu phù hợp với bộ lọc.',
  icon = 'ph ph-magnifying-glass',
  action,
  compact,
}: EmptyStateProps) {
  return (
    <StateFrame kind="empty" compact={compact} icon={icon} title={title}>
      {message && <p className="state-text">{message}</p>}
      {action && <div className="state-action">{action}</div>}
    </StateFrame>
  );
}

export interface ErrorStateProps {
  error: Error;
  onRetry: () => void;
  title?: string;
  compact?: boolean;
}

export function ErrorState({ error, onRetry, title = 'Không thể tải dữ liệu', compact }: ErrorStateProps) {
  return (
    <StateFrame kind="error" compact={compact} icon="ph ph-warning-circle" title={title} role="alert">
      <p className="state-text">{error.message}</p>
      <div className="state-action">
        <button className="btn btn-secondary" type="button" onClick={onRetry}>Thử lại</button>
      </div>
    </StateFrame>
  );
}
