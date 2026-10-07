import { useLayoutEffect, useRef } from 'react';
import { Outlet, Navigate, useLocation, useNavigationType } from 'react-router-dom';
import { useAuth, homeForRole } from '@/features/auth/AuthProvider';
import { canAccessPath } from '@/features/auth/authorization';
import { AuthLoading } from '@/features/auth/LoginView';
import { MobileTopBar } from './MobileTopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { isReturnToPage } from '@/lib/scroll-restoration';

/** Scroll offsets per history entry (Back/Forward) and per page (header back button). */
const scrollByEntry = new Map<string, number>();
const scrollByPath = new Map<string, number>();
const MAX_SCROLL_POSITIONS = 50;

function rememberPosition(positions: Map<string, number>, key: string, top: number) {
  positions.delete(key);
  positions.set(key, top);
  if (positions.size > MAX_SCROLL_POSITIONS) positions.delete(positions.keys().next().value!);
}

function scrollMainTo(main: HTMLElement, top: number) {
  if (typeof main.scrollTo === 'function') main.scrollTo(0, top);
  else main.scrollTop = top;
}

/** Retries while a page is still rendering its data, until the user takes over. */
function restoreScroll(main: HTMLElement, top: number) {
  let frame = 0;
  let attempts = 0;
  const stop = () => {
    window.cancelAnimationFrame(frame);
    main.removeEventListener('touchstart', stop);
    main.removeEventListener('wheel', stop);
  };
  const step = () => {
    scrollMainTo(main, top);
    if (Math.abs(main.scrollTop - top) <= 1 || ++attempts > 30) stop();
    else frame = window.requestAnimationFrame(step);
  };
  main.addEventListener('touchstart', stop, { passive: true });
  main.addEventListener('wheel', stop, { passive: true });
  step();
  return stop;
}

export function MobileAppLayout() {
  const { account, loading } = useAuth();
  const location = useLocation();
  const navigationType = useNavigationType();
  const mainRef = useRef<HTMLElement>(null);
  const locationRef = useRef(location);
  locationRef.current = location;

  // Before paint: a new page starts at the top; Back/Forward and the header
  // back button return to where the user left the page.
  useLayoutEffect(() => {
    if (typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
    const main = mainRef.current;
    if (!main) return;
    const saved = navigationType === 'POP'
      ? scrollByEntry.get(location.key)
      : isReturnToPage(location.state) ? scrollByPath.get(location.pathname) : undefined;
    if (!saved) {
      scrollMainTo(main, 0);
      return;
    }
    return restoreScroll(main, saved);
  }, [location.pathname, location.key, location.state, navigationType]);

  const rememberScroll = () => {
    const main = mainRef.current;
    if (!main) return;
    rememberPosition(scrollByEntry, locationRef.current.key, main.scrollTop);
    rememberPosition(scrollByPath, locationRef.current.pathname, main.scrollTop);
  };

  if (loading) return <AuthLoading />;
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!canAccessPath(account.role, location.pathname)) return <Navigate to={homeForRole(account.role, true)} replace />;

  return (
    <div className="mobile-app-shell">
      <MobileTopBar />
      <main
        ref={mainRef}
        onScroll={rememberScroll}
        className="mobile-main-content"
      >
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}
