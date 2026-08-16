export interface NavigationItem { label: string; to?: string; icon?: string; tone?: string }
export interface NavigationGroup { key: string; label: string; to?: string; items?: NavigationItem[] }

export const navigation: NavigationGroup[] = [
  { key: 'dashboard', label: 'Tổng quan', to: '/dashboard' },
  { key: 'products', label: 'Hàng hóa', items: [
    { label: 'Danh sách hàng hóa', to: '/products', icon: 'ph-package', tone: 'blue' },
    { label: 'Thiết lập giá', to: '/pricebooks', icon: 'ph-tag', tone: 'violet' },
    { label: 'Nhập hàng', to: '/purchase-orders', icon: 'ph-truck', tone: 'green' },
  ] },
  { key: 'orders', label: 'Đơn hàng', to: '/orders' },
  { key: 'customers', label: 'Khách hàng', items: [
    { label: 'Khách hàng', to: '/customers', icon: 'ph-users', tone: 'blue' },
    { label: 'Gói, thẻ đã bán', to: '/customer-cards', icon: 'ph-cards-three', tone: 'violet' },
  ] },
  { key: 'staff', label: 'Nhân viên', items: [
    { label: 'Danh sách nhân viên', to: '/staff', icon: 'ph-identification-card', tone: 'blue' },
    { label: 'Lịch làm việc', to: '/staff/schedule', icon: 'ph-calendar-dots', tone: 'sky' },
    { label: 'Bảng chấm công', to: '/staff/attendance', icon: 'ph-clock-user', tone: 'mint' },
    { label: 'Bảng lương', to: '/staff/payroll', icon: 'ph-money', tone: 'orange' },
    { label: 'Bảng hoa hồng', to: '/staff/commissions', icon: 'ph-chart-line-up', tone: 'pink' },
  ] },
];
