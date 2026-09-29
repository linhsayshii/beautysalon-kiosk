import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderDetail } from './OrderDetail';
import * as operationsApi from '../operations.api';

vi.mock('../operations.api');

const mockOrder = {
  id: 1,
  code: 'HD000001',
  status: 'paid',
  subtotal: 500000,
  discount: 50000,
  total: 450000,
  paymentMethod: 'cash',
  salesChannel: 'salon',
  issuedAt: '2026-08-15T10:30:00.000Z',
  createdAt: '2026-08-15T10:00:00.000Z',
  branchName: 'Chi nhánh Quận 1',
  customer: {
    code: 'KH000001',
    name: 'Nguyễn Thị Hoa',
    phone: '0901234567',
  },
  staff: {
    code: 'NV001',
    name: 'Trần Văn Nhân',
  },
  items: [
    {
      id: 101,
      itemType: 'service',
      code: 'DV01',
      name: 'Chăm sóc da chuyên sâu',
      description: 'Gói liệu trình làm sạch sâu và cấp ẩm',
      unit: 'lần',
      quantity: 1,
      unitPrice: 500000,
      discount: 50000,
      lineTotal: 450000,
    },
  ],
};

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('OrderDetail Component', () => {
  it('renders 5-layer structure including tabs, profile head, value strip, and item details', async () => {
    vi.mocked(operationsApi.getOrder).mockResolvedValue({
      data: mockOrder,
    } as any);

    renderWithClient(<OrderDetail id={1} />);

    // Layer 2: Tabs check
    expect(await screen.findByRole('tab', { name: /Hàng hóa & Dịch vụ \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Thông tin hóa đơn/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Thanh toán & Công nợ/i })).toBeInTheDocument();

    // Layer 3: Profile head check
    expect(screen.getByText('HD000001')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
    expect(screen.getByText('(0901234567)')).toBeInTheDocument();
    expect(screen.getByText('Chi nhánh Quận 1')).toBeInTheDocument();
    expect(screen.getByText('Tại salon')).toBeInTheDocument();

    // Layer 4: Value strip check
    expect(screen.getAllByText(/Tổng tiền hàng:/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('500.000đ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Giảm giá:/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('50.000đ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Tổng thanh toán:/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('450.000đ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^Đã thanh toán$/i)).toBeInTheDocument();

    // Layer 5: Tab "Hàng hóa & Dịch vụ" table items check
    expect(screen.getByText('DV01')).toBeInTheDocument();
    expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument();
    expect(screen.getByText('Gói liệu trình làm sạch sâu và cấp ẩm')).toBeInTheDocument();
    expect(screen.getByText('1 lần')).toBeInTheDocument();

    // Switch to Tab "Thông tin hóa đơn"
    fireEvent.click(screen.getByRole('tab', { name: /Thông tin hóa đơn/i }));
    expect(screen.getByText('Nhân viên thực hiện')).toBeInTheDocument();
    expect(screen.getByText('Trần Văn Nhân')).toBeInTheDocument();
    expect(screen.getByText('Mã hóa đơn')).toBeInTheDocument();
    expect(screen.queryByText('Bàn / Phòng')).not.toBeInTheDocument();

    // Switch to Tab "Thanh toán & Công nợ"
    fireEvent.click(screen.getByRole('tab', { name: /Thanh toán & Công nợ/i }));
    expect(screen.getByText('Hình thức thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Tiền mặt')).toBeInTheDocument();
    expect(screen.getByText('Số tiền đã thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Công nợ ghi nhận')).toBeInTheDocument();
    expect(screen.getByText('0đ')).toBeInTheDocument();
    expect(screen.getByText('Trạng thái thu tiền')).toBeInTheDocument();
    expect(screen.getByText('Đã thanh toán đủ')).toBeInTheDocument();
  });

  it('shows the staff chosen on a POS line that has no appointment', async () => {
    vi.mocked(operationsApi.getOrder).mockResolvedValue({
      data: {
        ...mockOrder,
        staff: null,
        items: [{ ...mockOrder.items[0], staffId: 5, staffName: 'Hậu', appointment: null }],
      },
    } as any);

    renderWithClient(<OrderDetail id={1} />);

    expect(await screen.findByText('Hậu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Thông tin hóa đơn/i }));
    expect(screen.getByText('Hậu')).toBeInTheDocument();
    expect(screen.queryByText('Chưa xác định')).not.toBeInTheDocument();
  });
  it('shows the invoice note as a note, not as a table or room', async () => {
    vi.mocked(operationsApi.getOrder).mockResolvedValue({ data: { ...mockOrder, note: 'QA test hóa đơn nợ' } } as any);
    renderWithClient(<OrderDetail id={1} />);
    fireEvent.click(await screen.findByRole('tab', { name: /Thông tin hóa đơn/i }));
    expect(screen.getByText('Ghi chú').parentElement).toHaveTextContent('QA test hóa đơn nợ');
  });

  it('does not colour zero discounts red', async () => {
    vi.mocked(operationsApi.getOrder).mockResolvedValue({
      data: { ...mockOrder, discount: 0, items: [{ ...mockOrder.items[0], discount: 0 }] },
    } as any);
    renderWithClient(<OrderDetail id={1} />);
    const row = (await screen.findByText('Chăm sóc da chuyên sâu')).closest('tr')!;
    expect(row.querySelectorAll('td')[6]).not.toHaveClass('text-danger');
    const total = screen.getByText(/^Giảm giá:/).querySelector('strong')!;
    expect(total).not.toHaveClass('text-danger');
  });
});
