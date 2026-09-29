import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import * as AuthProvider from '@/features/auth/AuthProvider';
import { AccountSettingsView } from './AccountSettingsView';

vi.mock('@/components/ui/Toast/ToastProvider', () => ({ useToast: () => ({ notify: vi.fn() }) }));

describe('AccountSettingsView', () => {
  it('accepts new passwords from 8 characters, as the server does', () => {
    vi.spyOn(AuthProvider, 'useAuth').mockReturnValue({
      account: { id: 1, username: 'staff', displayName: 'Yến', role: 'staff', branchId: 1, branchName: 'Trung tâm' },
      loading: false, login: vi.fn(), logout: vi.fn(), switchBranch: vi.fn(), updateLocalAccount: vi.fn(),
    } as unknown as ReturnType<typeof AuthProvider.useAuth>);
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}><MemoryRouter><AccountSettingsView /></MemoryRouter></QueryClientProvider>,
    );
    const inputs = [...container.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]')];
    expect(inputs).toHaveLength(2);
    expect(inputs.map((input) => input.minLength)).toEqual([8, 8]);
  });
});
