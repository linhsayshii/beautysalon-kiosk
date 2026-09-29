import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardStats } from './DashboardStats';

const dashboard = {
  summary: {
    appointments: { total: 4, completed: 1, completionRate: 25, changePercent: 12.5 },
    customers: { total: 2, new: 1, returning: 1, walkIn: 0 },
    cash: { income: 5_200_000, expense: 600_000 },
  },
};

describe('DashboardStats', () => {
  it('headlines today\'s net cash, since the card covers income and expense', () => {
    render(<DashboardStats dashboard={dashboard} />);
    const card = screen.getByRole('heading', { name: 'Thu chi hôm nay' }).closest('article')!;
    expect(card.querySelector('.stat-value')).toHaveTextContent('4.600.000đ');
    expect(card).toHaveTextContent('Tiền thu 5.200.000đ');
    expect(card).toHaveTextContent('Tiền chi 600.000đ');
  });

  it('shows a negative net when spending exceeds income', () => {
    render(<DashboardStats dashboard={{ ...dashboard, summary: { ...dashboard.summary, cash: { income: 100_000, expense: 250_000 } } }} />);
    const card = screen.getByRole('heading', { name: 'Thu chi hôm nay' }).closest('article')!;
    expect(card.querySelector('.stat-value')).toHaveTextContent('-150.000đ');
  });

  it('writes percentages with the Vietnamese decimal comma', () => {
    render(<DashboardStats dashboard={dashboard} />);
    expect(screen.getByText('12,5%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.queryByText(/\d\.\d+%/)).not.toBeInTheDocument();
  });
});
