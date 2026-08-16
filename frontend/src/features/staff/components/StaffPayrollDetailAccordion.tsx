import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { LoadingState } from '@/components/data-display/DataState';
import { StatusBadge } from '@/components/data-display/Badges';
import { exportCsv } from '@/lib/export';
import { getPayrollDetail, recalculatePayroll, cancelPayroll } from '../staff.api';
import { StaffPayrollPaymentModal } from './StaffPayrollPaymentModal';

interface StaffPayrollDetailAccordionProps {
  periodId: number;
  onOpenSheetView: (periodId: number) => void;
}

type PayrollTab = 'info' | 'records' | 'payments';

export function StaffPayrollDetailAccordion({ periodId, onOpenSheetView }: StaffPayrollDetailAccordionProps) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PayrollTab>('info');
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
  const records = detail.records || [];
  const payments = detail.payments || [];
  const summary = detail.summary || {
    totalStaff: 0,
    totalBaseSalary: 0,
    totalOvertimeSalary: 0,
    totalAllowance: 0,
    totalBonus: 0,
    totalCommission: 0,
    totalDeduction: 0,
    totalIncome: 0,
    totalNetSalary: 0,
    totalPaidAmount: 0,
    totalRemainingAmount: 0,
  };

  const handleExport = () => {
    if (records.length === 0) {
      notify('Thông báo', 'Không có dữ liệu phiếu lương để xuất');
      return;
    }
    const exportRows = records.map((r) => ({
      code: r.code,
      staffCode: r.staff.code,
      staffName: r.staff.name,
      role: r.staff.role,
      baseSalary: r.baseSalary,
      overtimeSalary: r.overtimeSalary,
      allowance: r.allowance,
      bonus: r.bonus,
      commission: r.commission,
      deduction: r.deduction,
      totalIncome: r.totalIncome,
      netSalary: r.netSalary,
      paidAmount: r.paidAmount,
      remainingAmount: r.remainingAmount,
    }));
    exportCsv(exportRows, `bang-luong-${period.code}`);
    notify('Thành công', 'Đã xuất file bảng lương');
  };

  return (
    <div
      className="payroll-accordion-container"
      style={{
        background: '#ffffff',
        borderTop: '2px solid #0052cc',
        borderBottom: '1px solid #cbd5e1',
        padding: 0,
        width: '100%',
      }}
    >
      {/* Layer 2: Inline Detail Tabs */}
      <div
        className="inline-detail-tabs"
        role="tablist"
        aria-label={`Chi tiết bảng lương ${period.code}`}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'info'}
          className={activeTab === 'info' ? 'is-active' : ''}
          onClick={() => setActiveTab('info')}
        >
          Thông tin
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'records'}
          className={activeTab === 'records' ? 'is-active' : ''}
          onClick={() => setActiveTab('records')}
        >
          Phiếu lương ({records.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'payments'}
          className={activeTab === 'payments' ? 'is-active' : ''}
          onClick={() => setActiveTab('payments')}
        >
          Lịch sử thanh toán ({payments.length})
        </button>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Layer 3: Profile Head */}
        <div
          className="payroll-profile-head staff-profile-head"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              className="payroll-profile-avatar staff-profile-avatar"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#e0f2fe',
                color: '#0052cc',
                fontSize: 24,
                flexShrink: 0,
              }}
            >
              <i className="ph ph-money" />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 16, color: '#1e293b' }}>{period.name}</strong>
                <StatusBadge status={period.status} />
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
                <span>Mã bảng lương: </span>
                <strong style={{ color: '#0052cc' }}>{period.code}</strong>
                <span style={{ color: '#64748b' }}> • Hàng tháng</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
            <div>
              Người tạo: <strong style={{ color: '#1e293b' }}>{period.creatorName || 'Hệ thống'}</strong>
            </div>
            <div>
              Kỳ làm việc: {formatDate(period.startsOn)} - {formatDate(period.endsOn)}
            </div>
          </div>
        </div>

        {/* Layer 4: 4-Column Value Strip */}
        <div
          className="payroll-value-strip staff-value-strip"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            background: '#f8fafc',
            padding: 12,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          <div>
            <span style={{ color: '#64748b' }}>Tổng số nhân viên: </span>
            <strong style={{ color: '#1e293b' }}>{formatNumber(summary.totalStaff)}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Tổng tiền lương: </span>
            <strong style={{ color: '#0052cc' }}>{formatMoney(summary.totalNetSalary)}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Đã chi trả: </span>
            <strong style={{ color: '#059669' }}>{formatMoney(summary.totalPaidAmount)}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Còn cần trả: </span>
            <strong style={{ color: '#e11d48' }}>{formatMoney(summary.totalRemainingAmount)}</strong>
          </div>
        </div>

        {/* Layer 5: Tab Content */}

        {/* TAB 1: THÔNG TIN */}
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
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Mã bảng lương:</span>
                <strong style={{ color: '#0052cc' }}>{period.code}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Tên bảng lương:</span>
                <strong style={{ color: '#1e293b' }}>{period.name}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Kỳ hạn trả:</span>
                <strong style={{ color: '#1e293b' }}>Hàng tháng</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Kỳ làm việc:</span>
                <strong style={{ color: '#1e293b' }}>
                  {formatDate(period.startsOn)} - {formatDate(period.endsOn)}
                </strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Ngày tạo:</span>
                <strong style={{ color: '#1e293b' }}>{formatDateTime(period.createdAt)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Người tạo:</span>
                <strong style={{ color: '#1e293b' }}>{period.creatorName || 'Auto'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Người lập bảng:</span>
                <strong style={{ color: '#1e293b' }}>{period.creatorName || 'Auto'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Trạng thái:</span>
                <div>
                  <StatusBadge status={period.status} />
                </div>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Phạm vi áp dụng:</span>
                <strong style={{ color: '#1e293b' }}>Tất cả nhân viên</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Người chốt lương:</span>
                <strong style={{ color: '#1e293b' }}>{period.approvedByName || '-'}</strong>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Ghi chú:</span>
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
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                {period.status === 'draft' && (
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
                      color: '#ef4444',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    <i className="ph ph-trash" />
                    <span>Hủy bỏ</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Dữ liệu được cập nhật vào: {formatDateTime(period.updatedDataAt || period.createdAt)}{' '}
                  <i className="ph ph-info" />
                </span>

                {period.status === 'draft' && (
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
                      color: '#0052cc',
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
                    background: '#0052cc',
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
                  onClick={handleExport}
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
          <div style={{ width: '100%' }}>
            <div className="table-scroll" style={{ width: '100%', overflowX: 'auto', maxHeight: 380 }}>
              <table className="kiotviet-payroll-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Mã phiếu</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tên nhân viên</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Lương chính</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Phụ cấp / Hoa hồng</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Tổng thu nhập</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Đã trả NV</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Còn cần trả</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => {
                    const allowanceAndCommission = (rec.allowance || 0) + (rec.commission || 0) + (rec.bonus || 0);
                    return (
                      <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#0052cc', fontWeight: 600 }}>{rec.code}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontWeight: 600, color: '#0052cc' }}>{rec.staff.name}</span>
                          {rec.staff.role && (
                            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 6 }}>({rec.staff.role})</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          {formatMoney(rec.baseSalary)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>
                          {formatMoney(allowanceAndCommission)}
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
                    );
                  })}
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
                  background: '#0052cc',
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
          <div style={{ width: '100%' }}>
            {!payments.length ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                Chưa có giao dịch thanh toán nào trong kỳ lương này.
              </div>
            ) : (
              <div className="table-scroll" style={{ width: '100%', overflowX: 'auto' }}>
                <table className="kiotviet-payroll-table" style={{ width: '100%' }}>
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
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0052cc' }}>{p.staff.name}</td>
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal thanh toán chi trả lương */}
      {isPaymentModalOpen && (
        <StaffPayrollPaymentModal periodDetail={detail} onClose={() => setIsPaymentModalOpen(false)} />
      )}
    </div>
  );
}

