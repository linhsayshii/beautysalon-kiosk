import { useEffect } from 'react';

const EDITABLE = 'textarea:not([disabled]):not([readonly]), input:not([disabled]):not([readonly]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="range"]):not([type="color"]), [contenteditable="true"]';
const HEIGHT = '--app-viewport-height';
const TOP = '--app-viewport-top';
let subscribers = 0;
let stop: (() => void) | undefined;

/** Scroll only the nearest field container, never the document behind a dialog. */
function revealFocusedField(top: number, height: number) {
  const field = document.activeElement;
  if (!(field instanceof HTMLElement) || !field.matches(EDITABLE)) return;

  for (let parent = field.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (!/(auto|scroll)/.test(getComputedStyle(parent).overflowY) || parent.scrollHeight <= parent.clientHeight) continue;
    const bounds = parent.getBoundingClientRect();
    const visibleTop = Math.max(top, bounds.top + parent.clientTop) + 12;
    const visibleBottom = Math.min(top + height, bounds.top + parent.clientTop + parent.clientHeight) - 12;
    if (visibleBottom <= visibleTop) continue;
    const rect = field.getBoundingClientRect();
    const delta = rect.top < visibleTop
      ? rect.top - visibleTop
      : Math.max(0, Math.min(rect.bottom - visibleBottom, rect.top - visibleTop));
    if (delta) parent.scrollTop += delta;
    // Nested sheets and pages may both scroll. Moving every ancestor makes the
    // page fight a user's gesture, so the nearest scroll owner is authoritative.
    return;
  }
}

function observeViewport() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const previousHeight = root.style.getPropertyValue(HEIGHT);
  const previousTop = root.style.getPropertyValue(TOP);
  let revealTimer = 0;
  let keyboardWasOpen = false;
  let restingHeight = 0;
  let restingWidth = 0;
  let visibleTop = 0;
  let visibleHeight = window.innerHeight;
  let lastHeight = '';
  let lastTop = '';

  const sync = (event?: Event) => {
    // Pinch zoom keeps native panning; do not reflow the UI around a magnified viewport.
    const zoomed = viewport && Math.abs(viewport.scale - 1) > 0.05;
    const height = zoomed ? window.innerHeight : (viewport?.height ?? window.innerHeight);
    const editing = document.activeElement?.matches(EDITABLE) ?? false;
    // iOS 26 Safari shrinks innerHeight with the keyboard too, so compare with
    // the height seen before any field was focused (same width/orientation).
    if (!zoomed && !editing && !keyboardWasOpen) {
      restingHeight = Math.max(window.innerHeight, height);
      restingWidth = window.innerWidth;
    }
    const fullHeight = Math.max(window.innerHeight, restingWidth === window.innerWidth ? restingHeight : 0);
    // Keep the layout stable through blur/click until the keyboard actually
    // closes. Reflowing on pointer focus can move a checkbox before its click.
    const keyboardOpen = !zoomed && (editing || keyboardWasOpen) && fullHeight - height > 100;
    keyboardWasOpen = keyboardOpen;
    // Only typing should move the shell. Without a focused field, an offset means
    // Safari is panning or bouncing the document; following it drags the whole
    // app against the swipe. With one, Safari has panned to the field and every
    // overlay must follow, or it is left above the screen. Every write restyles
    // the document, so skip no-ops.
    const top = !zoomed && (keyboardOpen || editing) ? (viewport?.offsetTop ?? 0) : 0;
    visibleTop = top;
    visibleHeight = height;
    const nextHeight = `${Math.round(height)}px`;
    const nextTop = `${Math.round(top)}px`;
    if (nextHeight !== lastHeight) root.style.setProperty(HEIGHT, (lastHeight = nextHeight));
    if (nextTop !== lastTop) root.style.setProperty(TOP, (lastTop = nextTop));
    root.classList.toggle('software-keyboard-open', keyboardOpen);
    root.classList.toggle('compact-keyboard-viewport', Boolean(keyboardOpen && height < 400));
    // Safari emits visualViewport scroll events while the user pans. Updating
    // scrollTop in response reverses or fights that gesture. Reveal the focused
    // field only after focus or a viewport resize caused by the keyboard. Safari
    // also pans while the keyboard slides in, so a scroll must not cancel that
    // reveal, and the reveal measures the viewport as it is when it runs.
    if (event?.type === 'scroll' && keyboardOpen) return;
    window.clearTimeout(revealTimer);
    if (keyboardOpen && event?.type !== 'focusout') {
      revealTimer = window.setTimeout(() => revealFocusedField(visibleTop, visibleHeight), 120);
    }
  };

  sync();
  viewport?.addEventListener('resize', sync);
  viewport?.addEventListener('scroll', sync);
  window.addEventListener('resize', sync);
  document.addEventListener('focusin', sync);
  document.addEventListener('focusout', sync);
  return () => {
    window.clearTimeout(revealTimer);
    viewport?.removeEventListener('resize', sync);
    viewport?.removeEventListener('scroll', sync);
    window.removeEventListener('resize', sync);
    document.removeEventListener('focusin', sync);
    document.removeEventListener('focusout', sync);
    root.style.setProperty(HEIGHT, previousHeight);
    root.style.setProperty(TOP, previousTop);
    root.classList.remove('software-keyboard-open');
    root.classList.remove('compact-keyboard-viewport');
  };
}

/** One observer shared by the app and standalone/nested dialog consumers. */
export function useVisualViewport(active = true) {
  useEffect(() => {
    if (!active) return;
    if (subscribers++ === 0) stop = observeViewport();
    return () => {
      if (--subscribers === 0) {
        stop?.();
        stop = undefined;
      }
    };
  }, [active]);
}
