import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValueStrip } from './InlineDetail';

describe('ValueStrip', () => {
  it('mutes a formatted zero instead of colouring it', () => {
    render(<ValueStrip items={[
      { label: 'Số dư thẻ', value: '0đ', tone: 'success' },
      { label: 'Nợ', value: '500.000đ', tone: 'danger' },
      { label: 'Ghé thăm', value: '0,5 lượt', tone: 'primary' },
    ]} />);
    expect(screen.getByText('0đ')).toHaveClass('is-zero');
    expect(screen.getByText('500.000đ')).toHaveClass('is-danger');
    expect(screen.getByText('0,5 lượt')).toHaveClass('is-primary');
  });
});
