const STORAGE_KEY = 'annachill-ui-mode';

export type UiMode = 'mobile' | 'desktop';

export function getPreferredUiMode(): UiMode | null {
  const val = localStorage.getItem(STORAGE_KEY);
  return val === 'mobile' || val === 'desktop' ? val : null;
}

export function setPreferredUiMode(mode: UiMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
  const isTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isNarrowScreen = window.innerWidth <= 768;
  return isStandalone || (isTouchScreen && isNarrowScreen);
}

export function shouldRedirectToMobile(currentPath: string): boolean {
  if (currentPath.startsWith('/m') || currentPath === '/login') return false;
  const pref = getPreferredUiMode();
  if (pref === 'desktop') return false;
  if (pref === 'mobile') return true;
  return isMobileDevice();
}
