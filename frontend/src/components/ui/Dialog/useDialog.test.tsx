import type { RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useDialog } from './useDialog';

class MockVisualViewport extends EventTarget {
  height = 700;
  offsetTop = 0;
  scale = 1;
}

const originalVisualViewport = window.visualViewport;
let visualViewport: MockVisualViewport;

function TestDialog() {
  const { dialogRef, titleId } = useDialog({ isOpen: true, onClose: vi.fn() });

  return (
    <div ref={dialogRef as RefObject<HTMLDivElement>} role="dialog" aria-labelledby={titleId} tabIndex={-1}>
      <h2 id={titleId}>Tiêu đề</h2>
    </div>
  );
}

beforeEach(() => {
  visualViewport = new MockVisualViewport();
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: visualViewport,
  });
});

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--app-viewport-height');
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: originalVisualViewport,
  });
});

describe('useDialog viewport behavior', () => {
  it('sizes the overlay from the visual viewport height', () => {
    render(<TestDialog />);

    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('700px');
  });

  it('tracks keyboard resize and follows Safari panning only while typing', () => {
    render(<TestDialog />);

    visualViewport.offsetTop = 110;
    visualViewport.dispatchEvent(new Event('scroll'));
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('0px');

    const field = document.body.appendChild(document.createElement('input'));
    field.focus();
    visualViewport.height = 420;
    visualViewport.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('420px');

    visualViewport.dispatchEvent(new Event('scroll'));
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('110px');
    field.remove();
  });

  it('keeps the shared viewport and scroll lock until the last nested dialog closes', () => {
    const outer = render(<TestDialog />);
    const inner = render(<TestDialog />);
    inner.unmount();
    visualViewport.height = 350;
    visualViewport.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('350px');
    expect(document.body.style.overflow).toBe('hidden');
    outer.unmount();
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('');
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('does not cancel native touchmove scrolling inside the dialog', () => {
    const { getByRole } = render(<TestDialog />);
    const move = new Event('touchmove', { bubbles: true, cancelable: true });

    getByRole('dialog').dispatchEvent(move);

    expect(move.defaultPrevented).toBe(false);
  });
});
