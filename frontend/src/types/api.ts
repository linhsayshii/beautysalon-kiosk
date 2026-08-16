export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ApiRecord = Record<string, any>;

export const statusLabels: Record<string, string> = {
  paid: 'Đã thanh toán', draft: 'Nháp', refunded: 'Đã hoàn', cancelled: 'Đã hủy',
  active: 'Đang sử dụng', completed: 'Đã dùng hết', expired: 'Hết hạn',
  depleted: 'Đã dùng hết',
  present: 'Đúng giờ', late: 'Đi muộn', leave: 'Nghỉ phép', absent: 'Vắng mặt', working: 'Đang làm',
  approved: 'Đã duyệt', pending: 'Chờ duyệt', scheduled: 'Đã xếp lịch', confirmed: 'Đã xác nhận',
  cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', card: 'Thẻ', wallet: 'Ví điện tử', mixed: 'Kết hợp',
  monthly: 'Theo ngày công chuẩn', hourly: 'Theo giờ làm việc', shift: 'Theo ca',
  product: 'Sản phẩm', service: 'Dịch vụ', package: 'Gói dịch vụ',
  account_card: 'Thẻ tài khoản',
  in_stock: 'Còn hàng', low: 'Dưới định mức', out: 'Hết hàng', inactive: 'Ngừng kinh doanh',
  with_debt: 'Đang có nợ', no_debt: 'Không có nợ',
};
