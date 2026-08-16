import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardSide } from './DashboardSide';

describe('DashboardSide component', () => {
  const baseDashboard = {
    reminders: {
      customersInDebt: 2,
      productsBelowStock: 1,
      productsAboveStock: 0,
    },
    upcomingAppointments: [],
    activities: [
      { id: 1, actorName: 'Nguyễn Văn A', description: 'tạo đơn hàng mới', objectCode: 'DH001', occurredAt: '2026-08-16T10:00:00Z', avatarTone: 'blue' },
      { id: 2, actorName: 'Trần Thị B', description: 'thanh toán hóa đơn', objectCode: 'HD002', occurredAt: '2026-08-16T09:30:00Z', avatarTone: 'pink' },
      { id: 3, actorName: 'Lê Văn C', description: 'check-in khách hàng', objectCode: 'KH003', occurredAt: '2026-08-16T09:00:00Z', avatarTone: 'violet' },
      { id: 4, actorName: 'Phạm Thị D', description: 'hoàn thành dịch vụ', objectCode: 'DV004', occurredAt: '2026-08-16T08:30:00Z', avatarTone: 'green' },
      { id: 5, actorName: 'Hoàng Văn E', description: 'hủy lịch hẹn', objectCode: 'LH005', occurredAt: '2026-08-16T08:00:00Z', avatarTone: 'orange' },
    ],
  };

  it('renders at most 3 recent activities even if more are provided', () => {
    render(<DashboardSide dashboard={baseDashboard} />);

    expect(screen.getByText('Hoạt động gần đây')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    expect(screen.getByText('Lê Văn C')).toBeInTheDocument();

    // 4th and 5th items should not be in the document
    expect(screen.queryByText('Phạm Thị D')).not.toBeInTheDocument();
    expect(screen.queryByText('Hoàng Văn E')).not.toBeInTheDocument();
  });

  it('renders empty message when no activities exist', () => {
    const emptyDashboard = {
      ...baseDashboard,
      activities: [],
    };

    render(<DashboardSide dashboard={emptyDashboard} />);
    expect(screen.getByText('Chưa có hoạt động gần đây.')).toBeInTheDocument();
  });
});
