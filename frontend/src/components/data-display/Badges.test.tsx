import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GoodsTypeBadge, StatusBadge } from './Badges';

describe('StatusBadge', () => {
  it('uses the purchasing-specific completed label', () => {
    render(<StatusBadge status="completed" purchase />);
    expect(screen.getByText('Đã nhập hàng')).toHaveClass('completed');
  });

  it('renders the account card catalog type', () => {
    render(<GoodsTypeBadge type="account_card" />);
    expect(screen.getByText('Thẻ tài khoản')).toHaveClass('account_card');
  });
});
