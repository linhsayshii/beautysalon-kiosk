function candidateInvoiceCode() {
  const dateStr = new Intl.DateTimeFormat('en-GB', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()).replace(/\//g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `HD${dateStr}-${randomSuffix}`;
}

/**
 * Returns an unused invoice code such as HD290926-4339. POS sales and
 * appointment invoices share this format so staff can read it out to a customer.
 */
export async function newInvoiceCode(client) {
  for (let attempts = 0; attempts < 5; attempts++) {
    const code = candidateInvoiceCode();
    const existing = await client.query('SELECT id FROM invoices WHERE code = $1', [code]);
    if (!existing.rows[0]) return code;
  }
  return `HD${Date.now().toString().slice(-8)}`;
}
