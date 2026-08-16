import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { CustomerCreateDialog } from './CustomerCreateDialog';

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={testQueryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  );
}

describe('CustomerCreateDialog', () => {
  it('renders required customer fields and validates name', async () => {
    const onClose = vi.fn();
    renderWithClient(<CustomerCreateDialog onClose={onClose} />);

    expect(screen.getByText('Thêm khách hàng')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Bắt buộc')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tự động')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập số điện thoại')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập link Facebook')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: 'Lưu' });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Hãy nhập Tên khách hàng')).toBeInTheDocument();
  });

  it('submits form with entered values and calls onSuccess', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const mockCustomMutationFn = vi.fn().mockResolvedValue({
      data: {
        id: 101,
        code: 'KH000101',
        name: 'Nguyễn Văn A',
        phone: '0987654321',
      },
    });

    renderWithClient(
      <CustomerCreateDialog
        onClose={onClose}
        onSuccess={onSuccess}
        customMutationFn={mockCustomMutationFn}
      />
    );

    const nameInput = screen.getByPlaceholderText('Bắt buộc');
    fireEvent.change(nameInput, { target: { value: 'Nguyễn Văn A' } });

    const phoneInput = screen.getByPlaceholderText('Nhập số điện thoại');
    fireEvent.change(phoneInput, { target: { value: '0987654321' } });

    const submitBtn = screen.getByRole('button', { name: 'Lưu' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCustomMutationFn).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Nguyễn Văn A',
          phone: '0987654321',
          code: undefined,
          dob: null,
          gender: null,
          email: null,
          facebook: null,
        }),
        expect.anything()
      );
      expect(onSuccess).toHaveBeenCalledWith({
        id: 101,
        code: 'KH000101',
        name: 'Nguyễn Văn A',
        phone: '0987654321',
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
