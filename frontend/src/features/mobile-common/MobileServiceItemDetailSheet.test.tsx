import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  MobileServiceItemDetailSheet,
  type ConfiguredServiceItem,
} from './MobileServiceItemDetailSheet';

vi.mock('@/features/pos/pos.api', () => ({
  getPosStaff: vi.fn().mockResolvedValue({
    data: [
      { id: 1, name: 'Nguyễn Thu Trang', role: 'Kỹ thuật viên chính' },
      { id: 2, name: 'Lê Minh Anh', role: 'Kỹ thuật viên' },
      { id: 3, name: 'Trần Thảo', role: 'Chuyên viên Spa' },
    ],
  }),
}));

const mockStaffList = [
  { id: 1, name: 'Nguyễn Thu Trang', role: 'Kỹ thuật viên chính' },
  { id: 2, name: 'Lê Minh Anh', role: 'Kỹ thuật viên' },
  { id: 3, name: 'Trần Thảo', role: 'Chuyên viên Spa' },
];

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>
  );
}

describe('MobileServiceItemDetailSheet', () => {
  const sampleItem: ConfiguredServiceItem = {
    itemId: 101,
    itemType: 'service',
    name: 'Combo Chăm Sóc Da Chuyên Sâu',
    unitPrice: 2500000,
    quantity: 1,
    durationMinutes: 90,
    startsAt: new Date(2026, 7, 18, 14, 30), // Tue 18/08/2026 14:30
    staffId: null,
    staffName: null,
    position: null,
  };

  it('renders header, item info card, duration, quantity counter, and total price', () => {
    const onClose = vi.fn();
    const onSaveItem = vi.fn();

    renderWithClient(
      <MobileServiceItemDetailSheet
        isOpen={true}
        item={sampleItem}
        staffList={mockStaffList}
        onClose={onClose}
        onSaveItem={onSaveItem}
      />
    );

    expect(screen.getByText('Chi tiết lịch dịch vụ')).toBeInTheDocument();
    expect(screen.getByText('Combo Chăm Sóc Da Chuyên Sâu')).toBeInTheDocument();
    expect(screen.getByText(/Thời lượng: 1h30'/i)).toBeInTheDocument();
    expect(screen.getByText('Số lượng')).toBeInTheDocument();
    expect(screen.getByText('Thành tiền')).toBeInTheDocument();
    expect(screen.getByText(/2[.,]500[.,]000/i)).toBeInTheDocument();
    expect(screen.getByText('LỊCH LÀM DỊCH VỤ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /xong/i })).toBeInTheDocument();
  });

  it('updates quantity and recalculated total price when clicking + and - buttons', () => {
    const onClose = vi.fn();
    const onSaveItem = vi.fn();

    renderWithClient(
      <MobileServiceItemDetailSheet
        isOpen={true}
        item={sampleItem}
        staffList={mockStaffList}
        onClose={onClose}
        onSaveItem={onSaveItem}
      />
    );

    const plusBtn = screen.getByRole('button', { name: /tăng số lượng/i });
    fireEvent.click(plusBtn);

    // Quantity should now be 2, total should be 5,000,000
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/5[.,]000[.,]000/i)).toBeInTheDocument();

    const minusBtn = screen.getByRole('button', { name: /giảm số lượng/i });
    fireEvent.click(minusBtn);

    // Quantity returns to 1, total returns to 2,500,000
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/2[.,]500[.,]000/i)).toBeInTheDocument();
  });

  it('calculates and displays date pill and time range pill (startsAt to startsAt + duration)', () => {
    const onClose = vi.fn();
    const onSaveItem = vi.fn();

    renderWithClient(
      <MobileServiceItemDetailSheet
        isOpen={true}
        item={sampleItem}
        staffList={mockStaffList}
        onClose={onClose}
        onSaveItem={onSaveItem}
      />
    );

    // Starts at 14:30 + 90 mins = 16:00
    expect(screen.getByText(/14:30\s*-\s*16:00/)).toBeInTheDocument();
    // 18/08
    expect(screen.getByText(/18\/08/)).toBeInTheDocument();
  });

  it('opens staff picker sheet and assigns technician', async () => {
    const onClose = vi.fn();
    const onSaveItem = vi.fn();

    renderWithClient(
      <MobileServiceItemDetailSheet
        isOpen={true}
        item={sampleItem}
        staffList={mockStaffList}
        onClose={onClose}
        onSaveItem={onSaveItem}
      />
    );

    // Click on "Chọn nhân viên"
    const staffRow = screen.getByText('Chọn nhân viên');
    fireEvent.click(staffRow);

    // Staff picker is open
    await waitFor(() => {
      expect(screen.getByText('Nguyễn Thu Trang')).toBeInTheDocument();
    });

    // Select Nguyễn Thu Trang
    fireEvent.click(screen.getByText('Nguyễn Thu Trang'));

    // Verify staff row now shows assigned technician name
    expect(screen.getByText('Nguyễn Thu Trang')).toBeInTheDocument();
  });

  it('opens position selector sheet and selects a bed / room', async () => {
    const onClose = vi.fn();
    const onSaveItem = vi.fn();

    renderWithClient(
      <MobileServiceItemDetailSheet
        isOpen={true}
        item={sampleItem}
        staffList={mockStaffList}
        onClose={onClose}
        onSaveItem={onSaveItem}
      />
    );

    // Click on "Chọn vị trí"
    const positionRow = screen.getByText('Chọn vị trí');
    fireEvent.click(positionRow);

    // Preset positions should appear (e.g. Giường 1, Phòng VIP 1)
    await waitFor(() => {
      expect(screen.getByText('Giường 1')).toBeInTheDocument();
      expect(screen.getByText('Phòng VIP 1')).toBeInTheDocument();
    });

    // Click Giường 1
    fireEvent.click(screen.getByText('Giường 1'));

    // Position is updated
    expect(screen.getByText('Giường 1')).toBeInTheDocument();
  });

  it('saves configured service item and calls onClose when clicking [ Xong ]', () => {
    const onClose = vi.fn();
    const onSaveItem = vi.fn();

    renderWithClient(
      <MobileServiceItemDetailSheet
        isOpen={true}
        item={sampleItem}
        staffList={mockStaffList}
        onClose={onClose}
        onSaveItem={onSaveItem}
      />
    );

    // Increment quantity
    fireEvent.click(screen.getByRole('button', { name: /tăng số lượng/i }));

    // Click Xong
    fireEvent.click(screen.getByRole('button', { name: /xong/i }));

    expect(onSaveItem).toHaveBeenCalledTimes(1);
    const savedItem = onSaveItem.mock.calls[0][0];
    expect(savedItem.itemId).toBe(101);
    expect(savedItem.quantity).toBe(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking header back button', () => {
    const onClose = vi.fn();
    const onSaveItem = vi.fn();

    renderWithClient(
      <MobileServiceItemDetailSheet
        isOpen={true}
        item={sampleItem}
        staffList={mockStaffList}
        onClose={onClose}
        onSaveItem={onSaveItem}
      />
    );

    const backBtn = screen.getByRole('button', { name: /quay lại|đóng|back/i });
    fireEvent.click(backBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
