/** Red text only for a real amount owed or deducted; a zero amount keeps the neutral (or settled) tone. */
export function owedTone(value: number | string | null | undefined, settled = ''): string {
  return Number(value ?? 0) > 0 ? 'text-danger' : settled;
}

/** A zero amount is not news: it reads muted, any other amount keeps the given tone. */
export function amountTone(value: number | string | null | undefined, tone = ''): string {
  return Number(value ?? 0) === 0 ? 'text-muted' : tone;
}
