import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MobileMetricCards } from './MobileMetricCards';

describe('MobileMetricCards', () => {
  it('renders all metric items correctly with label, value, note, and tone classes', () => {
    const items = [
      { label: 'Tổng khách hàng', value: '1,240', note: '+12 tháng này', tone: 'blue' as const },
      { label: 'Doanh thu hôm nay', value: '15,400,000 đ', tone: 'green' as const },
      { label: 'Khách nợ', value: 5, note: 'Cần thu hồi', tone: 'red' as const },
      { label: 'Gói active', value: 88, tone: 'violet' as const },
    ];

    const { container } = render(<MobileMetricCards items={items} />);

    expect(screen.getByText('Tổng khách hàng')).toBeInTheDocument();
    expect(screen.getByText('1,240')).toBeInTheDocument();
    expect(screen.getByText('+12 tháng này')).toBeInTheDocument();

    expect(screen.getByText('Doanh thu hôm nay')).toBeInTheDocument();
    expect(screen.getByText('15,400,000 đ')).toBeInTheDocument();

    expect(screen.getByText('Khách nợ')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Cần thu hồi')).toBeInTheDocument();

    expect(screen.getByText('Gói active')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();

    const blueCard = container.querySelector('.mobile-metric-card.tone-blue');
    const greenCard = container.querySelector('.mobile-metric-card.tone-green');
    const redCard = container.querySelector('.mobile-metric-card.tone-red');
    const violetCard = container.querySelector('.mobile-metric-card.tone-violet');

    expect(blueCard).toBeInTheDocument();
    expect(greenCard).toBeInTheDocument();
    expect(redCard).toBeInTheDocument();
    expect(violetCard).toBeInTheDocument();
  });

  it('renders nothing if items list is empty', () => {
    const { container } = render(<MobileMetricCards items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
