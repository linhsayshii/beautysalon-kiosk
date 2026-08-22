import { useEffect, useId, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const dialogStack: symbol[] = [];
let openDialogCount = 0;
let bodyOverflowBeforeDialogs = '';

function activateOverlay() {
  if (openDialogCount === 0) {
    bodyOverflowBeforeDialogs = document.body.style.overflow;
    document.body.classList.add('mobile-overlay-open');
    document.body.style.overflow = 'hidden';
  }
  openDialogCount += 1;
}

function deactivateOverlay() {
  openDialogCount = Math.max(0, openDialogCount - 1);
  if (openDialogCount === 0) {
    document.body.classList.remove('mobile-overlay-open');
    document.body.style.overflow = bodyOverflowBeforeDialogs;
  }
}

interface UseMobileDialogOptions {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/** Shared keyboard, focus and scroll behavior for mobile modal surfaces. */
export function useMobileDialog({ isOpen, onClose, initialFocusRef }: UseMobileDialogOptions) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const instanceRef = useRef(Symbol('mobile-dialog'));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const instance = instanceRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    dialogStack.push(instance);
    activateOverlay();

    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      const preferred = initialFocusRef?.current;
      const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (preferred ?? firstFocusable ?? dialog)?.focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialogStack.at(-1) !== instance) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => element.getAttribute('aria-hidden') !== 'true');

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      const stackIndex = dialogStack.lastIndexOf(instance);
      if (stackIndex >= 0) dialogStack.splice(stackIndex, 1);
      deactivateOverlay();
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [initialFocusRef, isOpen]);

  return { dialogRef, titleId };
}
