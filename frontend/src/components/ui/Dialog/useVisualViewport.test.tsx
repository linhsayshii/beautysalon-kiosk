import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewport } from './useVisualViewport';

class MockViewport extends EventTarget {
  height = 768;
  offsetTop = 0;
  scale = 1;
}

let viewport: MockViewport;
const original = window.visualViewport;
function Form() {
  useVisualViewport();
  return <div data-testid="scroll" style={{ overflowY: 'auto' }}><input aria-label="Tìm kiếm" /><textarea aria-label="Ghi chú" /></div>;
}

beforeEach(() => {
  vi.useFakeTimers();
  viewport = new MockViewport();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: original });
});

describe('keyboard viewport for all forms', () => {
  it('reveals a covered input by scrolling its container without scrolling the page', () => {
    const { getByRole, getByTestId } = render(<Form />);
    const field = getByRole('textbox', { name: 'Tìm kiếm' });
    const scroll = getByTestId('scroll');
    Object.defineProperties(scroll, { clientHeight: { value: 220 }, scrollHeight: { value: 900 } });
    scroll.getBoundingClientRect = () => ({ top: 130 } as DOMRect);
    field.getBoundingClientRect = () => ({ top: 500, bottom: 544 } as DOMRect);
    act(() => {
      field.focus();
      viewport.height = 400;
      viewport.offsetTop = 100;
      viewport.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(150);
    });
    expect(scroll.scrollTop).toBe(206);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(document.documentElement).toHaveClass('software-keyboard-open');
    act(() => {
      viewport.height = 768;
      viewport.offsetTop = 0;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(document.documentElement).not.toHaveClass('software-keyboard-open');
  });

  it('does not change a container scroll position while the visual viewport pans', () => {
    const { getByRole, getByTestId } = render(<Form />);
    const note = getByRole('textbox', { name: 'Ghi chú' });
    const scroll = getByTestId('scroll');
    Object.defineProperties(scroll, { clientHeight: { value: 300 }, scrollHeight: { value: 900 } });
    scroll.getBoundingClientRect = () => ({ top: 80 } as DOMRect);
    note.getBoundingClientRect = () => ({ top: 150, bottom: 220 } as DOMRect);
    act(() => {
      viewport.height = 400;
      viewport.dispatchEvent(new Event('resize'));
      note.focus();
      vi.advanceTimersByTime(150);
    });
    expect(scroll.scrollTop).toBe(0);
    scroll.scrollTop = 200;
    note.getBoundingClientRect = () => ({ top: 20, bottom: 64 } as DOMRect);
    act(() => {
      viewport.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(150);
    });
    expect(scroll.scrollTop).toBe(200);
  });

  it('reveals a covered field through only its nearest scrollable ancestor', () => {
    const { getByRole, getByTestId } = render(<div data-testid="outer" style={{ overflowY: 'auto' }}><Form /></div>);
    const field = getByRole('textbox', { name: 'Tìm kiếm' });
    const inner = getByTestId('scroll');
    const outer = getByTestId('outer');
    Object.defineProperties(inner, { clientHeight: { value: 220 }, scrollHeight: { value: 900 } });
    Object.defineProperties(outer, { clientHeight: { value: 300 }, scrollHeight: { value: 1000 } });
    inner.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
    outer.getBoundingClientRect = () => ({ top: 0 } as DOMRect);
    field.getBoundingClientRect = () => ({ top: 500, bottom: 544 } as DOMRect);
    act(() => {
      field.focus();
      viewport.height = 400;
      viewport.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(150);
    });
    expect(inner.scrollTop).toBe(236);
    expect(outer.scrollTop).toBe(0);
  });

  it('does not interpret pinch zoom as a software keyboard', () => {
    const { getByRole } = render(<Form />);
    act(() => {
      getByRole('textbox', { name: 'Tìm kiếm' }).focus();
      viewport.scale = 2;
      viewport.height = 300;
      viewport.offsetTop = 90;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(document.documentElement).not.toHaveClass('software-keyboard-open');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe(`${window.innerHeight}px`);
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('0px');
  });

  it('allows the whole dialog to scroll in a short keyboard viewport and restores it on close', () => {
    const { getByRole, unmount } = render(<Form />);
    act(() => {
      getByRole('textbox', { name: 'Ghi chú' }).focus();
      viewport.height = 240;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(document.documentElement).toHaveClass('compact-keyboard-viewport');
    act(() => getByRole('textbox', { name: 'Ghi chú' }).blur());
    expect(document.documentElement).toHaveClass('compact-keyboard-viewport');
    act(() => {
      viewport.height = 768;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(document.documentElement).not.toHaveClass('compact-keyboard-viewport');
    unmount();
    expect(document.documentElement).not.toHaveClass('software-keyboard-open');
  });

  it('falls back to window resize when VisualViewport is unavailable and cleans up', () => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
    const { unmount } = render(<Form />);
    window.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe(`${window.innerHeight}px`);
    unmount();
    window.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('');
  });
});
