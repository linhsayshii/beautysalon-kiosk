import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { StatusBadge } from '@/components/data-display/Badges';
import { formatMoney } from '@/lib/format';
import { exportCsv } from '@/lib/export';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { getPayrollList, type PayrollPeriodListItem } from '../staff.api';
import { StaffPayrollDetailAccordion } from './StaffPayrollDetailAccordion';
import { StaffPayrollSheetView } from './StaffPayrollSheetView';
import './AttendanceTimekeeping.css';

export function StaffPayrollView() {
  const { notify } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [periodTypeFilter, setPeriodTypeFilter] = useState('monthly');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['draft', 'approved']);
  const [expandedPeriodId, setExpandedPeriodId] = useState<number | null>(null);
  const [viewingSheetPeriodId, setViewingSheetPeriodId] = useState<number | null>(null);

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(15);

  const query = useQuery({
    queryKey: ['staff-payroll', searchTerm, selectedStatuses, periodTypeFilter],
    queryFn: () =>
      getPayrollList({
        search: searchTerm,
        status: selectedStatuses,
        periodType: periodTypeFilter,
      }),
  });

  const rawRows = query.data?.data ?? [];
  const grandSummary = query.data?.summary ?? {
    totalNetSalary: 0,
    totalPaidAmount: 0,
    totalRemainingAmount: 0,
    totalCommission: 0,
  };

  const filteredRows = useMemo(() => {
    return rawRows.filter((row) => {
      if (!selectedStatuses.includes(row.status)) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return row.name.toLowerCase().includes(s) || row.code.toLowerCase().includes(s);
      }
      return true;
    });
  }, [rawRows, selectedStatuses, searchTerm]);

  const handleExportList = () => {
    if (!filteredRows.length) {
      notify('Thông báo', 'Không có bảng lương nào để xuất');
      return;
    }
    const exportRows = filteredRows.map((r) => ({
      code: r.code,
      name: r.name,
      periodType: r.periodType === 'monthly' ? 'Hàng tháng' : r.periodType === 'weekly' ? 'Hàng tuần' : 'Nửa tháng',
      startsOn: r.startsOn,
      endsOn: r.endsOn,
      totalNetSalary: r.totalNetSalary,
      totalPaidAmount: r.totalPaidAmount,
      totalRemainingAmount: r.totalRemainingAmount,
      status: r.status === 'draft' ? 'Tạm tính' : r.status === 'approved' ? 'Đã chốt lương' : r.status === 'cancelled' ? 'Đã hủy' : r.status,
    }));
    exportCsv(exportRows, 'danh-sach-bang-luong');
    notify('Thành công', 'Đã xuất file danh sách bảng lương');
  };

  // If currently viewing the full calculation sheet
  if (viewingSheetPeriodId !== null) {
    return (
      <StaffPayrollSheetView
        periodId={viewingSheetPeriodId}
        onBack={() => setViewingSheetPeriodId(null)}
      />
    );
  }

  return (
    <div className="attendance-page">
      <div className="attendance-container">
        {/* Main layout: Sidebar Filter (Left) + Table View (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, alignItems: 'start' }}>
          {/* =================================================================== */}
          {/* SIDEBAR FILTER (Chuẩn KiotViet)                                     */}
          {/* =================================================================== */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {/* Filter 1: Kỳ hạn trả lương */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: 8,
                }}
              >
                Kỳ hạn trả lương
              </label>
              <select
                value={periodTypeFilter}
                onChange={(e) => setPeriodTypeFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  background: '#fff',
                  color: '#334155',
                  outline: 'none',
                }}
              >
                <option value="monthly">Hàng tháng</option>
                <option value="weekly">Hàng tuần</option>
                <option value="semi_monthly">Nửa tháng</option>
              </select>
            </div>

            {/* Filter 2: Trạng thái */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: 10,
                }}
              >
                Trạng thái
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#334155' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes('creating')}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedStatuses([...selectedStatuses, 'creating']);
                      else setSelectedStatuses(selectedStatuses.filter((s) => s !== 'creating'));
                    }}
                  />
                  <span>Đang tạo</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes('draft')}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedStatuses([...selectedStatuses, 'draft']);
                      else setSelectedStatuses(selectedStatuses.filter((s) => s !== 'draft'));
                    }}
                  />
                  <span>Tạm tính</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes('approved')}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedStatuses([...selectedStatuses, 'approved']);
                      else setSelectedStatuses(selectedStatuses.filter((s) => s !== 'approved'));
                    }}
                  />
                  <span>Đã chốt lương</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes('cancelled')}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedStatuses([...selectedStatuses, 'cancelled']);
                      else setSelectedStatuses(selectedStatuses.filter((s) => s !== 'cancelled'));
                    }}
                  />
                  <span>Đã hủy</span>
                </label>
              </div>
            </div>
          </div>

          {/* =================================================================== */}
          {/* MAIN TABLE AREA (Danh sách bảng lương chuẩn KiotViet)                */}
          {/* =================================================================== */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
            }}
          >
            {/* Top Toolbar */}
            <div
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0f172a' }}>Bảng lương</h2>
                <div style={{ position: 'relative', minWidth: 260 }}>
                  <i
                    className="ph ph-magnifying-glass"
                    style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }}
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Theo mã, tên bảng lương"
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (rawRows.length > 0) {
                      setViewingSheetPeriodId(rawRows[0].id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: '1px solid #0052cc',
                    background: '#0052cc',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <i className="ph ph-plus" />
                  <span>Bảng tính lương</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportList}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
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

            {/* Table Content */}
            {query.isPending ? (
              <div style={{ padding: 40 }}>
                <LoadingState />
              </div>
            ) : query.error ? (
              <div style={{ padding: 40 }}>
                <ErrorState error={query.error} onRetry={() => query.refetch()} />
              </div>
            ) : !filteredRows.length ? (
              <div style={{ padding: 40 }}>
                <EmptyState message="Không tìm thấy bảng lương nào." />
              </div>
            ) : (
              <div className="table-scroll" style={{ width: '100%', overflowX: 'auto' }}>
                <table className="kiotviet-payroll-table">
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ width: 40, padding: '10px 12px', textAlign: 'center' }}>
                        <input type="checkbox" />
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Mã</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Tên</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Kỳ hạn trả</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Kỳ làm việc</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tổng lương</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Đã trả nhân viên</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Còn cần trả</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Trạng thái</th>
                    </tr>
                    {/* Header Grand Summary Row (Chuẩn KiotViet) */}
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', fontWeight: 700 }}>
                      <td colSpan={5} style={{ padding: '8px 12px' }} />
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0f172a' }}>
                        {formatMoney(grandSummary.totalNetSalary)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#059669' }}>
                        {formatMoney(grandSummary.totalPaidAmount)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#e11d48' }}>
                        {formatMoney(grandSummary.totalRemainingAmount)}
                      </td>
                      <td />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row: PayrollPeriodListItem) => {
                      const isExpanded = expandedPeriodId === row.id;
                      return (
                        <Fragment key={row.id}>
                          <tr
                            className="payroll-row"
                            onClick={() => setExpandedPeriodId(isExpanded ? null : row.id)}
                            style={{
                              borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9',
                              background: isExpanded ? '#f0f7ff' : '#ffffff',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            <td
                              style={{ textAlign: 'center', padding: '10px 12px' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input type="checkbox" />
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0052cc' }}>{row.code}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>{row.name}</td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>Hàng tháng</td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>
                              {new Date(row.startsOn).toLocaleDateString('vi-VN')} -{' '}
                              {new Date(row.endsOn).toLocaleDateString('vi-VN')}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                              {formatMoney(row.totalNetSalary)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                              {formatMoney(row.totalPaidAmount)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#e11d48', fontWeight: 600 }}>
                              {formatMoney(row.totalRemainingAmount)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <StatusBadge status={row.status} payroll />
                            </td>
                          </tr>

                          {/* Accordion Expanded Detail (Tab Thông tin, Tab Phiếu lương, Tab Lịch sử) */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={9} style={{ padding: 0 }}>
                                <StaffPayrollDetailAccordion
                                  periodId={row.id}
                                  onOpenSheetView={(id) => setViewingSheetPeriodId(id)}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Pagination Bar */}
            <div
              style={{
                padding: '12px 18px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 13,
                color: '#64748b',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  <option value={15}>15 bản ghi</option>
                  <option value={30}>30 bản ghi</option>
                  <option value={50}>50 bản ghi</option>
                </select>
              </div>

              <div>
                1 - {filteredRows.length} trong {filteredRows.length} bảng lương
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
