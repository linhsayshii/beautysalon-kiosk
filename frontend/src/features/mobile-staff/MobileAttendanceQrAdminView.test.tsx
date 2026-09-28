import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import QRCode from 'qrcode';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import * as attendanceApi from '@/features/attendance/attendance.api';
import { MobileAttendanceQrAdminView } from './MobileAttendanceQrAdminView';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn() },
}));

vi.mock('@/services/metadata', () => ({
  useStoreName: () => 'AnnaChill Beauty',
}));

describe('MobileAttendanceQrAdminView', () => {
  beforeEach(() => {
    vi.spyOn(attendanceApi, 'getAttendanceChallenge').mockResolvedValue({
      data: { token: 'attendance-token', expiresAt: new Date(Date.now() + 15_000).toISOString() },
    } as any);
    vi.spyOn(attendanceApi, 'getAttendanceLocation').mockResolvedValue({
      data: { name: 'Chi nhánh Quận 1', latitude: 10.7768, longitude: 106.7009, radiusMeters: 100 },
    } as any);
    vi.mocked(QRCode.toDataURL).mockResolvedValue('data:image/png;base64,qr-code');
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--ink-950');
  });

  it('renders the generated QR image using a canvas-compatible hex colour', async () => {
    document.documentElement.style.setProperty('--ink-950', '#111827');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ToastProvider>
            <MobileAttendanceQrAdminView />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Mã QR chấm công cửa hàng' })).toHaveAttribute('src', 'data:image/png;base64,qr-code');
    });

    expect(QRCode.toDataURL).toHaveBeenCalledWith('attendance-token', expect.objectContaining({
      color: { dark: '#111827', light: '#ffffff' },
    }));
  });

  it('falls back to black when the ink token is not a hex colour', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ToastProvider>
            <MobileAttendanceQrAdminView />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(QRCode.toDataURL).toHaveBeenCalledWith('attendance-token', expect.objectContaining({
        color: { dark: '#000000', light: '#ffffff' },
      }));
    });
  });
});
