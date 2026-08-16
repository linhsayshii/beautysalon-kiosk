import type { ApiRecord } from '@/types/api';

export function csvCell(value: unknown) {
  const text = String(value ?? '');
  const neutralized = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${neutralized.replaceAll('"', '""')}"`;
}

export function exportCsv(rows: ApiRecord[], name: string) {
  if (!rows.length) return false;
  const keys = Object.keys(rows[0]).filter((key) => typeof rows[0][key] !== 'object');
  const csv = [keys.map(csvCell).join(','), ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(','))].join('\n');
  const href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = href;
  link.download = `annachill-${name}.csv`;
  link.click();
  URL.revokeObjectURL(href);
  return true;
}
