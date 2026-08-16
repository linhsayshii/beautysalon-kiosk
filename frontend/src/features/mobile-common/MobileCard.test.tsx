import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileCard } from './MobileCard';

describe('MobileCard', () => {
  it('renders title, subtitle, avatar, badge, details and actions', () => {
    const handleClick = vi.fn();
    const { container } = render(
      <MobileCard
        title="Nguyễn Thị Lan"
        subtitle="0912345678 • KH VIP"
        avatar={<span data-testid="avatar">NL</span>}
        badge={{ text: 'Nợ 500,000 đ', tone: 'red' }}
        details={[
          { label: 'Gói active', value: '2 gói' },
          { label: 'Lần cuối đến', value: '15/08/2026' },
        ]}
        action={<button>Gọi</button>}
        onClick={handleClick}
      />
    );

    expect(screen.getByText('Nguyễn Thị Lan')).toBeInTheDocument();
    expect(screen.getByText('0912345678 • KH VIP')).toBeInTheDocument();
    expect(screen.getByTestId('avatar')).toBeInTheDocument();

    const badge = screen.getByText('Nợ 500,000 đ');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('tone-red');

    expect(screen.getByText('Gói active')).toBeInTheDocument();
    expect(screen.getByText('2 gói')).toBeInTheDocument();
    expect(screen.getByText('Lần cuối đến')).toBeInTheDocument();
    expect(screen.getByText('15/08/2026')).toBeInTheDocument();

    expect(screen.getByText('Gọi')).toBeInTheDocument();

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('is-clickable');
    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders without optional fields and without clickable style if no onClick', () => {
    const { container } = render(<MobileCard title="Đơn hàng #1001" />);

    expect(screen.getByText('Đơn hàng #1001')).toBeInTheDocument();
    const card = container.firstChild as HTMLElement;
    expect(card).not.toHaveClass('is-clickable');
  });
});
