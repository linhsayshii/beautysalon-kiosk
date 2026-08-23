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

function findVerticalScrollContainer(target: EventTarget | null, dialog: HTMLElement) {
  let element = target instanceof Element ? target : null;

  while (element && dialog.contains(element)) {
    const styles = window.getComputedStyle(element);
    const canScrollVertically = ['auto', 'scroll', 'overlay'].includes(styles.overflowY)
      && element.scrollHeight > element.clientHeight;

    if (canScrollVertically) return element as HTMLElement;
    if (element === dialog) break;
    element = element.parentElement;
  }

  return null;
}

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

    // `overflow: hidden` on body does not reliably lock nested page scrollers on
    // mobile browsers. Keep a gesture inside the top-most dialog, while allowing
    // a scrollable area in that dialog to retain its native momentum scrolling.
    let lastTouchY: number | null = null;
    const isTopmostDialog = () => dialogStack.at(-1) === instance;
    const shouldBlockVerticalScroll = (target: EventTarget | null, deltaY: number) => {
      const dialog = dialogRef.current;
      if (!dialog || !(target instanceof Node) || !dialog.contains(target)) return true;

      const scrollContainer = findVerticalScrollContainer(target, dialog);
      if (!scrollContainer) return true;

      const isAtTop = scrollContainer.scrollTop <= 0;
      const isAtBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 1;
      return (deltaY < 0 && isAtTop) || (deltaY > 0 && isAtBottom);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!isTopmostDialog()) return;
      lastTouchY = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isTopmostDialog()) return;
      const touchY = event.touches[0]?.clientY;
      if (touchY === undefined) return;

      // Finger movement and scroll direction have opposite signs.
      const scrollDeltaY = lastTouchY === null ? 0 : lastTouchY - touchY;
      if (shouldBlockVerticalScroll(event.target, scrollDeltaY)) event.preventDefault();
      lastTouchY = touchY;
    };

    const handleTouchEnd = () => {
      lastTouchY = null;
    };

    const handleWheel = (event: WheelEvent) => {
      if (!isTopmostDialog()) return;
      if (shouldBlockVerticalScroll(event.target, event.deltaY)) event.preventDefault();
    };

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
    document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
    document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', handleTouchEnd, { capture: true });
    document.addEventListener('touchcancel', handleTouchEnd, { capture: true });
    document.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchmove', handleTouchMove, true);
      document.removeEventListener('touchend', handleTouchEnd, true);
      document.removeEventListener('touchcancel', handleTouchEnd, true);
      document.removeEventListener('wheel', handleWheel, true);
      const stackIndex = dialogStack.lastIndexOf(instance);
      if (stackIndex >= 0) dialogStack.splice(stackIndex, 1);
      deactivateOverlay();
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [initialFocusRef, isOpen]);

  return { dialogRef, titleId };
}
