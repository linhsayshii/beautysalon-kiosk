import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { WebSocketProvider } from '@/context/WebSocketContext';
import { MobileInvoiceCreateView } from './MobileInvoiceCreateView';
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

describe('MobileInvoiceCreateView Component', () => {
  let queryClient: QueryClient;

  const mockCustomers = [
    {
      id: 201,
      code: 'KH00201',
      name: 'Lê Thị Mai',
      phone: '0987654321',
      debtBalance: 0,
      remainingPackageUnits: 5,
    },
    {
      id: 202,
      code: 'KH00202',
      name: 'Trần Thị B',
      phone: '0909000202',
      debtBalance: 0,
      remainingPackageUnits: 0,
    },
  ];

  const mockCatalog = [
    {
      itemId: 10,
      itemType: 'service',
      code: 'DV10',
      name: 'Chăm sóc da chuyên sâu',
      category: 'Chăm sóc da',
      unit: 'Lần',
      salePrice: 300000,
      stockQuantity: null,
    },
    {
      itemId: 11,
      itemType: 'product',
      code: 'SP11',
      name: 'Serum Dưỡng Ẩm HA',
      category: 'Mỹ phẩm',
      unit: 'Chai',
      salePrice: 250000,
      stockQuantity: 15,
    },
  ];

  const mockStaff = [
    { id: 1, name: 'Nguyễn Kỹ Thuật Viên 1', role: 'Kỹ thuật viên' },
    { id: 2, name: 'Trần Kỹ Thuật Viên 2', role: 'Kỹ thuật viên' },
  ];

  const mockServicePackages: posApi.ServicePackageOption[] = [
    {
      customerPackageId: 901,
      packageCode: 'PKG901',
      packageId: 91,
      packageName: 'Gói chăm sóc da 5 buổi',
      totalUnits: 5,
      usedUnits: 1,
      remainingUnits: 4,
      expiresAt: null,
      status: 'active',
      services: [
        {
          serviceId: 10,
          serviceName: 'Chăm sóc da chuyên sâu',
          serviceCode: 'DV10',
          totalUnits: 5,
          usedCount: 1,
          availableUnits: 4,
        },
      ],
    },
  ];

  const mockReceiptData: posApi.PosReceiptData = {
    id: 501,
    code: 'HD260816001',
    status: 'paid',
    subtotal: 300000,
    discount: 0,
    total: 300000,
    amountPaid: 300000,
    changeAmount: 0,
    paymentMethod: 'cash',
    salesChannel: 'salon',
    issuedAt: new Date().toISOString(),
    note: '',
    branch: {
      name: 'Chi nhánh Quận 1',
      address: '123 Nguyễn Trãi, Q.1, TP.HCM',
      phone: '0909000111',
    },
    customer: {
      id: 201,
      code: 'KH00201',
      name: 'Lê Thị Mai',
      phone: '0987654321',
    },
    staff: {
      id: 1,
      name: 'Nguyễn Kỹ Thuật Viên 1',
    },
    items: [
      {
        id: 1,
        code: 'DV10',
        name: 'Chăm sóc da chuyên sâu',
        unit: 'Lần',
        quantity: 1,
        unitPrice: 300000,
        lineTotal: 300000,
      },
    ],
  };

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

    vi.spyOn(posApi, 'getPosCustomerServicePackages').mockResolvedValue({
      data: [],
      meta: {} as any,
    });

    vi.spyOn(posApi, 'checkoutPosInvoice').mockResolvedValue({
      data: mockReceiptData,
      meta: {} as any,
    });
  });

  const renderComponent = () =>
    render(
      <WebSocketProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MemoryRouter>
              <MobileInvoiceCreateView />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </WebSocketProvider>
    );

  it('renders initial state with customer selection, item list trigger, payment methods, and checkout button', async () => {
    renderComponent();

    // Header title
    expect(screen.getByText('Tạo hóa đơn')).toBeInTheDocument();

    // Customer selection is required before checkout
    expect(screen.getByText('Chọn khách hàng')).toBeInTheDocument();

    // Item List trigger / empty state
    expect(screen.getByText('Chưa có dịch vụ, sản phẩm trong hóa đơn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm dịch vụ, sản phẩm' })).toBeInTheDocument();

    // Payment Methods
    expect(screen.getByText('Tiền mặt')).toBeInTheDocument();
    expect(screen.getByText('Chuyển khoản')).toBeInTheDocument();
    expect(screen.getByText('Quẹt thẻ')).toBeInTheDocument();
    expect(screen.getByText('Thẻ tài khoản')).toBeInTheDocument();

    // Checkout & Print button
    expect(screen.getByRole('button', { name: /Chốt & In hóa đơn/i })).toBeInTheDocument();
  });

  it('allows picking a registered customer from sheet and updates display', async () => {
    renderComponent();

    const customerRow = screen.getByText('Chọn khách hàng');
    fireEvent.click(customerRow);

    // Customer selection sheet appears
    await waitFor(() => {
      expect(screen.getByText('Lê Thị Mai')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Lê Thị Mai'));

    // Customer display updated
    await waitFor(() => {
      expect(screen.getByText('Lê Thị Mai')).toBeInTheDocument();
      expect(screen.getByText(/0987654321/)).toBeInTheDocument();
    });
    expect(posApi.getPosCustomerServicePackages).toHaveBeenCalledWith(201);
    expect(screen.queryByRole('dialog', { name: 'Sử dụng gói dịch vụ' })).not.toBeInTheDocument();
  });

  it('opens available service packages after customer selection and sends package redemption metadata at checkout', async () => {
    vi.spyOn(posApi, 'getPosCustomerServicePackages').mockResolvedValue({
      data: mockServicePackages,
      meta: {} as any,
    });
    renderComponent();

    fireEvent.click(screen.getByText('Chọn khách hàng'));
    await waitFor(() => expect(screen.getByText('Lê Thị Mai')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Lê Thị Mai'));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Sử dụng gói dịch vụ' })).toBeInTheDocument();
      expect(screen.getByText('Gói chăm sóc da 5 buổi')).toBeInTheDocument();
      expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Chăm sóc da chuyên sâu'));
    fireEvent.click(screen.getByRole('button', { name: 'Dùng gói' }));

    await waitFor(() => expect(screen.getByText('Chi tiết lịch dịch vụ')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));

    await waitFor(() => {
      expect(screen.getByText('Trừ gói: Gói chăm sóc da 5 buổi')).toBeInTheDocument();
      expect(screen.getByText('0đ / lần')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Chốt & In hóa đơn/i }));

    await waitFor(() => {
      expect(posApi.checkoutPosInvoice).toHaveBeenCalledWith(expect.objectContaining({
        customerId: 201,
        amountPaid: 0,
        lines: [expect.objectContaining({
          itemId: 10,
          itemType: 'service',
          quantity: 1,
          usePackageId: 901,
          usePackageServiceId: 10,
        })],
      }));
    });
  });

  it('removes package-redemption lines when the customer is changed', async () => {
    vi.spyOn(posApi, 'getPosCustomerServicePackages').mockImplementation(async (customerId) => ({
      data: customerId === 201 ? mockServicePackages : [],
      meta: {} as any,
    }));
    renderComponent();

    fireEvent.click(screen.getByText('Chọn khách hàng'));
    await waitFor(() => expect(screen.getByText('Lê Thị Mai')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Lê Thị Mai'));
    await waitFor(() => expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Chăm sóc da chuyên sâu'));
    fireEvent.click(screen.getByRole('button', { name: 'Dùng gói' }));
    await waitFor(() => expect(screen.getByText('Chi tiết lịch dịch vụ')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));
    await waitFor(() => expect(screen.getByText('Trừ gói: Gói chăm sóc da 5 buổi')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Lê Thị Mai'));
    await waitFor(() => expect(screen.getByText('Trần Thị B')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Trần Thị B'));

    await waitFor(() => {
      expect(screen.queryByText('Trừ gói: Gói chăm sóc da 5 buổi')).not.toBeInTheDocument();
      expect(screen.getByText('Chưa có dịch vụ, sản phẩm trong hóa đơn')).toBeInTheDocument();
    });
  });

  it('allows adding item from catalog, opens detail sheet, assigns staff and quantity, and renders configured line', async () => {
    renderComponent();

    // Tap Add Item
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ, sản phẩm' }));

    // Catalog opens
    await waitFor(() => {
      expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument();
    });

    // Select Item from Catalog
    fireEvent.click(screen.getByText('Chăm sóc da chuyên sâu'));

    // Detail sheet opens
    await waitFor(() => {
      expect(screen.getByText('Chi tiết lịch dịch vụ')).toBeInTheDocument();
    });

    // Tap Select Staff
    fireEvent.click(screen.getByText('Chọn nhân viên'));
    await waitFor(() => {
      expect(screen.getByText('Nguyễn Kỹ Thuật Viên 1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Nguyễn Kỹ Thuật Viên 1'));

    // Save in detail sheet
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));

    // Line is displayed in invoice view
    await waitFor(() => {
      expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument();
      expect(screen.getByText('Nguyễn Kỹ Thuật Viên 1')).toBeInTheDocument();
      const line = screen.getByText('300.000đ / Lần').closest('.mobile-form-item-card')!;
      expect(line.querySelector('.mobile-form-item-price')).toHaveTextContent('300.000đ');
    });
  });

  it('adds a product with its own unit and no service schedule', async () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ, sản phẩm' }));
    expect(await screen.findByText('250.000đ')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Serum Dưỡng Ẩm HA'));
    expect(await screen.findByText('Chi tiết hàng hóa')).toBeInTheDocument();
    expect(screen.queryByText('LỊCH LÀM DỊCH VỤ')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));
    expect(await screen.findByText('250.000đ / Chai')).toBeInTheDocument();
    expect(screen.queryByText(/cái, lần/)).not.toBeInTheDocument();
  });

  it('adds a product by scanning its barcode from the catalog sheet', async () => {
    vi.spyOn(posApi, 'findPosItemsByBarcode').mockResolvedValue([{
      itemId: 5, itemType: 'product', code: 'SP000005', barcode: '8930000000011', name: 'Serum Dưỡng Ẩm HA',
      category: 'Mỹ phẩm', unit: 'Chai', salePrice: 250000, stockQuantity: 3,
    }]);
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ, sản phẩm' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quét mã vạch' }));
    fireEvent.change(screen.getByLabelText('Hoặc nhập mã vạch'), { target: { value: '8930000000011' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Chi tiết hàng hóa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));
    expect(await screen.findByText('250.000đ / Chai')).toBeInTheDocument();
  });

  it('calculates total with discount and submits checkout with line-level staffId', async () => {
    renderComponent();

    // 1. Select Customer
    fireEvent.click(screen.getByText('Chọn khách hàng'));
    await waitFor(() => expect(screen.getByText('Lê Thị Mai')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Lê Thị Mai'));

    // 2. Add Item & assign staff
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ, sản phẩm' }));
    await waitFor(() => expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Chăm sóc da chuyên sâu'));

    await waitFor(() => expect(screen.getByText('Chi tiết lịch dịch vụ')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Chọn nhân viên'));
    await waitFor(() => expect(screen.getByText('Nguyễn Kỹ Thuật Viên 1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Nguyễn Kỹ Thuật Viên 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));

    // 3. Select Payment method
    fireEvent.click(screen.getByText('Chuyển khoản'));

    // 4. Set Discount
    const discountInput = screen.getByPlaceholderText('0');
    fireEvent.change(discountInput, { target: { value: '50000' } });

    // 5. Submit Checkout
    const checkoutBtn = screen.getByRole('button', { name: /Chốt & In hóa đơn/i });
    fireEvent.click(checkoutBtn);

    await waitFor(() => {
      expect(posApi.checkoutPosInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 201,
          discount: 50000,
          paymentMethod: 'bank_transfer',
          amountPaid: 250000,
          lines: [
            expect.objectContaining({
              itemId: 10,
              itemType: 'service',
              quantity: 1,
              staffId: 1,
            }),
          ],
        })
      );
    });

    // 6. Print Receipt dialog should open
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /HÓA ĐƠN THANH TOÁN/i })).toBeInTheDocument();
    });
  });
});
