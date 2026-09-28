import { resolvePath, type createBrowserRouter } from 'react-router-dom';
import { isReturnToPage } from './scroll-restoration';

/** How a page change animates; read by styles/motion.css from `<html data-route-motion>`. */
export type RouteMotion = 'fade' | 'push' | 'back' | 'none';
type HistoryDirection = 'back' | 'forward';
type DataRouter = ReturnType<typeof createBrowserRouter>;

/** Bottom-nav destinations across roles: moving between them is a tab switch, not a push. */
const MOBILE_TABS = new Set([
  '/m',
  '/m/dashboard',
  '/m/appointments',
  '/m/notifications',
  '/m/more',
  '/m/pos',
  '/m/attendance',
  '/m/my-schedule',
  '/m/salary',
  '/m/account',
]);

const normalize = (pathname: string) => pathname.replace(/\/+$/, '') || '/';
const isMobilePath = (pathname: string) => pathname === '/m' || pathname.startsWith('/m/');
const isInside = (child: string, parent: string) => parent !== '/m' && child.startsWith(`${parent}/`);

/** Desktop always fades; the mobile shell slides like a native app stack. */
export function routeMotion(fromPathname: string, toPathname: string, direction?: HistoryDirection): RouteMotion {
  const from = normalize(fromPathname);
  const to = normalize(toPathname);
  if (!isMobilePath(from) || !isMobilePath(to)) return 'fade';
  if (direction) return direction === 'back' ? 'back' : 'push';
  if (isInside(to, from)) return 'push';
  if (isInside(from, to)) return 'back';
  const fromTab = MOBILE_TABS.has(from);
  const toTab = MOBILE_TABS.has(to);
  if (fromTab && !toTab) return 'push';
  if (!fromTab && toTab) return 'back';
  return 'fade';
}

function historyIndex(state: unknown): number | null {
  const idx = (state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' ? idx : null;
}

/**
 * Turns on View Transitions for every page change without touching call sites:
 * Link, NavLink, navigate() and <Navigate> all go through router.navigate.
 * Query-only changes and replace redirects stay instant. Browsers without the
 * API keep today's instant navigation. Returns a function that undoes it.
 */
export function enableRouteTransitions(router: DataRouter): () => void {
  if (typeof document.startViewTransition !== 'function') return () => {};
  const root = document.documentElement;
  const setMotion = (motion: RouteMotion) => { root.dataset.routeMotion = motion; };

  const navigate = router.navigate;
  router.navigate = ((to: Parameters<DataRouter['navigate']>[0], opts?: Parameters<DataRouter['navigate']>[1]) => {
    // Numeric deltas become popstate, which the listener below handles.
    if (typeof to === 'number' || to === null || opts?.replace || opts?.viewTransition === false) return navigate(to as never, opts);
    const from = router.state.location.pathname;
    const target = resolvePath(to, from).pathname;
    if (normalize(target) === normalize(from)) return navigate(to, opts);
    setMotion(routeMotion(from, target, isReturnToPage(opts?.state) ? 'back' : undefined));
    return navigate(to, { ...opts, viewTransition: true });
  }) as DataRouter['navigate'];

  // React Router replays a view transition on Back/Forward to a page that was
  // entered with one; the history index tells which way the user went. React
  // Router may finish its own popstate handling before this listener runs, so
  // the page being left is tracked here and only its non-POP updates count.
  let index = historyIndex(window.history.state);
  let pathname = router.state.location.pathname;
  const onPopState = (event: PopStateEvent) => {
    const next = historyIndex(event.state);
    const direction: HistoryDirection = next !== null && index !== null && next > index ? 'forward' : 'back';
    const from = pathname;
    index = next;
    pathname = window.location.pathname;
    // iOS Safari has already animated an edge-swipe; a second slide would stutter.
    const uaAnimated = (event as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition === true;
    setMotion(uaAnimated ? 'none' : routeMotion(from, pathname, direction));
  };
  window.addEventListener('popstate', onPopState);
  const unsubscribe = router.subscribe((state) => {
    if (state.navigation.state !== 'idle' || state.historyAction === 'POP') return;
    index = historyIndex(window.history.state);
    pathname = state.location.pathname;
  });

  return () => {
    router.navigate = navigate;
    window.removeEventListener('popstate', onPopState);
    unsubscribe();
  };
}
