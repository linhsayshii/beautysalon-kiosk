/** Red text only for a real amount owed or deducted; a zero amount keeps the neutral (or settled) tone. */
export function owedTone(value: number | string | null | undefined, settled = ''): string {
  return Number(value ?? 0) > 0 ? 'text-danger' : settled;
}
