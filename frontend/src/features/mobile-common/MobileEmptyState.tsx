import type { ReactNode } from 'react';
import { EmptyState } from '@/components/data-display/DataState';

export interface MobileEmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Compact variant of the shared EmptyState for mobile lists and sheets. */
export function MobileEmptyState({
  icon = 'ph ph-folder-open',
  title,
  description,
  action,
}: MobileEmptyStateProps) {
  return <EmptyState compact icon={icon} title={title} message={description ?? null} action={action} />;
}
