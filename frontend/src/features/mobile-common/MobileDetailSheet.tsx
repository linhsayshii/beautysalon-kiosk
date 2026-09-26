import type { ReactNode } from 'react';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';

export interface MobileDetailSheetProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footerActions?: ReactNode;
}

/** Record detail sheet: white cards on the canvas colour, optional sticky actions. */
export function MobileDetailSheet({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  footerActions,
}: MobileDetailSheetProps) {
  return (
    <BottomSheet
      open={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      tone="muted"
      footer={footerActions}
      testId="mobile-detail-sheet"
    >
      {children}
    </BottomSheet>
  );
}
