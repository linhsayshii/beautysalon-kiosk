import { afterEach, describe, expect, it } from 'vitest';
import { resolveHexToken } from './color-token';

describe('resolveHexToken', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--test-ink');
  });

  it('returns the hex value of a colour token', () => {
    document.documentElement.style.setProperty('--test-ink', '#172033');
    expect(resolveHexToken('--test-ink', '#000000')).toBe('#172033');
  });

  it('falls back when the token is missing', () => {
    expect(resolveHexToken('--test-ink', '#000000')).toBe('#000000');
  });

  it('falls back when the token is not a literal hex colour', () => {
    document.documentElement.style.setProperty('--test-ink', 'var(--ink-950)');
    expect(resolveHexToken('--test-ink', '#000000')).toBe('#000000');
  });
});
