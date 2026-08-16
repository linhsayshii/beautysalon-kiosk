import { describe, expect, it } from 'vitest';
import { csvCell } from './export';

describe('CSV export safety', () => {
  it('neutralizes spreadsheet formulas and escapes quotes', () => {
    expect(csvCell('=HYPERLINK("https://evil.example")')).toBe('"\'=HYPERLINK(""https://evil.example"")"');
    expect(csvCell('  +1+1')).toBe('"\'  +1+1"');
    expect(csvCell('Anna Chill')).toBe('"Anna Chill"');
  });
});
