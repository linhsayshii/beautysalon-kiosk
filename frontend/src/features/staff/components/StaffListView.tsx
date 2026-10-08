import { Fragment, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AvatarName } from '@/components/data-display/AvatarName';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { SummaryStrip } from '@/components/data-display/SummaryStrip';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { exportCsv } from '@/lib/export';
import { formatMoney, formatNumber } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import { statusLabels } from '@/types/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getStaff } from '../staff.api';
import { StaffCreateDialog } from './StaffCreateDialog';
import { StaffDetail } from './StaffDetail';
import { amountTone } from '@/lib/tone';

export function StaffListView() {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingStaff, setEditingStaff] = useState<{ staff: ApiRecord; initialTab: 'info' | 'salary' } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { subscribe } = useWebSocket();
  const query = useQuery({ queryKey: ['staff', appliedSearch], queryFn: () => getStaff({ search: appliedSearch }) });
  const rows = query.data?.data ?? [];
  const revenue = rows.reduce((sum, row) => sum + Number(row.monthRevenue), 0);
  const orders = rows.reduce((sum, row) => sum + Number(row.monthOrders), 0);

  useEffect(() => {
    const unsub = subscribe(['staff:created', 'staff:updated'], () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
    });
    return unsub;
  }, [subscribe, queryClient]);

  const applySearch = () => {
    setAppliedSearch(search);
    setExpanded(null);
  };

  return <>
    <main className="page"><div className="page-stack">
      <PageHeader
        title="Danh sách nhân viên"
        subtitle="Hồ sơ, vai trò và hiệu quả làm việc trong tháng."
        actionLabel="Thêm nhân viên"
        onAction={() => setIsCreating(true)}
        extraActions={<button className="btn btn-secondary" type="button" onClick={() => exportCsv(rows, 'staff')}><i className="ph ph-export" />Xuất file</button>}
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
              <th>Mã nhân viên</th><th>Nhân viên</th><th>Vai trò</th><th>Hình thức lương</th><th>Đơn tháng này</th><th>Doanh thu tháng</th><th>Trạng thái</th>
            </tr></thead>
            <tbody>{rows.map((row) => {
              const rowId = String(row.id);
              const isExpanded = expanded === rowId;
              const detailId = `staff-detail-${rowId}`;
              return <Fragment key={row.id}>
                <tr
                  className={`staff-data-row expandable-data-row ${isExpanded ? 'is-expanded' : ''}`}
                  onClick={() => setExpanded((current) => current === rowId ? null : rowId)}
                  aria-expanded={isExpanded}
                  aria-controls={detailId}
                >
                  <td data-label="Mã nhân viên"><span className="cell-main link">{row.code}</span></td>
                  <td data-label="Nhân viên"><AvatarName name={row.name} tone={row.avatarTone} /></td>
                  <td data-label="Vai trò">{row.role}</td>
                  <td data-label="Hình thức lương">{statusLabels[row.salaryType] ?? row.salaryType ?? '-'}</td>
                  <td data-label="Số đơn" className={`numeric-cell ${amountTone(row.monthOrders)}`}>{formatNumber(row.monthOrders)}</td>
                  <td data-label="Doanh thu" className={`money-cell ${amountTone(row.monthRevenue)}`}>{formatMoney(row.monthRevenue)}</td>
                  {/* Working is the normal state, so only a stopped profile gets a badge. */}
                  <td data-label="Trạng thái">{row.active ? <span className="text-muted">Đang hoạt động</span> : <span className="badge badge-neutral">Ngừng hoạt động</span>}</td>
                </tr>
                {isExpanded && <tr id={detailId} className="staff-detail-row expandable-detail-row"><td colSpan={7}><StaffDetail staff={row} onEdit={(initialTab) => setEditingStaff({ staff: row, initialTab })} /></td></tr>}
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
