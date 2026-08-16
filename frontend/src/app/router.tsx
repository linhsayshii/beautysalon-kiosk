import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AdminLayout } from '@/layouts/AdminLayout/AdminLayout';
import { MobileAppLayout } from '@/layouts/MobileAppLayout/MobileAppLayout';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';

export const router = createBrowserRouter([
  { path: '/login', lazy: () => import('@/pages/login/LoginPage') },
  {
    path: '/m',
    element: <MobileAppLayout />,
    children: [
      { index: true, element: <Navigate to="/m/dashboard" replace /> },
      { path: 'dashboard', lazy: () => import('@/pages/dashboard/MobileDashboardPage') },
      { path: 'pos', lazy: () => import('@/pages/pos/MobilePosPage') },
      { path: 'invoices/new', lazy: () => import('@/pages/pos/MobileInvoiceCreatePage') },
      { path: 'appointments/new', lazy: () => import('@/pages/appointments/MobileAppointmentCreatePage') },
      { path: 'orders', lazy: () => import('@/pages/orders/MobileOrdersPage') },
      { path: 'customers', lazy: () => import('@/pages/customers/CustomersPage') },
      { path: 'staff', lazy: () => import('@/pages/staff/MobileStaffManagementPage') },
      { path: 'schedule', lazy: () => import('@/pages/staff/MobileStaffSchedulePage') },
      { path: 'salary', lazy: () => import('@/pages/staff/MobileStaffSalaryPage') },
      { path: 'attendance', lazy: () => import('@/pages/attendance/AttendanceScanPage') },
      { path: 'account', lazy: () => import('@/pages/account-settings/MobileAccountPage') },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', lazy: () => import('@/pages/dashboard/DashboardPage') },
      { path: 'pos', lazy: () => import('@/pages/pos/PosPage') },
      { path: 'orders', lazy: () => import('@/pages/orders/OrdersPage') },
      { path: 'customers', lazy: () => import('@/pages/customers/CustomersPage') },
      { path: 'customer-cards', lazy: () => import('@/pages/customer-cards/CustomerCardsPage') },
      { path: 'products', lazy: () => import('@/pages/products/ProductsPage') },
      { path: 'pricebooks', lazy: () => import('@/pages/pricebooks/PricebooksPage') },
      { path: 'purchase-orders', lazy: () => import('@/pages/purchase-orders/PurchaseOrdersPage') },
      { path: 'purchase-orders/new', lazy: () => import('@/pages/purchase-orders/PurchaseOrderCreatePage') },
      { path: 'staff', lazy: () => import('@/pages/staff/StaffListPage') },
      { path: 'staff/schedule', lazy: () => import('@/pages/staff/StaffSchedulePage') },
      { path: 'staff/attendance', lazy: () => import('@/pages/staff/StaffAttendancePage') },
      { path: 'staff/payroll', lazy: () => import('@/pages/staff/StaffPayrollPage') },
      { path: 'staff/commissions', lazy: () => import('@/pages/staff/StaffCommissionsPage') },
      { path: 'staff/settings', element: <Navigate to="/staff" replace /> },
      { path: 'staff/accounts', element: <Navigate to="/account/settings" replace /> },
      { path: 'attendance/qr', lazy: () => import('@/pages/attendance/AttendanceQrPage') },
      { path: 'attendance', lazy: () => import('@/pages/attendance/AttendanceScanPage') },
      { path: 'branches', element: <Navigate to="/account/settings" replace /> },
      { path: 'account/settings', lazy: () => import('@/pages/account-settings/AccountSettingsPage') },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
