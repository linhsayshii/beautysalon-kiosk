import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { MobileBottomNav } from './MobileBottomNav';
import * as auth from '@/features/auth/AuthProvider';

describe('MobileBottomNav Component', () => {
  it('renders correct navigation tabs for manager role', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Admin', branchId: 1, branchName: 'CN1', staffId: null, staffCode: null, phone: '', email: '', username: 'admin' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });

    render(<MemoryRouter><MobileBottomNav /></MemoryRouter>);
    expect(screen.getByText('Tổng quan')).toBeInTheDocument();
    expect(screen.getByText('Bán hàng')).toBeInTheDocument();
    expect(screen.getByText('Đơn hàng')).toBeInTheDocument();
    expect(screen.getByText('Nhân sự')).toBeInTheDocument();
    expect(screen.getByText('Cài đặt')).toBeInTheDocument();
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
  });
});
