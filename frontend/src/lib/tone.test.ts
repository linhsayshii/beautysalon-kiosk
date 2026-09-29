import { describe, expect, it } from 'vitest';
import { owedTone } from './tone';

describe('owedTone', () => {
  it('marks an amount still owed or deducted as danger', () => {
    expect(owedTone(290000)).toBe('text-danger');
  });
  it('leaves zero and missing amounts uncoloured', () => {
    expect(owedTone(0)).toBe('');
    expect(owedTone(null)).toBe('');
    expect(owedTone(undefined)).toBe('');
  });
  it('can return a settled tone instead of nothing', () => {
    expect(owedTone(0, 'text-success')).toBe('text-success');
  });
});
