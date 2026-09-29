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

  it('still reveals the field when Safari pans right after the keyboard opens', () => {
    const { getByRole, getByTestId } = render(<Form />);
    const field = getByRole('textbox', { name: 'Tìm kiếm' });
    const scroll = getByTestId('scroll');
    Object.defineProperties(scroll, { clientHeight: { value: 600 }, scrollHeight: { value: 1200 } });
    scroll.getBoundingClientRect = () => ({ top: 400 } as DOMRect);
    field.getBoundingClientRect = () => ({ top: 900, bottom: 944 } as DOMRect);
    act(() => {
      field.focus();
      viewport.height = 400;
      viewport.dispatchEvent(new Event('resize'));
      // iOS pans during the keyboard animation, before the reveal runs.
      viewport.offsetTop = 300;
      viewport.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(150);
    });
    // Visible sheet area: 412..688 in layout coordinates.
    expect(scroll.scrollTop).toBe(256);
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

  it('does not move or restyle the app shell while the page pans without a keyboard', () => {
    render(<Form />);
    const root = document.documentElement;
    const setProperty = vi.spyOn(root.style, 'setProperty');
    act(() => {
      // Safari pans the visual viewport when a swipe chains to the document.
      for (const offsetTop of [20, 69, 139, 60, 0]) {
        viewport.offsetTop = offsetTop;
        viewport.dispatchEvent(new Event('scroll'));
      }
      vi.advanceTimersByTime(50);
    });
    expect(root.style.getPropertyValue('--app-viewport-top')).toBe('0px');
    expect(setProperty).not.toHaveBeenCalled();
    setProperty.mockRestore();
  });

  it('follows the visual viewport offset only while the keyboard is open', () => {
    const { getByRole } = render(<Form />);
    act(() => {
      getByRole('textbox', { name: 'Tìm kiếm' }).focus();
      viewport.height = 400;
      viewport.dispatchEvent(new Event('resize'));
      viewport.offsetTop = 120;
      viewport.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(50);
    });
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('120px');
  });

  it('detects the keyboard and follows the pan when innerHeight shrinks with it', () => {
    const innerHeight = window.innerHeight;
    const { getByRole } = render(<Form />);
    try {
      act(() => {
        getByRole('textbox', { name: 'Ghi chú' }).focus();
        // iOS 26 Safari reports the keyboard in innerHeight as well.
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 430 });
        viewport.height = 430;
        viewport.dispatchEvent(new Event('resize'));
        // A field low in the sheet makes Safari pan the visual viewport.
        viewport.offsetTop = 320;
        viewport.dispatchEvent(new Event('scroll'));
      });
      expect(document.documentElement).toHaveClass('software-keyboard-open');
      expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('320px');
    } finally {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
    }
  });

  it('keeps an overlay on the visible area while a field is focused, even if the keyboard is not detected', () => {
    const { getByRole } = render(<Form />);
    act(() => {
      getByRole('textbox', { name: 'Tìm kiếm' }).focus();
      viewport.offsetTop = 180;
      viewport.dispatchEvent(new Event('scroll'));
    });
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('180px');
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
