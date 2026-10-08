import { createRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { FloatingLayer } from './FloatingLayer';

it('makes a closing popover inert, preserves its exit, and cancels removal on reopen', () => {
  vi.useFakeTimers();
  try {
    const anchorRef = createRef<HTMLButtonElement>();
    const view = (open: boolean) => <>
      <button ref={anchorRef}>Chọn ngày</button>
      <FloatingLayer open={open} anchorRef={anchorRef} className="date-picker-popover" role="dialog" aria-label="Lịch">
        <button>Hôm nay</button>
      </FloatingLayer>
    </>;
    const { rerender } = render(view(false));
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(view(true));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-state', 'open');
    rerender(view(false));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(dialog).toHaveAttribute('inert');
    expect(dialog).toHaveAttribute('data-state', 'closed');
    act(() => vi.advanceTimersByTime(50));
    expect(dialog).toBeInTheDocument();
    rerender(view(true));
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(dialog).not.toHaveAttribute('inert');
    rerender(view(false));
    act(() => vi.advanceTimersByTime(100));
    expect(dialog).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
