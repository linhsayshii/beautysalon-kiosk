import type { RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useMobileDialog } from './useMobileDialog';

function touchEvent(type: 'touchstart' | 'touchmove', clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    configurable: true,
    value: [{ clientY }],
  });
  return event;
}

function TestDialog() {
  const { dialogRef, titleId } = useMobileDialog({ isOpen: true, onClose: vi.fn() });

  return (
    <div data-testid="backdrop">
      <div ref={dialogRef as RefObject<HTMLDivElement>} role="dialog" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId}>Tiêu đề</h2>
        <div data-testid="sheet-scroll-area" style={{ overflowY: 'auto' }} />
      </div>
    </div>
  );
}

function setScrollableDimensions(element: HTMLElement, scrollTop: number) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 200 },
    scrollHeight: { configurable: true, value: 600 },
    scrollTop: { configurable: true, writable: true, value: scrollTop },
  });
}

afterEach(() => {
  cleanup();
});

describe('useMobileDialog scroll containment', () => {
  it('blocks a swipe that starts outside the active dialog', () => {
    render(<TestDialog />);

    const backdrop = screen.getByTestId('backdrop');
    const move = touchEvent('touchmove', 80);
    backdrop.dispatchEvent(move);

    expect(move.defaultPrevented).toBe(true);
  });

  it('allows the sheet scroll area to scroll away from its boundaries', () => {
    render(<TestDialog />);

    const scrollArea = screen.getByTestId('sheet-scroll-area');
    setScrollableDimensions(scrollArea, 120);
    scrollArea.dispatchEvent(touchEvent('touchstart', 200));
    const move = touchEvent('touchmove', 160);
    scrollArea.dispatchEvent(move);

    expect(move.defaultPrevented).toBe(false);
  });

  it('blocks scroll chaining when a sheet scroll area is already at its top edge', () => {
    render(<TestDialog />);

    const scrollArea = screen.getByTestId('sheet-scroll-area');
    setScrollableDimensions(scrollArea, 0);
    scrollArea.dispatchEvent(touchEvent('touchstart', 100));
    const move = touchEvent('touchmove', 140);
    scrollArea.dispatchEvent(move);

    expect(move.defaultPrevented).toBe(true);
  });
});
