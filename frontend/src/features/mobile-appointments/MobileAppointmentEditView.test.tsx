import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { MobileAppointmentCreateView } from './MobileAppointmentCreateView';
import * as posApi from '@/features/pos/pos.api';
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ account: { branchTimezone: 'Asia/Ho_Chi_Minh' } }) }));

describe('Mobile appointment editor', () => {
  it('loads the existing group and saves its IDs, quantity, package, times and individual statuses', async () => {
    const items = [
      { appointmentId: 11, itemId: 1, itemType: 'service', name: 'Lăn kim tái tạo', quantity: 2, unitPrice: 1800000, durationMinutes: 90, startsAt: '2026-09-15T10:00:00Z', staffId: 2, staffName: 'Em Huệ', status: 'confirmed', note: 'Buổi đầu' },
      { appointmentId: 12, itemId: 2, itemType: 'service', name: 'Gội đầu', quantity: 1, unitPrice: 0, durationMinutes: 60, startsAt: '2026-09-16T10:00:00Z', staffId: 2, staffName: 'Em Huệ', usePackageId: 9, usePackageServiceId: 2, packageName: 'Gói gội đầu', status: 'waiting', note: 'Buổi sau' },
    ];
    vi.spyOn(posApi, 'getPosAppointmentEditor').mockResolvedValue({ data: { invoiceId: 4, invoiceCode: 'HD04', invoiceStatus: 'draft', customer: { id: 1, name: 'Hoàng Khánh Linh' }, startsAt: items[0].startsAt, status: 'confirmed', note: 'Buổi đầu', items }, meta: {} });
    vi.spyOn(posApi, 'getPosCatalog').mockResolvedValue({ data: [], meta: {} });
    vi.spyOn(posApi, 'getPosStaff').mockResolvedValue({ data: [], meta: {} });
    vi.spyOn(posApi, 'getPosCustomerServicePackages').mockResolvedValue({ data: [], meta: {} });
    const save = vi.spyOn(posApi, 'savePosAppointmentEditor').mockResolvedValue({ data: { appointments: [{id:11},{id:12}] }, meta: {} });
    const create = vi.spyOn(posApi, 'createPosAppointment');
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ToastProvider><MemoryRouter initialEntries={['/m/appointments/11/edit']}><Routes>
      <Route path="/m/appointments/:id/edit" element={<MobileAppointmentCreateView />} /><Route path="/m/appointments" element={<div>Đã về lịch dịch vụ</div>} />
    </Routes></MemoryRouter></ToastProvider></QueryClientProvider>);
    await screen.findByText('Hoàng Khánh Linh');
    expect(screen.getByText('Sửa lịch hẹn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Lưu thay đổi'}));
    await waitFor(() => expect(save).toHaveBeenCalledWith(11, expect.objectContaining({ customerId: 1, items: [
      expect.objectContaining({ appointmentId:11, serviceId:1, quantity:2, status:'confirmed', startsAt:'2026-09-15T10:00:00.000Z', endsAt:'2026-09-15T11:30:00.000Z' }),
      expect.objectContaining({ appointmentId:12, serviceId:2, usePackageId:9, usePackageServiceId:2, status:'waiting', note:'Buổi sau' }),
    ] })));
    expect(create).not.toHaveBeenCalled();
    expect(await screen.findByText('Đã về lịch dịch vụ')).toBeInTheDocument();
  });
});
