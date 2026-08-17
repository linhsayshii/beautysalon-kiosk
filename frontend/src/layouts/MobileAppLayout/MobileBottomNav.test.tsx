import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { MobileBottomNav } from './MobileBottomNav';
import * as auth from '@/features/auth/AuthProvider';

describe('MobileBottomNav Component', () => {
  it('renders correct navigation tabs and center action button for manager role', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Admin', branchId: 1, branchName: 'CN1', staffId: null, staffCode: null, phone: '', email: '', username: 'admin' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });

    render(<MemoryRouter><MobileBottomNav /></MemoryRouter>);
    expect(screen.getByText('Tổng quan')).toBeInTheDocument();
    expect(screen.getByText('Lịch dịch vụ')).toBeInTheDocument();
    expect(screen.getByText('Thông báo')).toBeInTheDocument();
    expect(screen.getByText('Nhiều hơn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tạo mới|action|quick action/i })).toBeInTheDocument();

    const overviewLink = screen.getByText('Tổng quan').closest('a');
    const appointmentsLink = screen.getByText('Lịch dịch vụ').closest('a');
    const notificationsLink = screen.getByText('Thông báo').closest('a');
    const moreLink = screen.getByText('Nhiều hơn').closest('a');

    expect(overviewLink).toHaveAttribute('href', '/m/dashboard');
    expect(appointmentsLink).toHaveAttribute('href', '/m/appointments');
    expect(notificationsLink).toHaveAttribute('href', '/m/notifications');
    expect(moreLink).toHaveAttribute('href', '/m/more');
  });

  it('renders correct navigation tabs for cashier role', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 3, role: 'cashier', displayName: 'Thu ngân', branchId: 1, branchName: 'CN1', staffId: null, staffCode: null, phone: '', email: '', username: 'cashier1' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });

    render(<MemoryRouter><MobileBottomNav /></MemoryRouter>);
    expect(screen.getByText('Bán hàng')).toBeInTheDocument();
    expect(screen.getByText('Đơn hàng')).toBeInTheDocument();
    expect(screen.getByText('Khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Tài khoản')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tạo mới|action|quick action/i })).toBeInTheDocument();
  });

  it('renders correct navigation tabs for staff role', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 2, role: 'staff', displayName: 'Thợ', branchId: 1, branchName: 'CN1', staffId: 10, staffCode: 'NV01', phone: '', email: '', username: 'staff1' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });

    render(<MemoryRouter><MobileBottomNav /></MemoryRouter>);
    expect(screen.getByText('Chấm công')).toBeInTheDocument();
    expect(screen.getByText('Lịch làm')).toBeInTheDocument();
    expect(screen.getByText('Lương')).toBeInTheDocument();
    expect(screen.getByText('Tài khoản')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tạo mới|action|quick action/i })).toBeInTheDocument();
  });

  it('opens quick action sheet when clicking center action button and displays action items', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Admin', branchId: 1, branchName: 'CN1', staffId: null, staffCode: null, phone: '', email: '', username: 'admin' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });

    render(<MemoryRouter><MobileBottomNav /></MemoryRouter>);

    // Quick action sheet should not be visible initially
    expect(screen.queryByText('Tạo lịch hẹn')).not.toBeInTheDocument();
    expect(screen.queryByText('Tạo hóa đơn bán hàng')).not.toBeInTheDocument();
    expect(screen.queryByText('Thêm khách hàng')).not.toBeInTheDocument();

    const centerActionBtn = screen.getByRole('button', { name: /tạo mới|action|quick action/i });
    fireEvent.click(centerActionBtn);

    // After clicking, action options should be displayed
    const appointmentLink = screen.getByText('Tạo lịch hẹn').closest('a');
    const invoiceLink = screen.getByText('Tạo hóa đơn bán hàng').closest('a');
    const customerLink = screen.getByText('Thêm khách hàng').closest('a');

    expect(appointmentLink).toHaveAttribute('href', '/m/appointments/new');
    expect(invoiceLink).toHaveAttribute('href', '/m/invoices/new');
    expect(customerLink).toHaveAttribute('href', '/m/customers?create=1');
  });
});
