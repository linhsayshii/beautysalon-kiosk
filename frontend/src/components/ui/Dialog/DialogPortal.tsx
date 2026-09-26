import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Keeps dialogs outside page-level scroll and stacking contexts. */
export function DialogPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
