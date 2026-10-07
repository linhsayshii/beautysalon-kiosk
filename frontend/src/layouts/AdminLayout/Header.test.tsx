import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as auth from '@/features/auth/AuthProvider';
import { Header } from './Header';

vi.mock('@/services/metadata', () => ({ useStoreName: () => 'Anna Chill Beauty' }));

function renderAs(role: 'manager' | 'cashier' | 'staff') {
  vi.spyOn(auth, 'useAuth').mockReturnValue({
    account: { id: 1, role, displayName: 'Yến', branchId: 1, branchName: 'Trung tâm', staffId: 3, staffCode: 'NV3', phone: '', email: '', username: role },
    loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
  } as unknown as ReturnType<typeof auth.useAuth>);
  return render(<MemoryRouter><Header /></MemoryRouter>);
}

describe('desktop header', () => {
  it('gives staff a link to the customers they are allowed to manage', () => {
    renderAs('staff');
    expect(screen.getByRole('link', { name: 'Mở khách hàng' })).toHaveAttribute('href', '/customers');
  });
  it('does not show the customers link to cashiers, who cannot open it', () => {
    renderAs('cashier');
    expect(screen.queryByRole('link', { name: 'Mở khách hàng' })).not.toBeInTheDocument();
  });
});
