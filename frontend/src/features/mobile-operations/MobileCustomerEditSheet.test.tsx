import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MobileCustomerEditSheet } from './MobileCustomerEditSheet';
import * as operationsApi from '@/features/operations/operations.api';

const mockCustomer = {
  id: 42,
  name: 'Nguyễn Thị Hoa',
  code: 'KH000042',
  phone: '0901234567',
  dob: '1995-08-15',
  gender: 'Nữ',
  group: 'Cá nhân',
  email: 'hoa.nguyen@example.com',
  facebook: 'fb.com/hoanguyen',
};

describe('MobileCustomerEditSheet', () => {
  const queryClient = new QueryClient();

  it('renders all customer fields correctly', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MobileCustomerEditSheet isOpen={true} customer={mockCustomer} onClose={vi.fn()} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Sửa thông tin khách hàng')).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên khách hàng/)).toHaveValue('Nguyễn Thị Hoa');
    expect(screen.getByLabelText(/Mã khách hàng/)).toHaveValue('KH000042');
    expect(screen.getByLabelText(/Số điện thoại/)).toHaveValue('0901234567');
    expect(screen.getByLabelText(/Ngày sinh/)).toHaveValue('1995-08-15');
    expect(screen.getByLabelText(/Email/)).toHaveValue('hoa.nguyen@example.com');
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });

  it('submits updated customer data successfully', async () => {
    const updateSpy = vi.spyOn(operationsApi, 'updateCustomer').mockResolvedValue({
      data: { id: 42, name: 'Nguyễn Thị Hoa (VIP)', code: 'KH000042' } as any,
      meta: {} as any,
    });
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <MobileCustomerEditSheet
          isOpen={true}
          customer={mockCustomer}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      </QueryClientProvider>
    );

    const nameInput = screen.getByLabelText(/Tên khách hàng/);
    fireEvent.change(nameInput, { target: { value: 'Nguyễn Thị Hoa (VIP)' } });

    const saveBtn = screen.getByRole('button', { name: 'Lưu' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          name: 'Nguyễn Thị Hoa (VIP)',
          code: 'KH000042',
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
