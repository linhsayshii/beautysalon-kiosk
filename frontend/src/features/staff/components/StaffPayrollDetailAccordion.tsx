import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatDateTime, formatMoney } from '@/lib/format';
import { LoadingState } from '@/components/data-display/DataState';
import { getPayrollDetail, recalculatePayroll, cancelPayroll } from '../staff.api';
import { StaffPayrollPaymentModal } from './StaffPayrollPaymentModal';

interface StaffPayrollDetailAccordionProps {
  periodId: number;
  onOpenSheetView: (periodId: number) => void;
}

export function StaffPayrollDetailAccordion({ periodId, onOpenSheetView }: StaffPayrollDetailAccordionProps) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'info' | 'records' | 'payments'>('info');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['staff-payroll-detail', periodId],
    queryFn: () => getPayrollDetail(periodId),
  });

  const detail = data?.data;

  const recalcMutation = useMutation({
    mutationFn: () => recalculatePayroll(periodId),
    onSuccess: (res) => {
      notify('Thành công', res.message || 'Đã tải lại và cập nhật dữ liệu bảng lương');
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
      queryClient.invalidateQueries({ queryKey: ['staff-payroll-detail', periodId] });
    },
    onError: (err: any) => {
      notify('Lỗi', err.message || 'Không thể tải lại dữ liệu bảng lương');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelPayroll(periodId),
    onSuccess: (res) => {
      notify('Đã hủy', res.message || 'Đã hủy bảng lương');
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
      queryClient.invalidateQueries({ queryKey: ['staff-payroll-detail', periodId] });
    },
    onError: (err: any) => {
      notify('Lỗi', err.message || 'Không thể hủy bảng lương');
    },
  });

  if (isLoading) {
    return (
      <div style={{ padding: 24, background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <LoadingState />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div style={{ padding: 24, background: '#f8fafc', color: '#ef4444', borderTop: '1px solid #e2e8f0' }}>
        Không thể tải chi tiết bảng lương.
      </div>
    );
  }

  const period = detail.period;
  const records = detail.records;
  const payments = detail.payments;
  const summary = detail.summary;

  return (
    <div
      className="payroll-accordion-container"
      style={{
        background: '#ffffff',
        borderTop: '2px solid #0284c7',
        borderBottom: '1px solid #cbd5e1',
        padding: '16px 20px',
      }}
    >
      {/* Tab Navigation */}
      <div
        className="payroll-tabs-header"
        style={{
          display: 'flex',
          gap: 24,
          borderBottom: '1px solid #e2e8f0',
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('info')}
          style={{
            padding: '8px 4px',
            fontWeight: activeTab === 'info' ? 700 : 500,
            color: activeTab === 'info' ? '#0284c7' : '#64748b',
            borderBottom: activeTab === 'info' ? '2px solid #0284c7' : '2px solid transparent',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Thông tin
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('records')}
          style={{
            padding: '8px 4px',
            fontWeight: activeTab === 'records' ? 700 : 500,
            color: activeTab === 'records' ? '#0284c7' : '#64748b',
            borderBottom: activeTab === 'records' ? '2px solid #0284c7' : '2px solid transparent',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Phiếu lương ({records.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          style={{
            padding: '8px 4px',
            fontWeight: activeTab === 'payments' ? 700 : 500,
            color: activeTab === 'payments' ? '#0284c7' : '#64748b',
            borderBottom: activeTab === 'payments' ? '2px solid #0284c7' : '2px solid transparent',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Lịch sử thanh toán ({payments.length})
        </button>
      </div>

      {/* TAB 1: THÔNG TIN (2 Cột chuẩn KiotViet) */}
      {activeTab === 'info' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px 24px',
              fontSize: 14.5,
              color: '#334155',
              paddingBottom: 16,
            }}
          >
            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Mã:</div>
              <div style={{ fontWeight: 600 }}>{period.code}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Tên:</div>
              <div style={{ fontWeight: 600 }}>{period.name}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Kỳ hạn trả:</div>
              <div>Hàng tháng</div>
            </div>
            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Kỳ làm việc:</div>
              <div>
                {new Date(period.startsOn).toLocaleDateString('vi-VN')} -{' '}
                {new Date(period.endsOn).toLocaleDateString('vi-VN')}
              </div>
            </div>

            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Ngày tạo:</div>
              <div>{formatDateTime(period.createdAt)}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Người tạo:</div>
              <div>{period.creatorName || 'Auto'}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Người lập bảng:</div>
              <div>{period.creatorName || 'Auto'}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Trạng thái:</div>
              <div style={{ fontWeight: 600 }}>
                {period.status === 'draft' && <span style={{ color: '#d97706' }}>Tạm tính</span>}
                {period.status === 'approved' && <span style={{ color: '#059669' }}>Đã chốt lương</span>}
                {period.status === 'cancelled' && <span style={{ color: '#ef4444' }}>Đã hủy</span>}
              </div>
            </div>

            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Tổng số nhân viên:</div>
              <div style={{ fontWeight: 600 }}>{summary.totalStaff}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Tổng lương:</div>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>{formatMoney(summary.totalNetSalary)}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Đã trả nhân viên:</div>
              <div style={{ fontWeight: 600, color: '#059669' }}>{formatMoney(summary.totalPaidAmount)}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Còn cần trả:</div>
              <div style={{ fontWeight: 600, color: '#e11d48' }}>{formatMoney(summary.totalRemainingAmount)}</div>
            </div>

            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Phạm vi áp dụng:</div>
              <div>Tất cả nhân viên</div>
            </div>
            <div>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Người chốt lương:</div>
              <div>{period.approvedByName || '-'}</div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ color: '#64748b', marginBottom: 2 }}>Ghi chú:</div>
              <div style={{ fontStyle: period.note ? 'normal' : 'italic', color: period.note ? '#334155' : '#94a3b8' }}>
                {period.note || 'Ghi chú...'}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 16,
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <div>
              {period.status !== 'approved' && period.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Bạn có chắc chắn muốn hủy bảng lương này không?')) {
                      cancelMutation.mutate();
                    }
                  }}
                  className="btn-icon-text"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#64748b',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <i className="ph ph-trash" />
                  <span>Hủy bỏ</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Dữ liệu được cập nhật vào: {formatDateTime(period.updatedDataAt || period.createdAt)}{' '}
                <i className="ph ph-info" />
              </span>

              {period.status !== 'approved' && (
                <button
                  type="button"
                  disabled={recalcMutation.isPending}
                  onClick={() => recalcMutation.mutate()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#0284c7',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <i className={`ph ph-arrow-clockwise ${recalcMutation.isPending ? 'ph-spin' : ''}`} />
                  <span>{recalcMutation.isPending ? 'Đang tính lại...' : 'Tải lại dữ liệu'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenSheetView(period.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <i className="ph ph-check-square" />
                <span>Xem bảng lương</span>
              </button>

              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <i className="ph ph-file-arrow-up" />
                <span>Xuất file</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PHIẾU LƯƠNG NHÂN VIÊN */}
      {activeTab === 'records' && (
        <div>
          <div style={{ overflowX: 'auto', maxHeight: 320 }}>
            <table className="kiotviet-payroll-table">
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Mã phiếu</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tên nhân viên</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Tổng lương</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Đã trả NV</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Còn cần trả</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', color: '#0284c7', fontWeight: 600 }}>{rec.code}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontWeight: 600, color: '#0284c7' }}>{rec.staff.name}</span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                      {formatMoney(rec.netSalary)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#059669' }}>
                      {formatMoney(rec.paidAmount)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#e11d48', fontWeight: 600 }}>
                      {formatMoney(rec.remainingAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              paddingTop: 14,
              borderTop: '1px solid #e2e8f0',
              marginTop: 12,
            }}
          >
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#0284c7',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <i className="ph ph-credit-card" />
              <span>Thanh toán</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: LỊCH SỬ THANH TOÁN */}
      {activeTab === 'payments' && (
        <div style={{ overflowX: 'auto' }}>
          {!payments.length ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              Chưa có giao dịch thanh toán nào trong kỳ lương này.
            </div>
          ) : (
            <table className="kiotviet-payroll-table">
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Thời gian</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Nhân viên nhận</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Số tiền</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Hình thức</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Người chi</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px' }}>{formatDateTime(p.paidAt)}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0284c7' }}>{p.staff.name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                      {formatMoney(p.amount)}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {p.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>{p.actorName || 'Quản lý'}</td>
                    <td style={{ padding: '8px 12px', color: '#64748b' }}>{p.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal thanh toán chi trả lương */}
      {isPaymentModalOpen && (
        <StaffPayrollPaymentModal periodDetail={detail} onClose={() => setIsPaymentModalOpen(false)} />
      )}
    </div>
  );
}
