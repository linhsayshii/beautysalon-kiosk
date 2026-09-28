/**
 * Reads a colour token from tokens.css as the literal hex that canvas-drawing libraries
 * (such as qrcode) need, since they cannot resolve CSS variables themselves.
 */
export function resolveHexToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : fallback;
}
