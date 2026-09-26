import type { RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useDialog } from './useDialog';

class MockVisualViewport extends EventTarget {
  height = 700;
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
  document.documentElement.style.removeProperty('--mobile-overlay-viewport-height');
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: originalVisualViewport,
  });
});

describe('useDialog viewport behavior', () => {
  it('sizes the overlay from the visual viewport height', () => {
    render(<TestDialog />);

    expect(document.documentElement.style.getPropertyValue('--mobile-overlay-viewport-height')).toBe('700px');
  });

  it('updates height on viewport resize without tracking viewport scroll offset', () => {
    render(<TestDialog />);

    visualViewport.height = 420;
    visualViewport.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--mobile-overlay-viewport-height')).toBe('420px');

    visualViewport.height = 360;
    visualViewport.dispatchEvent(new Event('scroll'));
    expect(document.documentElement.style.getPropertyValue('--mobile-overlay-viewport-height')).toBe('420px');
    expect(document.documentElement.style.getPropertyValue('--mobile-overlay-viewport-offset-top')).toBe('');
  });

  it('does not cancel native touchmove scrolling inside the dialog', () => {
    const { getByRole } = render(<TestDialog />);
    const move = new Event('touchmove', { bubbles: true, cancelable: true });

    getByRole('dialog').dispatchEvent(move);

    expect(move.defaultPrevented).toBe(false);
  });
});
