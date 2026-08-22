import { Fragment, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AvatarName } from '@/components/data-display/AvatarName';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { StatusBadge } from '@/components/data-display/Badges';
import { SummaryStrip } from '@/components/data-display/SummaryStrip';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { exportCsv } from '@/lib/export';
import { formatMoney, formatNumber } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import { statusLabels } from '@/types/api';
import { getStaff } from '../staff.api';
import { StaffCreateDialog } from './StaffCreateDialog';
import { StaffDetail } from './StaffDetail';

export function StaffListView() {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingStaff, setEditingStaff] = useState<{ staff: ApiRecord; initialTab: 'info' | 'salary' } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const query = useQuery({ queryKey: ['staff', appliedSearch], queryFn: () => getStaff({ search: appliedSearch }) });
  const rows = query.data?.data ?? [];
  const revenue = rows.reduce((sum, row) => sum + Number(row.monthRevenue), 0);
  const orders = rows.reduce((sum, row) => sum + Number(row.monthOrders), 0);
  const visibleIds = rows.map((row) => String(row.id));
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected;
    }
  }, [allVisibleSelected, selectedVisibleCount]);

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySearch = () => {
    setAppliedSearch(search);
    setExpanded(null);
  };

  return <>
    <main className="workspace"><div className="workspace-shell">
      <PageHeader
        title="Danh sách nhân viên"
        subtitle="Hồ sơ, vai trò và hiệu quả làm việc trong tháng."
        actionLabel="Thêm nhân viên"
        onAction={() => setIsCreating(true)}
        extraActions={<button className="secondary-button" type="button" onClick={() => exportCsv(rows, 'staff')}><i className="ph ph-export" />Xuất file</button>}
      />
      <SummaryStrip items={[
        { label: 'Tổng nhân viên', value: formatNumber(rows.filter((row) => row.active).length), note: 'Đang hoạt động' },
        { label: 'Doanh thu tháng', value: formatMoney(revenue), note: 'Từ hóa đơn đã thu', tone: 'green' },
        { label: 'Số đơn phụ trách', value: formatNumber(orders), note: 'Trong tháng hiện tại', tone: 'violet' },
        { label: 'Doanh thu trung bình', value: formatMoney(rows.length ? revenue / rows.length : 0), note: 'Theo nhân viên', tone: 'orange' },
      ]} />
      <section className="data-panel">
        <SearchToolbar value={search} placeholder="Tìm mã, tên hoặc vai trò nhân viên" onChange={setSearch} onSearch={applySearch} onRefresh={() => query.refetch()} />
        {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState /> : <>
          <div className="table-scroll"><table className="data-table staff-list-table">
            <thead><tr>
              <th className="mobile-hide"><input ref={selectAllRef} className="table-checkbox" type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Chọn tất cả nhân viên" /></th>
              <th>Mã nhân viên</th><th>Nhân viên</th><th>Vai trò</th><th>Hình thức lương</th><th>Đơn tháng này</th><th>Doanh thu tháng</th><th>Trạng thái</th>
            </tr></thead>
            <tbody>{rows.map((row) => {
              const rowId = String(row.id);
              const isSelected = selectedIds.has(rowId);
              const isExpanded = expanded === rowId;
              const detailId = `staff-detail-${rowId}`;
              return <Fragment key={row.id}>
                <tr
                  className={`staff-data-row expandable-data-row ${isSelected ? 'is-selected' : ''} ${isExpanded ? 'is-expanded' : ''}`}
                  onClick={() => setExpanded((current) => current === rowId ? null : rowId)}
                  aria-expanded={isExpanded}
                  aria-controls={detailId}
                >
                  <td className="mobile-hide"><input className="table-checkbox" type="checkbox" checked={isSelected} onChange={() => toggleRowSelection(rowId)} onClick={(event) => event.stopPropagation()} aria-label={`Chọn ${row.name}`} /></td>
                  <td data-label="Mã nhân viên"><span className="cell-main link">{row.code}</span></td>
                  <td data-label="Nhân viên"><AvatarName name={row.name} subtitle={row.role} tone={row.avatarTone} /></td>
                  <td data-label="Vai trò">{row.role}</td>
                  <td data-label="Hình thức lương">{statusLabels[row.salaryType] ?? row.salaryType ?? '-'}</td>
                  <td data-label="Số đơn" className="numeric-cell">{formatNumber(row.monthOrders)}</td>
                  <td data-label="Doanh thu" className="money-cell">{formatMoney(row.monthRevenue)}</td>
                  <td data-label="Trạng thái"><StatusBadge status={row.active ? 'active' : 'cancelled'} /></td>
                </tr>
                {isExpanded && <tr id={detailId} className="staff-detail-row expandable-detail-row"><td colSpan={8}><StaffDetail staff={row} onEdit={(initialTab) => setEditingStaff({ staff: row, initialTab })} /></td></tr>}
              </Fragment>;
            })}</tbody>
          </table></div>
          <Pagination pagination={{ page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 }} onChange={() => { setExpanded(null); }} />
        </>}
      </section>
    </div></main>
    {isCreating && <StaffCreateDialog onClose={() => setIsCreating(false)} />}
    {editingStaff && <StaffCreateDialog staff={editingStaff.staff} initialTab={editingStaff.initialTab} onClose={() => setEditingStaff(null)} />}
  </>;
}
