/** Navigation state that reopens a page at the scroll position the user left it. */
export const RETURN_TO_PAGE_STATE = { restoreScroll: true } as const;

export function isReturnToPage(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { restoreScroll?: unknown }).restoreScroll === true;
}
