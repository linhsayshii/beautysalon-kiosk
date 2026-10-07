const TYPE_FLAG = { product: 'allowProducts', service: 'allowServices', package: 'allowPackages' };

/** Invoice lines with the invoice discount spread by line value; the last line takes the rounding. */
export function walletLines(items, discount) {
  const payable = items.filter((item) => item.lineTotal > 0);
  const subtotal = payable.reduce((sum, item) => sum + item.lineTotal, 0);
  let discountLeft = Math.min(discount, subtotal);
  return payable.map((item, index) => {
    const share = index === payable.length - 1 ? discountLeft : Math.round(discount * item.lineTotal / subtotal);
    discountLeft -= share;
    return { itemType: item.itemType, itemId: item.itemId, name: item.name, amount: item.lineTotal - share };
  });
}

/**
 * A card pays for a line when it allows the line's type and, if it lists
 * specific goods of that type, the line is one of them. Prepaid cards never
 * pay for another card.
 */
export function cardCovers(card, line) {
  const flag = TYPE_FLAG[line.itemType];
  if (!flag || !card[flag]) return false;
  const listed = card.scope.filter((key) => key.startsWith(`${line.itemType}:`));
  return !listed.length || listed.includes(`${line.itemType}:${line.itemId}`);
}

/**
 * Splits a wallet payment over the customer's cards line by line. Cards come
 * ordered by expiry; for each line the narrowest eligible card is spent first
 * so a general card stays available for lines only it can cover.
 * Returns the amount to take from each card and the lines left unpaid.
 */
// ponytail: greedy per line, not an optimal assignment; enough for a handful of cards per customer.
export function allocateWalletPayment(lines, cards) {
  const available = new Map(cards.map((card) => [card.id, card.balance]));
  const narrowness = (card, line) => [
    card.scope.some((key) => key.startsWith(`${line.itemType}:`)) ? 0 : 1,
    Object.values(TYPE_FLAG).filter((flag) => card[flag]).length,
  ];
  const deductions = new Map();
  const uncovered = [];
  for (const line of lines) {
    let left = line.amount;
    const eligible = cards
      .map((card, order) => ({ card, order, rank: narrowness(card, line) }))
      .filter(({ card }) => cardCovers(card, line))
      .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.order - b.order);
    for (const { card } of eligible) {
      if (left <= 0) break;
      const take = Math.min(available.get(card.id), left);
      if (take <= 0) continue;
      available.set(card.id, available.get(card.id) - take);
      deductions.set(card.id, (deductions.get(card.id) ?? 0) + take);
      left -= take;
    }
    if (left > 0) uncovered.push(line.name);
  }
  return { deductions, uncovered };
}
