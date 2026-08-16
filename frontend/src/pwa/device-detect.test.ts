import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isMobileDevice, getPreferredUiMode, setPreferredUiMode, shouldRedirectToMobile } from './device-detect';

describe('device-detect utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('handles preference storage correctly', () => {
    expect(getPreferredUiMode()).toBeNull();
    setPreferredUiMode('mobile');
    expect(getPreferredUiMode()).toBe('mobile');
    setPreferredUiMode('desktop');
    expect(getPreferredUiMode()).toBe('desktop');
  });

  it('detects standalone mode or narrow viewport', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
    })));
    expect(isMobileDevice()).toBe(true);
  });

  it('evaluates shouldRedirectToMobile correctly', () => {
    // Should not redirect if already on /m route or /login
    expect(shouldRedirectToMobile('/m/dashboard')).toBe(false);
    expect(shouldRedirectToMobile('/login')).toBe(false);

    // If preferred desktop, should not redirect
    setPreferredUiMode('desktop');
    expect(shouldRedirectToMobile('/orders')).toBe(false);

    // If preferred mobile, should redirect
    setPreferredUiMode('mobile');
    expect(shouldRedirectToMobile('/orders')).toBe(true);
  });
});
