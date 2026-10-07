import { useState, useMemo, Fragment, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { StatusBadge } from '@/components/data-display/Badges';
import { formatMoney } from '@/lib/format';
import { amountTone, owedTone } from '@/lib/tone';
import { exportCsv } from '@/lib/export';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { Select } from '@/components/ui/Select/Select';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { Pagination } from '@/components/data-display/Pagination';
import { appConfig } from '@/app/config';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getPayrollList, type PayrollPeriodListItem } from '../staff.api';
import { PAYROLL_PERIOD_TYPES, payrollPeriodTypeLabel } from '../payroll-labels';
import { StaffPayrollDetailAccordion } from './StaffPayrollDetailAccordion';
import { StaffPayrollSheetView } from './StaffPayrollSheetView';

export function StaffPayrollView() {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { subscribe } = useWebSocket();
  const [searchTerm, setSearchTerm] = useState('');
  const [periodTypeFilter, setPeriodTypeFilter] = useState('monthly');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['draft', 'approved']);
  const [expandedPeriodId, setExpandedPeriodId] = useState<number | null>(null);
  const [viewingSheetPeriodId, setViewingSheetPeriodId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = appConfig.defaultPageSize;

  const query = useQuery({
    queryKey: ['staff-payroll', searchTerm, selectedStatuses, periodTypeFilter],
    queryFn: () =>
      getPayrollList({
        search: searchTerm,
        status: selectedStatuses,
        periodType: periodTypeFilter,
      }),
  });

  // WebSocket subscription for live payroll updates
  useEffect(() => {
    const unsub = subscribe('payroll:*', () => {
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
      notify('Cập nhật', 'Dữ liệu bảng lương đã thay đổi');
    });
    return unsub;
  }, [subscribe, queryClient, notify]);

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
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportList = () => {
    if (!filteredRows.length) {
      notify('Thông báo', 'Không có bảng lương nào để xuất');
      return;
    }
    const exportRows = filteredRows.map((r) => ({
      code: r.code,
      name: r.name,
      periodType: payrollPeriodTypeLabel(r.periodType),
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

  const statusOptions = [
    { value: 'creating', label: 'Đang tạo' },
    { value: 'draft', label: 'Tạm tính' },
    { value: 'approved', label: 'Đã chốt lương' },
    { value: 'cancelled', label: 'Đã hủy' },
  ];
  const toggleStatus = (status: string, checked: boolean) =>
    setSelectedStatuses(checked ? [...selectedStatuses, status] : selectedStatuses.filter((s) => s !== status));

  return (
    <main className="page">
      <div className="page-stack">
        <PageHeader
          title="Bảng lương"
          subtitle="Tạo, chốt và chi trả lương theo kỳ cho toàn bộ nhân viên."
          extraActions={<>
            <button type="button" className="btn btn-secondary" onClick={handleExportList}>
              <i className="ph ph-file-arrow-up" />
              <span>Xuất file</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (rawRows.length > 0) setViewingSheetPeriodId(rawRows[0].id);
              }}
            >
              <i className="ph ph-plus" />
              <span>Bảng tính lương</span>
            </button>
          </>}
        />

        <div className="page-grid">
          <aside className="filter-panel">
            <h2>Bộ lọc bảng lương</h2>
            <div className="filter-group">
              <label>Kỳ hạn trả lương</label>
              <Select
                value={periodTypeFilter}
                onChange={setPeriodTypeFilter}
                variant="filter"
                fullWidth
                aria-label="Kỳ hạn trả lương"
                options={PAYROLL_PERIOD_TYPES}
              />
            </div>
            <fieldset className="filter-group">
              <legend className="field-label">Trạng thái</legend>
              {statusOptions.map((option) => (
                <label className="check-option" key={option.value}>
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(option.value)}
                    onChange={(e) => toggleStatus(option.value, e.target.checked)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
          </aside>

          <section className="data-panel">
            <SearchToolbar
              value={searchTerm}
              placeholder="Theo mã, tên bảng lương"
              onChange={setSearchTerm}
              onSearch={() => query.refetch()}
              onRefresh={() => query.refetch()}
            />

            {query.isPending ? (
              <LoadingState />
            ) : query.error ? (
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            ) : !filteredRows.length ? (
              <EmptyState message="Không tìm thấy bảng lương nào." />
            ) : (
              <div className="table-scroll">
                <table className="data-table payroll-table">
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Tên</th>
                      <th>Kỳ hạn trả</th>
                      <th>Kỳ làm việc</th>
                      <th className="is-num">Tổng lương</th>
                      <th className="is-num">Đã trả nhân viên</th>
                      <th className="is-num">Còn cần trả</th>
                      <th>Trạng thái</th>
                    </tr>
                    <tr className="table-summary-row">
                      <td colSpan={4} />
                      <td className="is-num">{formatMoney(grandSummary.totalNetSalary)}</td>
                      <td className={`is-num ${amountTone(grandSummary.totalPaidAmount)}`}>{formatMoney(grandSummary.totalPaidAmount)}</td>
                      <td className={`is-num ${owedTone(grandSummary.totalRemainingAmount)}`}>{formatMoney(grandSummary.totalRemainingAmount)}</td>
                      <td />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row: PayrollPeriodListItem) => {
                      const isExpanded = expandedPeriodId === row.id;
                      return (
                        <Fragment key={row.id}>
                          <tr
                            className={`payroll-row expandable-data-row ${isExpanded ? 'is-expanded' : ''}`}
                            onClick={() => setExpandedPeriodId(isExpanded ? null : row.id)}
                          >
                            <td data-label="Mã"><span className="cell-main link">{row.code}</span></td>
                            <td data-label="Tên" className="payroll-name"><span className="cell-main">{row.name}</span></td>
                            <td data-label="Kỳ hạn trả" className="text-muted payroll-period-type">{payrollPeriodTypeLabel(row.periodType)}</td>
                            <td data-label="Kỳ làm việc" className="text-muted numeric-cell">
                              {new Date(row.startsOn).toLocaleDateString('vi-VN')} - {new Date(row.endsOn).toLocaleDateString('vi-VN')}
                            </td>
                            <td data-label="Tổng lương" className={`is-num money-cell ${amountTone(row.totalNetSalary)}`}>{formatMoney(row.totalNetSalary)}</td>
                            <td data-label="Đã trả" className={`is-num money-cell ${amountTone(row.totalPaidAmount)}`}>{formatMoney(row.totalPaidAmount)}</td>
                            <td data-label="Còn cần trả" className={`is-num money-cell ${owedTone(row.totalRemainingAmount, 'text-muted')}`}>{formatMoney(row.totalRemainingAmount)}</td>
                            <td data-label="Trạng thái"><StatusBadge status={row.status} payroll /></td>
                          </tr>
                          {isExpanded && (
                            <tr className="expandable-detail-row">
                              <td colSpan={8}>
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

            {filteredRows.length > 0 && (
              <Pagination
                pagination={{ page: currentPage, pageSize, total: filteredRows.length, totalPages }}
                onChange={(nextPage) => { setExpandedPeriodId(null); setPage(nextPage); }}
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
