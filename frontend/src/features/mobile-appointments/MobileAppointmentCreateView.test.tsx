import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { MobileAppointmentCreateView } from './MobileAppointmentCreateView';
import * as posApi from '@/features/pos/pos.api';
import * as opsApi from '@/features/operations/operations.api';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('MobileAppointmentCreateView Component', () => {
  let queryClient: QueryClient;

  const mockCustomers = [
    {
      id: 101,
      code: 'KH001',
      name: 'Nguyễn Thị Hoa',
      phone: '0901234567',
      debtBalance: 0,
      remainingPackageUnits: 3,
    },
  ];

  const mockCatalog = [
    {
      itemId: 1,
      itemType: 'service',
      code: 'DV01',
      name: 'Chăm sóc da chuyên sâu',
      category: 'Chăm sóc da',
      unit: 'Lần',
      salePrice: 350000,
      stockQuantity: null,
    },
    {
      itemId: 2,
      itemType: 'service',
      code: 'DV02',
      name: 'Gội đầu dưỡng sinh',
      category: 'Gội đầu',
      unit: 'Lần',
      salePrice: 150000,
      stockQuantity: null,
    },
  ];

  const mockStaff = [
    { id: 1, name: 'Trần Kỹ Thuật 1', role: 'Kỹ thuật viên' },
    { id: 2, name: 'Lê Kỹ Thuật 2', role: 'Kỹ thuật viên' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(opsApi, 'getCustomers').mockResolvedValue({
      data: mockCustomers as any,
      meta: { pagination: { total: 1, page: 1, pageSize: 50, totalPages: 1 }, summary: {} } as any,
    });

    vi.spyOn(posApi, 'getPosCatalog').mockResolvedValue({
      data: mockCatalog as any,
      meta: {} as any,
    });

    vi.spyOn(posApi, 'getPosStaff').mockResolvedValue({
      data: mockStaff as any,
      meta: { total: 2 } as any,
    });

    vi.spyOn(posApi, 'createPosAppointment').mockResolvedValue({
      data: { id: 999 } as any,
      meta: {} as any,
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <MobileAppointmentCreateView />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

  it('renders initial empty state with header, customer trigger, time trigger, empty items placeholder, and status pills', async () => {
    renderComponent();

    // Header
    expect(screen.getByText('Tạo lịch')).toBeInTheDocument();

    // Card 1 rows
    expect(screen.getByText('Thêm khách hàng')).toBeInTheDocument();
    expect(screen.getByText(/Bắt đầu làm/i)).toBeInTheDocument();

    // Card 2: Empty items state
    expect(screen.getByText('Chưa có dịch vụ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm dịch vụ' })).toBeInTheDocument();

    // Card 3: Status pills
    expect(screen.getByText('Chờ xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Chưa tới')).toBeInTheDocument();
    expect(screen.getByText('Đang chờ')).toBeInTheDocument();
    expect(screen.getByText('Đang làm')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thành')).toBeInTheDocument();

    // Bottom action button
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });

  it('opens customer selection sheet, selects a customer, and updates customer display', async () => {
    renderComponent();

    const customerRow = screen.getByText('Thêm khách hàng');
    fireEvent.click(customerRow);

    // Customer sheet opens
    await waitFor(() => {
      expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nguyễn Thị Hoa'));

    // Customer is selected
    await waitFor(() => {
      expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
      expect(screen.getByText('0901234567')).toBeInTheDocument();
    });
  });

  it('opens catalog modal when clicking add service, selects an item, configures it in detail sheet and displays configured line item', async () => {
    renderComponent();

    // Click add item
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ' }));

    // Catalog modal should show items
    await waitFor(() => {
      expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument();
    });

    // Tap on item from catalog
    fireEvent.click(screen.getByText('Chăm sóc da chuyên sâu'));

    // Opens detail sheet
    await waitFor(() => {
      expect(screen.getByText('Chi tiết lịch dịch vụ')).toBeInTheDocument();
    });

    // Save in detail sheet
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));

    // Now item should be shown in Card 2 (non-empty state)
    await waitFor(() => {
      expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument();
      expect(screen.getByText('350.000')).toBeInTheDocument();
    });
  });

  it('allows changing status selection to different pills', async () => {
    renderComponent();

    const inServicePill = screen.getByText('Đang làm');
    fireEvent.click(inServicePill);

    expect(inServicePill.closest('.mobile-form-status-pill')).toHaveClass('is-active');
  });

  it('creates appointment when clicking save with valid customer and service item', async () => {
    renderComponent();

    // 1. Select Customer
    fireEvent.click(screen.getByText('Thêm khách hàng'));
    await waitFor(() => expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Nguyễn Thị Hoa'));

    // 2. Add Service
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ' }));
    await waitFor(() => expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Chăm sóc da chuyên sâu'));

    await waitFor(() => expect(screen.getByText('Chi tiết lịch dịch vụ')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));

    // 3. Click Save
    const saveBtn = screen.getByRole('button', { name: 'Lưu' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(posApi.createPosAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 101,
          items: [expect.objectContaining({ serviceId: 1 })],
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  it('submits every configured service into the same appointment batch', async () => {
    renderComponent();

    fireEvent.click(screen.getByText('Thêm khách hàng'));
    await waitFor(() => expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Nguyễn Thị Hoa'));

    fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ' }));
    await waitFor(() => expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Chăm sóc da chuyên sâu'));
    await waitFor(() => expect(screen.getByText('Chi tiết lịch dịch vụ')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));

    fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ' }));
    await waitFor(() => expect(screen.getByText('Gội đầu dưỡng sinh')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Gội đầu dưỡng sinh'));
    await waitFor(() => expect(screen.getByText('Chi tiết lịch dịch vụ')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));

    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => {
      expect(posApi.createPosAppointment).toHaveBeenCalledWith(expect.objectContaining({
        customerId: 101,
        items: [
          expect.objectContaining({ serviceId: 1, quantity: 1 }),
          expect.objectContaining({ serviceId: 2, quantity: 1 }),
        ],
      }));
    });
  });
});
