import { act, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createBrowserRouter, createMemoryRouter } from 'react-router-dom';
import { enableRouteTransitions, routeMotion } from './route-motion';
import { RETURN_TO_PAGE_STATE } from './scroll-restoration';

describe('routeMotion', () => {
  it('fades every desktop page change', () => {
    expect(routeMotion('/dashboard', '/orders')).toBe('fade');
    expect(routeMotion('/staff', '/staff/payroll')).toBe('fade');
  });

  it('fades when crossing between the desktop and mobile shells', () => {
    expect(routeMotion('/dashboard', '/m/dashboard')).toBe('fade');
    expect(routeMotion('/m/more', '/login', 'back')).toBe('fade');
  });

  it('fades between mobile bottom-nav tabs', () => {
    expect(routeMotion('/m/dashboard', '/m/appointments')).toBe('fade');
    expect(routeMotion('/m/attendance', '/m/my-schedule')).toBe('fade');
  });

  it('pushes into a deeper mobile page', () => {
    expect(routeMotion('/m/appointments', '/m/appointments/new')).toBe('push');
    expect(routeMotion('/m/staff', '/m/staff/payroll/')).toBe('push');
  });

  it('pushes from a mobile tab into a feature page', () => {
    expect(routeMotion('/m/more', '/m/cashbook')).toBe('push');
    expect(routeMotion('/m/dashboard', '/m/reports')).toBe('push');
  });

  it('slides back to a parent or to a tab', () => {
    expect(routeMotion('/m/purchase-orders/new', '/m/purchase-orders')).toBe('back');
    expect(routeMotion('/m/cashbook', '/m/more')).toBe('back');
  });

  it('fades between sibling mobile feature pages', () => {
    expect(routeMotion('/m/customers', '/m/customer-cards')).toBe('fade');
  });

  it('follows an explicit history direction on mobile', () => {
    expect(routeMotion('/m/customers', '/m/customer-cards', 'back')).toBe('back');
    expect(routeMotion('/m/cashbook', '/m/more', 'forward')).toBe('push');
  });
});

function fakeViewTransitions() {
  const startViewTransition = vi.fn((update: () => unknown) => {
    const updateCallbackDone = Promise.resolve().then(update).then(() => undefined);
    return { finished: updateCallbackDone, ready: updateCallbackDone, updateCallbackDone, skipTransition: () => {} };
  });
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: startViewTransition });
  return startViewTransition;
}

function renderRouter(initialPath: string) {
  const router = createMemoryRouter(
    ['/m/more', '/m/cashbook', '/m/staff', '/m/staff/payroll', '/dashboard'].map((path) => ({ path, element: <p>{path}</p> })),
    { initialEntries: [initialPath] },
  );
  const disable = enableRouteTransitions(router);
  render(<RouterProvider router={router} />);
  return { router, disable };
}

describe('enableRouteTransitions', () => {
  let disable: (() => void) | undefined;

  // Data routers build a Request per navigation; Node's Request rejects jsdom's AbortSignal.
  beforeAll(() => {
    const NodeRequest = globalThis.Request;
    vi.stubGlobal('Request', class extends NodeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(input, init && { ...init, signal: undefined });
      }
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    disable?.();
    delete (document as { startViewTransition?: unknown }).startViewTransition;
    delete document.documentElement.dataset.routeMotion;
  });

  it('animates a change of page and records its motion', async () => {
    const startViewTransition = fakeViewTransitions();
    const setup = renderRouter('/m/more');
    disable = setup.disable;

    await act(() => setup.router.navigate('/m/cashbook'));

    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.routeMotion).toBe('push');
    expect(setup.router.state.location.pathname).toBe('/m/cashbook');
  });

  it('slides back when the navigation returns to a saved page', async () => {
    fakeViewTransitions();
    const setup = renderRouter('/m/cashbook');
    disable = setup.disable;

    await act(() => setup.router.navigate('/m/staff', { state: RETURN_TO_PAGE_STATE }));

    expect(document.documentElement.dataset.routeMotion).toBe('back');
  });

  it('does not animate query-only changes or redirects', async () => {
    const startViewTransition = fakeViewTransitions();
    const setup = renderRouter('/m/cashbook');
    disable = setup.disable;

    await act(() => setup.router.navigate('/m/cashbook?create=1'));
    await act(() => setup.router.navigate('/m/staff', { replace: true }));

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(setup.router.state.location.pathname).toBe('/m/staff');
  });

  it('leaves navigation untouched where view transitions are unsupported', async () => {
    const setup = renderRouter('/m/more');
    disable = setup.disable;

    await act(() => setup.router.navigate('/m/cashbook'));

    expect(setup.router.state.location.pathname).toBe('/m/cashbook');
    expect(document.documentElement.dataset.routeMotion).toBeUndefined();
  });

  it('picks the direction of a browser Back or Forward from the history index', () => {
    fakeViewTransitions();
    window.history.replaceState({ idx: 3 }, '', '/m/staff/payroll');
    const setup = renderRouter('/m/staff/payroll');
    disable = setup.disable;

    window.history.replaceState({ idx: 2 }, '', '/m/staff');
    window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 2 } }));
    expect(document.documentElement.dataset.routeMotion).toBe('back');

    window.history.replaceState({ idx: 4 }, '', '/m/cashbook');
    window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 4 } }));
    expect(document.documentElement.dataset.routeMotion).toBe('push');
  });

  it('slides forward when the browser Forward button replays a push', async () => {
    fakeViewTransitions();
    window.history.replaceState(null, '', '/m/more');
    const router = createBrowserRouter(['/m/more', '/m/customers'].map((path) => ({ path, element: <p>{path}</p> })));
    disable = enableRouteTransitions(router);
    render(<RouterProvider router={router} />);
    const popped = () => new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    const settled = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    await act(() => router.navigate('/m/customers'));
    window.history.back();
    await popped();
    await settled();
    expect(document.documentElement.dataset.routeMotion).toBe('back');

    window.history.forward();
    await popped();
    await settled();
    expect(document.documentElement.dataset.routeMotion).toBe('push');
    router.dispose();
  });

  it('keeps the Forward direction when React Router handles the popstate first', async () => {
    fakeViewTransitions();
    window.history.replaceState({ idx: 2 }, '', '/m/more');
    const router = createMemoryRouter(['/m/more', '/m/cashbook'].map((path) => ({ path, element: <p>{path}</p> })), {
      initialEntries: ['/m/more', '/m/cashbook'],
      initialIndex: 0,
    });
    disable = enableRouteTransitions(router);
    render(<RouterProvider router={router} />);

    // The browser moves to the next entry and React Router finishes its POP before this listener runs.
    window.history.replaceState({ idx: 3 }, '', '/m/cashbook');
    await act(() => router.navigate(1));
    window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 3 } }));

    expect(document.documentElement.dataset.routeMotion).toBe('push');
  });

  it('skips its own animation when the browser already animated a swipe back', () => {
    fakeViewTransitions();
    window.history.replaceState({ idx: 3 }, '', '/m/staff/payroll');
    const setup = renderRouter('/m/staff/payroll');
    disable = setup.disable;

    window.history.replaceState({ idx: 2 }, '', '/m/staff');
    const swipe = new PopStateEvent('popstate', { state: { idx: 2 } });
    Object.defineProperty(swipe, 'hasUAVisualTransition', { value: true });
    window.dispatchEvent(swipe);

    expect(document.documentElement.dataset.routeMotion).toBe('none');
  });
});
