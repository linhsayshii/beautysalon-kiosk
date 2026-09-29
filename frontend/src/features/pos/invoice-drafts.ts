type ClosableInvoice = {
  name: string;
  customer: { name?: string | null } | null;
  lines: { quantity: number }[];
};

/** Returns the question to ask before closing a POS invoice tab, or null when nothing would be lost. */
export function closeInvoiceConfirmation(invoice: ClosableInvoice): string | null {
  const owner = invoice.customer?.name ? ` của ${invoice.customer.name}` : '';
  const quantity = invoice.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  if (invoice.lines.length) return `Đóng ${invoice.name}${owner}? ${quantity} món trong hóa đơn sẽ bị bỏ.`;
  if (invoice.customer) return `Đóng ${invoice.name}${owner}? Hóa đơn chưa được lưu.`;
  return null;
}
