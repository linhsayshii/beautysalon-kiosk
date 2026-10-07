import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { MobileAppointmentCreateView } from './MobileAppointmentCreateView';
import * as posApi from '@/features/pos/pos.api';
import * as AuthProvider from '@/features/auth/AuthProvider';

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
    vi.spyOn(AuthProvider, 'useAuth').mockReturnValue({
      account: {
        id: 1, branchId: 1, staffId: null, username: 'owner', displayName: 'Chủ cửa hàng', role: 'owner',
        branchName: 'Chi nhánh trung tâm', branchTimezone: 'Asia/Ho_Chi_Minh', staffCode: null, phone: '', email: '',
      },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchBranch: vi.fn(),
      updateLocalAccount: vi.fn(),
    });

    vi.spyOn(posApi, 'searchPosCustomers').mockResolvedValue({
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

    vi.spyOn(posApi, 'getPosCustomerServicePackages').mockResolvedValue({
      data: [],
      meta: {} as any,
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
    expect(screen.getByText('Tạo lịch hẹn')).toBeInTheDocument();

    // Card 1 rows
    expect(screen.getByText('Chọn khách hàng')).toBeInTheDocument();
    expect(screen.getByText(/Bắt đầu làm/i)).toBeInTheDocument();

    // Card 2: Empty items state
    expect(screen.getByText('Chưa có dịch vụ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm dịch vụ' })).toBeInTheDocument();

    // Card 3: Status pills
    expect(screen.getByText('Chờ xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Chờ phục vụ')).toBeInTheDocument();
    expect(screen.getByText('Đang chờ')).toBeInTheDocument();
    expect(screen.getByText('Đang làm')).toBeInTheDocument();
    expect(screen.getByText('Đã xong')).toBeInTheDocument();

    // Bottom action button
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });

  it('opens customer selection sheet, selects a customer, and updates customer display', async () => {
    renderComponent();

    const customerRow = screen.getByText('Chọn khách hàng');
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
    expect(screen.getByText('350.000đ')).toBeInTheDocument();

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
      expect(screen.getByText('350.000đ')).toBeInTheDocument();
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
    fireEvent.click(screen.getByText('Chọn khách hàng'));
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
      expect(mockNavigate).toHaveBeenCalledWith('/m/appointments');
    });
  });

  it('submits every configured service into the same appointment batch', async () => {
    renderComponent();

    fireEvent.click(screen.getByText('Chọn khách hàng'));
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

  it('stores a selected package service on the appointment draft without charging it', async () => {
    vi.spyOn(posApi, 'getPosCustomerServicePackages').mockResolvedValue({
      data: [{
        customerPackageId: 901,
        packageCode: 'PKG-901',
        packageId: 51,
        packageName: 'Gói chăm sóc da 5 buổi',
        totalUnits: 5,
        usedUnits: 1,
        remainingUnits: 4,
        expiresAt: null,
        status: 'active',
        services: [{
          serviceId: 1,
          serviceName: 'Chăm sóc da chuyên sâu',
          serviceCode: 'DV01',
          totalUnits: 5,
          usedCount: 1,
          availableUnits: 4,
        }],
      }],
      meta: {} as any,
    });
    renderComponent();

    fireEvent.click(screen.getByText('Chọn khách hàng'));
    await waitFor(() => expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Nguyễn Thị Hoa'));

    await waitFor(() => expect(screen.getByText('Sử dụng gói dịch vụ')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Chăm sóc da chuyên sâu'));
    fireEvent.click(screen.getByRole('button', { name: 'Dùng gói' }));

    await waitFor(() => expect(screen.getByText('Chi tiết lịch dịch vụ')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));

    await waitFor(() => expect(screen.getByText('Dùng gói: Gói chăm sóc da 5 buổi')).toBeInTheDocument());
    expect(screen.getByText('0đ')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => {
      expect(posApi.createPosAppointment).toHaveBeenCalledWith(expect.objectContaining({
        customerId: 101,
        items: [expect.objectContaining({
          serviceId: 1,
          quantity: 1,
          usePackageId: 901,
          usePackageServiceId: 1,
        })],
      }));
    });
  });
});
