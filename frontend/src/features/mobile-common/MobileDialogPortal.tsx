import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Keeps mobile dialogs outside page-level scroll and stacking contexts. */
export function MobileDialogPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
