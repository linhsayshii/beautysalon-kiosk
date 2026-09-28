import { useEffect } from 'react';

const EDITABLE = 'textarea:not([disabled]):not([readonly]), input:not([disabled]):not([readonly]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="range"]):not([type="color"]), [contenteditable="true"]';
const HEIGHT = '--app-viewport-height';
const TOP = '--app-viewport-top';
let subscribers = 0;
let stop: (() => void) | undefined;

/** Scroll the field's container, never the document behind a dialog. */
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
  }
}

function observeViewport() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const previousHeight = root.style.getPropertyValue(HEIGHT);
  const previousTop = root.style.getPropertyValue(TOP);
  let revealTimer = 0;
  let keyboardWasOpen = false;

  const sync = () => {
    // Pinch zoom keeps native panning; do not reflow the UI around a magnified viewport.
    const zoomed = viewport && Math.abs(viewport.scale - 1) > 0.05;
    const height = zoomed ? window.innerHeight : (viewport?.height ?? window.innerHeight);
    const top = zoomed ? 0 : (viewport?.offsetTop ?? 0);
    root.style.setProperty(HEIGHT, `${Math.round(height)}px`);
    root.style.setProperty(TOP, `${Math.round(top)}px`);
    const editing = document.activeElement?.matches(EDITABLE) ?? false;
    // Keep the layout stable through blur/click until the keyboard actually
    // closes. Reflowing on pointer focus can move a checkbox before its click.
    const keyboardOpen = !zoomed && (editing || keyboardWasOpen) && window.innerHeight - height > 100;
    keyboardWasOpen = keyboardOpen;
    root.classList.toggle('software-keyboard-open', keyboardOpen);
    root.classList.toggle('compact-keyboard-viewport', Boolean(keyboardOpen && height < 400));
    window.clearTimeout(revealTimer);
    // Safari animates both resize and pan. Wait for them to settle before scrolling.
    if (keyboardOpen) revealTimer = window.setTimeout(() => revealFocusedField(top, height), 120);
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
